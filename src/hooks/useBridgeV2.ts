import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BridgeResult {
  ok: boolean;
  v2_account_id?: string;
  engine?: {
    total?: number;
    kill_count?: number;
    fix_count?: number;
    scale_count?: number;
    pattern_count?: number;
  };
  error?: string;
}

/**
 * Hook to bridge v1 platform_connections → v2 decision engine.
 * Call `bridge()` to sync Meta data into v2 tables, compute baselines,
 * and run the decision engine in one shot.
 */
export function useBridgeV2() {
  const [isBridging, setIsBridging] = useState(false);
  const [result, setResult] = useState<BridgeResult | null>(null);

  const bridge = useCallback(async (userId: string, personaId: string): Promise<BridgeResult> => {
    try {
      setIsBridging(true);
      const { data, error } = await supabase.functions.invoke('bridge-v2', {
        body: { user_id: userId, persona_id: personaId },
      });

      if (error) {
        const r: BridgeResult = { ok: false, error: error.message };
        setResult(r);
        return r;
      }

      const r: BridgeResult = {
        ok: true,
        v2_account_id: data?.v2_account_id,
        engine: data?.engine,
      };
      setResult(r);
      return r;
    } catch (err) {
      const r: BridgeResult = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      setResult(r);
      return r;
    } finally {
      setIsBridging(false);
    }
  }, []);

  return { bridge, isBridging, result };
}
