/**
 * useHubCredits — saldo de créditos do usuário + custo previsto de uma ação.
 *
 * Duas coisas que reduzem suporte e churn:
 *   1. O usuário vê o saldo antes de gerar.
 *   2. O usuário vê quanto a próxima geração vai custar.
 *
 * O saldo autoritativo vem da RPC `hub_credit_balance`. O frontend nunca
 * decide se pode gerar — isso é do servidor. Aqui é só exibição e um aviso
 * antecipado de saldo insuficiente.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCost, getPlan, type CreditAction, type HubPlan } from "@/lib/hubPlans";

export interface HubCreditsState {
  balance: number;
  planCredits: number;
  packCredits: number;
  used: number;
  plan: HubPlan;
  loading: boolean;
  /** Saldo suficiente pra ação? Checagem otimista — o servidor confirma. */
  canAfford: (action: CreditAction, units?: number) => boolean;
  costOf: (action: CreditAction, units?: number) => number;
  reload: () => Promise<void>;
}

export function useHubCredits(): HubCreditsState {
  const [balance, setBalance] = useState(0);
  const [planCredits, setPlanCredits] = useState(0);
  const [packCredits, setPackCredits] = useState(0);
  const [used, setUsed] = useState(0);
  const [planKey, setPlanKey] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: bal }, { data: profile }] = await Promise.all([
        (supabase.rpc("hub_credit_balance" as any, { p_user: user.id }) as any),
        (supabase.from("profiles" as any).select("plan").eq("id", user.id).maybeSingle() as any),
      ]);

      const row = Array.isArray(bal) ? bal[0] : bal;
      if (row) {
        setBalance(Number(row.balance) || 0);
        setPlanCredits(Number(row.plan_credits) || 0);
        setPackCredits(Number(row.pack_credits) || 0);
        setUsed(Number(row.used) || 0);
      }
      if (profile?.plan) setPlanKey(profile.plan as string);
    } catch (e) {
      console.error("[useHubCredits]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Qualquer geração bem-sucedida dispara este evento e o saldo se atualiza.
  useEffect(() => {
    const onSpent = () => { void load(); };
    window.addEventListener("hub-credits-spent", onSpent);
    return () => window.removeEventListener("hub-credits-spent", onSpent);
  }, [load]);

  const costOf = useCallback(
    (action: CreditAction, units = 1) => getCost(action, units), []);

  const canAfford = useCallback(
    (action: CreditAction, units = 1) => balance >= getCost(action, units), [balance]);

  return {
    balance, planCredits, packCredits, used,
    plan: getPlan(planKey),
    loading, canAfford, costOf, reload: load,
  };
}

/** Dispare após qualquer geração pra atualizar o saldo em todas as telas. */
export function notifyCreditsSpent() {
  window.dispatchEvent(new CustomEvent("hub-credits-spent"));
}
