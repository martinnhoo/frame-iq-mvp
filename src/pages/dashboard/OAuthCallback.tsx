import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

const PLATFORM_CONFIG: Record<string, { name: string; color: string; fn: string }> = {
  meta:   { name: "Meta Ads",    color: "#60a5fa", fn: "meta-oauth"   },
  tiktok: { name: "TikTok Ads", color: "#06b6d4", fn: "tiktok-oauth" },
  google: { name: "Google Ads", color: "#34d399", fn: "google-oauth"  },
};

const F = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { platform } = useParams<{ platform: string }>();
  const [status, setStatus] = useState<"loading" | "selecting" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting...");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [personaId, setPersonaId] = useState<string | null>(null);

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
            ? "/dashboard/diagnostic"
            : `/dashboard/accounts?connected=${platform || ""}`;
          setTimeout(() => navigate(dest), 2000);
          return;
        }

        if (accs.length === 1) {
          // Auto-select if only one account
          await saveSelectedAccount(uid, accs[0].id, pid);
          setStatus("success");
          setMessage(`${pl.name} connected with ${accs[0].name || accs[0].id}.`);
          // Meta → go to diagnostic for instant wow
          const dest = platform === "meta"
            ? "/dashboard/diagnostic"
            : `/dashboard/accounts?connected=${platform || ""}`;
          setTimeout(() => navigate(dest), 2000);
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
      setStatus("success");
      const acc = accounts.find(a => a.id === accountId);
      setMessage(`${pl.name} connected with "${acc?.name || accountId}".`);
      const dest = platform === "meta"
        ? "/dashboard/diagnostic"
        : "/dashboard/accounts";
      setTimeout(() => navigate(dest), 2000);
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
          {status === "success" && `${pl.name} Connected`}
          {status === "error" && "Falha na conexão"}
        </h2>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 20 }}>{message}</p>
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
              style={{ marginTop: 8, padding: "10px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: F, width: "100%" }}
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
