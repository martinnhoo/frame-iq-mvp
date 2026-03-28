// CampaignBuilder v1 — Co-piloto AI em tempo real para criação de campanhas Meta
// A IA comenta cada campo enquanto o usuário preenche, baseada em dados reais da conta

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, ChevronRight, ChevronLeft, Check, ExternalLink,
  Target, DollarSign, Users, Megaphone, AlertCircle,
  TrendingUp, Loader2, Rocket, Info, X
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Persona { id: string; name: string; result?: any; }
interface AiMessage { id: string; text: string; type: "tip" | "warn" | "insight" | "ok"; }
interface CampaignForm {
  name: string;
  objective: string;
  daily_budget: string;
  cbo: boolean;
  country: string;
  age_min: number;
  age_max: number;
  optimization_goal: string;
  adset_name: string;
  destination_url: string;
  primary_text: string;
  headline: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const OBJECTIVES = [
  { id: "OUTCOME_TRAFFIC",     label: "Tráfego",        desc: "Cliques no link",          icon: "🌐" },
  { id: "OUTCOME_LEADS",       label: "Leads",           desc: "Formulário ou mensagem",   icon: "📋" },
  { id: "OUTCOME_SALES",       label: "Vendas",          desc: "Compras e conversões",      icon: "💰" },
  { id: "OUTCOME_ENGAGEMENT",  label: "Engajamento",     desc: "Curtidas e comentários",   icon: "❤️" },
  { id: "OUTCOME_AWARENESS",   label: "Reconhecimento",  desc: "Alcance e memória",         icon: "📢" },
];

const OPT_GOALS: Record<string, { id: string; label: string }[]> = {
  OUTCOME_TRAFFIC:    [{ id: "LINK_CLICKS", label: "Cliques no link" }, { id: "LANDING_PAGE_VIEWS", label: "Visualizações de página" }],
  OUTCOME_LEADS:      [{ id: "LEAD_GENERATION", label: "Geração de leads" }, { id: "CONVERSIONS", label: "Conversões" }],
  OUTCOME_SALES:      [{ id: "CONVERSIONS", label: "Conversões" }, { id: "VALUE", label: "Valor de conversão" }],
  OUTCOME_ENGAGEMENT: [{ id: "POST_ENGAGEMENT", label: "Engajamento no post" }, { id: "VIDEO_VIEWS", label: "Visualizações de vídeo" }],
  OUTCOME_AWARENESS:  [{ id: "REACH", label: "Alcance" }, { id: "BRAND_AWARENESS", label: "Reconhecimento" }],
};

const COUNTRIES = [
  { id: "BR", label: "Brasil 🇧🇷" },
  { id: "MX", label: "México 🇲🇽" },
  { id: "US", label: "EUA 🇺🇸" },
  { id: "AR", label: "Argentina 🇦🇷" },
  { id: "CO", label: "Colômbia 🇨🇴" },
  { id: "IN", label: "Índia 🇮🇳" },
];

const STEPS = [
  { id: "objective", label: "Objetivo",   icon: Target },
  { id: "budget",    label: "Orçamento",  icon: DollarSign },
  { id: "audience",  label: "Público",    icon: Users },
  { id: "creative",  label: "Criativo",   icon: Megaphone },
  { id: "review",    label: "Revisar",    icon: Check },
];

const F = "'DM Sans', 'Sora', system-ui, sans-serif";
const PRIMARY  = "#0ea5e9";
const BG       = "#0e1118";
const SURFACE  = "#141824";
const SURFACE2 = "#1a2135";
const BORDER   = "rgba(255,255,255,0.08)";
const TEXT     = "#eef0f6";
const MUTED    = "rgba(255,255,255,0.42)";

// ── Main Component ───────────────────────────────────────────────────────────
export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [form, setForm] = useState<CampaignForm>({
    name: "",
    objective: "",
    daily_budget: "50",
    cbo: false,
    country: "BR",
    age_min: 18,
    age_max: 55,
    optimization_goal: "",
    adset_name: "",
    destination_url: "",
    primary_text: "",
    headline: "",
  });
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const aiRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastAiTrigger = useRef<string>("");

  // ── Load user + personas ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/login"); return; }
      setUserId(data.session.user.id);
      supabase.from("personas")
        .select("id, name, result")
        .eq("user_id", data.session.user.id)
        .order("created_at", { ascending: false })
        .then(({ data: ps }) => {
          setPersonas(ps || []);
          if (ps?.length) setSelectedPersona(ps[0]);
        });
    });
  }, [navigate]);

  // Auto-scroll AI panel
  useEffect(() => {
    if (aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight;
  }, [aiMessages]);

  // ── AI Copilot call ──────────────────────────────────────────────────────
  const askAI = useCallback(async (trigger: string, context: Partial<CampaignForm>) => {
    if (!userId || !selectedPersona) return;
    const key = trigger + JSON.stringify(context);
    if (key === lastAiTrigger.current) return;
    lastAiTrigger.current = key;

    setAiLoading(true);
    try {
      const { data: conn } = await supabase
        .from("platform_connections" as any)
        .select("ad_accounts, selected_account_id")
        .eq("user_id", userId)
        .eq("platform", "meta")
        .eq("persona_id", selectedPersona.id)
        .maybeSingle();

      const { data: snap } = await supabase
        .from("daily_snapshots" as any)
        .select("total_spend, avg_ctr, active_ads, ai_insight")
        .eq("user_id", userId)
        .eq("persona_id", selectedPersona.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: patterns } = await supabase
        .from("learned_patterns" as any)
        .select("pattern_key, insight_text, avg_ctr, is_winner, confidence")
        .eq("user_id", userId)
        .order("confidence", { ascending: false })
        .limit(10);

      const accountCtx = snap
        ? `CTR médio da conta: ${((snap.avg_ctr || 0) * 100).toFixed(2)}% | Spend semana: R$${(snap.total_spend || 0).toFixed(0)} | Anúncios ativos: ${snap.active_ads || 0}`
        : "Conta sem histórico de dados ainda.";

      const patternsCtx = (patterns || [])
        .filter((p: any) => p.insight_text)
        .slice(0, 5)
        .map((p: any) => `${p.is_winner ? "✓" : "✗"} ${p.insight_text} (CTR ${((p.avg_ctr || 0) * 100).toFixed(2)}%)`)
        .join("\n");

      const prompt = `Você é o co-piloto de campanha do AdBrief — um media buyer sênior comentando em tempo real enquanto o gestor configura uma campanha Meta Ads.

CONTA: ${selectedPersona.name}
DADOS: ${accountCtx}
${patternsCtx ? `\nPADRÕES APRENDIDOS:\n${patternsCtx}` : ""}

ETAPA ATUAL: ${trigger}
DADOS DO FORMULÁRIO: ${JSON.stringify(context, null, 2)}

Responda com 1-3 comentários CURTOS e DIRETOS (máx 2 linhas cada) baseados EXCLUSIVAMENTE nos dados reais desta conta. 
Formato JSON: [{"type":"tip"|"warn"|"insight"|"ok","text":"..."}]
- "tip": sugestão estratégica baseada nos dados
- "warn": alerta real de algo errado ou subótimo  
- "insight": dado da conta relevante para essa escolha
- "ok": confirmação quando algo está bem configurado

Seja ESPECÍFICO com números reais. Nunca invente dados. Se não tiver dados, diga brevemente.
Responda APENAS o JSON, sem texto antes ou depois.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const msgs: AiMessage[] = JSON.parse(clean).map((m: any) => ({
        ...m,
        id: Math.random().toString(36).slice(2),
      }));
      setAiMessages(prev => [...prev.slice(-6), ...msgs]);
    } catch {
      // Silent — copilot is non-blocking
    } finally {
      setAiLoading(false);
    }
  }, [userId, selectedPersona]);

  // Debounced trigger
  const triggerAI = useCallback((trigger: string, ctx: Partial<CampaignForm>) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => askAI(trigger, ctx), 800);
  }, [askAI]);

  const set = (k: keyof CampaignForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── Navigation ───────────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return !!form.objective && !!form.name;
    if (step === 1) return !!form.daily_budget && parseFloat(form.daily_budget) > 0;
    if (step === 2) return !!form.country;
    if (step === 3) return true;
    return true;
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const goPrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  // ── Launch ───────────────────────────────────────────────────────────────
  const launch = async () => {
    if (!selectedPersona || !userId) return;
    setLaunching(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-campaign", {
        body: {
          user_id: userId,
          persona_id: selectedPersona.id,
          campaign: {
            name: form.name,
            objective: form.objective,
            daily_budget: form.daily_budget,
            cbo: form.cbo,
            countries: [form.country],
            age_min: form.age_min,
            age_max: form.age_max,
            optimization_goal: form.optimization_goal || OPT_GOALS[form.objective]?.[0]?.id,
            adset_name: form.adset_name || `${form.name} — Público 1`,
          },
        },
      });

      if (res.error || res.data?.error) {
        setError(res.data?.error || res.error?.message || "Erro ao criar campanha");
        return;
      }
      setResult(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLaunching(false);
    }
  };

  // ── AI message styles ────────────────────────────────────────────────────
  const msgStyle = (type: string) => {
    const base = {
      padding: "10px 14px",
      borderRadius: 10,
      fontSize: 13,
      lineHeight: 1.5,
      marginBottom: 8,
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      animation: "slideIn 0.3s ease",
    };
    if (type === "warn")    return { ...base, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#fcd34d" };
    if (type === "insight") return { ...base, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#7dd3fc" };
    if (type === "ok")      return { ...base, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac" };
    return { ...base, background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: TEXT };
  };

  const msgIcon = (type: string) => {
    if (type === "warn")    return "⚠️";
    if (type === "insight") return "📊";
    if (type === "ok")      return "✓";
    return "💡";
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, padding: 24 }}>
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 32 }}>✓</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: TEXT, margin: "0 0 8px" }}>Campanha criada!</h1>
          <p style={{ color: MUTED, fontSize: 15, margin: "0 0 32px" }}>
            Campanha criada no status <strong style={{ color: "#fcd34d" }}>PAUSADA</strong>. Revise no Meta Ads Manager antes de ativar.
          </p>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, textAlign: "left", marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: MUTED, fontSize: 11, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Campaign ID</p>
                <p style={{ color: TEXT, fontSize: 13, fontFamily: "monospace", margin: 0 }}>{result.campaign_id}</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: MUTED, fontSize: 11, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>AdSet ID</p>
                <p style={{ color: TEXT, fontSize: 13, fontFamily: "monospace", margin: 0 }}>{result.adset_id}</p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <a href={result.ads_manager_url} target="_blank" rel="noreferrer" style={{ flex: 1, padding: "12px 20px", background: PRIMARY, color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <ExternalLink size={15} /> Abrir no Meta Ads
            </a>
            <button onClick={() => { setResult(null); setStep(0); setForm({ name: "", objective: "", daily_budget: "50", cbo: false, country: "BR", age_min: 18, age_max: 55, optimization_goal: "", adset_name: "", destination_url: "", primary_text: "", headline: "" }); setAiMessages([]); }}
              style={{ flex: 1, padding: "12px 20px", background: SURFACE2, color: TEXT, borderRadius: 10, fontWeight: 600, fontSize: 14, border: `1px solid ${BORDER}`, cursor: "pointer" }}>
              Nova campanha
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: F, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .cb-input { background: ${SURFACE2}; border: 1px solid ${BORDER}; border-radius: 10px; color: ${TEXT}; font-family: ${F}; font-size: 14px; padding: 11px 14px; width: 100%; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
        .cb-input:focus { border-color: ${PRIMARY}; }
        .cb-input::placeholder { color: ${MUTED}; }
        .obj-card { background: ${SURFACE}; border: 1.5px solid ${BORDER}; border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.15s; }
        .obj-card:hover { border-color: rgba(14,165,233,0.4); background: rgba(14,165,233,0.05); }
        .obj-card.selected { border-color: ${PRIMARY}; background: rgba(14,165,233,0.08); }
        .step-dot { width: 8px; height: 8px; border-radius: 50%; transition: all 0.2s; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate("/dashboard/ai")} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Rocket size={16} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Criar campanha</p>
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Co-piloto AI ativo — comentários em tempo real</p>
          </div>
        </div>

        {/* Persona picker */}
        {personas.length > 1 && (
          <select value={selectedPersona?.id || ""} onChange={e => setSelectedPersona(personas.find(p => p.id === e.target.value) || null)}
            className="cb-input" style={{ width: "auto", fontSize: 13, padding: "8px 12px" }}>
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {selectedPersona && <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{selectedPersona.name}</span>}
      </div>

      {/* ── Steps bar ── */}
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 0, borderBottom: `1px solid ${BORDER}`, overflowX: "auto" }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <React.Fragment key={s.id}>
              <div onClick={() => done && setStep(i)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: done ? "pointer" : "default", opacity: active || done ? 1 : 0.4, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "rgba(34,197,94,0.2)" : active ? "rgba(14,165,233,0.2)" : SURFACE2, border: `1.5px solid ${done ? "rgba(34,197,94,0.5)" : active ? PRIMARY : BORDER}`, transition: "all 0.2s" }}>
                  {done ? <Check size={13} color="#86efac" /> : <Icon size={13} color={active ? PRIMARY : MUTED} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? TEXT : MUTED, whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: i < step ? "rgba(34,197,94,0.3)" : BORDER, margin: "0 12px", minWidth: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Body: Form + AI ── */}
      <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>

        {/* Form panel */}
        <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>

          {/* STEP 0: Objetivo */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>Qual o objetivo?</h2>
              <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>Escolha o que você quer alcançar com esta campanha.</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12, marginBottom: 28 }}>
                {OBJECTIVES.map(obj => (
                  <div key={obj.id} className={`obj-card${form.objective === obj.id ? " selected" : ""}`}
                    onClick={() => {
                      set("objective", obj.id);
                      set("optimization_goal", OPT_GOALS[obj.id]?.[0]?.id || "");
                      triggerAI("objetivo_selecionado", { objective: obj.id, name: form.name });
                    }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{obj.icon}</div>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: TEXT }}>{obj.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{obj.desc}</p>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nome da campanha *</label>
                <input className="cb-input" placeholder="ex: Leads Q2 — Público Frio" value={form.name}
                  onChange={e => {
                    set("name", e.target.value);
                    if (form.objective) triggerAI("nome_campanha", { name: e.target.value, objective: form.objective });
                  }} />
              </div>
            </div>
          )}

          {/* STEP 1: Orçamento */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>Orçamento</h2>
              <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>Defina quanto você quer gastar por dia.</p>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Orçamento diário (R$) *</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>R$</span>
                  <input className="cb-input" style={{ paddingLeft: 36 }} type="number" min="5" step="5" value={form.daily_budget}
                    onChange={e => {
                      set("daily_budget", e.target.value);
                      triggerAI("orcamento", { daily_budget: e.target.value, objective: form.objective, cbo: form.cbo });
                    }} />
                </div>
                <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Mínimo recomendado: R$50/dia para sair da fase de aprendizado em ~7 dias.</p>
              </div>

              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: TEXT }}>CBO — Otimização de orçamento de campanha</p>
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Meta distribui o orçamento automaticamente entre os conjuntos.</p>
                  </div>
                  <button onClick={() => {
                    const next = !form.cbo;
                    set("cbo", next);
                    triggerAI("cbo_toggle", { cbo: next, daily_budget: form.daily_budget, objective: form.objective });
                  }} style={{ width: 44, height: 24, borderRadius: 12, background: form.cbo ? PRIMARY : BORDER, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 3, left: form.cbo ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </button>
                </div>
              </div>

              {/* Goal */}
              {OPT_GOALS[form.objective] && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Meta de otimização</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {OPT_GOALS[form.objective].map(g => (
                      <button key={g.id} onClick={() => {
                        set("optimization_goal", g.id);
                        triggerAI("meta_otimizacao", { optimization_goal: g.id, objective: form.objective });
                      }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1.5px solid ${form.optimization_goal === g.id ? PRIMARY : BORDER}`, background: form.optimization_goal === g.id ? "rgba(14,165,233,0.1)" : SURFACE2, color: form.optimization_goal === g.id ? PRIMARY : TEXT, cursor: "pointer", transition: "all 0.15s" }}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Público */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>Público</h2>
              <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>Defina quem vai ver seus anúncios.</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>País</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COUNTRIES.map(c => (
                    <button key={c.id} onClick={() => {
                      set("country", c.id);
                      triggerAI("pais", { country: c.id, objective: form.objective });
                    }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1.5px solid ${form.country === c.id ? PRIMARY : BORDER}`, background: form.country === c.id ? "rgba(14,165,233,0.1)" : SURFACE2, color: form.country === c.id ? PRIMARY : TEXT, cursor: "pointer", transition: "all 0.15s" }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Idade mínima</label>
                  <input className="cb-input" type="number" min={18} max={65} value={form.age_min}
                    onChange={e => {
                      set("age_min", parseInt(e.target.value));
                      triggerAI("faixa_etaria", { age_min: parseInt(e.target.value), age_max: form.age_max, objective: form.objective });
                    }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Idade máxima</label>
                  <input className="cb-input" type="number" min={18} max={65} value={form.age_max}
                    onChange={e => {
                      set("age_max", parseInt(e.target.value));
                      triggerAI("faixa_etaria", { age_min: form.age_min, age_max: parseInt(e.target.value), objective: form.objective });
                    }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nome do conjunto de anúncios</label>
                <input className="cb-input" placeholder={`${form.name} — Público 1`} value={form.adset_name}
                  onChange={e => set("adset_name", e.target.value)} />
                <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Deixe em branco para usar o nome padrão.</p>
              </div>
            </div>
          )}

          {/* STEP 3: Criativo */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>Criativo</h2>
              <p style={{ color: MUTED, fontSize: 14, margin: "0 0 8px" }}>Informações do anúncio. O criativo (vídeo/imagem) é enviado diretamente no Meta Ads Manager.</p>
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", gap: 8 }}>
                <Info size={14} color="#fcd34d" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13, color: "#fcd34d" }}>A campanha e o conjunto serão criados pausados. Adicione o criativo no Meta Ads Manager antes de ativar.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Texto principal (copy) *</label>
                <textarea className="cb-input" rows={4} placeholder="O que você quer dizer para o seu público? Seja direto e claro no primeiro parágrafo." value={form.primary_text}
                  onChange={e => {
                    set("primary_text", e.target.value);
                    if (e.target.value.length > 20) triggerAI("copy", { primary_text: e.target.value, objective: form.objective });
                  }}
                  style={{ resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Headline</label>
                <input className="cb-input" placeholder="Título do anúncio — máx 40 caracteres" value={form.headline} maxLength={40}
                  onChange={e => {
                    set("headline", e.target.value);
                    triggerAI("headline", { headline: e.target.value, primary_text: form.primary_text, objective: form.objective });
                  }} />
                <p style={{ fontSize: 12, color: form.headline.length > 35 ? "#fcd34d" : MUTED, margin: "6px 0 0", textAlign: "right" }}>{form.headline.length}/40</p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>URL de destino</label>
                <input className="cb-input" placeholder="https://..." value={form.destination_url}
                  onChange={e => {
                    set("destination_url", e.target.value);
                    if (e.target.value.startsWith("http")) triggerAI("url", { destination_url: e.target.value, objective: form.objective });
                  }} />
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>Revisar e criar</h2>
              <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>A campanha será criada <strong style={{ color: "#fcd34d" }}>pausada</strong>. Ative no Meta Ads Manager quando estiver pronta.</p>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{error}</p>
                </div>
              )}

              {/* Summary cards */}
              {[
                { label: "Objetivo", value: OBJECTIVES.find(o => o.id === form.objective)?.label || "—", icon: "🎯" },
                { label: "Orçamento diário", value: `R$ ${form.daily_budget}${form.cbo ? " (CBO)" : ""}`, icon: "💰" },
                { label: "País", value: COUNTRIES.find(c => c.id === form.country)?.label || form.country, icon: "🌍" },
                { label: "Faixa etária", value: `${form.age_min}–${form.age_max} anos`, icon: "👥" },
                { label: "Meta de otimização", value: OPT_GOALS[form.objective]?.find(g => g.id === form.optimization_goal)?.label || form.optimization_goal, icon: "📈" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: SURFACE, borderRadius: 10, marginBottom: 8, border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{item.value || "—"}</p>
                  </div>
                </div>
              ))}

              <button onClick={launch} disabled={launching}
                style={{ width: "100%", marginTop: 24, padding: "14px 20px", background: launching ? SURFACE2 : "linear-gradient(135deg,#0ea5e9,#0891b2)", color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 16, border: "none", cursor: launching ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}>
                {launching ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Criando...</> : <><Rocket size={18} /> Criar campanha pausada</>}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Nav buttons */}
          {step < 4 && (
            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              {step > 0 && (
                <button onClick={goPrev} style={{ padding: "11px 20px", background: SURFACE2, color: TEXT, borderRadius: 10, fontWeight: 600, fontSize: 14, border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <ChevronLeft size={16} /> Voltar
                </button>
              )}
              <button onClick={goNext} disabled={!canNext()}
                style={{ flex: 1, padding: "11px 20px", background: canNext() ? PRIMARY : SURFACE2, color: canNext() ? "#fff" : MUTED, borderRadius: 10, fontWeight: 700, fontSize: 14, border: "none", cursor: canNext() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── AI Copilot Panel ── */}
        <div style={{ width: 320, borderLeft: `1px solid ${BORDER}`, background: SURFACE, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Panel header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: aiLoading ? "#0ea5e9" : "#22c55e", animation: aiLoading ? "pulse 1s infinite" : "none" }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>Co-piloto IA</p>
            <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>Baseado nos seus dados</span>
          </div>

          {/* Messages */}
          <div ref={aiRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {aiMessages.length === 0 && !aiLoading && (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                <p style={{ color: MUTED, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  Comece a preencher os campos e o co-piloto vai comentar com base nos dados reais da sua conta.
                </p>
              </div>
            )}

            {aiMessages.map(msg => (
              <div key={msg.id} style={msgStyle(msg.type)}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{msgIcon(msg.type)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.text}</span>
              </div>
            ))}

            {aiLoading && (
              <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: "rgba(14,165,233,0.06)", borderRadius: 10, border: `1px solid rgba(14,165,233,0.15)` }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: PRIMARY, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: MUTED }}>Analisando...</span>
              </div>
            )}
          </div>

          {/* Context hint */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <TrendingUp size={12} color={MUTED} />
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                {selectedPersona ? `Dados de: ${selectedPersona.name}` : "Selecione uma conta para personalizar"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
