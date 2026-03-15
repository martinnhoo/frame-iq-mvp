import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const PLATFORM_LABELS: Record<string, { name: string; color: string; fn: string }> = {
  meta:    { name: "Meta Ads",    color: "#60a5fa", fn: "meta-oauth"    },
  tiktok:  { name: "TikTok Ads", color: "#06b6d4", fn: "tiktok-oauth"  },
  google:  { name: "Google Ads", color: "#34d399", fn: "google-oauth"  },
};

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { platform } = useParams<{ platform: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  const pl = PLATFORM_LABELS[platform || ""] || { name: platform, color: "#0ea5e9", fn: `${platform}-oauth` };

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`${pl.name} connection was cancelled.`);
        setTimeout(() => navigate("/dashboard"), 2500);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Invalid callback — missing code.");
        setTimeout(() => navigate("/dashboard"), 2500);
        return;
      }

      try {
        let userId = "";
        if (state) {
          try { userId = JSON.parse(atob(state)).user_id; } catch {}
        }
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id || "";
        }

        setMessage(`Connecting ${pl.name}...`);

        const { data, error: fnError } = await supabase.functions.invoke(pl.fn, {
          body: { action: "exchange_code", code, user_id: userId },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const accs = data?.ad_accounts || data?.customers || data?.advertiser_ids?.map((id: string) => ({ id })) || [];
        setStatus("success");
        setAccounts(accs);
        setMessage(`${pl.name} connected successfully!`);
        setTimeout(() => navigate("/dashboard"), 2500);
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Connection failed. Please try again.");
        setTimeout(() => navigate("/dashboard"), 3500);
      }
    };
    run();
  }, []);

  const F = "'Inter', sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: status === "success" ? "rgba(52,211,153,0.1)" : status === "error" ? "rgba(248,113,113,0.1)" : `${pl.color}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {status === "loading" && <Loader2 size={26} color={pl.color} className="animate-spin" />}
          {status === "success" && <CheckCircle2 size={26} color="#34d399" />}
          {status === "error" && <XCircle size={26} color="#f87171" />}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          {status === "loading" ? `Connecting ${pl.name}` : status === "success" ? `${pl.name} Connected` : "Connection Failed"}
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{message}</p>
        {status === "success" && accounts.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {accounts.slice(0, 3).map((acc: any, i: number) => (
              <div key={i} style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{acc.name || acc.id || `Account ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 20 }}>Redirecting to Loop...</p>
      </div>
    </div>
  );
}
