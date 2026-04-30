import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { ensureV2Account } from "@/hooks/useActiveAccount";

const PLATFORM_CONFIG: Record<string, { name: string; color: string; fn: string }> = {
  meta:   { name: "Meta Ads",    color: "#60a5fa", fn: "meta-oauth"   },
  tiktok: { name: "TikTok Ads", color: "#06b6d4", fn: "tiktok-oauth" },
  google: { name: "Google Ads", color: "#34d399", fn: "google-oauth"  },
};

const F = "'Plus Jakarta Sans', system-ui, sans-serif";

/**
 * Activation steps shown to the user while we hydrate the account.
 *
 * The user sees each step start (spinner), succeed (check), or skip
 * (dim). This is the "wow moment" — they just connected and watch
 * the system absorb their account in real time. By the time they hit
 * the Feed, they have decision cards waiting.
 *
 * Order matters: ensure_account → sync (parallel with profile) →
 * intelligence (depends on sync). Each step's failure is non-fatal —
 * we still deliver them to the Feed, just with less data.
 */
type StepKey = "ensure_account" | "sync_history" | "profile_business" | "generate_decisions";
type StepState = "pending" | "running" | "done" | "failed" | "skipped";
const STEP_LABELS: Record<StepKey, { label: string; activeLabel: string }> = {
  ensure_account: {
    label: "Conta vinculada",
    activeLabel: "Vinculando conta",
  },
  sync_history: {
    label: "Sincronizando últimos 90 dias",
    activeLabel: "Puxando histórico",
  },
  profile_business: {
    label: "Lendo seu negócio",
    activeLabel: "Analisando seu site",
  },
  generate_decisions: {
    label: "Gerando recomendações",
    activeLabel: "Decidindo o que pausar/escalar",
  },
};

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { platform } = useParams<{ platform: string }>();
  const [status, setStatus] = useState<"loading" | "selecting" | "analyzing" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting...");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  // Activation pipeline state — drives the progress UI
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    ensure_account: "pending",
    sync_history: "pending",
    profile_business: "pending",
    generate_decisions: "pending",
  });
  const setStep = (k: StepKey, s: StepState) =>
    setSteps((prev) => ({ ...prev, [k]: s }));

  const pl = PLATFORM_CONFIG[platform || ""] || { name: platform, color: "#0ea5e9", fn: `${platform}-oauth` };

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`${pl.name} connection was cancelled.`);
        setTimeout(() => navigate("/dashboard/accounts"), 2500);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Invalid callback — missing code.");
        setTimeout(() => navigate("/dashboard/accounts"), 2500);
        return;
      }

      try {
        let uid = "";
        let pid: string | null = null;
        if (state) {
          try {
            const decoded = JSON.parse(atob(state));
            uid = decoded.user_id || "";
            pid = decoded.persona_id || null;
          } catch {}
        }
        if (!uid) {
          const { data: { user } } = await supabase.auth.getUser();
          uid = user?.id || "";
        }

        setUserId(uid);
        setPersonaId(pid);
        setMessage(`Connecting ${pl.name}...`);

        console.log("[OAuth] Calling edge function:", pl.fn, { user_id: uid, persona_id: pid });
        const { data, error: fnError } = await supabase.functions.invoke(pl.fn, {
          body: { action: "exchange_code", code, user_id: uid, persona_id: pid, state },
        });

        if (fnError) {
          // Extract real error from FunctionsHttpError — .message is generic, actual error is in context
          let realMsg = fnError.message;
          try {
            const ctx = (fnError as any).context;
            if (ctx) {
              const body = typeof ctx === "string" ? JSON.parse(ctx) : (await ctx?.json?.() ?? ctx);
              realMsg = body?.error || body?.message || realMsg;
            }
          } catch {}
          console.error("[OAuth] Edge function error:", realMsg);
          throw new Error(realMsg);
        }
        if (data?.error) {
          console.error("[OAuth] Data error:", data.error);
          throw new Error(data.error);
        }
        console.log("[OAuth] Success:", { accounts: data?.ad_accounts?.length, saved: true });

        const accs: any[] = data?.ad_accounts || data?.customers || 
          (data?.advertiser_ids || []).map((id: string) => ({ id, name: `Advertiser ${id}` }));

        if (accs.length === 0) {
          setStatus("success");
          const savedId = data?.saved_id;
          setMessage(platform === "google"
            ? `Google Ads conectado${savedId ? " " : ""}. Vá em Contas → Google Ads → insira seu Customer ID.`
            : `${pl.name} connected.`);
          // Meta → go to diagnostic; others → accounts page
          const dest = platform === "meta"
            ? "/dashboard/feed"
            : `/dashboard/accounts?connected=${platform || ""}`;
          setTimeout(() => navigate(dest), 2000);
          return;
        }

        if (accs.length === 1) {
          // Auto-select if only one account
          await saveSelectedAccount(uid, accs[0].id, pid);
          if (platform === "meta") {
            // Meta gets the activation pipeline — by the time they hit the
            // Feed it's populated with sync data + decisions, not empty.
            await runActivationPipeline(uid, pid, accs[0]);
            setStatus("success");
            setMessage("Tudo pronto. Vamos pro seu painel.");
            setTimeout(() => navigate("/dashboard/feed"), 1200);
          } else {
            setStatus("success");
            setMessage(`${pl.name} connected with ${accs[0].name || accs[0].id}.`);
            setTimeout(() => navigate(`/dashboard/accounts?connected=${platform || ""}`), 2000);
          }
          return;
        }

        // Multiple accounts — show selector
        setAccounts(accs);
        setStatus("selecting");
        setMessage(`Choose the ad account for this persona`);

      } catch (e: any) {
        setStatus("error");
        const errMsg = e.message || e?.details || String(e) || "Connection failed. Please try again.";
        // Extract meaningful part if it's a Supabase function error
        let display = errMsg;
        if (errMsg.includes("redirect_uri_mismatch")) display = "redirect_uri_mismatch — a URL de callback não está registrada no Google Cloud Console";
        else if (errMsg.includes("invalid_grant")) display = "Código expirado ou já usado — tente conectar novamente";
        else if (errMsg.includes("invalid_client")) display = "Credenciais OAuth inválidas — verifique GOOGLE_CLIENT_ID e SECRET";
        else if (errMsg.includes("access_denied")) display = "Acesso negado — o usuário cancelou ou não tem permissão";
        setMessage(display);
        setTimeout(() => navigate("/dashboard/accounts"), 5000);
      }
    };
    run();
  }, []);

  /**
   * Run the activation pipeline AFTER OAuth success and account selection.
   *
   * This is the "wow moment" — the user just connected and we hydrate
   * their account in real time before delivering them to the Feed.
   *
   * Sequence:
   *   1. ensureV2Account — guarantees the v2 ad_accounts UUID exists
   *      (sync-meta-data and daily-intelligence both require it).
   *   2. PARALLEL:
   *        - sync-meta-data (deep)  — pulls 90 days of ads, ad_metrics,
   *          campaigns, daily_snapshots, ad_diary into Supabase tables.
   *        - business-profiler      — scrapes the user's site to learn
   *          what they sell, who's the audience, ICP. Independent of
   *          Meta sync, runs in parallel for speed.
   *   3. daily-intelligence — generates kill/scale/test decisions and
   *      writes them to the `decisions` table. Depends on sync.
   *
   * Each step's failure is non-fatal: we still deliver the user to
   * the Feed. Worst case they see KPIs but no decision cards yet —
   * the cron will catch up within the day.
   *
   * This is for Meta only — other platforms skip and go straight to
   * Accounts page (their integrations don't have the same pipeline yet).
   */
  const runActivationPipeline = async (
    uid: string,
    pid: string | null,
    metaAccount: { id: string; name?: string; currency?: string },
  ) => {
    setStatus("analyzing");
    setMessage("Lendo sua conta para gerar as primeiras decisões...");

    // Step 1: ensure v2 account row
    setStep("ensure_account", "running");
    const v2AccountId = await ensureV2Account(uid, metaAccount as { id: string; name: string; currency: string });
    if (!v2AccountId) {
      // No v2 row → can't run sync. Mark remaining as skipped, deliver
      // the user to the Feed; cron will recover later.
      setStep("ensure_account", "failed");
      setStep("sync_history", "skipped");
      setStep("profile_business", "skipped");
      setStep("generate_decisions", "skipped");
      return;
    }
    setStep("ensure_account", "done");

    // Step 2: parallel sync + profile
    setStep("sync_history", "running");
    setStep("profile_business", "running");

    // sync-meta-data: heavy, can take 30-60s for accounts with lots of ads.
    // We don't block on it failing — the user can still use the chat and
    // the live-metrics endpoint hits Meta directly.
    const syncPromise = supabase.functions
      .invoke("sync-meta-data", {
        body: { account_id: v2AccountId, sync_type: "deep" },
      })
      .then((r) => {
        if (r.error || (r.data as { error?: unknown } | null)?.error) {
          console.warn("[OAuth] sync-meta-data failed:", r.error || (r.data as { error?: unknown } | null)?.error);
          setStep("sync_history", "failed");
          return false;
        }
        setStep("sync_history", "done");
        return true;
      })
      .catch((e) => {
        console.warn("[OAuth] sync-meta-data threw:", e);
        setStep("sync_history", "failed");
        return false;
      });

    // business-profiler: lighter, ~10-20s. Independent of sync. We pass
    // persona_id and let it fetch the website + niche from there.
    const profilePromise = supabase.functions
      .invoke("business-profiler", {
        body: { user_id: uid, persona_id: pid },
      })
      .then((r) => {
        if (r.error || (r.data as { error?: unknown } | null)?.error) {
          console.warn("[OAuth] business-profiler failed:", r.error || (r.data as { error?: unknown } | null)?.error);
          setStep("profile_business", "failed");
        } else {
          setStep("profile_business", "done");
        }
      })
      .catch((e) => {
        console.warn("[OAuth] business-profiler threw:", e);
        setStep("profile_business", "failed");
      });

    // Wait for sync (decisions need its data); profile runs alongside.
    const [syncOk] = await Promise.all([syncPromise, profilePromise]);

    // Step 3: generate decisions — only meaningful if sync produced data.
    setStep("generate_decisions", "running");
    if (!syncOk) {
      setStep("generate_decisions", "skipped");
      return;
    }
    try {
      const r = await supabase.functions.invoke("daily-intelligence", {
        body: { user_id: uid, persona_id: pid },
      });
      if (r.error || (r.data as { error?: unknown } | null)?.error) {
        console.warn("[OAuth] daily-intelligence failed:", r.error || (r.data as { error?: unknown } | null)?.error);
        setStep("generate_decisions", "failed");
      } else {
        setStep("generate_decisions", "done");
      }
    } catch (e) {
      console.warn("[OAuth] daily-intelligence threw:", e);
      setStep("generate_decisions", "failed");
    }
  };

  const saveSelectedAccount = async (uid: string, accountId: string, pid: string | null) => {
    try {
      const query = supabase.from("platform_connections" as any)
        .update({ selected_account_id: accountId })
        .eq("user_id", uid)
        .eq("platform", platform!);
      const result = pid
        ? await query.eq("persona_id", pid)
        : await query.is("persona_id", null);
      if (result.error) console.error("[AdBrief] saveSelectedAccount error:", result.error);
    } catch (e) {
      console.error("[AdBrief] saveSelectedAccount exception:", e);
    }
  };

  const handleSelect = async (accountId: string) => {
    setSaving(true);
    setSelectedId(accountId);
    try {
      await saveSelectedAccount(userId, accountId, personaId);
      const acc = accounts.find(a => a.id === accountId);
      if (platform === "meta") {
        // Run the activation pipeline before landing on Feed — same UX
        // as the auto-select branch.
        await runActivationPipeline(userId, personaId, acc);
        setStatus("success");
        setMessage("Tudo pronto. Vamos pro seu painel.");
        setTimeout(() => navigate("/dashboard/feed"), 1200);
      } else {
        setStatus("success");
        setMessage(`${pl.name} connected with "${acc?.name || accountId}".`);
        setTimeout(() => navigate("/dashboard/accounts"), 2000);
      }
    } catch (e: any) {
      setSaving(false);
      setSelectedId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: status === "success" ? "rgba(52,211,153,0.1)" : status === "error" ? "rgba(248,113,113,0.1)" : `${pl.color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          {(status === "loading" || status === "selecting") && <Loader2 size={24} color={pl.color} className={status === "loading" ? "animate-spin" : ""} />}
          {status === "success" && <CheckCircle2 size={24} color="#34d399" />}
          {status === "error" && <XCircle size={24} color="#f87171" />}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          {status === "loading" && `Connecting ${pl.name}`}
          {status === "selecting" && "Escolha uma conta de anúncios"}
          {status === "analyzing" && "Lendo sua conta"}
          {status === "success" && `${pl.name} Connected`}
          {status === "error" && "Falha na conexão"}
        </h2>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 20 }}>{message}</p>

        {/* Activation pipeline progress — shown while we sync history,
            profile the business, and generate first decisions. Each row
            is a step; the active step has a spinner, completed has a
            check, failed/skipped has a dash. After the pipeline finishes
            the user is redirected to the Feed (which now has cards). */}
        {status === "analyzing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {(Object.keys(STEP_LABELS) as StepKey[]).map((key) => {
              const state = steps[key];
              const cfg = STEP_LABELS[key];
              const isRunning = state === "running";
              const isDone = state === "done";
              const isFailed = state === "failed" || state === "skipped";
              const labelColor = isDone
                ? "#34d399"
                : isFailed
                ? "rgba(255,255,255,0.32)"
                : isRunning
                ? "#fff"
                : "rgba(255,255,255,0.42)";
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 8,
                  background: isRunning ? "rgba(96,165,250,0.06)" : "transparent",
                  border: `1px solid ${isRunning ? "rgba(96,165,250,0.18)" : "transparent"}`,
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}>
                  <div style={{
                    width: 16, height: 16, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isRunning && <Loader2 size={14} color={pl.color} className="animate-spin" />}
                    {isDone && <CheckCircle2 size={14} color="#34d399" />}
                    {isFailed && (
                      <span style={{
                        width: 6, height: 1.5, background: "rgba(255,255,255,0.32)",
                      }}/>
                    )}
                    {state === "pending" && (
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "rgba(255,255,255,0.18)",
                      }}/>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isRunning ? 600 : 500,
                    color: labelColor, fontFamily: F,
                    transition: "color 0.2s ease",
                  }}>
                    {isRunning ? cfg.activeLabel : cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {status === "error" && message && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#f87171", fontFamily: "'DM Mono', monospace", margin: 0, wordBreak: "break-all" }}>{message}</p>
          </div>
        )}

        {/* Account selector */}
        {status === "selecting" && accounts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {accounts.length} account{accounts.length > 1 ? "s" : ""} available
            </p>
            {accounts.map((acc: any) => (
              <button
                key={acc.id}
                onClick={() => handleSelect(acc.id)}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: selectedId === acc.id ? `${pl.color}12` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedId === acc.id ? pl.color + "40" : "rgba(255,255,255,0.08)"}`,
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "all 0.12s", textAlign: "left", width: "100%",
                  opacity: saving && selectedId !== acc.id ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.borderColor = pl.color + "30"; }}
                onMouseLeave={e => { if (selectedId !== acc.id) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${pl.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {saving && selectedId === acc.id
                    ? <Loader2 size={14} color={pl.color} className="animate-spin" />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: pl.color }}>{(acc.name || acc.id).charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {acc.name || `Account ${acc.id}`}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                    ID: {acc.id}
                    {acc.currency ? ` · ${acc.currency}` : ""}
                    {acc.account_status === 1 ? " · Active" : ""}
                  </p>
                </div>
                <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
              </button>
            ))}

            <button
              onClick={() => navigate("/dashboard/accounts")}
              style={{ marginTop: 8, padding: "10px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", fontFamily: F, width: "100%", transition: "all 0.15s" }}
            >
              Skip for now
            </button>
          </div>
        )}

        {(status === "success" || status === "error") && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 16 }}>Redirecionando para Contas...</p>
        )}
      </div>
    </div>
  );
}
