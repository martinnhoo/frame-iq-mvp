/**
 * SidebarCreditsCard — saldo real do usuário (RPC hub_credit_balance via
 * useHubCredits). Sem números falsos: enquanto carrega mostra skeleton,
 * e se o saldo não vier, o card some em vez de inventar valor.
 *
 * O CTA de upgrade depende do NÍVEL do plano (slug real vindo do backend),
 * não do saldo. Quem já está no plano máximo vê apenas uma nota discreta.
 */
import { useNavigate } from "react-router-dom";
import { useHubCredits } from "@/hooks/useHubCredits";
import { hasUpgradeAvailable } from "@/lib/hubPlans";
import type { SidebarCopy } from "./sidebarConfig";

export function SidebarCreditsCard({ copy }: { copy: SidebarCopy }) {
  const navigate = useNavigate();
  const { balance, planCredits, packCredits, used, plan, loading } = useHubCredits();

  if (loading) {
    return (
      <div className="sb-credits" aria-busy="true">
        <div className="sb-credits-skeleton" style={{ width: "62%" }} />
        <div className="sb-credits-track" style={{ marginTop: 12 }} />
        <div className="sb-credits-skeleton" style={{ width: "100%", height: 32, marginTop: 12, borderRadius: 8 }} />
      </div>
    );
  }

  const total = planCredits + packCredits;
  if (!total && !balance) return null;

  const pctUsed = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const canUpgrade = hasUpgradeAvailable(plan.key);

  return (
    <div className="sb-credits">
      <div className="sb-credits-row">
        <span className="sb-credits-main">
          {balance.toLocaleString("pt-BR")} <span className="sb-credits-plan">· {plan.label}</span>
        </span>
        <span className="sb-credits-pct">{pctUsed}%</span>
      </div>
      <div
        className="sb-credits-track"
        role="progressbar"
        aria-valuenow={pctUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pctUsed}% ${copy.used}`}
      >
        <div className="sb-credits-fill" style={{ width: `${pctUsed}%` }} />
      </div>
      {canUpgrade ? (
        <button type="button" className="sb-credits-cta" onClick={() => navigate("/dashboard/plans")}>
          {copy.upgrade}
        </button>
      ) : (
        <button
          type="button"
          className="sb-credits-note"
          onClick={() => navigate("/dashboard/plans")}
        >
          {copy.maxPlan}
        </button>
      )}
    </div>
  );
}
