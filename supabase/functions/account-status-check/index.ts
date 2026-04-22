/**
 * account-status-check — Meta ad account-level health signals.
 *
 * Answers the questions a gestor de tráfego asks every morning:
 *   • Conta tá ativa ou bloqueada?
 *   • Tem saldo pra rodar?
 *   • Tem spend_cap batendo?
 *
 * Returns a structured `accountStatus` derived from Meta's /act_{id} endpoint:
 *   account_status:   1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW,
 *                     8=PENDING_SETTLEMENT, 9=IN_GRACE_PERIOD, 100=PENDING_CLOSURE,
 *                     101=CLOSED, 102=PENDING_REVIEW, 201=ANY_ACTIVE
 *   disable_reason:   0=NONE, 1=ADS_INTEGRITY_POLICY, 2=ADS_IP_REVIEW,
 *                     3=RISK_PAYMENT, 4=GRAY_ACCOUNT_SHUT_OFF, 5=ADS_AFC_REVIEW,
 *                     6=BUSINESS_INTEGRITY_RAR, 7=PERMANENT_CLOSE,
 *                     8=UNUSED_RESELLER_ACCOUNT, 9=UNUSED_ACCOUNT
 *   balance:          centavos remaining on prepaid accounts (if returned)
 *   spend_cap:        centavos — 0 or null = no cap
 *   amount_spent:     centavos spent this billing cycle
 *   currency
 *
 * We also synthesise a single `severity` ∈ {ok, warn, critical, unknown}
 * so the frontend can render the signal without re-encoding Meta's enum map.
 *
 * Caching: 15-minute server-side cache (balance can change mid-day, we don't
 * want to hammer Meta).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 15 * 60 * 1000;

type Severity = "ok" | "warn" | "critical" | "unknown";

interface AccountStatusResult {
  severity: Severity;
  message: string;
  /** Meta numeric account_status (1 = active). */
  account_status: number | null;
  /** Meta disable_reason (0 = none). */
  disable_reason: number | null;
  /** Centavos. Lifetime spend cap set by advertiser; 0/null = no cap. */
  spend_cap: number | null;
  /** Centavos spent against the cap in this billing cycle. */
  amount_spent: number | null;
  /** Centavos remaining on prepaid balance (if present). */
  balance: number | null;
  currency: string | null;
  /** Derived: spend_cap - amount_spent, or null when no cap. */
  cap_remaining: number | null;
  checked_at: string;
  cached: boolean;
  error?: string;
}

// Meta's account_status numeric codes.
function describeStatus(s: number | null): { severity: Severity; label: string } {
  switch (s) {
    case 1:   return { severity: "ok",       label: "Conta ativa" };
    case 2:   return { severity: "critical", label: "Conta desativada pela Meta" };
    case 3:   return { severity: "critical", label: "Conta com pendência de pagamento" };
    case 7:   return { severity: "warn",     label: "Conta em revisão de risco" };
    case 8:   return { severity: "critical", label: "Pendente de acerto de saldo" };
    case 9:   return { severity: "warn",     label: "Em período de tolerância" };
    case 100: return { severity: "warn",     label: "Fechamento pendente" };
    case 101: return { severity: "critical", label: "Conta encerrada" };
    case 102: return { severity: "warn",     label: "Em revisão" };
    default:  return { severity: "unknown",  label: "Status desconhecido" };
  }
}

// Meta's disable_reason codes (only kick in when account_status ≠ 1).
function describeDisableReason(r: number | null): string | null {
  switch (r) {
    case 0: case null: return null; // none
    case 1: return "Rejeitada por política de anúncios";
    case 2: return "Revisão de propriedade intelectual";
    case 3: return "Pagamento recusado";
    case 4: return "Conta de teste desativada";
    case 5: return "Revisão anti-fraude";
    case 6: return "Revisão de integridade de business";
    case 7: return "Encerrada permanentemente";
    case 8: return "Conta de revendedor inativa";
    case 9: return "Conta sem uso";
    default: return "Motivo não especificado";
  }
}

function parseCents(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
  return isFinite(n) ? Math.round(n) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id, account_id: requestedAccountId, force } = body;

    const authed = isCronAuthorized(req) || await isUserAuthorized(req, sb, user_id);
    if (!authed) return unauthorizedResponse(cors);

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Resolve Meta connection ────────────────────────────────────────────
    const connQuery = sb
      .from("platform_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("platform", "meta")
      .eq("status", "active");
    if (persona_id) connQuery.eq("persona_id", persona_id);

    const { data: connections } = await connQuery;
    if (!connections?.length) {
      return new Response(JSON.stringify({
        severity: "unknown", message: "Sem conexão Meta ativa",
        account_status: null, disable_reason: null, spend_cap: null,
        amount_spent: null, balance: null, currency: null, cap_remaining: null,
        checked_at: new Date().toISOString(), cached: false,
      } satisfies AccountStatusResult), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const conn = connections[0];
    const token = conn.access_token;
    const adAccounts = conn.ad_accounts || [];

    // ── Resolve Meta account ID (same convention as pixel-health-check) ───
    const looksLikeMetaId = (v: string) =>
      typeof v === "string" && (v.startsWith("act_") || /^\d+$/.test(v));
    const looksLikeUuid = (v: string) =>
      typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    let metaId: string | null = null;
    if (requestedAccountId && looksLikeMetaId(requestedAccountId)) {
      metaId = requestedAccountId;
    } else if (requestedAccountId && looksLikeUuid(requestedAccountId)) {
      const { data: row } = await sb
        .from("ad_accounts")
        .select("meta_account_id, user_id")
        .eq("id", requestedAccountId)
        .maybeSingle();
      if (!row || row.user_id !== user_id) {
        return new Response(JSON.stringify({ error: "ad_account_not_owned" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      metaId = row.meta_account_id;
    } else {
      metaId = conn.selected_account_id || adAccounts[0]?.account_id || null;
    }

    if (!metaId) {
      return new Response(JSON.stringify({
        severity: "unknown", message: "Nenhuma conta selecionada",
        account_status: null, disable_reason: null, spend_cap: null,
        amount_spent: null, balance: null, currency: null, cap_remaining: null,
        checked_at: new Date().toISOString(), cached: false,
      } satisfies AccountStatusResult), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const accIdNormalised = metaId.startsWith("act_") ? metaId : `act_${metaId}`;

    // ── Optional cache layer (best-effort; ignore errors) ──────────────────
    if (!force) {
      try {
        const { data: cached } = await sb
          .from("account_status_cache" as any)
          .select("data, checked_at")
          .eq("user_id", user_id)
          .eq("meta_account_id", accIdNormalised)
          .maybeSingle();
        if (cached?.checked_at) {
          const age = Date.now() - new Date(cached.checked_at).getTime();
          if (age < CACHE_TTL_MS && cached.data) {
            return new Response(JSON.stringify({ ...cached.data, cached: true }), {
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }
        }
      } catch { /* table may not exist — soft-fail */ }
    }

    // ── Hit Meta ───────────────────────────────────────────────────────────
    const fields = "account_status,disable_reason,spend_cap,amount_spent,balance,currency,name";
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${accIdNormalised}?fields=${fields}&access_token=${token}`
    );
    const metaData = await metaRes.json();

    if (!metaRes.ok || metaData.error) {
      const err = metaData?.error?.message || `meta ${metaRes.status}`;
      const result: AccountStatusResult = {
        severity: "unknown",
        message: `Não foi possível consultar a conta agora (${err})`,
        account_status: null, disable_reason: null,
        spend_cap: null, amount_spent: null, balance: null,
        currency: null, cap_remaining: null,
        checked_at: new Date().toISOString(),
        cached: false,
        error: err,
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const accStatus = typeof metaData.account_status === "number" ? metaData.account_status : null;
    const disReason = typeof metaData.disable_reason === "number" ? metaData.disable_reason : 0;
    const spendCap = parseCents(metaData.spend_cap);
    const amountSpent = parseCents(metaData.amount_spent);
    const balance = parseCents(metaData.balance);
    const currency = typeof metaData.currency === "string" ? metaData.currency : null;

    // Baseline severity from account_status.
    const { severity: statusSeverity, label } = describeStatus(accStatus);
    const reasonText = describeDisableReason(disReason);

    // Cap pressure: if we have cap + amount spent, compute remaining.
    const capRemaining = spendCap && spendCap > 0 && amountSpent !== null
      ? Math.max(0, spendCap - amountSpent)
      : null;
    const capPct = spendCap && spendCap > 0 && amountSpent !== null
      ? Math.min(1, amountSpent / spendCap)
      : null;

    // Escalate severity if we're burning through cap or balance is tiny.
    let severity: Severity = statusSeverity;
    let message = reasonText ? `${label} — ${reasonText}` : label;

    if (severity === "ok") {
      if (capPct !== null && capPct >= 0.95) {
        severity = "critical";
        message = "Limite de gasto da conta quase estourado";
      } else if (capPct !== null && capPct >= 0.80) {
        severity = "warn";
        message = "Limite de gasto próximo do teto";
      } else if (balance !== null && balance > 0 && balance < 2000 /* < R$20 */) {
        severity = "critical";
        message = "Saldo pré-pago quase acabando";
      } else if (balance !== null && balance > 0 && balance < 10000 /* < R$100 */) {
        severity = "warn";
        message = "Saldo pré-pago baixo";
      } else {
        severity = "ok";
        message = "Conta ativa e com saldo";
      }
    }

    const result: AccountStatusResult = {
      severity,
      message,
      account_status: accStatus,
      disable_reason: disReason,
      spend_cap: spendCap,
      amount_spent: amountSpent,
      balance,
      currency,
      cap_remaining: capRemaining,
      checked_at: new Date().toISOString(),
      cached: false,
    };

    // Best-effort cache write — never let it block the response.
    try {
      await sb.from("account_status_cache" as any).upsert({
        user_id,
        meta_account_id: accIdNormalised,
        data: result,
        checked_at: result.checked_at,
      } as any, { onConflict: "user_id,meta_account_id" });
    } catch { /* noop */ }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({
      severity: "unknown" as Severity,
      message: "Falha ao verificar status da conta",
      account_status: null, disable_reason: null,
      spend_cap: null, amount_spent: null, balance: null,
      currency: null, cap_remaining: null,
      checked_at: new Date().toISOString(),
      cached: false,
      error: msg,
    } satisfies AccountStatusResult), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
