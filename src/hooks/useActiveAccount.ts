/**
 * useActiveAccount — resolves the active Meta ad account for the Copilot Feed
 *
 * Chain: persona → platform_connections → selected Meta ad account → ad_accounts (v2)
 *
 * If the v2 `ad_accounts` row doesn't exist, it auto-creates it by calling
 * an upsert so the decision engine can reference it.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveAccount {
  /** v2 ad_accounts UUID — used for decisions, money_tracker queries */
  id: string;
  /** Meta ad account ID (e.g. "act_123456") */
  metaAccountId: string;
  /** Human-readable name */
  name: string;
  /** Currency code */
  currency: string;
  /** Access token from platform_connections */
  accessToken: string;
  /** All available Meta ad accounts for this persona */
  allAccounts: MetaAdAccount[];
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status?: number;
}

interface UseActiveAccountReturn {
  account: ActiveAccount | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  switchAccount: (metaAccountId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useActiveAccount(
  userId: string | undefined,
  personaId: string | null
): UseActiveAccountReturn {
  const [account, setAccount] = useState<ActiveAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevAccountRef = useRef<string | null>(null);
  const handlingEventRef = useRef(false);

  const resolve = useCallback(async () => {
    if (!userId || !personaId) {
      setAccount(null);
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Get platform_connections for this persona + meta
      const { data: connData, error: connErr } = await supabase.functions.invoke('meta-oauth', {
        body: { action: 'get_connections', user_id: userId },
      });

      if (connErr) throw new Error('Failed to load connections');

      type ConnRow = {
        platform: string;
        persona_id: string;
        status: string;
        selected_account_id?: string | null;
        ad_accounts?: MetaAdAccount[];
        access_token?: string;
      };
      const connections: ConnRow[] = (connData?.connections || []) as ConnRow[];
      const metaConn = connections.find(
        (c) => c.platform === 'meta' && c.persona_id === personaId && c.status === 'active'
      );

      if (!metaConn) {
        // No Meta connection for this persona
        setAccount(null);
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      setIsConnected(true);

      const adAccounts: MetaAdAccount[] = (metaConn.ad_accounts || []) as MetaAdAccount[];
      if (adAccounts.length === 0) {
        setAccount(null);
        setIsLoading(false);
        return;
      }

      // 2. Determine which account is selected
      const localSel = localStorage.getItem(`meta_sel_${personaId}`);
      const selectedId = metaConn.selected_account_id || localSel || adAccounts[0]?.id;
      const selectedMeta = adAccounts.find((a) => a.id === selectedId) || adAccounts[0];

      if (!selectedMeta) {
        setAccount(null);
        setIsLoading(false);
        return;
      }

      // 3. Ensure v2 ad_accounts row exists (upsert)
      // Note: metaConn.access_token may be undefined since get_connections
      // doesn't return it for security. The token is handled server-side
      // by sync-meta-data which falls back to platform_connections.
      const v2AccountId = await ensureV2Account(userId, selectedMeta);

      if (!v2AccountId) {
        setError('Failed to sync account');
        setAccount(null);
        setIsLoading(false);
        return;
      }

      const newAccount: ActiveAccount = {
        id: v2AccountId,
        metaAccountId: selectedMeta.id,
        name: selectedMeta.name || selectedMeta.id,
        currency: selectedMeta.currency || 'BRL',
        accessToken: metaConn.access_token,
        allAccounts: adAccounts,
      };
      setAccount(newAccount);

      // Dispatch event when the resolved account actually changed
      // so all listening components re-fetch their data.
      // Skip if we're already handling an incoming event (avoid infinite loop).
      if (prevAccountRef.current !== null && prevAccountRef.current !== v2AccountId && !handlingEventRef.current) {
        window.dispatchEvent(new CustomEvent('meta-account-changed', {
          detail: { personaId, accountId: selectedMeta.id },
        }));
      }
      prevAccountRef.current = v2AccountId;
    } catch (err) {
      console.error('[useActiveAccount]', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, personaId]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  // Listen for account changes from AccountsPage (e.g. switchAccount from another component)
  // Use handlingEventRef to avoid re-dispatching the event when we're already handling one
  useEffect(() => {
    const handler = () => {
      handlingEventRef.current = true;
      resolve().finally(() => { handlingEventRef.current = false; });
    };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, [resolve]);

  const switchAccount = useCallback(async (metaAccountId: string) => {
    if (!userId || !personaId) return;

    // Update platform_connections (off-schema for the generated types).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('platform_connections')
      .update({ selected_account_id: metaAccountId })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('platform', 'meta');

    localStorage.setItem(`meta_sel_${personaId}`, metaAccountId);

    // Re-resolve to get new v2 account
    await resolve();

    // Notify other components
    window.dispatchEvent(new CustomEvent('meta-account-changed', {
      detail: { personaId, accountId: metaAccountId },
    }));
  }, [userId, personaId, resolve]);

  return {
    account,
    isLoading,
    isConnected,
    error,
    switchAccount,
    refetch: resolve,
  };
}

/**
 * Ensures a v2 `ad_accounts` row exists for this Meta account.
 * Returns the v2 UUID.
 *
 * Exported so the OAuth callback can prepare the v2 row immediately
 * after OAuth success — sync-meta-data needs this UUID and we can't
 * wait for the dashboard hook to mount before kicking off sync.
 */
export async function ensureV2Account(
  userId: string,
  metaAccount: MetaAdAccount,
): Promise<string | null> {
  try {
    // Check if row already exists. ad_accounts is in the supabase schema
    // but the insert payload below has a few columns (timezone, total_*)
    // that aren't in the strict generated insert type — cast the client
    // once and narrow the result row.
    const { data: existing } = await supabase
      .from('ad_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('meta_account_id', metaAccount.id)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    // Create v2 ad_accounts row — token is backfilled server-side by sync-meta-data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertErr } = await (supabase as any)
      .from('ad_accounts')
      .insert({
        user_id: userId,
        meta_account_id: metaAccount.id,
        name: metaAccount.name || metaAccount.id,
        currency: metaAccount.currency || 'BRL',
        timezone: 'America/Sao_Paulo',
        status: 'active',
        total_ads_synced: 0,
        total_spend_30d: 0,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { code?: string; message?: string } | null };

    if (insertErr) {
      console.error('[ensureV2Account] insert error:', insertErr.message, insertErr.code);
      // Unique constraint race — row may exist now
      if (insertErr.code === '23505') {
        const { data: retry } = await supabase
          .from('ad_accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('meta_account_id', metaAccount.id)
          .maybeSingle();
        return retry?.id || null;
      }
      return null;
    }

    return created?.id || null;
  } catch (err) {
    console.error('[ensureV2Account]', err);
    return null;
  }
}
