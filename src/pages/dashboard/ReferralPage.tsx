// ReferralPage — share your code, see leaderboard, claim a code
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Gift, Trophy, Users, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

interface DashCtx { user: any; profile: any; [k: string]: any }

const F = T.font; // Design tokens;

const t = {
  en: {
    title: "Referral Program",
    subtitle: "Share AdBrief with a friend — you both get +10 bonus analyses",
    yourCode: "Your referral code",
    copyLink: "Copy link",
    copied: "Copied!",
    stats: "Your stats",
    referrals: "Referrals",
    bonusEarned: "Bonus analyses earned",
    leaderboard: "Top Referrers This Month",
    rank: "#",
    name: "Name",
    refs: "Referrals",
    you: "(you)",
    noLeaderboard: "No referrals yet this month. Be the first!",
    claimTitle: "Have a referral code?",
    claimPlaceholder: "Enter code (e.g. AB12CD34)",
    claimBtn: "Claim bonus",
    claiming: "Claiming...",
    alreadyReferred: "You've already used a referral code",
    shareText: "Try AdBrief — AI-powered Meta Ads intelligence. Use my code for +10 free analyses:",
    howItWorks: "How it works",
    step1: "Share your unique referral link with friends or colleagues",
    step2: "When they sign up and enter your code, you both get +10 bonus analyses",
    step3: "Climb the leaderboard and earn more rewards",
  },
  pt: {
    title: "Programa de Indicação",
    subtitle: "Compartilhe o AdBrief com um amigo — ambos ganham +10 melhorias bônus",
    yourCode: "Seu código de indicação",
    copyLink: "Copiar link",
    copied: "Copiado!",
    stats: "Suas estatísticas",
    referrals: "Indicações",
    bonusEarned: "Melhorias bônus ganhas",
    leaderboard: "Top Indicadores do Mês",
    rank: "#",
    name: "Nome",
    refs: "Indicações",
    you: "(você)",
    noLeaderboard: "Nenhuma indicação este mês. Seja o primeiro!",
    claimTitle: "Tem um código de indicação?",
    claimPlaceholder: "Digite o código (ex: AB12CD34)",
    claimBtn: "Resgatar bônus",
    claiming: "Resgatando...",
    alreadyReferred: "Você já usou um código de indicação",
    shareText: "Experimente o AdBrief — inteligência de Meta Ads com IA. Use meu código para +10 melhorias grátis:",
    howItWorks: "Como funciona",
    step1: "Compartilhe seu link de indicação com amigos ou colegas",
    step2: "Quando eles se cadastram e usam seu código, ambos ganham +10 melhorias bônus",
    step3: "Suba no ranking e ganhe mais recompensas",
  },
  es: {
    title: "Programa de Referidos",
    subtitle: "Comparte AdBrief con un amigo — ambos obtienen +10 análisis de bonificación",
    yourCode: "Tu código de referido",
    copyLink: "Copiar enlace",
    copied: "¡Copiado!",
    stats: "Tus estadísticas",
    referrals: "Referidos",
    bonusEarned: "Análisis de bonificación ganados",
    leaderboard: "Top Referidores del Mes",
    rank: "#",
    name: "Nombre",
    refs: "Referidos",
    you: "(tú)",
    noLeaderboard: "No hay referidos este mes. ¡Sé el primero!",
    claimTitle: "¿Tienes un código de referido?",
    claimPlaceholder: "Ingresa el código (ej: AB12CD34)",
    claimBtn: "Reclamar bonificación",
    claiming: "Reclamando...",
    alreadyReferred: "Ya has usado un código de referido",
    shareText: "Prueba AdBrief — inteligencia de Meta Ads con IA. Usa mi código para +10 análisis gratis:",
    howItWorks: "Cómo funciona",
    step1: "Comparte tu enlace de referido con amigos o colegas",
    step2: "Cuando se registran y usan tu código, ambos obtienen +10 análisis de bonificación",
    step3: "Sube en el ranking y gana más recompensas",
  },
};

interface LeaderboardEntry {
  rank: number; name: string; avatar_url: string | null; referrals: number; is_you: boolean;
}

export default function ReferralPage() {
  const ctx = useOutletContext<DashCtx>();
  const { language } = useLanguage();
  const lang = (language === "pt" || language === "es" ? language : "en") as keyof typeof t;
  const tx = t[lang];

  const [code, setCode] = useState(ctx.profile?.referral_code || "");
  const [totalRefs, setTotalRefs] = useState(0);
  const [bonusAnalyses, setBonusAnalyses] = useState(0);
  const [alreadyReferred, setAlreadyReferred] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInfo();
    loadLeaderboard();
  }, []);

  async function loadInfo() {
    try {
      const { data, error } = await supabase.functions.invoke("claim-referral", {
        body: { action: "get_info" },
      });
      if (error) throw error;
      setCode(data.referral_code || "");
      setTotalRefs(data.total_referrals || 0);
      setBonusAnalyses(data.bonus_analyses || 0);
      setAlreadyReferred(data.already_referred || false);
    } catch (e) {
      console.error("Referral info error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    try {
      const { data, error } = await supabase.functions.invoke("claim-referral", {
        body: { action: "leaderboard" },
      });
      if (error) throw error;
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.error("Leaderboard error:", e);
    }
  }

  async function handleClaim() {
    if (!claimCode.trim()) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke("claim-referral", {
        body: { action: "claim", code: claimCode.trim() },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.message || data.error);
        return;
      }
      toast.success(data.message || `+${data.bonus} bonus analyses!`);
      setClaimCode("");
      setAlreadyReferred(true);
      loadInfo();
      loadLeaderboard();
    } catch (e: any) {
      toast.error(e?.message || "Failed to claim code");
    } finally {
      setClaiming(false);
    }
  }

  function copyLink() {
    const url = `https://adbrief.pro/signup?ref=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(tx.copied);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareNative() {
    const url = `https://adbrief.pro/signup?ref=${code}`;
    if (navigator.share) {
      navigator.share({ title: "AdBrief", text: `${tx.shareText} ${code}`, url });
    } else {
      copyLink();
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ width: 28, height: 28, border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px", fontFamily: F }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Gift size={22} color="#0ea5e9" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0, fontFamily: F }}>{tx.title}</h1>
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0, fontFamily: F }}>{tx.subtitle}</p>
      </div>

      {/* Your Code Card */}
      <div style={{
        background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)",
        borderRadius: 12, padding: "24px", marginBottom: 20,
      }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 10px", fontFamily: F, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          {tx.yourCode}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 28, fontWeight: 800, color: "#0ea5e9", letterSpacing: "0.12em",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>{code}</span>
          <button onClick={copyLink} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: copied ? "rgba(34,197,94,0.15)" : "rgba(14,165,233,0.12)",
            border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(14,165,233,0.25)"}`,
            borderRadius: 8, cursor: "pointer", color: copied ? "#22A3A3" : "#0ea5e9",
            fontSize: 13, fontWeight: 500, fontFamily: F, transition: "all 0.2s",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? tx.copied : tx.copyLink}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Users size={14} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: F, fontWeight: 500 }}>{tx.referrals}</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0, fontFamily: F }}>{totalRefs}</p>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={14} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: F, fontWeight: 500 }}>{tx.bonusEarned}</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 700, color: "#0ea5e9", margin: 0, fontFamily: F }}>+{bonusAnalyses}</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 10, padding: "20px", marginBottom: 24,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 14px", fontFamily: F }}>{tx.howItWorks}</p>
        {[tx.step1, tx.step2, tx.step3].map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#0ea5e9", fontFamily: F,
            }}>{i + 1}</span>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.5, fontFamily: F }}>{step}</p>
          </div>
        ))}
      </div>

      {/* Claim Code — only if not already referred */}
      {!alreadyReferred && (
        <div style={{
          background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)",
          borderRadius: 10, padding: "20px", marginBottom: 24,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 12px", fontFamily: F }}>{tx.claimTitle}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={claimCode}
              onChange={e => setClaimCode(e.target.value.toUpperCase())}
              placeholder={tx.claimPlaceholder}
              maxLength={10}
              style={{
                flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                color: "#fff", fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em", outline: "none",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(167,139,250,0.3)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              onKeyDown={e => { if (e.key === "Enter") handleClaim(); }}
            />
            <button onClick={handleClaim} disabled={claiming || !claimCode.trim()}
              style={{
                padding: "10px 20px", background: claiming ? "rgba(167,139,250,0.1)" : "rgba(167,139,250,0.15)",
                border: "1px solid rgba(167,139,250,0.25)", borderRadius: 8,
                color: "#c4b5fd", fontSize: 13, fontWeight: 600, fontFamily: F,
                cursor: claiming ? "not-allowed" : "pointer", transition: "all 0.15s",
                opacity: !claimCode.trim() ? 0.4 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}>
              <ArrowRight size={14} />
              {claiming ? tx.claiming : tx.claimBtn}
            </button>
          </div>
        </div>
      )}

      {alreadyReferred && (
        <div style={{
          background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)",
          borderRadius: 10, padding: "14px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={16} color="#22A3A3" />
          <span style={{ fontSize: 13, color: "rgba(34,197,94,0.7)", fontFamily: F }}>{tx.alreadyReferred}</span>
        </div>
      )}

      {/* Leaderboard */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={16} color="rgba(251,191,36,0.6)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: F }}>{tx.leaderboard}</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0, fontFamily: F }}>{tx.noLeaderboard}</p>
          </div>
        ) : (
          <div>
            {leaderboard.map((entry) => {
              const medal = entry.rank === 1 ? "" : entry.rank === 2 ? "" : entry.rank === 3 ? "" : null;
              return (
                <div key={entry.rank} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: entry.is_you ? "rgba(14,165,233,0.04)" : "transparent",
                }}>
                  <span style={{
                    width: 28, textAlign: "center", fontSize: medal ? 16 : 13,
                    color: "rgba(255,255,255,0.35)", fontWeight: 600, fontFamily: F,
                  }}>
                    {medal || entry.rank}
                  </span>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                  }}>
                    {entry.avatar_url
                      ? <img src={entry.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>{entry.name.charAt(0)}</span>
                    }
                  </div>
                  <span style={{
                    flex: 1, fontSize: 13.5, fontWeight: entry.is_you ? 600 : 400,
                    color: entry.is_you ? "#0ea5e9" : "rgba(255,255,255,0.6)", fontFamily: F,
                  }}>
                    {entry.name} {entry.is_you && <span style={{ fontSize: 11, opacity: 0.6 }}>{tx.you}</span>}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: entry.is_you ? "#0ea5e9" : "rgba(255,255,255,0.5)",
                    fontFamily: F,
                  }}>
                    {entry.referrals}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
