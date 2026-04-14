import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AdAccount } from '../types/database';

const STORAGE_KEY = 'adbrief_selected_account';

interface UseAccountReturn {
  accounts: AdAccount[];
  currentAccount: AdAccount | null;
  setCurrentAccount: (account: AdAccount) => void;
  isLoading: boolean;
}

export function useAccount(): UseAccountReturn {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [currentAccount, setCurrentAccountState] = useState<AdAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: userdata, error: userError } = await supabase.auth.getUser();
      if (userError || !userdata.user) {
        throw userError || new Error('Not authenticated');
      }

      // Fetch ad_accounts for current user
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('*')
        .eq('user_id', userdata.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAccounts(data || []);

      // Restore selected account from localStorage or pick first one
      const savedAccountId = localStorage.getItem(STORAGE_KEY);
      if (savedAccountId && data) {
        const saved = data.find((a) => a.id === savedAccountId);
        if (saved) {
          setCurrentAccountState(saved);
          return;
        }
      }

      // Default to first account if available
      if (data && data.length > 0) {
        setCurrentAccountState(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setAccounts([]);
      setCurrentAccountState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const setCurrentAccount = useCallback((account: AdAccount) => {
    setCurrentAccountState(account);
    localStorage.setItem(STORAGE_KEY, account.id);
  }, []);

  return {
    accounts,
    currentAccount,
    setCurrentAccount,
    isLoading,
  };
}
