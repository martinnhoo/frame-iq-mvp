import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

const PLATFORM_CONFIG: Record<string, { name: string; color: string; fn: string }> = {
  meta:   { name: "Meta Ads",    color: "#60a5fa", fn: "meta-oauth"   },
  tiktok: { name: "TikTok Ads", color: "#06b6d4", fn: "tiktok-oauth" },
  google: { name: "Google Ads", color: "#34d399", fn: "google-oauth"  },
};

const F = "'Inter', sans-serif";

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
        setTimeout(() => navigate("/dashboard/ai"), 2500);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Invalid callback — missing code.");
        setTimeout(() => navigate("/dashboard/ai"), 2500);
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

        const { data, error: fnError } = await supabase.functions.invoke(pl.fn, {
          body: { action: "exchange_code", code, user_id: uid, persona_id: pid },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const accs: any[] = data?.ad_accounts || data?.customers || 
          (data?.advertiser_ids || []).map((id: string) => ({ id, name: `Advertiser ${id}` }));

        if (accs.length === 0) {
          setStatus("success");
          setMessage(`${pl.name} connected — no ad accounts found.`);
          setTimeout(() => navigate("/dashboard/ai"), 2000);
          return;
        }

        if (accs.length === 1) {
          // Auto-select if only one account
          await saveSelectedAccount(uid, accs[0].id, pid);
          setStatus("success");
          setMessage(`${pl.name} connected with ${accs[0].name || accs[0].id}.`);
          setTimeout(() => navigate("/dashboard/ai"), 2000);
          return;
        }

        // Multiple accounts — show selector
        setAccounts(accs);
        setStatus("selecting");
        setMessage(`Choose the ad account for this persona`);

      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Connection failed. Please try again.");
        setTimeout(() => navigate("/dashboard/ai"), 3500);
      }
    };
    run();
  }, []);

  const saveSelectedAccount = async (uid: string, accountId: string, pid: string | null) => {
    await supabase.from("platform_connections" as any)
      .update({ selected_account_id: accountId })
      .eq("user_id", uid)
      .eq("platform", platform!);
  };

  const handleSelect = async (accountId: string) => {
    setSaving(true);
    setSelectedId(accountId);
    try {
      await saveSelectedAccount(userId, accountId, personaId);
      setStatus("success");
      const acc = accounts.find(a => a.id === accountId);
      setMessage(`${pl.name} connected with "${acc?.name || accountId}".`);
      setTimeout(() => navigate("/dashboard/ai"), 2000);
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
          {status === "selecting" && "Choose an ad account"}
          {status === "success" && `${pl.name} Connected`}
          {status === "error" && "Connection Failed"}
        </h2>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 20 }}>{message}</p>

        {/* Account selector */}
        {status === "selecting" && accounts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                    ID: {acc.id}
                    {acc.currency ? ` · ${acc.currency}` : ""}
                    {acc.account_status === 1 ? " · Active" : ""}
                  </p>
                </div>
                <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
              </button>
            ))}

            <button
              onClick={() => navigate("/dashboard/ai")}
              style={{ marginTop: 8, padding: "10px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: F, width: "100%" }}
            >
              Skip for now
            </button>
          </div>
        )}

        {(status === "success" || status === "error") && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 16 }}>Redirecting to Loop...</p>
        )}
      </div>
    </div>
  );
}
