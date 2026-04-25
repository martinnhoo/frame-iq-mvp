// AdBrief AI Chat v2
// Removed: dead imports (Sparkles, Brain, Radio, Wifi etc), unused vars (PLATFORMS, BS, SUGGS, metaConn),
//          duplicate LP_CSS injection, LP_CSS as separate string
// Fixed: single CSS block (no more split/duplicate style tags)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { storage } from "@/lib/storage";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useOutletContext, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  Send, Loader2, RotateCcw,
  ThumbsUp, ThumbsDown, Copy, RefreshCw,
  Zap, Clapperboard, ScanEye, X, Sparkles, Target, FileText,
  TrendingUp, TrendingDown, BarChart2, BarChart3, Stethoscope,
  ChevronRight, Plus,
} from "lucide-react";
// v20: removed unused — Brain, Upload, Activity, ExternalLink,
//      DollarSign, MousePointerClick, Eye, Target, Radio, Wifi, WifiOff
import UpgradeWall from "@/components/UpgradeWall";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { ReferralNudge } from "@/components/dashboard/ReferralNudge";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";
// FirstWinBanner removed — ProactiveBlock handles welcome flow
import { trackEvent } from "@/lib/posthog";
const F = T.font; // 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
const M = T.font; // Same as F
const DEMO_STORAGE_KEY = "adbrief_demo_result";

// ── ABAvatar — logo real do adbrief (PNG asset) ───────────────────────────────
function ABAvatar({ size = 28 }: { size?: number }) {
  const r = Math.round(size * 0.28);
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      background: "#0a0c10",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden",
    }}>
      <img
        src="/ab-avatar.png"
        alt="AB"
        width={size}
        height={size}
        style={{ display: "block", width: size, height: size, objectFit: "cover" }}
      />
    </div>
  );
}
const j = { fontFamily: F } as const;
const m = { fontFamily: M } as const;

// ── Platforms ──────────────────────────────────────────────────────────────────

// Inline icons

// Inline icons for use in JSX buttons
const PLATFORM_ICONS_INLINE: Record<string,React.ReactNode> = {
  meta: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lobe-icons-meta-fill-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lobe-icons-meta-fill-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lobe-icons-meta-fill-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lobe-icons-meta-fill-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lobe-icons-meta-fill-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lobe-icons-meta-fill-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lobe-icons-meta-fill-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lobe-icons-meta-fill-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lobe-icons-meta-fill-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lobe-icons-meta-fill-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lobe-icons-meta-fill-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lobe-icons-meta-fill-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lobe-icons-meta-fill-12)"></path><defs><linearGradient id="lobe-icons-meta-fill-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"></stop><stop offset="45.39%" stopColor="#0668E1"></stop><stop offset="85.91%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"></stop><stop offset="99.88%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"></stop><stop offset="68.81%" stopColor="#0064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"></stop><stop offset="99.43%" stopColor="#0072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"></stop><stop offset="91.41%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"></stop><stop offset="99.95%" stopColor="#0081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"></stop><stop offset="99.94%" stopColor="#0279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"></stop><stop offset="100%" stopColor="#0377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"></stop><stop offset="100%" stopColor="#0471E9"></stop></linearGradient></defs></svg>,
};
// ─────────────────────────────────────────────────────────────────────────────
// SKILLS system removed — AI always operates in full expert mode

// TOOLBAR — shown as "thought-bubble" cards when user opens the tool menu.
// Each tool has its own color + a 1-line description shown inside the bubble.
// `desc` is the thing that makes the menu feel informative instead of just
// being a wall of labels.
// ⚠ "Brief" action temporarily hidden from the public toolbar — generate-brief
// was returning non-2xx for common prompts and was confusing users. The
// standalone page at `/dashboard/brief` and the InlineToolPanel config for
// `action: "brief"` are INTENTIONALLY LEFT INTACT so the owner can still
// reach it by: (a) direct URL /dashboard/brief, or (b) appending ?brief=1 to
// /dashboard/ai which re-enables the pill in the toolbar. Remove this note
// and re-add the entries below once generate-brief is fixed end-to-end.
const TOOLBAR: Record<string, Array<{icon: any; label: string; action: string; color: string; desc: string}>> = {
  en: [
    { icon: Zap,            label: "Hooks",            action: "hooks",        color: "#06b6d4", desc: "New hook variations based on your winners" },
    { icon: Clapperboard,   label: "Script",           action: "script",       color: "#34d399", desc: "Full script for your next video creative" },
    { icon: ScanEye,        label: "Competitor",       action: "competitor",   color: "#a78bfa", desc: "Decode a competitor ad and their strategy" },
    { icon: Target,         label: "Persona",          action: "persona",      color: "#c084fc", desc: "Update who you're selling to" },
  ],
  pt: [
    { icon: Zap,            label: "Hooks",            action: "hooks",        color: "#06b6d4", desc: "Variações de abertura com base nos seus vencedores" },
    { icon: Clapperboard,   label: "Roteiro",          action: "script",       color: "#34d399", desc: "Script completo pro seu próximo vídeo" },
    { icon: ScanEye,        label: "Concorrente",      action: "competitor",   color: "#a78bfa", desc: "Decodifica um anúncio concorrente e a estratégia dele" },
    { icon: Target,         label: "Persona",          action: "persona",      color: "#c084fc", desc: "Atualiza o perfil de quem você tá vendendo" },
  ],
  es: [
    { icon: Zap,            label: "Hooks",            action: "hooks",        color: "#06b6d4", desc: "Variaciones de gancho basadas en tus ganadores" },
    { icon: Clapperboard,   label: "Guión",            action: "script",       color: "#34d399", desc: "Guión completo para tu próximo video" },
    { icon: ScanEye,        label: "Competidor",       action: "competitor",   color: "#a78bfa", desc: "Decodifica un anuncio competidor y su estrategia" },
    { icon: Target,         label: "Persona",          action: "persona",      color: "#c084fc", desc: "Actualiza a quién le vendes" },
  ],
};

// Hidden re-enable: if the URL has ?brief=1 on /dashboard/ai, the owner gets
// the pill back in the toolbar without exposing it to everyone else.
const BRIEF_PILL_BY_LANG: Record<string, {icon: any; label: string; action: string; color: string; desc: string}> = {
  en: { icon: FileText, label: "Brief",    action: "brief", color: "#f59e0b", desc: "Brief ready to hand to your creative team" },
  pt: { icon: FileText, label: "Brief",    action: "brief", color: "#f59e0b", desc: "Briefing pronto pra passar pra equipe criativa" },
  es: { icon: FileText, label: "Brief",    action: "brief", color: "#f59e0b", desc: "Brief listo para tu equipo creativo" },
};

// ── Block types ────────────────────────────────────────────────────────────────
interface Block {
  type: "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate"|"tool_call"|"meta_action"|"text"|"trend_chart"|"limit_warning"|"creative_check"|"credits_exhausted_free"|"credits_exhausted_paid";
  remaining?: number;
  original_message?: string;
  title: string; content?: string; items?: string[];
  route?: string; params?: Record<string,string>; cta?: string;
  tool?: string; tool_params?: Record<string,string>;
  meta_action?: string; target_id?: string; target_type?: string; target_name?: string; value?: string;
  metrics?: { label:string; value:string; delta?:string; trend?:"up"|"down"|"flat" }[];
  table?: { headers:string[]; rows:string[][] };
  chart?: { type:"bar"; labels:string[]; values:number[]; colors?:string[] };
  trend?: { dates:string[]; ctr:number[]; roas:number[]; spend:number[] };
}
interface AIMessage {
  role: "user"|"assistant";
  blocks?: Block[];
  userText?: string;
  imagePreview?: string;
  ts: number;
  id: number;
}




// ── InlineToolPanel ──────────────────────────────────────────────────────────────
function InlineToolPanel({ action, onClose, onSend, lang, accountCtx }: {
  action: string; onClose: () => void; onSend: (msg: string, displayText?: string) => void; lang: string;
  accountCtx?: { product?: string; niche?: string; market?: string; platform?: string; angle?: string };
}) {
  const [val, setVal] = useState(accountCtx?.angle || "");
  const [platform, setPlatform] = useState("meta"); // google disabled
  const [tone, setTone] = useState("direct");

  const config: Record<string, any> = {
    hooks: {
      icon: "", color: "#06b6d4",
      title: { en: "Generate Hooks", pt: "Gerar Hooks", es: "Generar Hooks" },
      placeholder: { en: "Describe product, angle, or paste context…", pt: "Descreva o produto, ângulo, ou cole o contexto…", es: "Describe el producto, ángulo, o pega el contexto…" },
      cta: { en: "Generate 5 hooks →", pt: "Gerar 5 hooks →", es: "Generar 5 hooks →" },
      buildMsg: (v: string, p: string, t: string) => `[HOOKS] Generate 5 high-converting ${t} ad hooks. Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Platform: ${accountCtx?.platform||p}. Tone: ${t}. Context: "${v}". Format: [N]. [Hook]. Label hook type. Use account patterns if available.`,
    },
    script: {
      icon: "", color: "#34d399",
      title: { en: "Write Script", pt: "Escrever Roteiro", es: "Escribir Guión" },
      placeholder: { en: "What's the ad about? Paste brief or context…", pt: "Sobre o que é o anúncio? Cole o brief ou contexto…", es: "¿De qué trata el anuncio? Pega el brief o contexto…" },
      cta: { en: "Write script →", pt: "Escrever roteiro →", es: "Escribir guión →" },
      buildMsg: (v: string, p: string, t: string) => `[SCRIPT] Write a complete ${t} video ad script. Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Platform: ${accountCtx?.platform||p}. Context: "${v}". Format: VO | ON-SCREEN | VISUAL. Hook in first 3s.`,
    },
    competitor: {
      icon: "", color: "#a78bfa",
      title: { en: "Competitors Analysis", pt: "Análise de Concorrentes", es: "Análisis de Competidores" },
      placeholder: { en: "Paste competitor URL, describe their ad, or enter brand name…", pt: "Cole URL do concorrente, descreva o criativo, ou escreva a marca…", es: "Pega URL del competidor, describe su anuncio, o escribe la marca…" },
      cta: { en: "Analyze →", pt: "Analisar →", es: "Analizar →" },
      buildMsg: (v: string) => `Analyze this competitor: "${v}". Give: 1) Hook type & formula, 2) Emotional trigger, 3) Creative model, 4) What makes it work, 5) How to beat it.`,
    },
    brief: {
      icon: "", color: "#f59e0b",
      title: { en: "Creative Brief", pt: "Brief Criativo", es: "Brief Creativo" },
      placeholder: { en: "Describe the campaign: product, objective, audience, format…", pt: "Descreva a campanha: produto, objetivo, público, formato…", es: "Describe la campaña: producto, objetivo, audiencia, formato…" },
      cta: { en: "Generate brief →", pt: "Gerar brief →", es: "Generar brief →" },
      buildMsg: (v: string, p: string, t: string) => `[BRIEF] Create a complete creative brief for a ${t} ad campaign. Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Platform: ${accountCtx?.platform||p}. Context: "${v}". Include: objective, target audience, key message, creative direction, format specs, references.`,
    },
    persona: {
      icon: "", color: "#c084fc",
      title: { en: "Build Persona", pt: "Criar Persona", es: "Crear Persona" },
      placeholder: { en: "Describe your product or audience segment…", pt: "Descreva o produto ou segmento de audiência…", es: "Describe el producto o segmento de audiencia…" },
      cta: { en: "Generate persona →", pt: "Gerar persona →", es: "Generar persona →" },
      buildMsg: (v: string) => `[PERSONA] Build a detailed buyer persona for: "${v}". Product: ${accountCtx?.product||accountCtx?.niche||""}. Market: ${accountCtx?.market||lang.toUpperCase()}. Include: demographics, psychographics, pain points, desires, objections, media habits, purchase triggers, day-in-the-life, and ideal ad angle for this persona.`,
    },
  };
  const cfg = config[action];
  if (!cfg) return null;
  const l = ["en","pt","es"].includes(lang) ? lang : "en";
  const tones = ["direct","conversational","urgent","educational"];
  const toneLabels: Record<string,Record<string,string>> = {
    direct:{en:"Direct",pt:"Direto",es:"Directo"},
    conversational:{en:"Conversational",pt:"Conversacional",es:"Conversacional"},
    urgent:{en:"Urgent",pt:"Urgente",es:"Urgente"},
    educational:{en:"Educational",pt:"Educativo",es:"Educativo"},
  };
  const submit = () => { if(val.trim()){onSend(cfg.buildMsg(val.trim(),platform,tone), val.trim());onClose();}};

  return (
    <div style={{borderRadius:16,overflow:"hidden",border:`1px solid rgba(148,163,184,0.10)`,background:"linear-gradient(160deg,rgba(15,23,42,0.90) 0%,rgba(15,23,42,0.70) 100%)",boxShadow:`0 0 0 1px rgba(148,163,184,0.04) inset, 0 8px 32px rgba(0,0,0,0.40), 0 0 40px ${cfg.color}08`,backdropFilter:"blur(16px) saturate(180%)",margin:"0 0 12px",animation:"toolSlideIn 0.22s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",borderBottom:`1px solid rgba(148,163,184,0.08)`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:7,background:`${cfg.color}20`,border:`1px solid ${cfg.color}35`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:12}}>{cfg.icon}</span>
          </div>
          <span style={{...j,fontSize:13,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.01em"}}>{cfg.title[l]}</span>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,color:"rgba(255,255,255,0.45)",cursor:"pointer",display:"flex",padding:"4px 6px",transition:"all 0.15s"}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.10)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.70)"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.45)"}}>
          <X size={13}/>
        </button>
      </div>
      <div style={{padding:"12px 16px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {!["competitor","persona"].includes(action)&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:4}}>
              {["meta","tiktok"].map(p=>(
                <button key={p} onClick={()=>setPlatform(p)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",...j,background:platform===p?cfg.color:"rgba(255,255,255,0.06)",color:platform===p?"#000":"rgba(255,255,255,0.55)",transition:"all 0.1s"}}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
            <div style={{width:1,height:16,background:"rgba(148,163,184,0.08)"}}/>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {tones.map(t=>(
                <button key={t} onClick={()=>setTone(t)}
                  style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",...j,background:tone===t?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",color:tone===t?"#F1F5F9":"rgba(255,255,255,0.50)",transition:"all 0.1s"}}>
                  {toneLabels[t][l]}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={cfg.placeholder[l]} rows={3} autoFocus
          style={{width:"100%",background:"rgba(148,163,184,0.06)",border:"1px solid rgba(148,163,184,0.12)",borderRadius:12,padding:"10px 14px",color:"#F1F5F9",fontSize:13,lineHeight:1.65,resize:"none",outline:"none",...m,caretColor:cfg.color,boxSizing:"border-box",transition:"border-color 0.2s, background 0.2s, box-shadow 0.2s"}}
          onFocus={e=>{e.currentTarget.style.borderColor=`${cfg.color}55`;e.currentTarget.style.background="rgba(148,163,184,0.08)";e.currentTarget.style.boxShadow=`0 0 0 1px ${cfg.color}20`;}}
          onBlur={e=>{e.currentTarget.style.borderColor="rgba(148,163,184,0.12)";e.currentTarget.style.background="rgba(148,163,184,0.06)";e.currentTarget.style.boxShadow="none";}}
          onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)submit();}}
        />
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
          <span style={{...m,fontSize:12,color:"#475569"}}>⌘↵</span>
          <button onClick={submit} disabled={!val.trim()}
            style={{padding:"8px 20px",borderRadius:10,fontSize:13,fontWeight:700,background:val.trim()?"#2563EB":"rgba(148,163,184,0.06)",color:val.trim()?"#fff":"#475569",border:"none",cursor:val.trim()?"pointer":"not-allowed",...j,transition:"all 0.15s",boxShadow:val.trim()?"0 4px 16px rgba(37,99,235,0.35)":"none"}}>
            {cfg.cta[l]}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Confirm action block ───────────────────────────────────────────────────────
function ConfirmActionBlock({block,onConfirm,lang}:{block:Block;onConfirm:(b:Block)=>Promise<void>;lang:string}) {
  const [state, setState] = useState<"idle"|"running"|"done"|"cancelled">("idle");
  const [result, setResult] = useState("");

  // Auto-execute read-only actions without user confirmation
  useEffect(()=>{
    if((block as any)._autoExec && state==="idle"){
      setState("running");
      onConfirm(block).then(()=>{setState("done");}).catch(()=>{setState("idle");});
    }
  },[]);

  if((block as any)._autoExec && state==="running") return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:10,background:"rgba(14,165,233,0.06)",border:"1px solid rgba(14,165,233,0.15)",marginBottom:8}}>
      <Loader2 size={13} color="#0ea5e9" className="animate-spin"/>
      <span style={{...m,fontSize:12,color:"rgba(238,240,246,0.6)"}}>{lang==="pt"?"Buscando dados...":lang==="es"?"Buscando datos...":"Fetching data..."}</span>
    </div>
  );
  if((block as any)._autoExec && state==="done") return null; // result shown by executeMetaAction callback

  const L: Record<string,Record<string,string>> = {
    en:{
      sure:"Are you sure you want to proceed with the action:",
      confirm:lang==="es"?"Sí, continuar":"Sim, continuar",cancel:lang==="es"?"Cancelar":"Cancelar",running:lang==="es"?"Ejecutando...":"Executando...",done:lang==="es"?"Listo ":"Pronto ",
      pause:lang==="es"?"Pausar":"Pausar",enable:lang==="es"?"Activar":"Ativar",update_budget:lang==="es"?"Actualizar budget":"Atualizar budget",publish:lang==="es"?"Publicar":"Publicar",duplicate:lang==="es"?"Duplicar":"Duplicar",
      warning:"This action will be logged and cannot be undone.",
    },
    pt:{
      sure:"Tem certeza que deseja prosseguir com a ação:",
      confirm:"Sim, prosseguir",cancel:"Cancelar",running:"Executando...",done:"Concluído ",
      pause:"Pausar",enable:"Ativar",update_budget:"Atualizar orçamento",publish:"Publicar",duplicate:"Duplicar",
      warning:"Esta ação será registrada e não pode ser desfeita.",
    },
    es:{
      sure:"¿Estás seguro de que deseas proceder con la acción:",
      confirm:"Sí, proceder",cancel:"Cancelar",running:"Ejecutando...",done:"Completado ",
      pause:"Pausar",enable:"Activar",update_budget:"Actualizar presupuesto",publish:"Publicar",duplicate:"Duplicar",
      warning:"Esta acción quedará registrada y no se puede deshacer.",
    },
  };
  const t=L[lang]||L.en;
  const actionLabel=t[block.meta_action as string]||block.meta_action||"Execute";
  const target=block.target_name||block.target_id||"";
  const icons: Record<string,string>={pause:"",enable:"",update_budget:"",publish:"",duplicate:""};
  const icon=icons[block.meta_action||""]||"";

  if(state==="done") return(
    <div style={{borderRadius:14,border:"1px solid rgba(52,211,153,0.25)",background:"rgba(52,211,153,0.06)",padding:"14px 16px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <span style={{fontSize:16}}></span>
        <p style={{...j,fontSize:13,fontWeight:700,color:"#34d399",margin:0}}>{t.done}</p>
      </div>
      <p style={{...m,fontSize:12,color:"rgba(52,211,153,0.7)",margin:0}}>{result}</p>
    </div>
  );
  if(state==="cancelled") return null;

  return(
    <div style={{borderRadius:16,border:"1px solid rgba(251,146,60,0.3)",background:"rgba(251,146,60,0.04)",marginBottom:10,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 16px 12px",borderBottom:"1px solid rgba(251,146,60,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:20}}>{icon}</span>
          <p style={{...j,fontSize:13,fontWeight:700,color:"#fb923c",margin:0}}>{block.title}</p>
        </div>
        {/* Clear confirmation question */}
        <p style={{...m,fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.5,margin:"0 0 4px"}}>
          {t.sure}
        </p>
        <p style={{...j,fontSize:14,fontWeight:700,color:"#fff",margin:0}}>
          {actionLabel}{target?` — ${target}`:""}
          {block.value?<span style={{color:"#fb923c"}}> → {block.value}</span>:null}
        </p>
      </div>
      {/* Warning */}
      <div style={{padding:"8px 16px",background:"rgba(251,146,60,0.06)",borderBottom:"1px solid rgba(251,146,60,0.08)"}}>
        <p style={{...m,fontSize:12,color:"rgba(251,146,60,0.6)",margin:0}}> {t.warning}</p>
      </div>
      {/* Buttons */}
      <div style={{padding:"16px",display:"flex",gap:8}}>
        <button onClick={async()=>{
          setState("running");
          await onConfirm(block);
          setResult(`${actionLabel}${target?` — ${target}`:""} executado com sucesso`);
          setState("done");
        }} disabled={state==="running"}
          style={{...j,fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:10,background:state==="running"?"rgba(251,146,60,0.3)":"#fb923c",color:state==="running"?"#fb923c":"#000",border:state==="running"?"1px solid rgba(251,146,60,0.3)":"none",cursor:state==="running"?"wait":"pointer",display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"center"}}>
          {state==="running"?<><Loader2 size={13} className="animate-spin"/>{t.running}</>:t.confirm}
        </button>
        <button onClick={()=>setState("cancelled")}
          style={{...m,fontSize:12,padding:"10px 16px",borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:500}}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Defensive cleanup: strip raw JSON wrappers if the backend leaks them ─────
// This catches the case where the edge function parser falls through and
// dumps `\`\`\`json [{"type":"insight","content":"..."}]` as content.
function sanitizeLeakedJson(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  let s = raw;

  // Quick exit if it doesn't look like leaked JSON
  const looksLikeJson = /```json|^\s*\[?\s*\{?\s*"type"\s*:|"content"\s*:\s*"/i.test(s);
  if (!looksLikeJson) return raw;

  // 1) Strip code fences
  s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // 2) Try to extract all "content": "..." values
  const contentMatches: string[] = [];
  const titleMatches: string[] = [];
  const contentRegex = /"content"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  const titleRegex   = /"title"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m: RegExpExecArray | null;
  while ((m = contentRegex.exec(s)) !== null) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`);
      if (typeof decoded === "string" && decoded.trim().length > 0) contentMatches.push(decoded);
    } catch {
      contentMatches.push(m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    }
  }
  let tm: RegExpExecArray | null;
  while ((tm = titleRegex.exec(s)) !== null) {
    try {
      const decoded = JSON.parse(`"${tm[1]}"`);
      if (typeof decoded === "string") titleMatches.push(decoded);
    } catch {
      titleMatches.push(tm[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'));
    }
  }

  if (contentMatches.length > 0) {
    if (titleMatches.length === contentMatches.length) {
      return contentMatches
        .map((c, i) => {
          const t = titleMatches[i]?.trim();
          return t ? `## ${t}\n\n${c}` : c;
        })
        .join("\n\n");
    }
    return contentMatches.join("\n\n");
  }

  // 3) Last resort: strip JSON syntax cruft
  return s
    .replace(/^\s*\[|\]\s*$/g, "")
    .replace(/"(type|title|content|priority_rank|impact_daily|id)"\s*:\s*"[^"]*"\s*,?/gi, "")
    .replace(/"(type|title|content|priority_rank|impact_daily|id)"\s*:\s*[^,}\]]+,?/gi, "")
    .replace(/\{|\}/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/^\s*,\s*/gm, "")
    .trim();
}

// ── renderMarkdown — premium word-by-word streaming like ChatGPT/Claude ──────
function renderMarkdown(text: string, stream = false): React.ReactNode[] {
  if (!text || typeof text !== "string") return [];
  const cleaned = sanitizeLeakedJson(text);
  const normalized = cleaned.replace(/\\n\\n/g, "\n\n").replace(/\\n/g, "\n");
  const lines = normalized.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: { text: string; ordered: boolean; num?: number }[] = [];
  let orderedCounter = 0;
  const F = "'Plus Jakarta Sans', sans-serif";
  const MONO = "'DM Mono',monospace";

  // Word-level stagger for streaming effect — Claude-like smooth token reveal
  let globalWordIdx = 0;
  const WORD_DELAY = stream ? 0.022 : 0; // 22ms per word
  const WORD_DUR = stream ? 0.12 : 0;

  // Inline formatting — bold, code, italic — now with per-word animation
  const inlineFormat = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let idx = 0;
    while (remaining.length > 0) {
      const boldMatch  = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*$)/s);
      const italicMatch = remaining.match(/^(.*?)_(.+?)_(.*$)/s);
      const codeMatch  = remaining.match(/^(.*?)`([^`]+)`(.*$)/s);
      const earliest = [
        boldMatch  ? boldMatch[1].length  : Infinity,
        italicMatch ? italicMatch[1].length : Infinity,
        codeMatch  ? codeMatch[1].length  : Infinity,
      ];
      const minIdx = earliest.indexOf(Math.min(...earliest));
      if (minIdx === 0 && boldMatch) {
        if (boldMatch[1])  parts.push(wrapWords(boldMatch[1], idx++, {}));
        parts.push(wrapWords(boldMatch[2], idx++, { fontWeight: 600, color: "rgba(255,255,255,0.97)", letterSpacing: "-0.01em" }, true));
        remaining = boldMatch[3];
      } else if (minIdx === 1 && italicMatch) {
        if (italicMatch[1]) parts.push(wrapWords(italicMatch[1], idx++, {}));
        parts.push(wrapWords(italicMatch[2], idx++, { fontStyle: "italic" as const, color: "rgba(255,255,255,0.7)" }));
        remaining = italicMatch[3];
      } else if (minIdx === 2 && codeMatch) {
        if (codeMatch[1]) parts.push(wrapWords(codeMatch[1], idx++, {}));
        parts.push(<code key={idx++} style={{ fontFamily: MONO, fontSize: "0.85em", background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 4, padding: "1px 6px", color: "#67e8f9", animation: stream ? `wordReveal ${WORD_DUR}s ease-out ${(globalWordIdx++) * WORD_DELAY}s both` : undefined }}>{codeMatch[2]}</code>);
        remaining = codeMatch[3];
      } else {
        parts.push(wrapWords(remaining, idx++, {}));
        break;
      }
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  // Wrap text into individually animated words.
  // DOM structure is identical whether streaming or not — this prevents a flash
  // when stream prop transitions true→false (React would otherwise unmount the
  // word spans and remount a single span, causing mid-animation words to snap
  // to their final state all at once).
  function wrapWords(text: string, key: number, style: React.CSSProperties, bold = false): React.ReactNode {
    if (!stream) {
      // Non-streaming: plain span/strong, no per-word wrapping needed
      return bold ? <strong key={key} style={style}>{text}</strong> : <span key={key} style={style}>{text}</span>;
    }
    const words = text.split(/(\s+)/);
    const Tag = bold ? "strong" : "span";
    return (
      <Tag key={key} style={style}>
        {words.map((w, wi) => {
          if (/^\s+$/.test(w)) return w; // preserve whitespace as-is
          const delay = (globalWordIdx++) * WORD_DELAY;
          // `both` fill-mode keeps final state pinned after animation finishes,
          // so words stay visible even if stream prop is cleared later.
          return <span key={wi} style={{ display: "inline", animation: `wordReveal ${WORD_DUR}s ease-out ${delay}s both` }}>{w}</span>;
        })}
      </Tag>
    );
  }

  // Block-level animation is intentionally stream-INDEPENDENT so the animation
  // property doesn't change when streamingMsgId clears (which would replay the
  // animation and cause a visible flash). The streaming feel is driven entirely
  // by word-level wordReveal animations below.
  const blockAnim = (_i: number): React.CSSProperties => ({
    animation: `fadeUp 0.22s ease-out both`,
  });

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    const items = [...listBuffer];
    const isOrdered = items[0]?.ordered;
    const listIdx = nodes.length;
    nodes.push(
      <div key={key} style={{ margin: "6px 0 12px", display: "flex", flexDirection: "column", gap: 5, ...blockAnim(listIdx) }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {isOrdered
              ? <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "rgba(14,165,233,0.6)", flexShrink: 0, minWidth: 18, marginTop: 3, letterSpacing: "0.02em" }}>{item.num}.</span>
              : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(14,165,233,0.7)", flexShrink: 0, marginTop: 8 }} />
            }
            <span style={{ fontFamily: F, fontSize: 14.5, color: "rgba(240,242,248,0.88)", lineHeight: 1.7, letterSpacing: "-0.01em" }}>
              {inlineFormat(item.text)}
            </span>
          </div>
        ))}
      </div>
    );
    listBuffer = [];
    orderedCounter = 0;
  };

  // Semantic label detection — maps label keywords → accent color, optional bg tint
  // Used to render `**Label:** value` lines as mini info-blocks with consistent UX language.
  type LabelKind = "critical" | "action" | "status" | "cause" | "neutral";
  const classifyLabel = (label: string): LabelKind => {
    const l = label.toLowerCase();
    if (/problema|crítico|critico|erro\b|falha|urgente|broken|critical|risco/.test(l)) return "critical";
    if (/ação|acao|action|próximo passo|recomenda|o que fazer|next step|passo\s*\d|imediat/.test(l)) return "action";
    if (/status|pixel|último|ultimo|diagn[oó]stico|funcionando|disparando|healthy/.test(l)) return "status";
    if (/causa|poss[ií]vel|poss[ií]veis|por que|possible|cause/.test(l)) return "cause";
    return "neutral";
  };
  const labelColor: Record<LabelKind, string> = {
    critical: "#F87171",
    action:   "#0EA5E9",
    status:   "#4ADE80",
    cause:    "#FBBF24",
    neutral:  "rgba(255,255,255,0.50)",
  };
  const labelBgTint: Record<LabelKind, string> = {
    critical: "rgba(248,113,113,0.06)",
    action:   "rgba(14,165,233,0.05)",
    status:   "transparent",
    cause:    "transparent",
    neutral:  "transparent",
  };
  const labelBorder: Record<LabelKind, string> = {
    critical: "rgba(248,113,113,0.22)",
    action:   "rgba(14,165,233,0.22)",
    status:   "transparent",
    cause:    "transparent",
    neutral:  "transparent",
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // H1
    if (/^#\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em", margin: "20px 0 6px", lineHeight: 1.2, ...blockAnim(nodes.length) }}>
          {inlineFormat(trimmed.replace(/^#\s/, ""))}
        </p>
      );
      return;
    }

    // H2 — section title with subtle tag pill
    if (/^##\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      const title = trimmed.replace(/^##\s/, "");
      const kind = classifyLabel(title);
      const color = labelColor[kind];
      nodes.push(
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px", ...blockAnim(nodes.length) }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0, opacity: 0.85 }} />
          <p style={{ fontFamily: F, fontSize: 15.5, fontWeight: 700, color: "rgba(255,255,255,0.96)", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.3 }}>
            {inlineFormat(title)}
          </p>
        </div>
      );
      return;
    }

    // H3
    if (/^###\s/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(
        <p key={i} style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: "rgba(14,165,233,0.7)", letterSpacing: "0.09em", textTransform: "uppercase", margin: "14px 0 4px", ...blockAnim(nodes.length) }}>
          {trimmed.replace(/^###\s/, "")}
        </p>
      );
      return;
    }

    // HR
    if (/^---+$/.test(trimmed)) {
      flushList(`fl-${i}`);
      nodes.push(<div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0", ...blockAnim(nodes.length) }} />);
      return;
    }

    // Unordered list
    if (/^[-*•]\s/.test(trimmed)) {
      listBuffer.push({ text: trimmed.replace(/^[-*•]\s/, ""), ordered: false });
      return;
    }

    // Ordered list
    const ordMatch = trimmed.match(/^(\d+)\.\s(.+)/);
    if (ordMatch) {
      orderedCounter++;
      listBuffer.push({ text: ordMatch[2], ordered: true, num: parseInt(ordMatch[1]) });
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList(`fl-${i}`);
      return;
    }

    // Label:value line — pattern "**Label:** value..." (or "**Label**: value")
    // Renders as a small-caps uppercase label above the value, with semantic coloring
    // for critical / action / status / cause. This is what lifts responses like the
    // pixel diagnostic from "wall of bold text" to a structured info card.
    const labelValueMatch = trimmed.match(/^\*\*([^*]+?)\*\*\s*:?\s*(.+)$/);
    if (labelValueMatch) {
      flushList(`fl-${i}`);
      const label = labelValueMatch[1].replace(/:\s*$/, "").trim();
      const value = labelValueMatch[2].trim();
      // Only treat as label-value if label is short enough to actually be a label
      if (label.length > 0 && label.length <= 40 && value.length > 0) {
        const kind = classifyLabel(label);
        const color = labelColor[kind];
        const bg = labelBgTint[kind];
        const br = labelBorder[kind];
        const tinted = bg !== "transparent";

        nodes.push(
          <div key={i} style={{
            display: "flex", flexDirection: "column", gap: 3,
            padding: tinted ? "9px 12px 10px" : "2px 0",
            margin: tinted ? "6px 0" : "3px 0",
            borderRadius: tinted ? 8 : 0,
            background: bg,
            border: tinted ? `1px solid ${br}` : "none",
            borderLeft: tinted ? `3px solid ${color}` : "none",
            ...blockAnim(nodes.length),
          }}>
            <span style={{
              fontFamily: F,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: "0.11em",
              textTransform: "uppercase" as const,
              color,
              lineHeight: 1,
            }}>
              {label}
            </span>
            <span style={{
              fontFamily: F,
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(240,245,255,0.92)",
              lineHeight: 1.55,
              letterSpacing: "-0.01em",
            }}>
              {inlineFormat(value)}
            </span>
          </div>
        );
        return;
      }
    }

    // Paragraph
    flushList(`fl-${i}`);
    nodes.push(
      <p key={i} style={{ fontFamily: F, fontSize: 14.5, color: "rgba(235,240,248,0.88)", lineHeight: 1.75, margin: "0 0 10px", letterSpacing: "-0.01em", ...blockAnim(nodes.length) }}>
        {inlineFormat(trimmed)}
      </p>
    );
  });

  flushList("final");
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// SkillSelector removed

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVE CHECK CARD — inline in chat
// ─────────────────────────────────────────────────────────────────────────────


const CC_VERDICT = {
  READY:   { color: "#22A3A3", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.22)", label: "Aprovado" },
  REVIEW:  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.22)", label: "Revisar"  },
  BLOCKED: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.22)",  label: "Bloqueado"},
};
const CC_METRIC_COLORS: Record<string,string> = { green:"#22A3A3", amber:"#f59e0b", red:"#ef4444", blue:"#0da2e7" };

function getCCMetrics(raw: any) {
  const m: Array<{label:string;value:string;delta?:string;color:"green"|"amber"|"red"|"blue"}> = [];
  if (raw.hook_analysis?.score !== undefined) {
    const s = raw.hook_analysis.score;
    m.push({ label:"Hook", value:`${s}/10`, color: s>=7?"green":s>=5?"amber":"red" });
  }
  if (raw.estimated_hook_score !== undefined) {
    const hs = raw.estimated_hook_score;
    m.push({ label:"Hook Rate", value:`${hs}%`, delta: hs>=35?"acima da média":hs>=20?"na média":"abaixo da média", color: hs>=35?"green":hs>=20?"amber":"red" });
  }
  // Compliance tile removed — gray-hat-friendly. Account-killer warnings render as a footer note.
  return m;
}

function renderCCDiagnosis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2,-2);
      const isRisk = /risco|bloqueado|problem|erro|evite|cuidado/i.test(inner);
      const isOk   = /forte|correto|aprovado|excelente|funciona/i.test(inner);
      return <strong key={i} style={{ color: isRisk?"#f59e0b":isOk?"#22A3A3":"#0da2e7", fontWeight:700 }}>{inner}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function CreativeCheckCard({ block }: { block: any }) {
  const raw = block._ccData || {};
  const vc = CC_VERDICT[(raw.verdict as keyof typeof CC_VERDICT)] || CC_VERDICT.REVIEW;
  const metrics = getCCMetrics(raw);
  const F = "Inter,-apple-system,sans-serif";
  const M = { fontFamily:"'DM Mono',monospace" };

  // Build diagnosis from hook + cta only (compliance scoring removed — see account-killer footer)
  const diagParts: string[] = [];
  if (raw.hook_analysis?.detail) diagParts.push(raw.hook_analysis.detail);
  if (raw.cta_check?.detail) diagParts.push(raw.cta_check.detail);
  const diagnosis = diagParts.filter(Boolean).join(" ") || raw.verdict_reason || "";
  const accountKiller = typeof raw.account_killer_warning === "string" && raw.account_killer_warning.trim().length > 0
    ? raw.account_killer_warning.trim()
    : null;

  const fixes    = raw.top_fixes    || [];
  const strengths= raw.strengths    || [];
  const spelling = raw.language_check?.issues || [];

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "18px 20px", marginTop: 4,
      fontFamily: F,
    }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display:"inline-flex", alignItems:"center", gap:4,
          padding:"2px 9px", borderRadius:5, fontSize:10, fontWeight:700,
          letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:8,
          background:vc.bg, border:`1px solid ${vc.border}`, color:vc.color,
        }}>
          {raw.verdict==="READY" && " "}
          {raw.verdict==="REVIEW" && "△ "}
          {raw.verdict==="BLOCKED" && " "}
          {vc.label}
        </span>
        <p style={{ margin:0, fontSize:16, fontWeight:700, color:"#f0f2f8", letterSpacing:"-0.025em", lineHeight:1.35 }}>
          {raw.verdict_reason || "Análise do criativo"}
        </p>
        {block._fileName && (
          <p style={{ margin:"4px 0 0", fontSize:11, color:"rgba(255,255,255,0.22)", ...M }}>
            {block._fileName}
          </p>
        )}
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div style={{
          display:"grid", gridTemplateColumns:`repeat(${metrics.length},1fr)`,
          marginBottom:16, paddingBottom:16,
          borderBottom:"1px solid rgba(255,255,255,0.06)",
        }}>
          {metrics.map((m,i) => (
            <div key={i} style={{ paddingLeft: i>0?16:0, borderLeft: i>0?"1px solid rgba(255,255,255,0.06)":"none" }}>
              <p style={{ margin:0, fontSize:9.5, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase" as const, color:"rgba(255,255,255,0.28)" }}>
                {m.label}
              </p>
              <p style={{ margin:"4px 0 0", fontSize:24, fontWeight:800, color:CC_METRIC_COLORS[m.color], letterSpacing:"-0.04em", lineHeight:1 }}>
                {m.value}
              </p>
              {m.delta && <p style={{ margin:"2px 0 0", fontSize:10, color:"rgba(255,255,255,0.25)", ...M }}>{m.delta}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Diagnosis */}
      {diagnosis && (
        <div style={{ marginBottom:16, paddingBottom:16, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin:0, fontSize:13, lineHeight:1.75, color:"rgba(255,255,255,0.65)" }}>
            {renderCCDiagnosis(diagnosis)}
          </p>
        </div>
      )}

      {/* Spelling */}
      {spelling.length > 0 && (
        <div style={{ marginBottom:16, paddingBottom:16, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin:"0 0 8px", fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,0.35)" }}>
            Erros de escrita
          </p>
          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:"5px 12px" }}>
            {spelling.map((s:any,i:number) => (
              <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12 }}>
                <span style={{ color:"#ef4444", textDecoration:"line-through", ...M }}>{s.found}</span>
                <span style={{ color:"rgba(255,255,255,0.2)", fontSize:10 }}>→</span>
                <span style={{ color:"#22A3A3", ...M }}>{s.fix}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fixes + Strengths */}
      <div style={{
        display:"grid",
        gridTemplateColumns: fixes.length>0&&strengths.length>0?"1fr 1fr":"1fr",
        gap:20,
      }}>
        {fixes.length > 0 && (
          <div>
            <p style={{ margin:"0 0 10px", fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,0.35)" }}>Ajustar</p>
            {fixes.map((fix:string,i:number) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:i<fixes.length-1?8:0 }}>
                <div style={{ width:4, height:4, borderRadius:"50%", background:"#0da2e7", marginTop:8, flexShrink:0 }} />
                <span style={{ fontSize:12.5, color:"rgba(255,255,255,0.62)", lineHeight:1.65 }}>{fix}</span>
              </div>
            ))}
          </div>
        )}
        {strengths.length > 0 && (
          <div>
            <p style={{ margin:"0 0 10px", fontSize:11.5, fontWeight:600, color:"rgba(255,255,255,0.35)" }}>Funcionando</p>
            {strengths.map((s:string,i:number) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:i<strengths.length-1?8:0 }}>
                <div style={{ width:4, height:4, borderRadius:"50%", background:"#22A3A3", marginTop:8, flexShrink:0 }} />
                <span style={{ fontSize:12.5, color:"rgba(255,255,255,0.62)", lineHeight:1.65 }}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account-killer footer — only when AI flagged something that would clearly burn the account.
          Discreet, never blocks the analysis. The user decides what to do. */}
      {accountKiller && (
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: "1px solid rgba(245,158,11,0.16)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", flexShrink: 0, marginTop: 2,
            color: "#f59e0b", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em",
          }}>△</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(245,158,11,0.7)" }}>
              Atenção da plataforma
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,0.55)" }}>
              {accountKiller}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan checkout wiring (shared across in-chat upgrade cards) ──
const PRICE_IDS_CHAT: Record<string, string> = {
  maker:  "price_1T9sd1Dr9So14XztT3Mqddch",
  pro:    "price_1T9sdfDr9So14XztPR3tI14Y",
  studio: "price_1TMzhCDr9So14Xzt1rUmfs7h",
};

// Labels rendered client-side so they localize with the user's language.
const PLAN_LABELS: Record<string, Record<"pt"|"en"|"es", { name: string; credits: string; accounts: string }>> = {
  maker: {
    pt: { name: "Maker",  credits: "~33 melhorias/mês",  accounts: "1 conta de anúncios" },
    en: { name: "Maker",  credits: "~33 improvements/mo", accounts: "1 ad account" },
    es: { name: "Maker",  credits: "~33 mejoras/mes",    accounts: "1 cuenta de anuncios" },
  },
  pro: {
    pt: { name: "Pro",    credits: "~166 melhorias/mês", accounts: "3 contas de anúncios" },
    en: { name: "Pro",    credits: "~166 improvements/mo", accounts: "3 ad accounts" },
    es: { name: "Pro",    credits: "~166 mejoras/mes",   accounts: "3 cuentas de anuncios" },
  },
  studio: {
    pt: { name: "Studio", credits: "Créditos ilimitados", accounts: "Contas ilimitadas" },
    en: { name: "Studio", credits: "Unlimited credits",   accounts: "Unlimited accounts" },
    es: { name: "Studio", credits: "Créditos ilimitados", accounts: "Cuentas ilimitadas" },
  },
};

const formatChatPlanPrice = (price: number, l: string) => {
  const suffix = l === "pt" ? "/mês" : l === "es" ? "/mes" : "/mo";
  return `$${price}${suffix}`;
};

function BlockCard({block,lang,onNavigate,onSend,accountCtx,stream=false}: {block:Block;lang:string;onNavigate:(r:string,p?:Record<string,string>)=>void;onSend?:(msg:string)=>void;accountCtx?:{product?:string;niche?:string;market?:string;platform?:string};stream?:boolean}) {
  const [copiedIdx,setCopiedIdx]=useState<number|null>(null);
  const [scriptLoadingIdx,setScriptLoadingIdx]=useState<number|null>(null);
  const [checkoutLoading,setCheckoutLoading]=useState<string|null>(null);
  const F="'Plus Jakarta Sans', sans-serif";
  const M="'Plus Jakarta Sans', system-ui, sans-serif";
  const MONO="'DM Mono',monospace";

  // ── In-chat Stripe checkout ────────────────────────────────────────────────
  // Paid plan cards in chat MUST go straight to Stripe, not /pricing. Matches
  // UpgradeWall error-handling policy: surface real errors via toast, never
  // swallow with a silent redirect.
  const startChatCheckout = async (planKey: string) => {
    const l = (lang === "pt" || lang === "es") ? lang : "en";
    const priceId = PRICE_IDS_CHAT[planKey];
    if (!priceId) { onNavigate("/pricing"); return; }
    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: priceId, billing: "monthly" },
      });
      if (error) {
        const errMsg = (error as any)?.message || "";
        const errData = (error as any)?.context?.body;
        let parsed: any = null;
        try { parsed = typeof errData === "string" ? JSON.parse(errData) : errData; } catch {}
        if (parsed?.error_code === "disposable_email") {
          toast.error(l==="pt"?"Email temporário não é aceito. Use um email permanente.":l==="es"?"Email temporal no aceptado. Usa un email permanente.":"Disposable email not accepted. Use a permanent email.");
        } else if (parsed?.error_code === "ip_rate_limit") {
          toast.error(l==="pt"?"Muitas tentativas. Tente novamente em algumas horas.":l==="es"?"Demasiados intentos. Intenta en unas horas.":"Too many attempts. Try again in a few hours.");
        } else {
          toast.error(l==="pt"?"Não conseguimos iniciar o checkout. Tente novamente.":l==="es"?"No pudimos iniciar el checkout. Intenta de nuevo.":"Couldn't start checkout. Please try again.", { description: errMsg||parsed?.error });
        }
        setCheckoutLoading(null);
        return;
      }
      if (data?.url) { window.location.href = data.url; return; }
      toast.error(l==="pt"?"Resposta inesperada do servidor. Tente novamente.":l==="es"?"Respuesta inesperada del servidor. Intenta de nuevo.":"Unexpected server response. Please try again.");
    } catch (e) {
      toast.error(l==="pt"?"Erro de conexão. Verifique sua internet.":l==="es"?"Error de conexión. Verifica tu internet.":"Connection error. Check your internet.", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const copyItem=(text:string,idx:number)=>{
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(()=>setCopiedIdx(null),1800);
  };
  const useAsScript=(text:string,idx:number)=>{
    if(!onSend) { onNavigate("/dashboard/script",{product:text.slice(0,120)}); return; }
    setScriptLoadingIdx(idx);
    // Build a [SCRIPT] command using the hook as the opening — AI will call generate-script inline
    const product = accountCtx?.product||accountCtx?.niche||"";
    const market  = accountCtx?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US");
    const platform= accountCtx?.platform||"Meta";
    const msg = `[SCRIPT] Escreva um roteiro completo de vídeo usando este hook de abertura exato: "${text}". Produto: ${product}. Mercado: ${market}. Plataforma: ${platform}. Formato: VO | ON-SCREEN | VISUAL. Mantenha o hook exatamente como está nas primeiras cenas.`;
    setTimeout(()=>setScriptLoadingIdx(null),2000);
    onSend(msg);
  };

  // ── NAVIGATE ──
  if(block.type==="creative_check") return <CreativeCheckCard block={block} />;
  if(block.type==="navigate") return(
    <div style={{margin:"4px 0 8px"}}>
      {block.content&&<p style={{fontFamily:M,fontSize:13.5,color:"rgba(255,255,255,0.55)",lineHeight:1.65,marginBottom:10}}>{block.content}</p>}
      <button onClick={()=>onNavigate(block.route!,block.params)}
        style={{fontFamily:F,fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:8,background:"#0284c7",color:"#f0f9ff",border:"1px solid #0ea5e9",cursor:"pointer",letterSpacing:"-0.01em",transition:"all 0.15s"}}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#0ea5e9"}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#0284c7"}}>
        {block.cta||"Abrir →"}
      </button>
    </div>
  );

  // ── WARNING — linha colorida discreta, sem caixa ──
  if(block.type==="warning") return(
    <div style={{display:"flex",alignItems:"flex-start",gap:8,margin:"2px 0 8px",padding:"12px 14px 12px 16px",borderRadius:8,background:"rgba(251,191,36,0.05)",borderLeft:"3px solid rgba(251,191,36,0.4)"}}>
      <span style={{fontSize:13,flexShrink:0,marginTop:1,lineHeight:1}}></span>
      <div className="msg-body" style={{fontSize:13.5,lineHeight:1.65,margin:0,flex:1}}>
        {renderMarkdown(block.content||block.title||"", stream)}
      </div>
    </div>
  );

  // ── CREDITS EXHAUSTED (FREE) — plan cards ──
  if(block.type==="credits_exhausted_free") {
    const plans = (block as any).plans || [];
    const l: "pt"|"en"|"es" = (lang === "pt" || lang === "es") ? lang : "en";
    return(
      <div style={{margin:"4px 0 12px"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.50)",fontFamily:F,marginBottom:12,lineHeight:1.5}}>
          {l==="pt"?"Seus créditos gratuitos acabaram. Escolha um plano para continuar:":l==="es"?"Tus créditos gratuitos se agotaron. Elige un plan para continuar:":"Your free credits have run out. Choose a plan to continue:"}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {plans.map((p:any,i:number)=>{
            // Fallback for old edge-fn responses that don't yet send a `key`.
            const key: string = p.key || (typeof p.name === "string" ? p.name.toLowerCase() : "");
            const label = PLAN_LABELS[key]?.[l] || PLAN_LABELS[key]?.en;
            const priceNum: number | undefined = p.price_monthly;
            const priceText = typeof priceNum === "number" ? formatChatPlanPrice(priceNum, l) : (p.price || "");
            const isLoading = checkoutLoading === key;
            return (
              <div key={i}
                role="button"
                tabIndex={0}
                onClick={()=>{ if (!checkoutLoading) startChatCheckout(key); }}
                onKeyDown={e=>{ if ((e.key==="Enter"||e.key===" ") && !checkoutLoading) { e.preventDefault(); startChatCheckout(key); } }}
                aria-disabled={!!checkoutLoading}
                style={{
                  padding:"14px 16px",borderRadius:10,cursor: checkoutLoading ? "wait" : "pointer",transition:"all 0.18s",
                  background: p.recommended ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.03)",
                  border: p.recommended ? "1px solid rgba(14,165,233,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  opacity: (checkoutLoading && !isLoading) ? 0.5 : 1,
                }}
                onMouseEnter={e=>{ if (!checkoutLoading) (e.currentTarget as HTMLElement).style.background=p.recommended?"rgba(14,165,233,0.12)":"rgba(255,255,255,0.05)"; }}
                onMouseLeave={e=>{ if (!checkoutLoading) (e.currentTarget as HTMLElement).style.background=p.recommended?"rgba(14,165,233,0.08)":"rgba(255,255,255,0.03)"; }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:p.recommended?"#0ea5e9":"#F0F6FC",fontFamily:F}}>{label?.name || p.name}</span>
                    {p.recommended&&<span style={{fontSize:9,fontWeight:700,color:"#0ea5e9",background:"rgba(14,165,233,0.12)",padding:"2px 7px",borderRadius:4,letterSpacing:"0.03em"}}>{l==="pt"?"RECOMENDADO":l==="es"?"RECOMENDADO":"RECOMMENDED"}</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {isLoading && <Loader2 size={12} className="animate-spin" color="#0ea5e9" />}
                    <span style={{fontSize:13,fontWeight:700,color:"#F0F6FC",fontFamily:F}}>{priceText}</span>
                  </div>
                </div>
                <div style={{fontSize:11.5,color:"rgba(255,255,255,0.45)",fontFamily:F}}>
                  {label ? `${label.credits} · ${label.accounts}` : `${p.credits||""}${p.credits&&p.highlight?" · ":""}${p.highlight||""}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CREDITS EXHAUSTED (PAID) — buy credits and/or upgrade ──
  if(block.type==="credits_exhausted_paid") {
    const planName = (block as any).plan_name || "";
    const totalCredits = (block as any).total_credits || 0;
    const nextPlan = (block as any).next_plan;
    const options: string[] = (block as any).options || [];
    const showUpgrade = options.includes("upgrade") && nextPlan;
    const showCredits = options.includes("buy_credits");
    const l: "pt"|"en"|"es" = (lang === "pt" || lang === "es") ? lang : "en";
    // Next-plan key may not be present in older edge-fn responses — derive from name.
    const nextKey: string = nextPlan?.key || (typeof nextPlan?.name === "string" ? nextPlan.name.toLowerCase() : "");
    const nextPriceText = typeof nextPlan?.price_monthly === "number"
      ? formatChatPlanPrice(nextPlan.price_monthly, l)
      : (nextPlan?.price || "");
    const isLoadingUpgrade = checkoutLoading === nextKey;
    return(
      <div style={{margin:"4px 0 12px"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.50)",fontFamily:F,marginBottom:12,lineHeight:1.5}}>
          {l==="pt"?`Você usou todos os ${totalCredits.toLocaleString("pt-BR")} créditos do plano ${planName} este mês.`:l==="es"?`Has usado todos los ${totalCredits.toLocaleString("es")} créditos del plan ${planName} este mes.`:`You've used all ${totalCredits.toLocaleString("en-US")} credits on the ${planName} plan this month.`}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {/* Buy credits — routes to /pricing for credit pack selection */}
          {showCredits&&(
            <div onClick={()=>onNavigate("/pricing")} style={{
              padding:"14px 16px",borderRadius:10,cursor:"pointer",transition:"all 0.18s",
              background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)"}}>
              <div>
                <div style={{fontSize:13.5,fontWeight:700,color:"#F0F6FC",fontFamily:F,marginBottom:3}}>{l==="pt"?"Comprar créditos extras":l==="es"?"Comprar créditos extras":"Buy extra credits"}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.40)",fontFamily:F}}>{l==="pt"?"Receba mais créditos sem mudar de plano":l==="es"?"Obtén más créditos sin cambiar de plan":"Get more credits without changing plans"}</div>
              </div>
              <span style={{fontSize:16,color:"rgba(255,255,255,0.30)"}}>→</span>
            </div>
          )}
          {/* Upgrade plan — straight to Stripe checkout */}
          {showUpgrade&&(
            <div
              role="button"
              tabIndex={0}
              aria-disabled={!!checkoutLoading}
              onClick={()=>{ if (!checkoutLoading) startChatCheckout(nextKey); }}
              onKeyDown={e=>{ if ((e.key==="Enter"||e.key===" ") && !checkoutLoading) { e.preventDefault(); startChatCheckout(nextKey); } }}
              style={{
                padding:"14px 16px",borderRadius:10,cursor: checkoutLoading ? "wait" : "pointer",transition:"all 0.18s",
                background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.20)",
                display:"flex",alignItems:"center",justifyContent:"space-between",
                opacity: (checkoutLoading && !isLoadingUpgrade) ? 0.5 : 1,
              }}
              onMouseEnter={e=>{ if (!checkoutLoading) (e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.12)"; }}
              onMouseLeave={e=>{ if (!checkoutLoading) (e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.08)"; }}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:13.5,fontWeight:700,color:"#0ea5e9",fontFamily:F}}>{l==="pt"?`Subir para ${nextPlan.name}`:l==="es"?`Subir a ${nextPlan.name}`:`Upgrade to ${nextPlan.name}`}</span>
                  <span style={{fontSize:9,fontWeight:700,color:"#0ea5e9",background:"rgba(14,165,233,0.12)",padding:"2px 7px",borderRadius:4,letterSpacing:"0.03em"}}>+{((nextPlan.credits/totalCredits-1)*100).toFixed(0)}% {l==="en"?"credits":"créditos"}</span>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:F}}>
                  {nextPlan.credits.toLocaleString(l==="pt"?"pt-BR":l==="es"?"es":"en-US")} {l==="en"?"credits":"créditos"} · {nextPriceText}
                </div>
              </div>
              {isLoadingUpgrade
                ? <Loader2 size={14} className="animate-spin" color="#0ea5e9" />
                : <span style={{fontSize:16,color:"rgba(14,165,233,0.50)"}}>→</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── HOOKS — inspirado em Claude.ai: lista limpa, sem caixas ──
  if(block.type==="hooks") return(
    <div style={{marginBottom:4}}>
      {block.items?.map((item,i)=>{
        const copied = copiedIdx===i;
        return(
          <div key={i}
            style={{display:"flex",alignItems:"flex-start",gap:0,borderBottom:"1px solid rgba(255,255,255,0.06)",transition:"background 0.12s",animation:"fadeUp 0.18s ease-out both"}}
            className="hook-item"
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
            {/* Número */}
            <div style={{width:32,paddingTop:14,paddingBottom:12,flexShrink:0,display:"flex",justifyContent:"flex-end",paddingRight:8}}>
              <span style={{fontFamily:MONO,fontSize:12,color:"rgba(255,255,255,0.2)",letterSpacing:"0.02em"}}>{i+1}</span>
            </div>
            {/* Texto */}
            <div style={{flex:1,padding:"12px 12px 12px 0",minWidth:0}}>
              <span style={{fontFamily:M,fontSize:14,color:"rgba(255,255,255,0.9)",lineHeight:1.65,display:"block",letterSpacing:"-0.01em"}}>{item}</span>
            </div>
            {/* Ações — aparecem no hover via opacity */}
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 4px",paddingTop:12,flexShrink:0,opacity:0.6,transition:"opacity 0.12s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6"}}>
              <button onClick={()=>copyItem(item,i)}
                style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",height:24,borderRadius:6,background:copied?"rgba(52,211,153,0.1)":"transparent",border:`1px solid ${copied?"rgba(52,211,153,0.25)":"rgba(255,255,255,0.1)"}`,cursor:"pointer",fontSize:12,color:copied?"#34d399":"rgba(255,255,255,0.5)",fontFamily:M,transition:"all 0.15s",whiteSpace:"nowrap" as const,transform:copied?"scale(1.04)":"scale(1)"}}>
                {copied
                  ?<><svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{lang==="pt"?"Copiado":lang==="es"?"Copiado":"Copied"}</span></>
                  :<><Copy size={9}/><span>{lang==="pt"?"Copiar":lang==="es"?"Copiar":lang==="es"?"Copiar":"Copiar"}</span></>
                }
              </button>
              <button onClick={()=>useAsScript(item,i)}
                disabled={scriptLoadingIdx===i}
                style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",height:24,borderRadius:6,background:scriptLoadingIdx===i?"rgba(14,165,233,0.12)":"transparent",border:`1px solid ${scriptLoadingIdx===i?"rgba(14,165,233,0.3)":"rgba(255,255,255,0.1)"}`,cursor:scriptLoadingIdx===i?"default":"pointer",fontSize:12,color:scriptLoadingIdx===i?"rgba(14,165,233,0.8)":"rgba(255,255,255,0.5)",fontFamily:M,transition:"all 0.12s",whiteSpace:"nowrap" as const}}
                onMouseEnter={e=>{if(scriptLoadingIdx!==i){(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.2)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.8)"}}}
                onMouseLeave={e=>{if(scriptLoadingIdx!==i){(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.1)";(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.5)"}}}>
                {scriptLoadingIdx===i
                  ? <><span style={{width:8,height:8,borderRadius:"50%",border:"1.5px solid rgba(14,165,233,0.5)",borderTopColor:"#0ea5e9",animation:"lp-spin 0.7s linear infinite",display:"inline-block"}}/><span>{lang==="pt"?"Gerando...":lang==="es"?"Generando...":"Generating..."}</span></>
                  : <>{lang==="pt"?"Roteiro":lang==="es"?"Guión":"Script"}</>
                }
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── ACTION — inline, sem caixa verde ──
  if(block.type==="action") return(
    <div className="msg-body" style={{fontSize:14,lineHeight:1.75,margin:"0 0 6px"}}>
      {renderMarkdown(block.content||block.title||"", stream)}
    </div>
  );

  // ── DEFAULT: insight / prose — markdown rendered ──
  const hasItems = block.items && block.items.length > 0;
  return(
    <div style={{marginBottom:hasItems?10:4}} className="msg-body">
      {block.content&&(
        <div style={{margin:hasItems?"0 0 14px":"0"}}>
          {renderMarkdown(block.content, stream)}
        </div>
      )}
      {hasItems&&(
        <div style={{display:"flex",flexDirection:"column",gap:0,marginTop:block.content?2:0}}>
          {block.items!.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:0,alignItems:"flex-start",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"10px 0"}}>
              <span style={{fontFamily:MONO,fontSize:12,color:"rgba(255,255,255,0.2)",marginTop:4,flexShrink:0,width:24,letterSpacing:"0.02em"}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{fontFamily:M,fontSize:14,color:"rgba(240,242,248,0.82)",lineHeight:1.72,flex:1,letterSpacing:"-0.01em"}}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Proactive Block — first message from the AI when chat opens ──────────────
const ProactiveBlock = React.memo(function ProactiveBlock({ block, lang, onSend, connections, personaName }: { block: Block; lang: string; onSend: (s: string) => void; connections?: string[]; personaName?: string }) {
  const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t); }, []);

  const hasMeta = connections?.includes("meta");

  // Parse briefing cards from block.content (structured by triggerProactiveGreeting)
  const briefingCards: { tag: string; tagColor: string; headline: string; detail: string; action?: string; actionPrompt?: string }[] = [];
  try {
    const parsed = JSON.parse(block.content || "[]");
    if (Array.isArray(parsed)) parsed.forEach((c: any) => briefingCards.push(c));
  } catch {
    // Legacy plain-text greeting — wrap it as a single insight card
    if (block.content) {
      briefingCards.push({
        tag: lang === "pt" ? "BRIEFING" : "BRIEFING",
        tagColor: "#0ea5e9",
        headline: personaName ? `${personaName}` : (lang === "pt" ? "Sua conta" : "Your account"),
        detail: block.content,
      });
    }
  }

  // Quick actions at bottom
  const quickActions: Record<string, string[]> = {
    pt: hasMeta
      ? ["O que pausar agora?", "Gerar hooks vencedores", "O que escalar?", "Escrever roteiro"]
      : ["Gerar hooks para minha conta", "Escrever roteiro de anúncio", "Analisar concorrente"],
    es: hasMeta
      ? ["¿Qué pausar ahora?", "Generar hooks ganadores", "¿Qué escalar?", "Escribir guión"]
      : ["Generar hooks para mi cuenta", "Escribir guión de anuncio", "Analizar competidor"],
    en: hasMeta
      ? ["What to pause now?", "Generate winning hooks", "What to scale?", "Write a script"]
      : ["Generate hooks for my account", "Write an ad script", "Analyze a competitor"],
  };
  const actions = quickActions[lang] || quickActions.pt;

  return (
    <div style={{
      width: "100%", maxWidth: 620, margin: "auto",
      padding: "clamp(12px,2vw,20px) clamp(12px,3vw,20px) 20px",
      marginTop: "clamp(4px, 1.5vw, 12px)",
    }}>
      <style>{`
        @keyframes pb-fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pb-cardIn { from { opacity:0; transform:translateY(12px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes pb-breathe { 0%,100% { box-shadow: 0 0 0 0 rgba(13,162,231,0) } 50% { box-shadow: 0 0 12px 2px rgba(13,162,231,0.10) } }
      `}</style>

      {/* ── Header: avatar + greeting ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
        animation: mounted ? "pb-fadeUp 0.3s ease-out 0.06s both" : "none", opacity: 0,
      }}>
        <div style={{ animation: mounted ? "pb-breathe 3.5s ease-in-out 1s infinite" : "none", borderRadius: 8 }}>
          <ABAvatar size={24} />
        </div>
        <div>
          <h1 style={{
            fontFamily: F, fontSize: "clamp(18px,3.5vw,22px)", fontWeight: 800,
            color: "#f0f2f8", letterSpacing: "-0.03em", lineHeight: 1.2, margin: 0,
          }}>
            {block.title}
          </h1>
        </div>
      </div>

      {/* ── Briefing Cards — urgente/oportunidade/insight ── */}
      {briefingCards.map((card, i) => (
        <div key={i} style={{
          background: "rgba(15,23,42,0.65)",
          border: `1px solid ${card.tagColor === "#F87171" ? "rgba(248,113,113,0.20)" : card.tagColor === "#4ADE80" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.08)"}`,
          borderLeft: `3px solid ${card.tagColor}`,
          borderRadius: 12, padding: "clamp(12px,2vw,16px) clamp(14px,2.5vw,18px)",
          marginBottom: 8,
          animation: mounted ? `pb-fadeUp 0.3s ease-out ${0.12 + i * 0.06}s both` : "none",
          opacity: 0,
        }}>
          {/* Tag */}
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const,
            color: card.tagColor, fontFamily: F, marginBottom: 4, display: "block",
          }}>
            {card.tag}
          </span>
          {/* Headline */}
          <p style={{
            fontSize: 14, fontWeight: 700, color: "#F0F6FC", margin: "4px 0 3px",
            lineHeight: 1.4, fontFamily: F,
          }}>
            {card.headline}
          </p>
          {/* Detail */}
          <p style={{
            fontSize: 12.5, color: "rgba(240,246,252,0.72)", margin: "0 0 8px",
            lineHeight: 1.5, fontFamily: F,
          }}>
            {card.detail}
          </p>
          {/* Action button */}
          {card.action && (
            <button onClick={() => onSend(card.actionPrompt || card.action!)}
              style={{
                background: card.tagColor === "#F87171" ? "#F87171" : card.tagColor === "#4ADE80" ? "rgba(74,222,128,0.15)" : "rgba(14,165,233,0.12)",
                color: card.tagColor === "#F87171" ? "#fff" : card.tagColor,
                border: card.tagColor === "#F87171" ? "none" : `1px solid ${card.tagColor}30`,
                borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700,
                fontFamily: F, cursor: "pointer", transition: "all 0.15s",
                boxShadow: card.tagColor === "#F87171" ? `0 2px 8px rgba(248,113,113,0.3)` : "none",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {card.action}
            </button>
          )}
        </div>
      ))}

      {/* ── Quick Actions — horizontal pills ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12,
        animation: mounted ? `pb-fadeUp 0.3s ease-out ${0.12 + briefingCards.length * 0.06 + 0.06}s both` : "none",
        opacity: 0,
      }}>
        {actions.map((label, i) => (
          <button key={i} onClick={() => onSend(label)}
            style={{
              padding: "7px 14px", borderRadius: 8,
              background: "rgba(148,163,184,0.05)",
              border: "1px solid rgba(148,163,184,0.10)",
              cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600,
              color: "rgba(148,163,184,0.85)", transition: "all 0.15s", outline: "none",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(148,163,184,0.10)";
              e.currentTarget.style.borderColor = "rgba(148,163,184,0.18)";
              e.currentTarget.style.color = "#F1F5F9";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(148,163,184,0.05)";
              e.currentTarget.style.borderColor = "rgba(148,163,184,0.10)";
              e.currentTarget.style.color = "rgba(148,163,184,0.85)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
});

// ─── Live Panel v5 — build bump v2 ────────────────────────────────────────────────────────────
// Design: editorial dark refinado — Inter, cards com proporção correta


const I = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };
const MONO = { fontFamily: "'SF Mono','Fira Code',ui-monospace,monospace" };

// ── Tiny sparkline ────────────────────────────────────────────────────────────
function Spark({ d, c = "#0ea5e9", w = 56, h = 28 }: { d: number[]; c?: string; w?: number; h?: number }) {
  if (!d || d.length < 2) return null;
  const mn = Math.min(...d), mx = Math.max(...d), r = mx - mn || 1;
  const pts = d.map((v, i) => [
    (i / (d.length - 1)) * w,
    h - 3 - ((v - mn) / r) * (h - 6)
  ]);
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(" ");
  // Area fill path: line + down to bottom + back
  const areaPath = `M${pts[0][0]},${pts[0][1]} ` +
    pts.slice(1).map(([x,y]) => `L${x},${y}`).join(" ") +
    ` L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`;
  const lx = pts[pts.length-1][0], ly = pts[pts.length-1][1];
  const up = d[d.length - 1] >= d[d.length - 2];
  const dotC = up ? "#22d3ee" : "#fb7185";
  const id = `sg${Math.random().toString(36).slice(2,7)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`}/>
      <polyline points={linePts} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2" fill={dotC}/>
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, trend, spark, color = "#0ea5e9", warn = false }: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "flat";
  spark?: number[]; color?: string; warn?: boolean;
}) {
  const vc = warn ? "#fb7185" : "rgba(255,255,255,0.95)";
  const sc = warn ? "rgba(248,113,133,0.65)" : trend === "up" ? "#22d3ee" : trend === "down" ? "rgba(248,113,133,0.65)" : "rgba(255,255,255,0.25)";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  return (
    <div className="lp-kpi" style={{
      flex: 1, minWidth: 0, padding: "14px 16px 12px",
      background: warn ? "rgba(251,113,133,0.05)" : "rgba(255,255,255,0.025)",
      borderRadius: 12,
      borderTop: `2px solid ${warn ? "rgba(251,113,133,0.35)" : "rgba(255,255,255,0.06)"}`,
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 600,
          color: "rgba(255,255,255,0.28)", letterSpacing: "0.09em", textTransform: "uppercase" as const }}>{label}</span>
        {spark && spark.length >= 2 && <Spark d={spark} c={warn ? "#fb7185" : color} w={48} h={24}/>}
      </div>
      <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 700,
        color: vc, letterSpacing: "-0.035em", lineHeight: 1 }}>{value}</div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {trendIcon && <span style={{ fontSize: 10, color: sc, lineHeight: 1 }}>{trendIcon}</span>}
          <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 500, color: sc }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Ad row ────────────────────────────────────────────────────────────────────
const AdRow = React.memo(function AdRow({ a, kind, ask }: { a: any; kind: "winner" | "risk" | "normal"; ask: (q: string) => void }) {
  const isW = kind === "winner", isR = kind === "risk";
  const ctr = parseFloat(a.ctr || 0).toFixed(2);
  const fr = a.freq != null ? parseFloat(a.freq).toFixed(1) : null;
  const sp = parseFloat(a.spend || 0).toFixed(0);
  const accentColor = isW ? "#22d3ee" : isR ? "#fb7185" : "rgba(255,255,255,0.15)";
  return (
    <div className="lp-row" onClick={() => ask(`Analisa o criativo "${a.name}" — por que está ${isW ? "performando bem" : isR ? "em risco" : "assim"}?`)} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{ width: 3, height: 28, borderRadius: 2, background: accentColor, flexShrink: 0, opacity: isW || isR ? 1 : 0.4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...I, fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.82)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || "—"}</p>
        {a.campaign && <p style={{ ...I, fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.campaign}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(ctr) > 1.5 ? "#22d3ee" : parseFloat(ctr) < 0.5 ? "#fb7185" : "rgba(255,255,255,0.55)" }}>{ctr}%</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>CTR</span>
        </div>
        {fr && <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(fr) > 3.5 ? "#fb7185" : "rgba(255,255,255,0.35)" }}>{fr}x</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>FREQ</span>
        </div>}
        <div style={{ textAlign: "right" as const }}>
          <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>R${sp}</span>
          <span style={{ ...I, fontSize: 9, color: "rgba(255,255,255,0.2)", display: "block", letterSpacing: "0.05em" }}>SPEND</span>
        </div>
      </div>
    </div>
  );
});

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampRow({ c }: { c: any }) {
  const on = c.status === "ACTIVE" || c.status === "ENABLED";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ width: 3, height: 20, borderRadius: 2, background: on ? "#22d3ee" : "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      <span style={{ ...I, fontSize: 12.5, fontWeight: 400, color: on ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
      {c.budget && <span style={{ ...MONO, fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{c.budget}</span>}
      {c.ctr && <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: parseFloat(c.ctr) > 1.5 ? "#22d3ee" : "rgba(255,255,255,0.25)", flexShrink: 0 }}>{parseFloat(c.ctr).toFixed(2)}%</span>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ a, ask }: { a: { t: "warn" | "ok" | "info"; title: string; detail: string; q: string }; ask: (q: string) => void }) {
  const isOk = a.t === "ok";
  const isWarn = a.t === "warn";
  const accent = isOk ? "#22d3ee" : isWarn ? "#fb7185" : "#818cf8";
  const bg = isOk ? "rgba(34,211,238,0.05)" : isWarn ? "rgba(251,113,133,0.05)" : "rgba(129,140,248,0.05)";
  return (
    <div className="lp-alert" onClick={() => ask(a.q)} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      cursor: "pointer", background: bg,
      border: `1px solid ${accent}22`,
      borderLeft: `3px solid ${accent}`,
      transition: "opacity 0.12s",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: accent, display: "block" }}>{a.title}</span>
        <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginTop: 1 }}>{a.detail}</span>
      </div>
      <span style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontSize: 11, color: accent, opacity: 0.7, flexShrink: 0, whiteSpace: "nowrap" }}>Perguntar →</span>
    </div>
  );
}

// ── Smart alerts ──────────────────────────────────────────────────────────────
function mkAlerts(d: any, lang: string) {
  if (!d || d.error) return [];
  const k = d.kpis || {}, W = d.winners || [], R = d.at_risk || [];
  const fr = parseFloat(k.frequency || 0), ctr = parseFloat(k.ctr || 0), sp = parseFloat(k.spend || 0);
  const out: Array<{ t: "warn" | "ok" | "info"; title: string; detail: string; q: string }> = [];
  const L = {
    highFreq:   { pt:"Frequência crítica",       es:"Frecuencia crítica",       en:"Critical frequency"    },
    highFreqD:  { pt:`${fr.toFixed(1)}x — fadiga se aproximando`, es:`${fr.toFixed(1)}x — fatiga próxima`, en:`${fr.toFixed(1)}x — fatigue approaching` },
    highFreqQ:  { pt:"Minha frequência está alta. O que devo fazer agora?", es:"Mi frecuencia está alta. ¿Qué hago ahora?", en:"My frequency is high. What should I do now?" },
    lowCtr:     { pt:"CTR abaixo do esperado",   es:"CTR por debajo de lo esperado", en:"CTR below benchmark" },
    lowCtrD:    { pt:`${ctr.toFixed(2)}% — revise os hooks`, es:`${ctr.toFixed(2)}% — revisa los hooks`, en:`${ctr.toFixed(2)}% — review hooks` },
    lowCtrQ:    { pt:"Por que meu CTR está baixo? Quais criativos estão prejudicando?", es:"¿Por qué mi CTR está bajo?", en:"Why is my CTR low? Which creatives are hurting it?" },
    atRisk:     { pt:`${R.length} criativo${R.length>1?"s":""} em risco`, es:`${R.length} creativo${R.length>1?"s":""} en riesgo`, en:`${R.length} creative${R.length>1?"s":""} at risk` },
    atRiskD:    { pt:"Fadiga detectada — pausa recomendada", es:"Fatiga detectada — pausar recomendado", en:"Fatigue detected — pause recommended" },
    atRiskQ:    { pt:"Quais criativos devo pausar agora e por quê?", es:"¿Cuáles creativos debo pausar y por qué?", en:"Which creatives should I pause now and why?" },
    winners:    { pt:`${W.length} criativo${W.length>1?"s":""} prontos pra escalar`, es:`${W.length} creativo${W.length>1?"s":""} listos para escalar`, en:`${W.length} creative${W.length>1?"s":""} ready to scale` },
    winnersD:   { pt:"Janela aberta — CTR alto, freq baixa", es:"Ventana abierta — CTR alto, freq baja", en:"Window open — high CTR, low frequency" },
    winnersQ:   { pt:"Quais criativos posso escalar agora e como?", es:"¿Cuáles creativos puedo escalar ahora?", en:"Which creatives can I scale now and how?" },
    healthy:    { pt:"Conta saudável",            es:"Cuenta saludable",           en:"Healthy account"       },
    healthyD:   { pt:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — tudo bem`, es:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — todo bien`, en:`CTR ${ctr.toFixed(2)}% · freq ${fr.toFixed(1)}x — looking good` },
    healthyQ:   { pt:"Minha conta está performando bem. Como aproveitar este momento?", es:"Mi cuenta está bien. ¿Cómo aprovechar este momento?", en:"My account is performing well. How can I capitalize on this?" },
  };
  const t = (k: keyof typeof L) => (L[k] as any)[lang] || (L[k] as any).en;
  if (fr > 3.5) out.push({ t: "warn", title: t("highFreq"), detail: t("highFreqD"), q: t("highFreqQ") });
  if (ctr < 0.5 && sp > 50) out.push({ t: "warn", title: t("lowCtr"), detail: t("lowCtrD"), q: t("lowCtrQ") });
  if (R.length > 0) out.push({ t: "warn", title: t("atRisk"), detail: t("atRiskD"), q: t("atRiskQ") });
  if (W.length > 0) out.push({ t: "ok", title: t("winners"), detail: t("winnersD"), q: t("winnersQ") });
  if (!out.length && ctr > 1.5 && fr < 2.5) out.push({ t: "ok", title: t("healthy"), detail: t("healthyD"), q: t("healthyQ") });
  return out;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const Div = () => <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0" }} />;

// ── Section label ─────────────────────────────────────────────────────────────
const Sec = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px" }}>
    <span style={{ width: 3, height: 12, borderRadius: 2, background: c, flexShrink: 0 }}/>
    <p style={{ ...I, fontSize: 10, fontWeight: 700, color: c, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: 0, opacity: 0.85 }}>{children}</p>
  </div>
);

// ── Main LivePanel ────────────────────────────────────────────────────────────
function LivePanel({ user, selectedPersona, connections, lang, onSend }: {
  user: any; selectedPersona: any; connections: string[]; lang: string; onSend: (m: string) => void;
}) {
  const [pd,   setPd]   = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [fail, setFail] = React.useState<string | null>(null);
  const [tab,  setTab]  = React.useState<"meta" | "google">("meta"); // google disabled
  const [ts,   setTs]   = React.useState<Date | null>(null);
  const today = React.useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const addDaysAI = (d: Date, n: number) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
  const fmtAI = (d: Date) => d.toISOString().split("T")[0];
  const fmtLabelAI = (d: Date) => d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
  const PRESETS_AI = [{label:"7D",days:7},{label:"30D",days:30},{label:"90D",days:90}];
  const [dateRange, setDateRange] = React.useState({ from: addDaysAI(today,-6), to: today });
  const [activePreset, setActivePreset] = React.useState("7D");
  const [showCal, setShowCal] = React.useState(false);
  const [calDraft, setCalDraft] = React.useState<{from:Date|null;to:Date|null}>({from:null,to:null});
  const [calView, setCalView] = React.useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [calSel, setCalSel] = React.useState<"from"|"to">("from");
  const [calHover, setCalHover] = React.useState<Date|null>(null);
  const calRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    if(!showCal) return;
    const handler=(e:MouseEvent)=>{ if(calRef.current&&!calRef.current.contains(e.target as Node)) setShowCal(false); };
    setTimeout(()=>document.addEventListener("mousedown",handler),0);
    return ()=>document.removeEventListener("mousedown",handler);
  },[showCal]);

  const hasMeta   = connections.includes("meta");
  // hasGoogle — disabled (see GOOGLE_ADS_BACKUP.md)

  // ── Context lock: block stale async responses from previous persona/account ──
  const contextRef = React.useRef<string>("");
  const selectedAccId = storage.get(`meta_sel_${selectedPersona?.id}`, "") || "";
  const currentCtx = `${selectedPersona?.id}_${selectedAccId}`;

  // Hard clear on persona/account change — zero flash of old data
  React.useEffect(() => {
    if (contextRef.current && contextRef.current !== currentCtx) {
      setPd(null); setTs(null); setFail(null); setBusy(false);
    }
    contextRef.current = currentCtx;
  }, [currentCtx]);

  const load = React.useCallback(async () => {
    if (!user?.id || !selectedPersona?.id) return;
    const loadCtx = currentCtx; // snapshot context at call time
    setBusy(true); setFail(null);
    try {
      const days = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1;
      const period = days <= 7 ? "7d" : days <= 14 ? "14d" : days <= 30 ? "30d" : days <= 60 ? "60d" : "90d";
      const selectedAccId = storage.get(`meta_sel_${selectedPersona.id}`, "") || undefined;
      const { data: r, error: e } = await (supabase.functions.invoke as any)("live-metrics", {
        body: { user_id: user.id, persona_id: selectedPersona.id, period,
          date_from: fmtAI(dateRange.from), date_to: fmtAI(dateRange.to),
          account_id: selectedAccId }
      });
      if (e) throw new Error(e.message || "Erro");
      if (r?.ok) {
        // Adaptar formato do live-metrics para o formato esperado pelo LivePanel
        const adapted: any = {};
        if (r.meta && !r.meta.error) {
          const m = r.meta;
          adapted.meta = {
            account_name: m.account_name,
            currency_symbol: "R$",
            period: `${fmtAI(dateRange.from)} → ${fmtAI(dateRange.to)}`,
            kpis: {
              spend: m.spend?.toFixed(2) || "0.00",
              ctr: ((m.ctr || 0) * 100).toFixed(2),
              cpm: m.cpm ? m.cpm.toFixed(2) : (m.impressions > 0 ? ((m.spend / m.impressions) * 1000).toFixed(2) : "0.00"),
              cpc: m.cpc ? m.cpc.toFixed(2) : "0.00",
              frequency: m.frequency ? m.frequency.toFixed(2) : "0.00",
              reach: m.reach || 0,
              roas: m.roas ? m.roas.toFixed(2) : null,
              cpa: m.cpa ? m.cpa.toFixed(2) : null,
              conversions: (m.conversions || 0).toFixed(0),
              active_ads: m.top_ads?.length || 0,
            },
            top_ads: (m.top_ads || []).map((a: any) => ({
              name: a.ad_name || a.name, campaign: a.campaign_name,
              spend: a.spend, ctr: (a.ctr || 0) * 100,
              cpm: a.cpm || 0, freq: 0, conv: a.conversions || 0,
              isWinner: (a.ctr || 0) * 100 > 1.5 && a.spend > 5,
              isRisk: (a.ctr || 0) * 100 < 0.5 && a.spend > 20,
            })),
            winners: [],
            at_risk: [],
            campaigns: [],
            time_series: (m.daily || []).map((d: any) => ({
              date: d.date, spend: d.spend, ctr: (d.ctr || 0) * 100, cpm: 0
            })),
          };
          adapted.meta.winners = adapted.meta.top_ads.filter((a: any) => a.isWinner).slice(0, 5);
          adapted.meta.at_risk = adapted.meta.top_ads.filter((a: any) => a.isRisk).slice(0, 5);
        }
        // google result handling — disabled (see GOOGLE_ADS_BACKUP.md)
        // Context lock: only apply if still on the same persona+account
        if (loadCtx === contextRef.current) {
          setPd(adapted); setTs(new Date());
        }
      } else throw new Error(r?.error || "Resposta inválida");
    } catch (e: any) {
      if (loadCtx === contextRef.current) setFail(e.message || "Falha");
    }
    finally {
      if (loadCtx === contextRef.current) setBusy(false);
    }
  }, [user?.id, selectedPersona?.id, connections.join(","), dateRange.from.getTime(), dateRange.to.getTime(), currentCtx]);

  React.useEffect(() => { load(); }, [load]);

  // Recarregar quando usuário troca de conta Meta
  React.useEffect(() => {
    const onAccChanged = () => load();
    window.addEventListener("meta-account-changed", onAccChanged);
    return () => window.removeEventListener("meta-account-changed", onAccChanged);
  }, [load]);

  const data = pd?.[tab];
  const k = data?.kpis || {};
  const spS = (data?.time_series || []).map((d: any) => d.spend);
  const cS  = (data?.time_series || []).map((d: any) => d.ctr);
  const sTr = spS.length >= 2 ? (spS[spS.length - 1] > spS[0] ? "up" : "down") as "up" | "down" : "flat";
  const cTr = cS.length   >= 2 ? (cS[cS.length - 1]   > cS[0]   ? "up" : "down") as "up" | "down" : "flat";
  const alerts = tab === "meta" ? mkAlerts(data, lang) : [];
  const accName = data?.account_name || "";
  const isEmpty = data && !data.error && !parseInt(k.active_ads || k.active_campaigns || "0") && !(data.top_ads?.length) && !(data.campaigns?.length);

  const tcfg: Record<string, { label: string; c: string }> = {
    meta:   { label: "Meta Ads",   c: "#3b82f6" },
    // google: disabled
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LIVE PANEL v5 — Premium glassmorphism metrics dashboard
  // ══════════════════════════════════════════════════════════════════════════
  {
    const cur = data?.currency_symbol || "R$";
    const metrics = data && !data.error && !busy ? [
      k.spend       && { lbl: lang==="pt"?"Gasto":lang==="es"?"Gasto":"Spend", val: `${cur}${parseFloat(k.spend||0).toLocaleString(undefined,{maximumFractionDigits:0})}`, warn: false, tr: sTr, color: "#F1F5F9", icon: "spend" },
      k.ctr         && { lbl: "CTR", val: `${parseFloat(k.ctr||0).toFixed(2)}%`, warn: parseFloat(k.ctr) < 0.5, tr: cTr, color: parseFloat(k.ctr) > 1.5 ? "#10B981" : parseFloat(k.ctr) < 0.5 ? "#EF4444" : "#F1F5F9", icon: "ctr" },
      k.cpm && parseFloat(k.cpm) > 0 && { lbl: "CPM", val: `${cur}${parseFloat(k.cpm||0).toFixed(1)}`, warn: false, tr: "flat" as const, color: "#F1F5F9", icon: "cpm" },
      k.cpc && parseFloat(k.cpc) > 0 && { lbl: "CPC", val: `${cur}${parseFloat(k.cpc).toFixed(2)}`, warn: false, tr: "flat" as const, color: "#F1F5F9", icon: "cpc" },
      k.frequency && parseFloat(k.frequency) > 0 && { lbl: "Freq", val: `${parseFloat(k.frequency).toFixed(1)}x`, warn: parseFloat(k.frequency) > 3.5, tr: "flat" as const, color: parseFloat(k.frequency) > 3.5 ? "#EF4444" : "#F1F5F9", icon: "freq" },
      k.conversions && k.conversions !== "0" && { lbl: "Conv", val: k.conversions, warn: false, tr: "flat" as const, color: "#10B981", icon: "conv" },
      k.roas && parseFloat(k.roas) > 0 && { lbl: "ROAS", val: `${parseFloat(k.roas).toFixed(2)}x`, warn: parseFloat(k.roas) < 1, tr: "flat" as const, color: parseFloat(k.roas) >= 2 ? "#10B981" : parseFloat(k.roas) < 1 ? "#EF4444" : "#F1F5F9", icon: "roas" },
    ].filter(Boolean) : [];
    const isLive = !busy && !fail;

    return (
      <div className="lp lp-bar" style={{
        ...I, display: "flex", flexDirection: "column" as const,
        padding: "0", userSelect: "none" as const,
        background: "rgba(6,10,20,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(148,163,184,0.06)",
        position: "relative" as const, zIndex: 10,
      }}>
        {/* ── Top accent gradient line ── */}
        <div style={{
          height: 1, width: "100%",
          background: isLive
            ? "linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.4) 20%, rgba(16,185,129,0.4) 50%, rgba(37,99,235,0.4) 80%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.08) 50%, transparent 100%)",
          flexShrink: 0,
        }}/>

        {/* ── Main content row ── */}
        <div style={{
          display: "flex", alignItems: "center", height: 56,
          padding: "0 20px", gap: 0,
        }}>

          {/* ── Left: Live status badge ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0, marginRight: 16,
          }}>
            {/* Live indicator orb */}
            <div style={{
              position: "relative" as const, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* Outer glow ring */}
              <div style={{
                position: "absolute" as const, inset: 0, borderRadius: "50%",
                border: `1.5px solid ${isLive ? "rgba(16,185,129,0.25)" : busy ? "rgba(148,163,184,0.12)" : "rgba(239,68,68,0.25)"}`,
                animation: isLive ? "lpRingPulse 3s ease-in-out infinite" : "none",
              }}/>
              {/* Inner orb with Meta logo */}
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isLive ? "rgba(16,185,129,0.08)" : busy ? "rgba(148,163,184,0.06)" : "rgba(239,68,68,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isLive ? "0 0 12px rgba(16,185,129,0.15)" : "none",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.9 }}>
                  <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta-g0)"/>
                  <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta-g1)"/>
                  <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta-g2)"/>
                  <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta-g3)"/>
                  <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta-g4)"/>
                  <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta-g5)"/>
                  <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
                  <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta-g6)"/>
                  <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
                  <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta-g7)"/>
                  <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta-g8)"/>
                  <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta-g9)"/>
                  <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta-g10)"/>
                  <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta-g11)"/>
                  <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta-g12)"/>
                  <defs>
                    <linearGradient id="meta-g0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
                    <linearGradient id="meta-g1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
                    <linearGradient id="meta-g2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
                    <linearGradient id="meta-g3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
                    <linearGradient id="meta-g4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
                    <linearGradient id="meta-g5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
                    <linearGradient id="meta-g6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
                    <linearGradient id="meta-g7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
                    <linearGradient id="meta-g8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
                    <linearGradient id="meta-g9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
                    <linearGradient id="meta-g10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
                    <linearGradient id="meta-g11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
                    <linearGradient id="meta-g12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Status text */}
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 1 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                textTransform: "uppercase" as const, lineHeight: 1,
                color: busy ? "#94A3B8" : fail ? "#EF4444" : "#10B981",
                fontFamily: F,
              }}>
                {busy ? (lang==="pt"?"Atualizando":"Updating") : fail ? "Error" : "LIVE"}
              </span>
              {accName && !busy && !fail && (
                <span style={{
                  fontSize: 10, fontWeight: 500, color: "#475569",
                  fontFamily: F, lineHeight: 1, maxWidth: 100,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                }}>
                  {accName}
                </span>
              )}
            </div>
          </div>

          {/* ── Separator ── */}
          <div style={{ width: 1, height: 28, background: "rgba(148,163,184,0.08)", flexShrink: 0 }}/>

          {/* ── Metric cards ── */}
          {metrics.length > 0 && (
            <div className="lp-metrics-scroll" style={{
              display: "flex", alignItems: "center", flex: 1, overflow: "hidden",
              marginLeft: 14, gap: 3,
            }}>
              {(metrics as any[]).map((item: any) => (
                <div key={item.lbl} style={{
                  display: "flex", flexDirection: "column" as const,
                  flexShrink: 0, padding: "6px 14px", borderRadius: 10,
                  background: "rgba(148,163,184,0.03)",
                  border: "1px solid rgba(148,163,184,0.06)",
                  transition: "all 0.2s ease",
                  cursor: "default",
                  position: "relative" as const,
                  minWidth: 58,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(148,163,184,0.07)";
                    e.currentTarget.style.borderColor = "rgba(148,163,184,0.14)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(148,163,184,0.03)";
                    e.currentTarget.style.borderColor = "rgba(148,163,184,0.06)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {/* Label row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 600, color: "#64748B",
                      fontFamily: F,
                      letterSpacing: "0.06em", textTransform: "uppercase" as const,
                      lineHeight: 1,
                    }}>
                      {item.lbl}
                    </span>
                    {item.tr !== "flat" && (
                      <span style={{
                        fontSize: 7, fontWeight: 700, lineHeight: 1,
                        color: item.tr === "up" ? "#10B981" : "#EF4444",
                        display: "flex", alignItems: "center",
                      }}>
                        {item.tr === "up" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                  {/* Value */}
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: item.color || "#F1F5F9",
                    fontFamily: F,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}>
                    {item.val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Loading skeleton shimmer ── */}
          {busy && metrics.length === 0 && (
            <>
              <style>{`@keyframes lpSkPulse{0%,100%{opacity:0.15}50%{opacity:0.4}}`}</style>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, marginLeft: 14 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width: 64 + i * 6, height: 38, borderRadius: 10,
                    background: "rgba(148,163,184,0.06)",
                    border: "1px solid rgba(148,163,184,0.04)",
                    animation: `lpSkPulse 1.6s ease-in-out ${i * 0.12}s infinite`,
                  }}/>
                ))}
              </div>
            </>
          )}

          {/* ── Error ── */}
          {fail && !busy && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flex: 1, marginLeft: 14,
              padding: "6px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#EF4444", fontFamily: F, opacity: 0.8 }}>
                {lang==="pt" ? "Falha ao carregar dados" : lang==="es" ? "Error al cargar datos" : "Failed to load data"}
              </span>
              <button onClick={load} style={{
                fontSize: 10, fontWeight: 700, color: "#2563EB", background: "none",
                border: "none", cursor: "pointer", fontFamily: F, padding: "2px 6px",
              }}>
                {lang==="pt" ? "Tentar" : "Retry"}
              </button>
            </div>
          )}

          {/* ── Right side: segmented date control + calendar ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 14, position: "relative" as const }}>
            {/* Segmented control background */}
            <div style={{
              display: "flex", alignItems: "center",
              padding: 2, borderRadius: 10,
              background: "rgba(148,163,184,0.04)",
              border: "1px solid rgba(148,163,184,0.06)",
              gap: 1,
            }}>
              {PRESETS_AI.map(p => (
                <button key={p.label} onClick={() => {
                  setActivePreset(p.label);
                  setDateRange({ from: addDaysAI(today, -(p.days - 1)), to: today });
                }}
                  style={{
                    padding: "5px 12px", borderRadius: 8, border: "none",
                    background: activePreset === p.label
                      ? "rgba(37,99,235,0.14)"
                      : "transparent",
                    color: activePreset === p.label ? "#2563EB" : "rgba(255,255,255,0.45)",
                    fontSize: 10, fontWeight: 700, fontFamily: F,
                    letterSpacing: "0.02em", cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { if (activePreset !== p.label) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}}
                  onMouseLeave={e => { if (activePreset !== p.label) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendar icon for custom date */}
            <button onClick={() => setShowCal(!showCal)}
              style={{
                width: 32, height: 32, borderRadius: 10, border: "none",
                background: showCal ? "rgba(37,99,235,0.14)" : "rgba(255,255,255,0.04)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease", marginLeft: 2,
              }}
              onMouseEnter={e => { if (!showCal) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { if (!showCal) e.currentTarget.style.background = showCal ? "rgba(37,99,235,0.14)" : "rgba(255,255,255,0.04)"; }}
              title={lang === "pt" ? "Escolher datas" : "Pick dates"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showCal ? "#2563EB" : "rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>

            {/* Calendar dropdown */}
            {showCal && (
              <div ref={calRef} style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 100,
                background: "rgba(10,15,28,0.96)",
                border: "1px solid rgba(148,163,184,0.10)",
                borderRadius: 16, padding: 18, minWidth: 270,
                boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(148,163,184,0.04)",
                backdropFilter: "blur(20px) saturate(180%)",
              }}>
                {/* Month nav */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <button onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() - 1, 1))}
                    style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 14, padding: "4px 8px", borderRadius: 6, lineHeight: 1, transition: "all 0.15s" }}>
                    ‹
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#F1F5F9", fontFamily: F }}>
                    {calView.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() + 1, 1))}
                    style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 14, padding: "4px 8px", borderRadius: 6, lineHeight: 1, transition: "all 0.15s" }}>
                    ›
                  </button>
                </div>
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
                  {(lang === "pt" ? ["D","S","T","Q","Q","S","S"] : ["S","M","T","W","T","F","S"]).map((d, i) => (
                    <div key={i} style={{ fontSize: 9, fontWeight: 700, color: "#475569", textAlign: "center", padding: 4, fontFamily: F, letterSpacing: "0.04em" }}>{d}</div>
                  ))}
                </div>
                {/* Calendar days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                  {(() => {
                    const first = new Date(calView.getFullYear(), calView.getMonth(), 1);
                    const last = new Date(calView.getFullYear(), calView.getMonth() + 1, 0);
                    const cells: React.ReactNode[] = [];
                    for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= last.getDate(); d++) {
                      const dt = new Date(calView.getFullYear(), calView.getMonth(), d);
                      const isFrom = calDraft.from && dt.toDateString() === calDraft.from.toDateString();
                      const isTo = calDraft.to && dt.toDateString() === calDraft.to.toDateString();
                      const inRange = calDraft.from && calDraft.to && dt >= calDraft.from && dt <= calDraft.to;
                      const isFuture = dt > today;
                      cells.push(
                        <button key={d} disabled={isFuture} onClick={() => {
                          if (calSel === "from") {
                            setCalDraft({ from: dt, to: null });
                            setCalSel("to");
                          } else {
                            const from = calDraft.from!;
                            const finalFrom = dt < from ? dt : from;
                            const finalTo = dt < from ? from : dt;
                            setCalDraft({ from: finalFrom, to: finalTo });
                            setActivePreset("");
                            setDateRange({ from: finalFrom, to: finalTo });
                            setShowCal(false);
                            setCalSel("from");
                          }
                        }}
                          style={{
                            width: "100%", aspectRatio: "1", border: "none", borderRadius: 8,
                            background: isFrom || isTo ? "rgba(37,99,235,0.25)" : inRange ? "rgba(37,99,235,0.08)" : "transparent",
                            color: isFuture ? "rgba(148,163,184,0.15)" : isFrom || isTo ? "#2563EB" : "#F1F5F9",
                            fontSize: 11, fontWeight: isFrom || isTo ? 700 : 500, fontFamily: F,
                            cursor: isFuture ? "default" : "pointer",
                            transition: "all 0.1s",
                          }}
                        >
                          {d}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
                {/* Current range label */}
                <div style={{
                  marginTop: 12, fontSize: 10, color: "#64748B", textAlign: "center", fontFamily: F,
                  padding: "6px 0", borderTop: "1px solid rgba(148,163,184,0.06)",
                }}>
                  {fmtLabelAI(dateRange.from)} — {fmtLabelAI(dateRange.to)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Keyframes ── */}
        <style>{`
          @keyframes lpRingPulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.06); }
          }
        `}</style>
      </div>
    );
  }

  // LivePanel — compact bar only (no expanded panel)
  return null;
}




// ─────────────────────────────────────────────────────────────────────────────
// Memory extraction runs backend-side in adbrief-ai-chat → extract-chat-memory
// edge function (fire-and-forget, with Haiku dedup + 50/persona cap). The
// browser never touches the Anthropic API directly — API keys stay in the
// edge environment where they belong.
// ─────────────────────────────────────────────────────────────────────────────

export default function AdBriefAI() {
  usePageTitle("IA Chat");
  const {user,profile,selectedPersona,setSelectedPersona,accountAlerts:ctxAlerts}=useOutletContext<DashboardContext>();
  const {language}=useLanguage();
  const lang=(["pt","es"].includes(language)?language:"en") as "pt"|"es"|"en";
  const navigate=useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // SK scoped per persona — each account has its own persistent chat history
  const SK=`adbrief_chat_v1_${selectedPersona?.id||"default"}`;

  const [messages,setMessages]=useState<AIMessage[]>(()=>{
    if (!selectedPersona?.id) return [];
    try {
      const saved = storage.getJSON(SK, []);
      const sanitized = saved.map((m: any) => ({
        ...m,
        blocks: (m.blocks||[]).filter((b: any) => b.type !== "trend_chart")
      }));
      const hasUserHistory = sanitized.some((m: any) => m?.role === "user" && String(m?.userText || "").trim().length > 0);
      return hasUserHistory ? sanitized : [];
    } catch { return []; }
  });
  /* ── Inject demo analysis into chat when arriving from demo signup ── */
  const demoInjectedRef = useRef(false);
  const demoMessagesRef = useRef<AIMessage[] | null>(null);
  // Track whether from_demo param was present on initial load (before any effect cleans it)
  const fromDemoParam = useRef(searchParams.get("from_demo") === "1");
  // Parse demo data IMMEDIATELY on mount — no persona dependency
  // This ensures demoMessagesRef is populated before any greeting path reads it
  useEffect(() => {
    if (demoInjectedRef.current) return;
    if (!fromDemoParam.current) return;
    demoInjectedRef.current = true;
    // Clean up URL param
    searchParams.delete("from_demo");
    setSearchParams(searchParams, { replace: true });
    try {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!saved) return;
      const { result, preview } = JSON.parse(saved);
      if (!result?.score) return;
      localStorage.removeItem(DEMO_STORAGE_KEY);
      const now = Date.now();
      const pt = lang === "pt"; const es = lang === "es";
      // Build a rich analysis text from the demo result (same format as /demo, fully readable)
      const parts: string[] = [];
      parts.push(`**${pt ? "Nota" : es ? "Nota" : "Score"}: ${result.score}/10** \u2014 ${result.verdict || ""}`);
      if (result.hook) parts.push(`\n**${pt ? "O que funciona" : es ? "Lo que funciona" : "What works"}:**\n${result.hook}`);
      if (result.message) parts.push(`\n**${pt ? "O que melhorar" : es ? "Qu\u00e9 mejorar" : "What to improve"}:**\n${result.message}`);
      if (result.cta) parts.push(`\n**CTA:** ${result.cta}`);
      if (result.actions?.length) parts.push(`\n**${pt ? "Pr\u00f3ximos passos" : es ? "Pr\u00f3ximos pasos" : "Next steps"}:**\n${result.actions.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}`);
      parts.push(`\n---\n${pt ? "Conecte sua conta de Meta Ads para an\u00e1lises conectadas aos seus dados reais de ROAS, CTR e spend." : es ? "Conecta tu cuenta de Meta Ads para an\u00e1lisis conectados a tus datos reales." : "Connect your Meta Ads account for analyses connected to your real ROAS, CTR and spend data."}`);
      const analysisText = parts.join("\n");
      const demoMessages: AIMessage[] = [
        { role: "user", id: now, ts: now, userText: pt ? "Analise este anúncio" : es ? "Analiza este anuncio" : "Analyze this ad", imagePreview: preview || undefined },
        { role: "assistant", id: now + 1, ts: now + 1, blocks: [{ type: "text", title: pt ? "Análise do anúncio" : es ? "Análisis del anuncio" : "Ad Analysis", content: analysisText }] },
      ];
      // Keep the unlocked demo alive even if persona/account selection finishes a bit later
      demoMessagesRef.current = demoMessages;
      storage.setJSON("adbrief_chat_v1_default", demoMessages);
      // Prevent proactive greeting from overwriting demo messages
      proactiveFired.current = true;
      // Also force contextReady so the chat doesn't show spinner
      setContextReady(true);
    } catch {}
  }, []);

  const [accountAlerts,setAccountAlerts]=useState<any[]>(ctxAlerts||[]);
  // Virtual scroll: render only last N messages for performance
  // User can load older messages with "Ver mais"
  const MSG_PAGE = 30;
  const [visibleCount, setVisibleCount] = useState(MSG_PAGE);
  // Reset visible count when conversation clears
  const visibleMessages = messages.slice(-visibleCount);
  const hasOlderMessages = messages.length > visibleCount;
  const [alertsDismissing,setAlertsDismissing]=useState<Set<string>>(new Set());
  const [greetingKey,setGreetingKey]=useState(0);
  // Onboarding quiz removed — AI learns from conversation naturally
  const [chatImage,setChatImage]=useState<{base64:string;name:string;preview:string;mediaType:string}|null>(null);
  // Last image the user analyzed in this conversation. Re-attached on follow-up
  // turns so the AI doesn't lose pixel context. Cleared when persona switches or
  // user uploads a new image. Preserved as long as the conversation continues.
  const [lastAnalyzedImage,setLastAnalyzedImage]=useState<{base64:string;name:string;mediaType:string}|null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [chatDragOver,setChatDragOver]=useState(false);
  const [input,setInput]=useState("");
  // Support ?prompt= query param — pre-fill input from URL
  const promptParam = useRef(searchParams.get("prompt"));
  useEffect(() => {
    if (promptParam.current && selectedPersona?.id) {
      setInput(promptParam.current);
      searchParams.delete("prompt");
      setSearchParams(searchParams, { replace: true });
      promptParam.current = null;
    }
  }, [selectedPersona?.id]);


  // Session goal — persists 7 days, resets automatically
  const GOAL_KEY = `adbrief_goal_${selectedPersona?.id || "default"}`;
  const [sessionGoal, setSessionGoal] = useState<string>(() => {
    try {
      const saved = storage.getJSON(GOAL_KEY, null);
      if (saved?.text && saved?.ts && Date.now() - saved.ts < 7 * 24 * 60 * 60 * 1000) return saved.text;
    } catch {}
    return "";
  });
  const [showGoalInput, setShowGoalInput] = useState(false);
  const saveGoal = (text: string) => {
    setSessionGoal(text);
    try { storage.setJSON(GOAL_KEY, { text, ts: Date.now() }); } catch {}
    setShowGoalInput(false);
  };
  const [loading,setLoading]=useState(false);
  const [streamingMsgId,setStreamingMsgId]=useState<number|null>(null);
  const streamTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [contextReady,setContextReady]=useState(false);
  const [context,setContext]=useState("");
  const [connections,setConnections]=useState<string[]>([]);
  const [connectionsLoading,setConnectionsLoading]=useState(false);
  const [feedback,setFeedback]=useState<Record<number,"like"|"dislike"|null>>({});
  const [copiedId,setCopiedId]=useState<number|null>(null);
  const [activeTool,setActiveTool]=useState<string|null>(null);
  const [activeToolParams,setActiveToolParams]=useState<Record<string,string>>({});
  // Tool menu (thought-bubble stack) — opens from the [+] trigger inside the composer
  const [showToolMenu,setShowToolMenu]=useState(false);
  const toolMenuRef=useRef<HTMLDivElement>(null);
  const toolTriggerRef=useRef<HTMLButtonElement>(null);
  const [showUpgradeWall,setShowUpgradeWall]=useState(false);
  // Credit balance from the new credit system
  const [creditBalance,setCreditBalance]=useState<{remaining:number,total:number}|null>(null);

  // ── Custom confirm modal — replaces native window.confirm() ─────────────
  // Promise-based so callsites stay async/clean: `if (await confirmAsync({...})) ...`
  // Queue-backed: when N parallel actions all hit a force-confirm guard
  // (e.g. bulk pause, 3 cards clicked fast), each one's modal waits its
  // turn instead of overwriting the previous and orphaning its Promise.
  // Two visual variants: "default" (clear chat, neutral) and "warning" (force-pause,
  // orange/danger). Variant drives accent color, button copy, and the optional
  // detail block (e.g. snapshot stats from the pause-safety guard).
  type ConfirmRequest = {
    variant: "default" | "warning";
    title: string;
    message: string;
    detail?: string | null;       // optional secondary line (smaller, dimmer)
    confirmLabel: string;
    cancelLabel: string;
    onResolve: (ok: boolean) => void;
  };
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRequest[]>([]);
  const confirmModal = confirmQueue[0] || null;
  const confirmAsync = useCallback((opts: Omit<ConfirmRequest, "onResolve">): Promise<boolean> => {
    return new Promise((resolve) => {
      const req: ConfirmRequest = {
        ...opts,
        onResolve: (ok) => {
          // Pop only THIS request from the queue. Use a ref-style filter so
          // we don't accidentally drop a sibling that snuck in between
          // mount and click (rare, but harmless to guard against).
          setConfirmQueue((prev) => prev.filter((r) => r !== req));
          resolve(ok);
        },
      };
      setConfirmQueue((prev) => [...prev, req]);
    });
  }, []);
  const [proactiveLoading,setProactiveLoading]=useState(true); // start true to prevent "Conecte" flash
  const proactiveFired=useRef(false);
  const onboardingSessionDone=useRef(false);
  const [showOnboardingWelcome,setShowOnboardingWelcome]=useState(false);
  const [onboardingStep,setOnboardingStep]=useState<number|null>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const prevPersonaId=useRef<string|null>(null);

  // ── Scroll to bottom on mount / when messages first load ──
  const initialScrollDone=useRef(false);
  useEffect(()=>{
    if(messages.length>0 && !initialScrollDone.current){
      initialScrollDone.current=true;
      // Use setTimeout to ensure DOM is rendered
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"instant"}),50);
    }
  },[messages.length]);

  // Reset scroll flag when persona changes
  useEffect(()=>{
    initialScrollDone.current=false;
  },[selectedPersona?.id]);

  // ── Tool menu: close on click-outside + ESC ──
  useEffect(()=>{
    if(!showToolMenu) return;
    const onDown=(e:MouseEvent)=>{
      const t=e.target as Node;
      if(toolMenuRef.current?.contains(t)) return;
      if(toolTriggerRef.current?.contains(t)) return;
      setShowToolMenu(false);
    };
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape") setShowToolMenu(false); };
    document.addEventListener("mousedown",onDown);
    document.addEventListener("keydown",onKey);
    return ()=>{ document.removeEventListener("mousedown",onDown); document.removeEventListener("keydown",onKey); };
  },[showToolMenu]);

  // ── Load credit balance on mount ──
  useEffect(()=>{
    if(!user?.id) return;
    const load = async () => {
      try {
        const { data } = await supabase.functions.invoke("check-usage", {
          body: { user_id: user.id },
        });
        if(data?.credits){
          setCreditBalance({ remaining: data.credits.remaining, total: data.credits.total + (data.credits.bonus||0) });
        }
      } catch(e: any){
        // Non-fatal — credits panel will fall back to its default. Log so we
        // can see real outages instead of silent failures.
        console.warn('[AdBriefAI] check-usage failed', e?.message || e);
      }
    };
    load();
  },[user?.id]);

  // ── Load correct chat history when account changes (no reset — each account has its own history) ──
  useEffect(()=>{
    const newId = selectedPersona?.id || null;
    if(prevPersonaId.current !== newId) {
      // Image memory is scoped per persona — clear when switching
      setLastAnalyzedImage(null);
      // Load this account's saved history from localStorage
      const newSK = `adbrief_chat_v1_${newId||"default"}`;
      try {
        if (!newId) {
          setMessages([]);
        } else {
          const sanitizeMessages = (items: any[]) => items.map((m: any) => ({
            ...m,
            blocks: (m.blocks || []).filter((b: any) => b.type !== "trend_chart")
          }));
          const hasUserHistory = (items: any[]) =>
            items.some((m: any) => m?.role === "user" && String(m?.userText || "").trim().length > 0);

          const saved = sanitizeMessages(storage.getJSON(newSK, []));
          const currentVisible = sanitizeMessages(messages as any[]);
          const defaultSaved = sanitizeMessages(storage.getJSON("adbrief_chat_v1_default", []));

          if (hasUserHistory(saved)) {
            setMessages(saved);
          } else if (fromDemoParam.current && hasUserHistory(currentVisible)) {
            setMessages(currentVisible as AIMessage[]);
            storage.setJSON(newSK, currentVisible);
            storage.remove("adbrief_chat_v1_default");
          } else if (fromDemoParam.current && hasUserHistory(defaultSaved)) {
            setMessages(defaultSaved as AIMessage[]);
            storage.setJSON(newSK, defaultSaved);
            storage.remove("adbrief_chat_v1_default");
          } else {
            setMessages([]);
          }
        }
      } catch { setMessages([]); }
      // Reload session goal for this account
      const goalKey = `adbrief_goal_${newId||"default"}`;
      try {
        const saved = storage.getJSON(goalKey, null);
        if (saved?.text && saved?.ts && Date.now() - saved.ts < 7 * 24 * 60 * 60 * 1000) {
          setSessionGoal(saved.text);
        } else {
          setSessionGoal("");
        }
      } catch { setSessionGoal(""); }
      // Reset account-specific UI state — strict persona isolation
      setShowOnboardingWelcome(false);
      setOnboardingStep(null);
      proactiveFired.current = false;
      demoMessagesRef.current = null; // clear stale demo messages from previous persona
      onboardingSessionDone.current = false; // new persona = check onboarding again
      // Kill any in-flight streaming/loading from previous persona
      setStreamingMsgId(null);
      if (streamTimerRef.current) { clearTimeout(streamTimerRef.current); streamTimerRef.current = null; }
      setLoading(false); // cancel any pending send spinner
      setProactiveLoading(false); // cancel any pending proactive greeting
      setContextReady(false);
      setConnections([]);
      if (newId) setGreetingKey(k => k + 1);
    }
    prevPersonaId.current = newId;
  },[selectedPersona?.id]);

  // Load connections — STRICT: only scoped to this account, NO global fallback
  // Load connections — runs on persona change AND when tab becomes visible
  // (user may have connected/disconnected in Accounts tab)
  const loadConnections = React.useCallback(() => {
    if(!user?.id) { setConnections([]); setConnectionsLoading(false); return; }
    const pid = selectedPersona?.id || null;
    if(!pid) { setConnections([]); setConnectionsLoading(false); return; }
    setConnectionsLoading(true);
    supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: user.id }
    }).then(({ data }: any) => {
      // Context guard: discard if persona changed during fetch
      if ((selectedPersona?.id || null) !== pid) return;
      const all = (data?.connections || []) as any[];
      const scoped = all.filter((c: any) => c.persona_id === pid && c.status === "active");
      setConnections(scoped.map((c: any) => c.platform));
      setConnectionsLoading(false);
      // Save ad_accounts list to localStorage for account switcher in LivePanel
      const metaConn = scoped.find((c: any) => c.platform === "meta");
      if (metaConn?.ad_accounts?.length) {
        storage.setJSON(`meta_accounts_${pid}`, metaConn.ad_accounts);
      }
    }).catch(() => { if ((selectedPersona?.id || null) === pid) { setConnections([]); setConnectionsLoading(false); } });
  }, [user?.id, selectedPersona?.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    const onVisible = () => { if(document.visibilityState === "visible") loadConnections(); };
    document.addEventListener("visibilitychange", onVisible);
    // Also reload when user changes Meta ad account in AccountsPage
    const onAccChanged = () => { loadConnections(); setGreetingKey(k => k+1); };
    window.addEventListener("meta-account-changed", onAccChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("meta-account-changed", onAccChanged);
    };
  }, [loadConnections]);

  // Proactive greeting — fires when connections are known (after context is ready)
  useEffect(()=>{
    if(!contextReady || proactiveFired.current) return;
    if(!lang) return;
    if(!user?.id) return;
    // No persona — show welcome message for new users without account
    if(!selectedPersona?.id){
      proactiveFired.current = true;
      const hour = new Date().getHours();
      const greeting = lang==="pt"
        ? (hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite")
        : lang==="es"
        ? (hour<12?"Buenos días":hour<18?"Buenas tardes":"Buenas noches")
        : (hour<12?"Good morning":hour<18?"Good afternoon":"Good evening");

      const welcome = lang==="pt"
        ? `${greeting}! Bem-vindo ao AdBrief. Sou sua IA de performance criativa para Meta Ads.\n\nPosso te ajudar com:\n- Gerar hooks que convertem\n- Escrever roteiros para vídeo ads\n- Analisar criativos (manda uma imagem)\n- Estratégia criativa para seu nicho\n\nPara análises conectadas aos seus dados reais (CTR, ROAS, o que escalar e pausar), crie uma conta em **Contas** e conecte o Meta Ads.\n\nMe conta: qual seu nicho e o que está trabalhando agora?`
        : lang==="es"
        ? `${greeting}! Bienvenido a AdBrief. Soy tu IA de performance creativa para Meta Ads.\n\nPuedo ayudarte con:\n- Generar hooks que convierten\n- Escribir guiones para video ads\n- Analizar creativos (envía una imagen)\n- Estrategia creativa para tu nicho\n\nPara análisis conectados a tus datos reales, crea una cuenta en **Cuentas** y conecta Meta Ads.\n\nCuéntame: ¿cuál es tu nicho y en qué estás trabajando?`
        : `${greeting}! Welcome to AdBrief. I'm your creative performance AI for Meta Ads.\n\nI can help with:\n- Generate high-converting hooks\n- Write video ad scripts\n- Analyze creatives (send an image)\n- Creative strategy for your niche\n\nFor analyses connected to your real data (CTR, ROAS, what to scale and pause), create an account in **Accounts** and connect Meta Ads.\n\nTell me: what's your niche and what are you working on?`;

      const aid = Date.now() + 1;
      const demoMsgs0 = demoMessagesRef.current || [];
      demoMessagesRef.current = null;
      setMessages([{
        role: "assistant",
        blocks: [
          { type: "text" as any, title: greeting + "!", content: welcome },
        ],
        ts: aid, id: aid
      }, ...demoMsgs0]);
      setProactiveLoading(false);
      return;
    }
    // Wait a tick to let connections settle
    const timer = setTimeout(()=>{
      const pid = selectedPersona?.id || null;
      const hasMetaConn = connections.includes("meta");
      const hasGoogleConn = false /* google disabled */;
      const hasAnyConn = hasMetaConn || hasGoogleConn;

      // Server-side filter by persona_id — prevents cross-account snapshot leakage
      const buildSnapQuery = () => {
        const q = (supabase as any).from("daily_snapshots")
          .select("date,total_spend,avg_ctr,active_ads,winners_count,losers_count,yesterday_ctr,ai_insight,top_ads,raw_period")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5);
        return pid ? q.eq("persona_id", pid) : q.is("persona_id", null);
      };
      // Normalize CTR from daily_snapshots — old data stored as percentage (7.818),
      // new data (after fix) stored as decimal (0.07818). If >1, it's percentage → divide by 100.
      const normSnap = (s: any) => {
        if (!s) return s;
        if (s.avg_ctr > 1) s.avg_ctr = s.avg_ctr / 100;
        if (s.yesterday_ctr > 1) s.yesterday_ctr = s.yesterday_ctr / 100;
        if (Array.isArray(s.top_ads)) s.top_ads = s.top_ads.map((a: any) => ({ ...a, ctr: a.ctr > 1 ? a.ctr / 100 : a.ctr }));
        return s;
      };

      // Fetch live-metrics in parallel — same source as Feed KPIs / LivePanel
      // This ensures BRIEFING card shows the SAME numbers users see elsewhere.
      // CRITICAL: pass the same account_id LivePanel uses, otherwise the edge fn
      // falls back to a different account and the briefing ends up showing the
      // wrong totals (e.g. top chips R$112 vs briefing R$51).
      //
      // Date-range parity with LivePanel:
      // LivePanel defaults to {from: today-6, to: today} which is an INCLUSIVE
      // 7-day window. If we just send period:"7d" the backend computes
      // since = today - 7 days → 8-day window → higher spend number.
      // We replicate LivePanel's math here so the briefing card and the top
      // KPI chips can never disagree.
      const fmtISO = (d: Date) => d.toISOString().split("T")[0];
      const briefTo = new Date();
      const briefFrom = new Date(briefTo.getTime() - 6 * 86400000);
      const fetchLive = async (): Promise<{ spend: number; ctr: number; clicks: number; impressions: number; active_ads: number } | null> => {
        if (!hasMetaConn) return null;
        try {
          const selectedAccId = pid ? (storage.get(`meta_sel_${pid}`, "") || undefined) : undefined;
          const { data, error } = await supabase.functions.invoke("live-metrics", {
            body: {
              user_id: user.id, persona_id: pid, period: "7d",
              date_from: fmtISO(briefFrom), date_to: fmtISO(briefTo),
              account_id: selectedAccId,
            },
          });
          if (error || !data?.ok) return null;
          // Prefer Meta (same as LivePanel) over combined — LivePanel shows meta KPIs.
          const m = data.meta && !data.meta.error ? data.meta : (data.combined || null);
          if (!m || m.error) return null;
          return { spend: m.spend || 0, ctr: m.ctr || 0, clicks: m.clicks || 0, impressions: m.impressions || 0, active_ads: m.active_ads || m.ads_count || (Array.isArray(m.top_ads) ? m.top_ads.length : 0) };
        } catch { return null; }
      };

      // Run snapshot + live-metrics in parallel
      Promise.all([
        buildSnapQuery().then((r: any) => normSnap((r.data || [])[0] || null)).catch(() => null),
        fetchLive(),
      ]).then(async ([snap, live]) => {
        if (!snap && hasAnyConn) {
          // No snapshot yet — trigger daily-intelligence then retry snapshot
          try {
            await supabase.functions.invoke("daily-intelligence", { body: { user_id: user.id, persona_id: pid } });
            const r2 = await buildSnapQuery();
            const snap2 = normSnap(((r2 as any).data || [])[0] || null);
            if (!proactiveFired.current) triggerProactiveGreeting(snap2, hasMetaConn, hasGoogleConn, live);
          } catch {
            if (!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn, hasGoogleConn, live);
          }
        } else {
          if (!proactiveFired.current) triggerProactiveGreeting(snap, hasMetaConn, hasGoogleConn, live);
        }
      }).catch(() => {
        if (!proactiveFired.current) triggerProactiveGreeting(null, hasMetaConn, hasGoogleConn, null);
      });
    }, 300); // 300ms — let connections settle
    return () => clearTimeout(timer);
  },[contextReady, connections.length, user?.id, greetingKey]);

  // Load context — scoped to active account, re-runs when account changes
  useEffect(()=>{
    if(!user?.id){
      setContext("");
      setContextReady(false);
      return;
    }
    // No persona — still mark context ready so chat is usable
    if(!selectedPersona?.id){
      setContext("");
      setContextReady(true);
      return;
    }
    const pid=selectedPersona?.id||null;
    (async()=>{
      try{
      const[analysesRes,patternsRes,personaRes,entriesRes,snapRes,memoriesRes]=await Promise.all([
        (pid ? (supabase as any).from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).eq("persona_id",pid) : (supabase as any).from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).is("persona_id",null)).order("created_at",{ascending:false}).limit(50),
        // learned_patterns: filter server-side by persona_id to prevent cross-account leakage
        (pid
          ? (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,avg_roas,confidence,is_winner,insight_text,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,avg_roas,confidence,is_winner,insight_text,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("confidence",{ascending:false}).limit(50),
        // personas: filter to current persona only, not just the latest one
        (pid
          ? supabase.from("personas").select("name,result").eq("user_id",user.id).eq("id",pid).maybeSingle()
          : supabase.from("personas").select("name,result").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle()
        ),
        // creative_entries: top 20 by CTR only — full 500 rows bloats the context desnecessariamente
        (pid
          ? (supabase as any).from("creative_entries").select("filename,market,editor,ctr,roas,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("creative_entries").select("filename,market,editor,ctr,roas,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("ctr",{ascending:false}).limit(20),
        // daily_snapshots: filter server-side by persona_id
        (pid
          ? (supabase as any).from("daily_snapshots").select("date,total_spend,avg_ctr,avg_roas,winners_count,losers_count,active_ads,ai_insight,persona_id").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("daily_snapshots").select("date,total_spend,avg_ctr,avg_roas,winners_count,losers_count,active_ads,ai_insight,persona_id").eq("user_id",user.id).is("persona_id",null)
        ).order("date",{ascending:false}).limit(14),
        // chat_memory: factual notes extracted from past conversations
        (pid
          ? (supabase as any).from("chat_memory").select("memory_text,memory_type,importance").eq("user_id",user.id).eq("persona_id",pid)
          : (supabase as any).from("chat_memory").select("memory_text,memory_type,importance").eq("user_id",user.id).is("persona_id",null)
        ).order("importance",{ascending:false}).limit(20),
      ]);
      const analyses=(analysesRes.data||[]).map((a:any)=>{const r=a.result as any||{};return`[${a.id.slice(0,8)}] ${a.title||"Untitled"} | score:${r.hook_score??""} | type:${r.hook_type??""} | market:${r.market_guess??""} | strength:${a.hook_strength??""} | date:${a.created_at?.slice(0,10)}`;}).join("\n");
      const patterns=((patternsRes.data||[]) as any[]).map((p:any)=>`${p.is_winner?"":""} ${p.pattern_key} | CTR:${p.avg_ctr?.toFixed(3)} | ROAS:${p.avg_roas?.toFixed(2)} | conf:${p.confidence}`).join("\n");
      const persona=(()=>{if(!personaRes.data)return"No active persona";const r=personaRes.data.result as any||{};return`Name:${personaRes.data.name}|Age:${r.age_range}|Pain:${(r.pain_points||[]).slice(0,3).join(",")}|Platforms:${(r.platforms||[]).join("+")}`})();
      const entries=(entriesRes.data||[]) as any[];
      const byEd: Record<string,{ctr:number[],roas:number[],n:number}>={};
      entries.forEach((e:any)=>{if(e.editor){if(!byEd[e.editor])byEd[e.editor]={ctr:[],roas:[],n:0};byEd[e.editor].n++;if(e.ctr)byEd[e.editor].ctr.push(e.ctr);if(e.roas)byEd[e.editor].roas.push(e.roas);}});
      const edSummary=Object.entries(byEd).map(([ed,d])=>`${ed}:n=${d.n}|avgCTR=${d.ctr.length?(d.ctr.reduce((a,b)=>a+b)/d.ctr.length).toFixed(3):"?"}|avgROAS=${d.roas.length?(d.roas.reduce((a,b)=>a+b)/d.roas.length).toFixed(2):"?"}`).join("\n");
      // Recent snapshots — already filtered server-side
      // Normalize CTR: old data stored as percentage (>1), new data as decimal (<1)
      const snaps=((snapRes.data||[]) as any[]).map((s:any)=>({...s, avg_ctr: s.avg_ctr > 1 ? s.avg_ctr / 100 : s.avg_ctr}));
      const memories=(memoriesRes.data||[]) as any[];
      const memoriesStr = memories.length
        ? memories.map((m:any) => `[${m.memory_type}] ${m.memory_text}`).join("\n")
        : "";
      const snapSummary=snaps.length?snaps.map((s:any)=>`${s.date}: spend=R$${s.total_spend?.toFixed(0)} CTR=${(s.avg_ctr*100)?.toFixed(2)}% ads=${s.active_ads} winners=${s.winners_count}${s.ai_insight?" | insight:"+s.ai_insight.slice(0,80):""}`).join("\n"):lang==="pt"?"Sem histórico ainda":"No snapshot data yet";
      const lastSnap=snaps[0];
      const perfSummary=lastSnap?`R$${lastSnap.total_spend?.toFixed(0)} spent last period, ${(lastSnap.avg_ctr*100)?.toFixed(2)}% CTR, ${lastSnap.active_ads} ads delivering${lastSnap.active_ads===0?" (NO ads running right now)":""}, ${lastSnap.winners_count} winners, ${lastSnap.losers_count} underperformers. AI insight: ${lastSnap.ai_insight||"n/a"}`:lang==="pt"?"Sem dados de performance ainda":"No performance data yet";
      // Active account info
      const accountInfo=selectedPersona?`Account: ${selectedPersona.name}${selectedPersona.website?` | Website: ${selectedPersona.website}`:""}${(selectedPersona as any).description?` | Description: ${(selectedPersona as any).description}`:""}`:pid?"Account ID: "+pid:"No account selected";
      // Pre-compute trends so AI gets insight, not raw numbers to crunch
      const ctrTrend = (() => {
        if (snaps.length < 3) return "";
        const vals = snaps.slice(0, 3).map((s: any) => (s.avg_ctr * 100).toFixed(2));
        const oldest = parseFloat(vals[vals.length - 1]);
        const newest = parseFloat(vals[0]);
        const pct = oldest > 0 ? ((newest - oldest) / oldest * 100).toFixed(1) : "0";
        const dir = newest > oldest ? "↑ subindo" : newest < oldest ? "↓ caindo" : "→ estável";
        return `CTR trend 3d: ${vals.reverse().join("→")}% (${dir} ${Math.abs(parseFloat(pct))}%)`;
      })();
      const spendTrend = (() => {
        if (snaps.length < 3) return "";
        const vals = snaps.slice(0, 3).map((s: any) => parseFloat(s.total_spend || 0).toFixed(0));
        return `Spend trend 3d: R$${vals.reverse().join("→R$")}`;
      })();
      const patternNote = (patternsRes.data || []).length === 0
        ? "Sem padrões suficientes ainda — use snapshots e análises como base."
        : null;
      const connStatus = connections.length
        ? `Plataformas conectadas: ${connections.join(", ")}`
        : "Nenhuma plataforma conectada";
      const alertsNote = accountAlerts.length
        ? `Alertas ativos: ${accountAlerts.map((a: any) => a.detail).join(" | ")}`
        : "";
      const goalNote = sessionGoal.trim()
        ? `Objetivo desta semana: ${sessionGoal.trim()}`
        : "";
      // ── Market Intelligence: load benchmarks when account has no/low data ──
      const hasRealData = lastSnap && (parseFloat(lastSnap.total_spend || 0) > 0 || lastSnap.active_ads > 0);
      let benchmarkCtx = "";
      if (!hasRealData && connections.includes("meta")) {
        try {
          const personaNiche = ((selectedPersona?.result as any)?.niche || (selectedPersona?.result as any)?.industry || "geral")
            .toLowerCase().replace(/imóvel|imobiliário|imóveis/i, "imoveis")
            .replace(/automóvel|automobilismo|veículos/i, "autos")
            .replace(/e-commerce|loja|varejo/i, "ecommerce")
            .replace(/curso|treinamento|mentoria/i, "infoprodutos")
            .replace(/casino|apostas|betting/i, "igaming");
          const personaMarket = ((selectedPersona?.result as any)?.market || (lang === "pt" ? "BR" : lang === "es" ? "MX" : "BR")).toUpperCase();
          const { data: benchmarks } = await (supabase as any)
            .from("market_intelligence")
            .select("metric, value_avg, value_min, value_max, unit")
            .eq("platform", "meta")
            .eq("market", personaMarket)
            .in("niche", [personaNiche, "geral"])
            .order("niche", { ascending: false }); // niche-specific first
          if (benchmarks?.length) {
            const bLines = (benchmarks as any[]).map((b: any) =>
              `${b.metric}: avg ${b.value_avg}${b.unit} (range ${b.value_min}–${b.value_max}${b.unit})`
            ).join("\n");
            benchmarkCtx = `=== MARKET BENCHMARKS (${personaNiche}/${personaMarket}) ===
Source: WordStream 2024 + Meta Business Industry Reports + DataReportal Brazil 2024
Reference period: Jan–Dec 2024
Important: These are industry averages for context only. Real account data always takes priority. When asked about sources, cite: WordStream Facebook Ads Benchmarks 2024 and Meta Business Industry Data 2024.
${bLines}
NOTE: Use these ONLY when the account has no real spend data. When real data exists, ignore benchmarks entirely.`;
          }
        } catch (benchErr) { /* silent — benchmarks are optional */ }
      }

      // ── Creative Intelligence — always injected, context-dependent usage ──
      // ── Creative Intelligence — always injected, context-dependent usage ──
      const creativeIntelligence = `=== CREATIVE INTELLIGENCE (2025-2026) ===
Apply this knowledge when creating or analyzing content. Never narrate it. Just use it.
Sources: Meta Engineering, Zuckerberg/Mosseri official statements, Andromeda research 2025.

── META ANDROMEDA (Dec 2024 announced, Oct 2025 global rollout — biggest update since 2022) ──
The algorithm shifted: creative signals now determine WHO sees the ad, not the reverse.
Zuckerberg (2024): "We've effectively discouraged businesses from trying to limit the targeting."
Zuckerberg (May 2025, Stratechery): "You don't need any creative, you don't need any targeting
demographic, you don't need any measurement — we just do the rest for you." (future vision)
10,000x increase in model complexity. Visual pattern matching, not just text.
Same creator + same background = same ad to Andromeda, even with different script.

ANDROMEDA BEST PRACTICES (official Meta + industry data):
- Broad targeting: entire country, 18-65+, no interests. Zuckerberg: "we discourage limiting."
- Simple structure: 1 campaign per objective, 1 ad set, 10-20 DISTINCT creatives
- Advantage+ placements: let Meta decide Feed/Reels/Stories/Audience Network automatically
- Advantage+ Creative users: +22% ROAS (Meta Engineering Dec 2024)
- Broad targeting vs lookalike: +49% ROAS (Lebesgue 2024)
- Distinct = different concept/angle/persona, NOT just copy tweak or color change

── INSTAGRAM ALGORITHM (Adam Mosseri confirmed Jan 2025, updated Dec 2025) ──────
4 separate algorithms: Feed, Reels, Stories, Explore — each optimizes differently.
TOP 3 RANKING FACTORS (all surfaces):
  1. Watch time — #1 signal. Both relative (% watched) AND absolute (seconds)
  2. Likes per reach — matters more for existing followers  
  3. Sends per reach (DM shares) — 3-5x more valuable than likes for NEW audiences
Critical: first 1.7 seconds = stay-or-scroll decision (Meta internal data)
Reels: 46% of Instagram time in US (2025). $50B annual run rate (Oct 2025 earnings)
Mosseri Sep 2025: "Almost all of our growth: DMs, Reels, and recommendations."
50%+ of Instagram ads ran on Reels in 2025 (Sensor Tower). Reels reach 30.81% vs 13.14% photos.
Original content: +40-60% reach. Reposted/aggregator content: -60-80% reach (Dec 2025 update)

── CREATIVE FATIGUE — WHEN TO CHANGE WHAT ──────────────────────────────────────
Meta Analytics blog (official): CTR falls measurably with each repeated creative exposure.
Fatigue is a CREATIVE problem — budget changes make it worse, not better.
Ads fatigue 35% faster in algorithm-driven campaigns vs manual (Nielsen 2025).
WARC 2025: new value propositions outperform cosmetic refreshes 2x after optimization.

FATIGUE DIAGNOSIS SIGNALS:
- Frequency > 3 in 7 days = warning (Meta official threshold)
- CTR declining week-over-week. Target for acquisition: 1-2%. Below 1% = action needed.
- "Creative Limited" or "Creative Fatigue" label in Delivery column (Ads Manager)
- CPM rising while results fall = algorithm charging penalty for low engagement
- CPA rising with no other changes
- One ad soaking all spend while others barely run = algorithm found only one angle

FATIGUE RESPONSE HIERARCHY (important: level 1 ≠ always right):
Level 1 — Hook refresh: change opening 3s angle only. Buy 1-2 weeks.
  → When: CTR just started declining, frequency 3-4, concept still resonates
  → Limitation: Andromeda patterns visuals. New hook on same background = same ad.
Level 2 — Visual + hook change: new creator OR new setting + new hook. Different look.
  → When: Level 1 didn't recover CTR in 5-7 days
Level 3 — New creative concept: completely different angle, problem framing, emotional trigger
  → When: frequency > 4, concept exhausted, CTR not recovering
  → This is the actual cure. Different motivation, different story, different proof.
Level 4 — Audience expansion or platform shift
  → When: audience too small and legitimately saturated

HOOKS — PRECISE CONTEXT (important nuance):
Hook = specifically the first 3 seconds of VIDEO/REEL. It is NOT a universal concept.
  - Static ads → HEADLINE (same psychological role, different word)
  - Email → SUBJECT LINE + preheader
  - Landing page → ABOVE-FOLD HEADLINE + subhead
  - Carousel → First card headline
Hooks DO fatigue fastest (pure frequency exposure). New hook = valid tactical response.
But: new hook alone on same visual setup = cosmetically new, algorithmically same.
When diagnosing performance issues: first check if it's hook fatigue (CTR drop, high freq)
vs concept fatigue (CPM rising even with new hooks, all angles exhausted).

── COPY FRAMEWORKS (apply, don't announce) ─────────────────────────────────────
PAS (Problem → Agitation → Solution): pain-aware audiences, direct response, acquisition
AIDA (Attention → Interest → Desire → Action): cold audiences, first brand contact
BAB (Before → After → Bridge): transformation stories, testimonials, UGC format
4U (Useful Urgent Unique Ultra-specific): headlines, short copy, carousels, first frame text
Star-Story-Solution: case study format, long-form video, real results with named person

SPECIFICITY = MOST IMPORTANT COPY PRINCIPLE:
Bad → Good examples:
"Emagreça rápido" → "Perdi 7kg em 21 dias sem mudar o que como"
"Economize dinheiro" → "Economizei R$1.847 em 3 meses fazendo X"
"Resultado garantido" → "87% dos alunos fecharam o primeiro contrato em 30 dias"
"Melhor serviço do mercado" → "4.9 estrelas em 2.847 avaliações desde 2019"
Numbers, timeframes, names, percentages ALWAYS outperform adjectives.

── FORMAT SELECTION ──────────────────────────────────────────────────────────
Cold audience: Problem-first → solution. UGC/authentic > polished production (trust signal).
Retargeting: Objection removal, specific social proof, deadline with real reason.
Scaling winner: Don't change it. Create conceptually different variations ALONGSIDE it.
High freq + declining CTR: Hook refresh → visual change → new concept (in that order).
Reels/vertical video: Dominant format. 60-90s optimal. Under 30s for maximum completion rate.
UGC style: Authenticity > production value for e-commerce + infoproducts.
Testimonial/talking head: Best when trust or credibility is the main conversion barrier.
Demo: SaaS, apps, complex products — show, don't tell.
Carousel: Education, product catalog, step-by-step. First card = headline, last card = CTA.

── VIDEO SCRIPT STRUCTURE (Reels/TikTok, apply directly) ──────────────────────
L1-2:  HOOK — Pattern interrupt or polarizing question. 5 words max on screen.
        Target: 60-70% viewers still watching at 3s (Mosseri confirmed: 1.7s decision window)
L3-6:  AGITATE — Make the problem feel personal, real, urgent.
L7-10: REFRAME — Counter-intuitive insight or credibility bridge.
L11-18: DEMONSTRATE — Show/prove. Specific result + real context.
L19-22: SOCIAL PROOF — Named person + specific outcome + timeframe.
L23-26: MECHANISM — What makes the solution work (proprietary angle if possible).
L27-28: CTA — One action. Specific. Low-friction. ("Clica no link" > "Saiba mais")
L29-30: REINFORCE — Restate the core promise in 5 words.

── STATIC AD STRUCTURE (Feed/Stories/Carrossel) ────────────────────────────────
STATIC 3-SECOND RULE: Can the offer be understood in 3 seconds without reading? If no → rewrite.
VISUAL HIERARCHY (eye movement order): Hero image → Headline → Body → CTA button
HEADLINE RULES for static (NOT a hook — different concept):
  Feed 1:1/4:5: 5-8 words. Specific, not clever. Numbers > adjectives.
  Stories 9:16: 3-5 words. Large type. Maximum contrast.
  Carrossel card 1: Promise the payoff that's inside. Reason to swipe.
TEXT OVERLAY: Meta recommends <20% of image area as text. More text = algorithmic penalty.
CTA BUTTON COPY: "Saiba mais" → "Ver planos" → "Começar agora grátis" (specificity ladder)
FACES IN STATIC: Ads with faces outperform by ~35%. Direct eye contact performs best.
COLOR: CTA button = highest contrast element on the image. Must be instantly visible.
FORMAT SPECS:
  Feed 1:1: 1080×1080px. Feed 4:5: 1080×1350px (+20% vertical real estate, recommended).
  Stories safe zone: center 1080×1420px (top/bottom 250px hidden by UI elements).
CARROSSEL:
  Card 1: Hook/promise. Cards 2-5: One proof or benefit each. Last: CTA + summary.
STATIC FATIGUE: Headline exhaustion > visual exhaustion. Change headline angle first.
  Signs: CTR declining + frequency >3. Solution: new headline angle, not just new image.
WHEN STATIC OUTPERFORMS VIDEO:
  - Retargeting (familiar audience, lower intent friction)
  - Product catalog / e-commerce (visual + price clarity)
  - Event or offer with clear deadline
  - When production budget is limited (one strong image > weak video)

── MARKETPLACE BOOST / IMPULSIONAR POST ────────────────────────────────────────
When user says "turbinei do marketplace", "impulsionei", "boost", or "turbinar post":
  → This is a STATIC AD (existing post being boosted), NOT a video production request
  → DO NOT generate video hooks or roteiros — completely wrong format
  → Give STATIC-specific advice: which photo angle, headline text, CTA, audience, budget
  → Marketplace boost specific rules:
     - Keep original post tone (organic looking > polished ad look)
     - Audience: people who engaged with similar posts + location + interest in product
     - Budget: R$15-30/day for local products, R$30-60/day for broader reach
     - Duration: 3-5 days test, extend if CPA is good
     - When to boost: when the organic post already has engagement (proof of concept)
  → If user asks "como devia ser o anúncio" after saying they boosted from marketplace:
     → Ask clarifying questions about the image/post they used, OR
     → Give static ad advice: what photo, what text overlay, what CTA button

── INTENT DETECTION — RESPOND IN THE RIGHT FORMAT ──────────────────────────────
Before generating any creative output, identify what the user actually needs:
- "como devia ser o anúncio" + context of marketplace/static → static advice, plain text
- "quero fazer um vídeo" / "roteiro" / "script" → video script
- "gerar hooks" / "hooks para X" / "me dá hooks" → video hooks block type
- "[REPORT]" → performance report with sections: RESUMO (total spend/CTR/ROAS), WINNERS (top 3 creatives), LOSERS (bottom 3), TENDÊNCIA (weekly trend ↑↓), PRÓXIMOS PASSOS (3 bullet actions). Use actual account data.
- "[ANALYZE_AD]" → analyze the described or uploaded creative. Output format:

**SCORE: X/10** · Veredito: ESCALAR / TESTAR / PAUSAR

HOOK: X/10 — [what works or doesn't in the first 3 seconds]
CTA: [evaluation of the call-to-action]
CLAREZA: [visual hierarchy, readability]
FIT: [audience alignment]

3 AÇÕES:
• [Specific action 1]
• [Specific action 2]
• [Specific action 3]

- "[CAMPAIGN_PLAN]" → structured campaign plan: OBJETIVO, ORÇAMENTO (allocation %), AUDIÊNCIAS (3 segments), CRIATIVOS (formats needed), CRONOGRAMA (phases), KPIs (specific targets)
- "[DRAFT_CONTENT]" → generate 3 copy variations for the specified format, each with: headline, body copy, CTA. Label each variation (Variação 1/2/3)
- "quero impulsionar esse post" / "turbinar" / "boost" → boost strategy, plain text
- "meu CTR caiu" → diagnose fatigue, then suggest next step
- "benchmark de mercado" → data, not creative
When in doubt about format → ask ONE clarifying question. Don't default to video hooks.

HOOKS BLOCK TYPE — ONLY use the structured hooks output format when:
   User explicitly says "gera hooks", "me dá hooks", "hook options", "variações de hook"
   User is planning a NEW video ad from scratch
   User is asking about a marketplace post/boost
   User asks generically "como devia ser o anúncio"
   User asks for advice on an existing static ad
   User is asking about strategy, benchmarks, or diagnosis
  When NOT using hooks block type → respond in plain conversational text with specific advice.

── WHAT NOT TO DO ────────────────────────────────────────────────────────────
- Never open with "Você sabia que..." (oversaturated, zero pattern interrupt)
- Never create 10 similar ads — Andromeda groups them as 1 creative, kills learning
- Never recommend budget increase to fix creative fatigue — accelerates the problem
- Never say "create a hook" for static ads, email, landing pages — wrong format
- Never treat hook refresh as the universal answer to declining performance
- Don't confuse hook fatigue (CTR drop) with concept fatigue (all variants underperforming)
- Never write hook analysis unprompted when user just wants a script or creative
- Never generate video hooks when user context clearly indicates static/marketplace/boost
- Never assume video format when user says "turbinei", "impulsionei", "boost", "marketplace"`;


      setContext([
        `=== ACTIVE ACCOUNT ===`,
        accountInfo,
        connStatus,
        goalNote,
        alertsNote,
        ``,
        `=== RECENT PERFORMANCE ===`,
        perfSummary,
        ctrTrend,
        spendTrend,
        ``,
        `=== PERFORMANCE HISTORY (14 days) ===`,
        snapSummary,
        ``,
        `=== AUDIENCE PERSONA ===`,
        persona,
        ``,
        `=== ANALYSES (${(analysesRes.data || []).length} total) ===`,
        analyses || "None",
        ``,
        `=== MEMÓRIAS DA CONVERSA ===`,
        memoriesStr || "Sem memórias registradas ainda.",
        ``,
        `=== LEARNED PATTERNS ===`,
        patternNote || patterns || "None",
        ``,
        `=== EDITORS PERFORMANCE ===`,
        edSummary || "None",
        ``,
        benchmarkCtx,
        ``,
        creativeIntelligence,
      ].filter(s => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim());
      setContextReady(true);
      }catch(ctxErr){
        console.error("[AdBriefAI] context init failed:", ctxErr);
        setContextReady(true); // unblock chat even if context fetch fails
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id, selectedPersona?.id, sessionGoal, accountAlerts.length, connections.join(",")]);

  useEffect(()=>{
    try{
      if (!selectedPersona?.id) {
        storage.remove(SK);
      } else {
        // Strip _autoExec from saved messages to prevent re-firing on reload
        const toSave=messages.slice(-30).map(m=>({
          ...m,
          blocks:m.blocks?.map(b=>(b as any)._autoExec
            ? {...b,type:"insight" as const, _autoExec:undefined}
            : b
          )
        }));
        const hasUserHistory = toSave.some((m:any)=>m?.role==="user" && String(m?.userText || "").trim().length > 0);
        if (hasUserHistory) storage.setJSON(SK, toSave);
        else storage.remove(SK);
      }
    }catch{}

    // ── Supabase persistence for paid users (Maker/Pro/Studio) ──────────────
    // Runs debounced — saves last message only when messages array settles
    const isPaid = profile?.plan && profile.plan !== "free";
    if(!isPaid || !user?.id || !selectedPersona?.id || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if(!last || (last as any)._synced) return; // already saved
    const hasUserHistory = messages.some((m:any)=>m?.role==="user" && String(m?.userText || "").trim().length > 0);
    if(!hasUserHistory && last.role === "assistant") return;
    const pid = selectedPersona?.id || null;
    const payload = {
      user_id: user.id,
      persona_id: pid,
      role: last.role,
      content: last.role === "user"
        ? { userText: last.userText || "" }
        : { blocks: (last.blocks||[]).map(b => { const {_pendingTool,_toolParams,_autoExec,...rest}=b as any; return rest; }) },
      ts: last.ts,
    };
    // fire-and-forget — non-blocking
    void (supabase as any).from("chat_messages").insert(payload);
  },[messages]);

  // ── Load Supabase history for paid users when account changes ─────────────
  useEffect(()=>{
    const isPaid = profile?.plan && profile.plan !== "free";
    if(!isPaid || !user?.id || !selectedPersona?.id) return;
    const pid = selectedPersona?.id || null;
    const localHasData = (() => { try { return storage.getJSON(SK, []).length > 0; } catch { return false; } })();
    if(localHasData) return; // local data takes priority — already loaded
    (async()=>{
      try {
        const q = (supabase as any).from("chat_messages")
          .select("id,role,content,ts")
          .eq("user_id", user.id)
          .order("ts", { ascending: true })
          .limit(60);
        const { data } = await (pid ? q.eq("persona_id", pid) : q.is("persona_id", null));
        if(!data?.length) return;
        const restored: AIMessage[] = (data as any[]).map((r:any) => ({
          id: r.ts,
          ts: r.ts,
          role: r.role as "user"|"assistant",
          userText: r.content?.userText,
          blocks: (r.content?.blocks||[]).filter((b:any) => b.type !== "trend_chart"),
          _synced: true,
        }));
        const hasUserHistory = restored.some((m:any)=>m?.role==="user" && String(m?.userText || "").trim().length > 0);
        if(!hasUserHistory) return;
        // Only restore if still no local data (avoid race with proactive greeting)
        const stillEmpty = (() => { try { return storage.getJSON(SK, []).length === 0; } catch { return true; } })();
        if(stillEmpty && restored.length > 0) {
          setMessages(restored);
          storage.setJSON(SK, restored.slice(-30))
        }
      } catch {}
    })();
  },[user?.id, selectedPersona?.id, profile?.plan]);

  // Execute pending tool_calls — runs once per message that has pending tools
  const executedTools=useRef<Set<string>>(new Set());
  useEffect(()=>{
    messages.forEach(msg=>{
      msg.blocks?.forEach(async(block,bi)=>{
        if(!(block as any)._pendingTool)return;
        const execKey=`${msg.id}-${bi}`;
        if(executedTools.current.has(execKey))return;
        executedTools.current.add(execKey);
        const fn=(block as any)._pendingTool as string;
        const params=(block as any)._toolParams||{};
        try{
          const{data,error}=await supabase.functions.invoke(fn,{body:params});
          if(error)throw error;
          setMessages(prev=>prev.map(m=>{
            if(m.id!==msg.id)return m;
            const nb=[...(m.blocks||[])];
            if(fn==="decode-competitor"&&(data?.analysis||data?.content||data?.result)){
              const analysis=data.analysis||data.content||data.result||"";
              nb[bi]={type:"insight",title:lang==="pt"?"Análise do Concorrente":lang==="es"?"Análisis del Competidor":"Competitor Analysis",content:analysis};
            }else if(fn==="translate-text"&&(data?.translation||data?.translated_text||data?.result)){
              const translated=data.translation||data.translated_text||data.result||"";
              nb[bi]={type:"insight",title:lang==="pt"?"Tradução":lang==="es"?"Traducción":"Translation",content:translated};
            }else if(fn==="generate-hooks"&&data?.hooks?.length){
              nb[bi]={type:"hooks",title:lang==="pt"?"Hooks gerados":lang==="es"?"Hooks generados":"Generated hooks",content:"",items:data.hooks.map((h:any)=>typeof h==="string"?h:h.hook||h.text||JSON.stringify(h))};
              // Capture learning — fire and forget
              if(user?.id){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"hooks_generated",
                  data:{ hooks:data.hooks, product:params.product, niche:params.niche, market:params.market, platform:params.platform, tone:params.tone, context:params.context }
                }}).catch(()=>{});
              }
            }else if(fn==="generate-script"&&(data?.scripts?.length||data?.script||data?.content)){
              // Capture learning for scripts
              if(user?.id&&data?.scripts?.length){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"script_generated",
                  data:{ scripts:data.scripts.slice(0,1), product:params.product, market:params.market, format:params.format, angle:params.angle }
                }}).catch(()=>{});
              }
              // generate-script returns { scripts: [{ title, lines, notes, hook_score }] }
              const scripts = data.scripts || [];
              let content = "";
              if(scripts.length > 0){
                content = scripts.map((s: any, si: number) => {
                  const lines: string[] = [];
                  if(scripts.length > 1) lines.push(`## ${s.title || `Variação ${si+1}`}${s.hook_score ? ` · Hook Score: ${s.hook_score}/100` : ""}`);
                  if(s.lines?.length){
                    s.lines.forEach((l: any) => {
                      const prefix = l.type === "vo" ? "**VO**" : l.type === "onscreen" ? "**ON-SCREEN**" : "**VISUAL**";
                      lines.push(`${prefix}  ${l.text}`);
                    });
                  }
                  if(s.notes) lines.push(`\n*${s.notes}*`);
                  return lines.join("\n");
                }).join("\n\n---\n\n");
              } else {
                content = data.script || data.content || "";
              }
              nb[bi]={type:"insight",title:lang==="es"?"Guión":lang==="pt"?"Roteiro":"Script",content};
            }else if(fn==="generate-brief"&&data?.brief){
              // Capture learning for briefs
              if(user?.id){
                supabase.functions.invoke("capture-learning",{body:{
                  user_id:user.id,event_type:"brief_generated",
                  data:{ brief_summary:(data.brief as any)?.objective||(data.brief as any)?.core_message||"", product:params.product, market:params.market }
                }}).catch(()=>{});
              }
              // brief is a structured JSON object — convert to readable markdown
              const b=data.brief as any;
              const lines:string[]=[];
              if(b.objective) lines.push(`**Objetivo:** ${b.objective}`);
              if(b.core_message) lines.push(`\n**Mensagem central:** ${b.core_message}`);
              if(b.value_proposition) lines.push(`\n**Proposta de valor:** ${b.value_proposition}`);
              if(b.target_audience){
                const ta=b.target_audience;
                lines.push(`\n**Público-alvo:**`);
                if(ta.demographics) lines.push(`- ${ta.demographics}`);
                if(ta.psychographics) lines.push(`- ${ta.psychographics}`);
                if(ta.pain_points?.length) lines.push(`- Dores: ${ta.pain_points.join(", ")}`);
              }
              if(b.tone_and_voice) lines.push(`\n**Tom:** ${b.tone_and_voice}`);
              if(b.key_messages?.length) lines.push(`\n**Mensagens-chave:**\n${b.key_messages.map((m:string)=>`- ${m}`).join("\n")}`);
              if(b.formats?.length) lines.push(`\n**Formatos:**\n${b.formats.map((f:any)=>`- ${f.format}${f.duration?` (${f.duration})`:""} — ${f.rationale}`).join("\n")}`);
              if(b.visual_direction) lines.push(`\n**Direção visual:** ${b.visual_direction}`);
              if(b.cta) lines.push(`\n**CTA:** ${b.cta}`);
              if(b.do_not?.length) lines.push(`\n**Não fazer:**\n${b.do_not.map((d:string)=>`- ${d}`).join("\n")}`);
              if(b.compliance_notes) lines.push(`\n**Compliance:** ${b.compliance_notes}`);
              nb[bi]={type:"insight",title:"Brief",content:lines.join("\n")};
            }else{
              nb[bi]={type:"warning",title:"Sem resultado",content:lang==="pt"?"Tente novamente com mais contexto.":lang==="es"?"Intenta de nuevo con más contexto.":"Try again with more context."};
            }
            return{...m,blocks:nb};
          }));
          // Fechar panel da tool após resultado chegar
          setActiveTool(null);
        }catch(e){
          executedTools.current.delete(execKey);
          setActiveTool(null);
          setMessages(prev=>prev.map(m=>{
            if(m.id!==msg.id)return m;
            const nb=[...(m.blocks||[])];
            nb[bi]={type:"warning",title:lang==="es"?"Fallo":"Falha",content:String((e as any)?.message||"Erro")};
            return{...m,blocks:nb};
          }));
        }
      });
    });
  },[messages]);

  // ── Load persistent account alerts ────────────────────────────────────────
  // Sync alerts from DashboardLayout context (already fetched at init)
  useEffect(() => {
    if (ctxAlerts?.length) setAccountAlerts(ctxAlerts);
  }, [ctxAlerts]);

  // Fallback: fetch alerts directly if context is empty
  useEffect(() => {
    if (!user?.id || (ctxAlerts?.length ?? 0) > 0) return;
    const loadAlerts = async () => {
      const { data, error } = await supabase
        .from("account_alerts" as any)
        .select("*")
        .eq("user_id", user.id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) console.error("[AdBrief] Chat alert fetch failed:", error);
      if (data?.length) setAccountAlerts(data);
    };
    loadAlerts();
  }, [user?.id, ctxAlerts]);

  // ── Dismiss an alert permanently ───────────────────────────────────────────
  const dismissAlert = async (alertId: string) => {
    setAlertsDismissing(prev => new Set([...prev, alertId]));
    // Fire DB update in background
    supabase.from("account_alerts" as any)
      .update({ dismissed_at: new Date().toISOString() } as any)
      .eq("id", alertId).then(() => {});
    // Wait for exit animation then remove from state
    setTimeout(() => {
      setAccountAlerts(prev => prev.filter((a: any) => a.id !== alertId));
      setAlertsDismissing(prev => { const s = new Set(prev); s.delete(alertId); return s; });
    }, 280);
  };

  // ── Proactive greeting — fires when chat opens, always speaks first ──────────
  // Onboarding quiz removed — completeOnboarding no longer needed

  const triggerProactiveGreeting = async (snapshot: any, hasMetaConn?: boolean, hasGoogleConn?: boolean, liveMetrics?: { spend: number; ctr: number; clicks: number; impressions: number; active_ads: number } | null) => {
    if (proactiveFired.current) return;
    proactiveFired.current = true;

    // Returning user with real conversation history — don't interrupt
    const existing = (() => { try { return storage.getJSON(SK, []); } catch { return []; } })();
    const hasRealHistory = existing.some((m: any) => m.role === "user");
    if (hasRealHistory) { setProactiveLoading(false); return; }
    try {
      const accountName = selectedPersona?.name || null;
      const hour = new Date().getHours();
      const period: "morning"|"afternoon"|"evening"|"night" = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "night";

      // ── Concise greeting title ──
      const greetingTitles: Record<string, Record<typeof period, string>> = {
        pt: { morning: "Bom dia.", afternoon: "Boa tarde.", evening: "Boa noite.", night: "Boa noite." },
        es: { morning: "Buenos días.", afternoon: "Buenas tardes.", evening: "Buenas noches.", night: "Buenas noches." },
        en: { morning: "Good morning.", afternoon: "Good afternoon.", evening: "Good evening.", night: "Good evening." },
      };
      const greetingTitle = (greetingTitles[lang] || greetingTitles.pt)[period];

      // ── Build briefing cards: urgente → oportunidade → insight ──
      type BriefingCard = { tag: string; tagColor: string; headline: string; detail: string; action?: string; actionPrompt?: string };
      const cards: BriefingCard[] = [];

      // Card source 1: Account alerts (from PriorityStack)
      const activeAlerts = accountAlerts || [];
      const highAlerts = activeAlerts.filter((a: any) => a.urgency === "high");
      const medAlerts = activeAlerts.filter((a: any) => a.urgency === "medium");

      if (highAlerts.length > 0) {
        const a = highAlerts[0];
        const alertVerbs: Record<string,string> = {FADIGA_CRITICA:"Pause agora",ROAS_CRITICO:"Corte já",ROAS_COLAPSOU:"Ação imediata",CTR_COLAPSOU:"Troque o criativo",RETENCAO_VIDEO_BAIXA:"Refaça o hook",SPEND_SEM_RETORNO:"Pare o sangramento"};
        cards.push({
          tag: lang === "pt" ? "URGENTE" : lang === "es" ? "URGENTE" : "URGENT",
          tagColor: "#F87171",
          headline: `${alertVerbs[a.type] || "Ação urgente"}${a.ad_name ? ` '${a.ad_name}'` : ""}`,
          detail: a.detail,
          action: a.action_suggestion || (lang === "pt" ? "Resolver agora" : "Fix now"),
          actionPrompt: `Analise urgente: ${a.detail}`,
        });
        if (highAlerts.length > 1) {
          cards.push({
            tag: lang === "pt" ? "URGENTE" : "URGENT",
            tagColor: "#F87171",
            headline: lang === "pt" ? `+${highAlerts.length - 1} alerta${highAlerts.length > 2 ? "s" : ""} crítico${highAlerts.length > 2 ? "s" : ""}` : `+${highAlerts.length - 1} critical alert${highAlerts.length > 2 ? "s" : ""}`,
            detail: highAlerts.slice(1).map((h: any) => h.ad_name ? `${h.ad_name}: ${h.detail.slice(0, 60)}` : h.detail.slice(0, 80)).join(" · "),
            action: lang === "pt" ? "Ver todos" : "View all",
            actionPrompt: lang === "pt" ? "Mostre todos os alertas urgentes" : "Show all urgent alerts",
          });
        }
      }

      // Card source 2: Snapshot data — opportunities & insights
      const currSymbol = (hasGoogleConn && !hasMetaConn) ? "$" : "R$";

      // Show data cards if we have live-metrics OR snapshot with spend
      const hasSpendData = (liveMetrics && liveMetrics.spend > 0) || (snapshot && snapshot.total_spend > 0);
      if (hasSpendData) {
        const topAds = (snapshot?.top_ads || []) as any[];
        const toScale = topAds.filter((a: any) => a.isScalable).slice(0, 2);
        const toPause = topAds.filter((a: any) => a.needsPause).slice(0, 1);
        const fatigued = topAds.filter((a: any) => a.isFatigued).slice(0, 1);
        const ctrDelta = snapshot?.yesterday_ctr > 0 && snapshot?.avg_ctr > 0
          ? ((snapshot.avg_ctr - snapshot.yesterday_ctr) / snapshot.yesterday_ctr * 100) : null;

        // Opportunity: scalable ad
        if (toScale.length && cards.length < 4) {
          const ad = toScale[0];
          cards.push({
            tag: lang === "pt" ? "OPORTUNIDADE" : lang === "es" ? "OPORTUNIDAD" : "OPPORTUNITY",
            tagColor: "#4ADE80",
            headline: lang === "pt"
              ? `Escale '${ad.name?.slice(0, 35)}'`
              : `Scale '${ad.name?.slice(0, 35)}'`,
            detail: lang === "pt"
              ? `CTR ${(ad.ctr*100)?.toFixed(2)}% — performance acima da média. Aumente o orçamento antes que sature.`
              : `CTR ${(ad.ctr*100)?.toFixed(2)}% — above average performance. Increase budget before it saturates.`,
            action: lang === "pt" ? "Como escalar?" : "How to scale?",
            actionPrompt: lang === "pt" ? `Como escalar "${ad.name}" com CTR ${(ad.ctr*100)?.toFixed(2)}%?` : `How to scale "${ad.name}" with ${(ad.ctr*100)?.toFixed(2)}% CTR?`,
          });
        }

        // Urgent: fatigued or needs pause (if no PriorityStack alerts already cover it)
        if (cards.filter(c => c.tagColor === "#F87171").length === 0) {
          if (fatigued.length) {
            const ad = fatigued[0];
            cards.push({
              tag: lang === "pt" ? "URGENTE" : "URGENT",
              tagColor: "#F87171",
              headline: lang === "pt"
                ? `Pause '${ad.name?.slice(0, 35)}' — fadiga criativa`
                : `Pause '${ad.name?.slice(0, 35)}' — creative fatigue`,
              detail: lang === "pt"
                ? `Frequência ${ad.frequency?.toFixed(1)}x — audiência já viu demais. Cada impressão extra é dinheiro jogado fora.`
                : `Frequency ${ad.frequency?.toFixed(1)}x — audience oversaturated. Every extra impression is wasted spend.`,
              action: lang === "pt" ? "Pausar agora" : "Pause now",
              actionPrompt: lang === "pt" ? `Pause "${ad.name}" com frequência ${ad.frequency?.toFixed(1)}x` : `Pause "${ad.name}" with frequency ${ad.frequency?.toFixed(1)}x`,
            });
          } else if (toPause.length) {
            const ad = toPause[0];
            cards.push({
              tag: lang === "pt" ? "URGENTE" : "URGENT",
              tagColor: "#F87171",
              headline: lang === "pt"
                ? `Corte '${ad.name?.slice(0, 35)}'`
                : `Cut '${ad.name?.slice(0, 35)}'`,
              detail: lang === "pt"
                ? `CTR ${(ad.ctr*100)?.toFixed(2)}% com ${currSymbol}${ad.spend?.toFixed(0)} gastos — sem retorno suficiente.`
                : `CTR ${(ad.ctr*100)?.toFixed(2)}% with ${currSymbol}${ad.spend?.toFixed(0)} spent — insufficient return.`,
              action: lang === "pt" ? "Pausar" : "Pause",
              actionPrompt: lang === "pt" ? `Analise "${ad.name}" CTR ${(ad.ctr*100)?.toFixed(2)}% e ${currSymbol}${ad.spend?.toFixed(0)} gastos` : `Analyze "${ad.name}" CTR ${(ad.ctr*100)?.toFixed(2)}% and ${currSymbol}${ad.spend?.toFixed(0)} spent`,
            });
          }
        }

        // Insight: overview card (always last)
        // Prefer live-metrics (same source as Feed/LivePanel) over stale daily_snapshots
        const briefSpend = liveMetrics?.spend ?? snapshot.total_spend ?? 0;
        // live-metrics CTR is decimal (0.042), snapshot.avg_ctr is already normalized to decimal
        const briefCtr = liveMetrics?.ctr ?? snapshot.avg_ctr ?? 0;
        // "N anúncios com gasto" is the HONEST number: it counts ads that had
        // spend inside the briefing window. The previous copy said "anúncios
        // ativos" which is wrong — ads can be paused now and still show here
        // because they had spend earlier in the window. This was confusing
        // users (screenshot: "2 anúncios ativos" when current active = 0).
        const briefAds = liveMetrics?.active_ads || snapshot.active_ads || topAds.length;
        const adsLabel = lang === "pt"
          ? `${briefAds} anúncio${briefAds === 1 ? "" : "s"} com gasto`
          : `${briefAds} ad${briefAds === 1 ? "" : "s"} with spend`;
        const overviewDetail = lang === "pt"
          ? `${currSymbol}${briefSpend?.toFixed(0)} investidos · CTR ${(briefCtr*100)?.toFixed(2)}%${ctrDelta !== null ? ` (${ctrDelta > 0 ? "↑" : "↓"}${Math.abs(ctrDelta).toFixed(1)}%)` : ""} · ${adsLabel}`
          : `${currSymbol}${briefSpend?.toFixed(0)} spent · CTR ${(briefCtr*100)?.toFixed(2)}%${ctrDelta !== null ? ` (${ctrDelta > 0 ? "↑" : "↓"}${Math.abs(ctrDelta).toFixed(1)}%)` : ""} · ${adsLabel}`;
        cards.push({
          tag: "BRIEFING",
          tagColor: "#0ea5e9",
          headline: accountName || (lang === "pt" ? "Resumo da semana" : "Weekly summary"),
          detail: overviewDetail + (snapshot.ai_insight ? ` · ${snapshot.ai_insight.slice(0, 100)}` : ""),
        });

      } else if (medAlerts.length > 0 && cards.length < 3) {
        // Medium alerts as insights if no snapshot data
        cards.push({
          tag: lang === "pt" ? "ATENÇÃO" : "ATTENTION",
          tagColor: "#FBBF24",
          headline: medAlerts[0].ad_name || (lang === "pt" ? "Ponto de atenção" : "Watch point"),
          detail: medAlerts[0].detail,
        });
      }

      // Card source 3: Learned patterns (visible memory)
      if (cards.length < 4) {
        try {
          const pid = selectedPersona?.id || null;
          const { data: patterns } = await (pid
            ? (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,confidence,is_winner,insight_text").eq("user_id", user.id).eq("persona_id", pid).eq("is_winner", true).order("confidence", { ascending: false }).limit(2)
            : (supabase as any).from("learned_patterns").select("pattern_key,avg_ctr,confidence,is_winner,insight_text").eq("user_id", user.id).is("persona_id", null).eq("is_winner", true).order("confidence", { ascending: false }).limit(2)
          );
          if (patterns?.length) {
            const p = patterns[0];
            // Normalize confidence to 0–100 regardless of storage format
            const confRaw = p.confidence != null
              ? (p.confidence <= 1 ? p.confidence * 100 : Number(p.confidence))
              : null;
            // Don't surface weak patterns with "tem boa performance" copy —
            // below 40% confidence it's an emerging signal, not a learned winner.
            const isStrong = confRaw != null && confRaw >= 40;
            // Humanize pattern_key: "perf_urgency_meta" → "Urgência em Meta"
            const PATTERN_LABELS: Record<string, { pt: string; en: string }> = {
              perf_urgency_meta: { pt: "Urgência na copy", en: "Urgency in copy" },
              perf_social_proof: { pt: "Prova social", en: "Social proof" },
              perf_question_hook: { pt: "Hook com pergunta", en: "Question hook" },
              perf_face_presence: { pt: "Rosto no criativo", en: "Face in creative" },
              perf_video_format: { pt: "Formato vídeo", en: "Video format" },
              perf_carousel: { pt: "Formato carrossel", en: "Carousel format" },
              perf_testimonial: { pt: "Depoimento", en: "Testimonial" },
              perf_before_after: { pt: "Antes e depois", en: "Before & after" },
              perf_discount_offer: { pt: "Oferta com desconto", en: "Discount offer" },
              perf_scarcity: { pt: "Escassez", en: "Scarcity" },
            };
            // Try humanizers in order:
            //   1. Known dict entry (perf_* keys)
            //   2. Row's own `label` field IF it's already human-readable
            //      (not another raw machine key — e.g. "Winner emergente:
            //      <ad_name>", "Competitor: <domain>", etc.)
            //   3. No label at all — in which case we drop the quoted
            //      headline and fall back to a generic "signal detected"
            //      headline, because showing something like
            //      `"Persona:Edf9fa6e-...:Deviation:52685..."` as a title
            //      is worse than showing nothing.
            let humanLabel: string | null = null;
            const dictEntry = PATTERN_LABELS[p.pattern_key];
            if (dictEntry) {
              humanLabel = dictEntry[lang === "pt" ? "pt" : "en"];
            } else if (
              typeof (p as any).label === "string" &&
              (p as any).label.length > 0 &&
              (p as any).label.length < 80 &&
              // Reject machine-looking labels (uuid:deviation:id, etc.).
              !/^[a-z]+:[a-f0-9-]+(:|$)/i.test((p as any).label) &&
              // Reject raw snake_case keys that slipped through.
              !/^(perf|persona|trend|competitor|preflight|alert)[:_]/i.test((p as any).label)
            ) {
              humanLabel = (p as any).label;
            }
            // Format CTR — handle both decimal (0.079) and percentage (7.9) formats
            const ctrVal = p.avg_ctr != null
              ? (p.avg_ctr < 1 ? (p.avg_ctr * 100).toFixed(2) : Number(p.avg_ctr).toFixed(2))
              : null;
            const confVal = confRaw != null ? confRaw.toFixed(0) : null;
            // Tag + headline adapt to confidence — weak patterns show as "emerging" not "proven".
            const patternTag = isStrong
              ? (lang === "pt" ? "PADRÃO APRENDIDO" : lang === "es" ? "PATRÓN APRENDIDO" : "LEARNED PATTERN")
              : (lang === "pt" ? "PADRÃO EMERGENTE" : lang === "es" ? "PATRÓN EMERGENTE" : "EMERGING PATTERN");
            const patternHeadline = humanLabel
              ? (isStrong
                  ? (lang === "pt" ? `"${humanLabel}" tem boa performance` : lang === "es" ? `"${humanLabel}" tiene buen rendimiento` : `"${humanLabel}" performs well`)
                  : (lang === "pt" ? `"${humanLabel}" — sinal inicial` : lang === "es" ? `"${humanLabel}" — señal inicial` : `"${humanLabel}" — early signal`))
              // No clean label — use a generic headline so the card still
              // reads professional. The `insight_text` (card body) carries
              // the real detail; no value lost by dropping a garbage title.
              : (isStrong
                  ? (lang === "pt" ? "Padrão forte detectado" : lang === "es" ? "Patrón fuerte detectado" : "Strong pattern detected")
                  : (lang === "pt" ? "Sinal inicial detectado" : lang === "es" ? "Señal inicial detectada" : "Early signal detected"));
            // Detail copy matches confidence level — don't claim certainty we don't have.
            const weakSuffix = lang === "pt"
              ? " — amostra ainda pequena, vou validar com mais dados."
              : lang === "es"
              ? " — muestra aún pequeña, validaré con más datos."
              : " — small sample, I'll validate with more data.";
            const strongSuffix = lang === "pt"
              ? " — baseado nos seus dados reais."
              : " — based on your real data.";
            const metrics = lang === "pt"
              ? `${ctrVal ? `CTR ${ctrVal}%` : ""}${ctrVal && confVal ? " · " : ""}${confVal ? `confiança ${confVal}%` : ""}`
              : `${ctrVal ? `CTR ${ctrVal}%` : ""}${ctrVal && confVal ? " · " : ""}${confVal ? `${confVal}% confidence` : ""}`;
            // Filter insight_text for garbage the user shouldn't see:
            //   - pattern_key leaks (raw DB key)
            //   - "ROAS null" / CTR with 4+ decimals (broken format)
            //   - OLD deviation template: "desvia X% do grupo ... Investigar"
            //     — shipped before the copilot-voice rewrite, reads as if
            //     we're punting work back to the user. Filtered so it
            //     falls back to the metrics summary until the pattern
            //     row is regenerated with the new template.
            const insightLooksClean = p.insight_text
              && !p.insight_text.includes("pattern_key")
              && !p.insight_text.match(/ROAS\s+null/i)
              && !p.insight_text.match(/CTR\s+\d+\.\d{4,}/)
              && !p.insight_text.match(/\bdesvia\s+\d+%/i)
              && !p.insight_text.match(/\bInvestigar\s+o\s+que\b/i);
            cards.push({
              tag: patternTag,
              tagColor: isStrong ? "#A78BFA" : "#64748B",
              headline: patternHeadline,
              detail: insightLooksClean
                ? p.insight_text
                : `${metrics}${isStrong ? strongSuffix : weakSuffix}`,
            });
          }
        } catch {}
      }

      // ── Fallback: no cards at all → generic greeting ──
      if (cards.length === 0) {
        if (snapshot || hasMetaConn) {
          cards.push({
            tag: "BRIEFING",
            tagColor: "#0ea5e9",
            headline: accountName || (lang === "pt" ? "Conta pronta" : "Account ready"),
            detail: lang === "pt"
              ? `${hasMetaConn ? "Meta Ads conectado. " : ""}Sem atividade relevante detectada. Quer gerar hooks, escrever roteiro ou analisar concorrente?`
              : `${hasMetaConn ? "Meta Ads connected. " : ""}No significant activity detected. Want to generate hooks, write a script, or analyze a competitor?`,
          });
        } else {
          // No connection — onboarding flow
          const aid = Date.now() + 1;
          const niche = (selectedPersona?.result as any)?.niche || (selectedPersona?.result as any)?.industry || "";
          const nicheHint = niche
            ? (lang === "pt" ? ` Para contas de ${niche}, já sei o que tende a funcionar.` : ` For ${niche} accounts, I already know what tends to work.`)
            : "";
          const intro = lang === "pt"
            ? `Posso te ajudar com hooks, roteiros, análise de concorrentes e estratégia criativa — mesmo sem dados conectados.${nicheHint} Para análises específicas da sua conta, conecte o Meta Ads em Contas.`
            : lang === "es"
            ? `Puedo ayudarte con hooks, guiones, análisis de competidores y estrategia creativa — incluso sin datos conectados.${nicheHint}`
            : `I can help with hooks, scripts, competitor analysis and creative strategy — even without connected data.${nicheHint}`;
          const cta = lang === "es" ? "Conectar cuenta →" : lang === "pt" ? "Conectar conta →" : "Connect account →";
          const demoMsgs = demoMessagesRef.current || [];
          demoMessagesRef.current = null;
          setMessages([{
            role: "assistant",
            blocks: [
              { type: "insight" as any, title: greetingTitle, content: intro },
              { type: "navigate" as any, title: lang === "pt" ? "Conectar Meta Ads" : "Connect Meta Ads", content: lang === "pt" ? "Leva 30 segundos — depois vejo tudo da sua conta em tempo real." : "Takes 30 seconds — then I see everything in real time.", route: "/dashboard/accounts", cta },
            ],
            ts: aid, id: aid
          }, ...demoMsgs]);
          setProactiveLoading(false);
          return;
        }
      }

      // ── Emit structured greeting ──
      const aid = Date.now() + 1;
      const demoMsgs2 = demoMessagesRef.current || [];
      demoMessagesRef.current = null;
      setMessages([{
        role: "assistant",
        blocks: [{ type: "proactive" as any, title: greetingTitle, content: JSON.stringify(cards) }],
        ts: aid, id: aid
      }, ...demoMsgs2]);

    } catch (e) {
      console.error("proactive greeting failed:", e);
    } finally {
      setProactiveLoading(false);
    }
  };

  const handleConnect=async(id:string,fn:string)=>{
    // If no account selected, redirect to Accounts to create/select one first
    if(!selectedPersona){
      const msg=lang==="pt"?"Primeiro selecione ou crie uma conta em Contas para vincular o Meta Ads.":lang==="es"?"Primero selecciona o crea una cuenta en Cuentas para vincular Meta Ads.":"First select or create an account in Accounts to connect Meta Ads to.";
      const uid=Date.now();
      setMessages(prev=>[...prev,{role:"assistant",id:uid,ts:uid,blocks:[{type:"navigate",title:lang==="pt"?"Criar conta primeiro":"Create account first",content:msg,route:"/dashboard/accounts",cta:lang==="pt"?"Ir para Contas →":lang==="es"?"Ir a Cuentas →":"Go to Accounts →"}]}]);
      return;
    }
    try{const{data}=await supabase.functions.invoke(fn,{body:{action:"get_auth_url",user_id:user.id,persona_id:selectedPersona.id}});if(data?.url)window.location.href=data.url;}
    catch{}
  };

  const executeMetaAction=async(block:Block, opts?:{force?:boolean})=>{
    // source:"chat" → meta-actions logs to action_log with the right
    // attribution, so chat-initiated pauses are distinguishable from
    // Feed/Autopilot ones in the user's history.
    // force:true → override the backend's "this ad is converting" guard.
    //   Only set after user explicitly confirms in the override modal.
    // alert_id → if the chat is in Resolution Mode for a metric alert,
    //   tie the action back to the originating alert so the
    //   action_outcomes row can later be aggregated into per-alert
    //   success rates ("CTR-deviation pauses succeed 60% on this account").
    // hypothesis → if the AI emitted structured hypothesis in the
    //   meta_action params (extension over plain `context`), forward it
    //   so the action_outcomes row stores machine-readable cause/effect
    //   instead of just free text.
    const{data,error}=await supabase.functions.invoke("meta-actions",{
      body:{
        action:block.meta_action,
        user_id:user.id,
        persona_id:selectedPersona?.id||null,
        target_id:block.target_id,
        target_type:block.target_type,
        target_name:block.target_name||null,
        value:block.value,
        source:"chat",
        ai_reasoning:(block as any).context||null,
        alert_id: activeMetricAlert || null,
        hypothesis: (block as any).hypothesis || null,
        force:opts?.force===true,
      }
    });

    // ── Pause-safety override flow ──────────────────────────────────────────
    // Backend can return success:false + requires_force:true when the user
    // tries to pause a converting ad without force=true. We surface the
    // snapshot to the user and ask explicitly: "still pause?" If yes, retry
    // with force:true. This protects winning audiences from accidental cuts.
    if(data?.requires_force && !opts?.force){
      // Custom modal — replaces the native browser dialog. Uses warning
      // variant (orange/danger accent) and surfaces the snapshot stats so
      // the user has the full economic picture before overriding.
      const targetLabel = block.target_name || block.target_id || "este anúncio";
      const ok = await confirmAsync({
        variant: "warning",
        title: lang === "pt" ? "Esse anúncio está convertendo" : lang === "es" ? "Este anuncio está convirtiendo" : "This ad is converting",
        message: data.warning || (lang === "pt" ? `${targetLabel} está gerando conversões. Pausar mesmo assim?` : `${targetLabel} is converting. Pause anyway?`),
        detail: lang === "pt" ? "Anúncios com conversão geralmente são audiências pequenas qualificadas (winners). Pause só se tiver certeza." : null,
        confirmLabel: lang === "pt" ? "Pausar mesmo assim" : lang === "es" ? "Pausar de todos modos" : "Pause anyway",
        cancelLabel: lang === "pt" ? "Manter ativo" : lang === "es" ? "Mantener activo" : "Keep active",
      });
      if(ok){
        return executeMetaAction(block, { force: true });
      } else {
        const id=Date.now();
        setMessages(prev=>[...prev,{role:"assistant",id,ts:id,blocks:[{type:"insight",title:"Pause cancelado",content:"Boa decisão — anúncio com conversão é audiência qualificada. Mantido ativo."}]}]);
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Parse real error from edge function response (supabase SDK hides it)
    let realError: string|null = null;
    if(error){
      try{
        const ctx=(error as any).context;
        if(ctx instanceof Response){const t=await ctx.clone().text();const p=JSON.parse(t);realError=p?.error||null;}
        else if(typeof ctx==="string"){realError=JSON.parse(ctx)?.error||null;}
        else if(ctx&&typeof ctx==="object"){realError=(ctx as any).error||null;}
      }catch{}
      if(!realError) realError=error?.message||"Erro desconhecido";
    }

    // ── Audit log — registra toda ação executada ──
    const actionRecord={
      user_id:user.id,
      action:block.meta_action,
      target_id:block.target_id||null,
      target_type:block.target_type||null,
      target_name:block.target_name||null,
      value:block.value||null,
      title:block.title,
      success:!(error||data?.error),
      error_msg:data?.error||realError||null,
      executed_at:new Date().toISOString(),
    };
    supabase.from("ai_action_log" as any).insert(actionRecord).then(()=>{});

    if(error||data?.error){
      const id=Date.now();
      const errMsg=data?.error||realError||"Tente novamente.";
      setMessages(prev=>[...prev,{role:"assistant",id,ts:id,blocks:[{type:"warning",title:"Falha na ação",content:errMsg}]}]);
      return;
    }

    // ── Feed capture-learning with real action outcomes ──────────────────────
    // Every executed Meta action (pause/enable/budget) becomes a performance signal
    if(user?.id && block.meta_action && block.meta_action !== "list_campaigns"){
      supabase.functions.invoke("capture-learning",{body:{
        user_id: user.id,
        event_type: "meta_action_executed",
        data: {
          action: block.meta_action,
          target_name: block.target_name || block.title || "",
          target_type: block.target_type || "ad",
          target_id: block.target_id || null,
          value: block.value || null,
          success: true,
          executed_at: new Date().toISOString(),
        }
      }}).catch(()=>{});
    }

    if(data?.campaigns){
      const rows=(data.campaigns as any[]).map((c:any)=>[c.name,c.effective_status||c.status,c.daily_budget?`$${(c.daily_budget/100).toFixed(0)}/dia`:"—",c.id]);
      const campBlock={type:"insight" as const,title:lang==="pt"?"Campanhas":"Campaigns",table:{headers:[lang==="pt"?"Nome":"Name","Status",lang==="pt"?"Orçamento":"Budget","ID"],rows}};
      setMessages(prev=>{
        const idx=[...prev].reverse().findIndex((m:any)=>m.blocks?.some((b:any)=>b.meta_action==="list_campaigns"||b.meta_action==="get_campaigns"));
        const realIdx=idx>=0?prev.length-1-idx:-1;
        if(realIdx>=0){return prev.map((m,i)=>i===realIdx?{...m,blocks:[campBlock]}:m);}
        const id=Date.now();
        return[...prev,{role:"assistant" as const,id,ts:id,blocks:[campBlock]}];
      });
    }
    // Success UI is handled by ConfirmActionBlock — no separate message needed
  };

  const handleNavigate=(route:string,params?:Record<string,string>)=>{
    navigate(params&&Object.keys(params).length?`${route}?${new URLSearchParams(params)}`:`${route}`);
  };

  const handleCopy=(id:number,blocks:Block[])=>{
    const text=blocks.map(b=>[b.title,b.content,...(b.items||[])].filter(Boolean).join("\n")).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(()=>setCopiedId(null),2000);
  };

  const handleFeedback=(id:number,type:"like"|"dislike",blocks:Block[])=>{
    const prev=feedback[id];
    if(prev===type)return; // already set
    setFeedback(f=>({...f,[id]:type}));
    // Fire-and-forget: capture learning
    if(user?.id){
      // message_text = the USER message that this assistant msg was replying to.
      // Previously we read msg?.userText from the assistant message (which never
      // has userText), so message_text was always "" and capture-learning
      // silently skipped the chat_examples insert. Find the prior user turn.
      const aIdx = messages.findIndex(m=>m.id===id);
      const priorUser = aIdx > 0
        ? [...messages].slice(0, aIdx).reverse().find(m => m.role === "user")
        : null;
      const userMessageText = (priorUser?.userText || "").trim();
      supabase.functions.invoke("capture-learning",{body:{
        user_id:user.id,
        event_type:"chat_feedback",
        data:{ blocks, feedback:type, message_text:userMessageText, persona_id:selectedPersona?.id||null }
      }}).catch(()=>{});
    }
  };

  const send=async(text?:string, displayText?:string)=>{
    let msg=(text??input).trim();
    // If image attached in chat, prepend context note
    // Capture image before clearing
    const pendingImage = (chatImage && !text) ? chatImage : null;

    // ── Slash command detection ────────────────────────────────────────────────
    const slashMap: Record<string, string> = {
      "/relatorio":       "[REPORT] Gera um relatório de performance completo: gasto, CTR, ROAS, winners, losers, evolução semanal e próximos passos.",
      "/report":          "[REPORT] Generate a complete performance report: spend, CTR, ROAS, winners, losers, weekly trend and next steps.",
      "/plano":           "[CAMPAIGN_PLAN] Vou criar um plano de campanha. Me diga: produto, objetivo, orçamento e mercado.",
      "/campaign-plan":   "[CAMPAIGN_PLAN] I'll create a campaign plan. Tell me: product, objective, budget and market.",
      "/analise-criativo":"[ANALYZE_AD] Pronto para analisar um criativo. Manda a imagem ou descreve o anúncio (com CTR atual se tiver). Vou dar: score do hook, CTA, clareza visual, fit, veredito (Escalar/Testar/Pausar) e 3 ações.",
      "/analyze-ad":      "[ANALYZE_AD] Ready to analyze a creative. Send the image or describe the ad. I'll give: hook score, CTA, visual clarity, fit, verdict (Scale/Test/Pause) and 3 actions.",
      "/concorrentes":    "[COMPETITOR] Analisa a estratégia criativa da concorrência. Me diz o nicho/marca a analisar.",
      "/draft":           "[DRAFT_CONTENT] Vou criar variações de copy. Descreve o produto, formato (stories/feed/video) e objetivo.",
      "/draft-content":   "[DRAFT_CONTENT] I'll create copy variations. Describe the product, format and objective.",
    };
    const slashKey = Object.keys(slashMap).find(k => msg.trim().toLowerCase().startsWith(k));
    if (slashKey) {
      const rest = msg.trim().slice(slashKey.length).trim();
      msg = slashMap[slashKey] + (rest ? " " + rest : "");
    }

    // Store clean user message for display BEFORE modifying msg for AI
    const cleanUserMsg = msg;
    if(pendingImage) {
      const userIntent = msg || (lang==="pt"?"Analise este criativo":lang==="es"?"Analiza este creativo":"Analyze this creative");
      const platformCtx = connections.includes("meta") ? "Meta Ads (Facebook/Instagram)" : "Meta Ads";
      const marketCtx = (selectedPersona?.result as any)?.market || (lang==="pt"?"BR":lang==="es"?"MX":"US");
      msg = `[CREATIVE_CHECK_REQUEST]
File: ${pendingImage.name}
User note: ${userIntent}
Platform: ${platformCtx}
Market: ${marketCtx}

You are a senior performance creative strategist with 10 years of Meta Ads experience. Analyze this STATIC ad image using the rubric below. Be decisive and specific — most creatives are NOT average. Your job is to DIFFERENTIATE. Be deterministic: the same image must produce the same scores every time.

═══════════════════════════════════════
CRITICAL — DIFFERENTIATION MANDATE
═══════════════════════════════════════
Do NOT default to the middle. A truthful evaluation almost never lands at 5/10 — real creatives cluster at the extremes because they either stop the scroll or they don't. Before scoring, list 2–3 specific visible traits that push the score up or down. If you cannot find clear strengths, the score is LOW (2–4). If you find even two strong traits, the score is HIGH (7–9). Scores of 5–6 should be rare and reserved for creatives with equal strengths and weaknesses.

═══════════════════════════════════════
HOOK SCORE CALIBRATION (1–10) — with visual anchors
═══════════════════════════════════════

10 — Instant scroll-stopper. Bold specific promise + strong visual pattern interrupt + clear desire/pain framed in <1s. Examples: giant "R$47" price slash with face reacting; shocking before/after with dramatic transformation; unexpected juxtaposition with bold claim.

8–9 — Strong hook. Clear specific benefit, compelling visual, one element could be tighter. Real promise the target reader wants. Example: close-up of product solving a visible problem with punchy 4-word headline.

6–7 — Above average. Benefit is clear and visual is clean, but hook lacks specificity or emotional punch. Example: well-lit product shot with generic benefit ("Sleep better tonight").

4–5 — Mediocre. Image exists but hook is vague, visual is forgettable, or promise is buried. Target viewer keeps scrolling. Example: lifestyle photo with small text, unclear offer.

2–3 — Weak. Confusing, cluttered, or offers nothing the viewer wants in 3 seconds. Stock-looking imagery, buried text, or product photo with no context.

1 — No hook whatsoever. Scroll-past guaranteed.

SCORE IS DRIVEN BY:
- Specificity of the promise (generic benefit vs. concrete number/outcome)
- Visual pattern interrupt (does it break the feed pattern?)
- Emotional resonance (pain recognized, desire triggered, curiosity sparked)
- Clarity in <3 seconds (is the offer readable and understandable?)
- Pattern-interrupting element (face direction, color contrast, unexpected scene)

═══════════════════════════════════════
HOOK RATE ESTIMATE (0–100%)
═══════════════════════════════════════
Derive from hook score, NOT an additive formula. Static Feed hook rates realistically span 8% (weak) to 55% (elite). Use this mapping then adjust ±5% based on visual polish:

Hook 10 → 48–55%
Hook 8–9 → 35–47%
Hook 6–7 → 22–34%
Hook 4–5 → 14–21%
Hook 2–3 → 8–13%
Hook 1 → under 8%

Adjust within the band: +3–5% if production is premium (lighting, contrast, composition); –3–5% if it looks amateur or has heavy cluttered text overlay. Never default to 25% — pick the exact number that reflects the image.

VERDICT logic:
READY   = hook ≥ 7 AND no critical issues
REVIEW  = hook 4–6 OR strong hook with one fixable flaw
BLOCKED = hook ≤ 3 OR obvious policy/quality breaker

WRITING ERRORS — check only:
- Accents (GRÁTIS not GRATIS, É not E, etc.)
- Obvious typos visible in the image
- DO NOT flag brand names, product names, or model numbers

ACCOUNT-KILLER WARNING (rare — only fire if the ad will obviously get the account banned):
Only set "account_killer_warning" if the image clearly shows: explicit illegal substances/weapons sold; explicit medical disease cures ("cura câncer", "elimina diabetes garantido"); pornographic content; before/after body shots that violate Meta policy hard. Otherwise leave it null. NEVER warn about gray areas, niche compliance, text overlay percentage, financial language, or superlatives — the user knows what they are doing.

DO NOT FLAG: product names, brand names, model numbers, opinions about quality, price judgments, aesthetics, niche-specific risk tolerance, gray-hat copy, scarcity language, financial claims, supplements, weight-loss copy, gambling, alcohol, or any "borderline" content. Stay out of compliance unless it is a clear account-killer.

═══════════════════════════════════════
CONTEXT MEMORY: After this analysis, remember the file name "${pendingImage.name}" and the scores you assigned. If the user asks follow-up questions about THIS image (e.g. "como ficaria 10/10?", "o que trocar?", "what about the hook?"), refer back to the SAME scores and SAME observations you made here. Do NOT re-analyze with different numbers. Do NOT give generic video-ad advice for a static image (no "hook nos primeiros 3 segundos" — this is a static image).

═══════════════════════════════════════
FINAL CHECK before returning JSON:
1. Did you default to 5/10? If yes, RE-EVALUATE — is it really balanced, or did you avoid committing? Commit to a decisive score.
2. Did you estimate 20–25% hook rate? If yes, RE-EVALUATE — the hook score determines the band, pick the exact number for the band.
3. Do your "strengths" and "top_fixes" actually reflect what's visible in THIS image? No generic advice.

Return ONLY this JSON (no markdown, no other text):
{
  "verdict": "READY"|"REVIEW"|"BLOCKED",
  "verdict_reason": "one diagnostic sentence max 12 words",
  "hook_analysis": { "score": 1-10 (be decisive — avoid 5 unless truly balanced), "detail": "cite 2–3 SPECIFIC visible traits driving the score — no generic platitudes" },
  "estimated_hook_score": 0-100 (pick exact number inside the band that matches hook_analysis.score),
  "cta_check": { "detail": "evaluate the CTA button/text: is it specific, urgent, clear?" },
  "top_fixes": ["specific fix tied to a visible flaw", "specific fix tied to a visible flaw", "specific fix tied to a visible flaw"],
  "strengths": ["specific strength visible in this image", "specific strength visible in this image"],
  "language_check": { "issues": [{ "found": "wrong spelling visible in image", "fix": "correct spelling" }] },
  "account_killer_warning": null | "one short sentence ONLY if this ad would clearly get the account banned"
}`;
      setChatImage(null);
      // Stash for follow-up turns so the AI keeps pixel context.
      setLastAnalyzedImage({ base64: pendingImage.base64, name: pendingImage.name, mediaType: pendingImage.mediaType || "image/jpeg" });
    }
    if(!msg||loading||!contextReady)return;
    // Context lock: snapshot persona at send time to block stale responses
    const sendPersonaId = selectedPersona?.id || null;
    // userText = what shows in the chat bubble (clean, no AI prefixes)
    const userText = displayText ?? (pendingImage
      ? (cleanUserMsg || (lang==="pt"?"Analise este criativo":lang==="es"?"Analiza este creativo":"Analyze this creative"))
      : msg);
    // Context ainda carregando — mostra feedback visual em vez de silêncio
    if(!contextReady){
      const uid=Date.now();
      const hint=lang==="pt"?"Carregando contexto da conta, aguarde um instante...":lang==="es"?"Cargando contexto de la cuenta, espera un momento...":"Loading account context, just a moment...";
      setMessages(prev=>[...prev,{role:"user",userText:userText,ts:uid,id:uid},{role:"assistant",ts:uid+1,id:uid+1,blocks:[{type:"insight" as const,title:"",content:hint}]}]);
      setInput("");
      return;
    }

    // ── Intercept Telegram intent — check status first, respond accurately ──
    if (/telegram/i.test(msg) && user?.id) {
      const uid = Date.now();
      setMessages(prev=>[...prev,{role:"user",id:uid,ts:uid,userText:userText}]);
      setInput("");
      requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"instant"}));
      setLoading(true);
      try {
        const { data: tgConn } = await (supabase.from("telegram_connections" as any) as any)
          .select("chat_id, telegram_username, connected_at")
          .eq("user_id", user.id).eq("active", true).maybeSingle();

        const aid = Date.now()+1;

        if (tgConn?.chat_id) {
          // CONNECTED — confirm status and show commands
          const username = tgConn.telegram_username ? `@${tgConn.telegram_username}` : null;
          const since = tgConn.connected_at
            ? new Date(tgConn.connected_at).toLocaleDateString(lang==="pt"?"pt-BR":"en", { day:"2-digit", month:"short", year:"numeric" })
            : null;
          const txt = lang==="pt"
            ? `Sim, já está conectado${username ? ` como ${username}` : ""}. Você recebe alertas automáticos quando algo crítico acontece na conta e pode pausar criativos direto pelo bot.`
            : lang==="es"
            ? `Sí, ya está conectado${username ? ` como ${username}` : ""}. Recibes alertas automáticos cuando algo crítico pasa en la cuenta y puedes pausar creativos directo desde el bot.`
            : `Yes, it's connected${username ? ` as ${username}` : ""}. You get automatic alerts when something critical happens in your account and can pause creatives directly from the bot.

To disconnect, click the Telegram icon at the top.`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:"",content:txt}]}]);
        } else if (/conect|ativ|quero|want|receb|alert|notif|quiero/i.test(msg)) {
          // NOT CONNECTED + wants to connect — generate pairing link
          const tok = Math.random().toString(36).slice(2,8)+Math.random().toString(36).slice(2,8);
          await (supabase.from("telegram_pairing_tokens" as any) as any).insert({
            user_id:user.id, token:tok,
            expires_at: new Date(Date.now()+10*60*1000).toISOString(),
          });
          const link = `https://t.me/AdBriefAlertsBot?start=${tok}`;
          const txt = lang==="pt"
            ? `Simples. Clique no link — ele abre o @AdBriefAlertsBot com o seu token. Toque em /start e pronto.

 ${link}

Você vai receber alertas críticos e pode pausar anúncios direto pelo Telegram. Tudo fica registrado aqui com data e hora.`
            : lang==="es"
            ? `Simple. Haz clic en el enlace — abre @AdBriefAlertsBot con tu token. Toca /start y listo.

 ${link}

Recibirás alertas críticos y podrás pausar anuncios desde Telegram.`
            : `Simple. Click the link — it opens @AdBriefAlertsBot with your token. Tap /start and you're done.

 ${link}

You'll get critical alerts and can pause ads from Telegram. Everything logged here.`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:lang==="pt"?"Conectar Telegram":lang==="es"?"Conectar Telegram":"Connect Telegram",content:txt}]}]);
        } else {
          // NOT CONNECTED + just asking — inform
          const txt = lang==="pt"
            ? `Seu Telegram não está conectado ainda. Quer conectar para receber alertas críticos e pausar anúncios direto pelo app?`
            : lang==="es"
            ? `Tu Telegram aún no está conectado. ¿Quieres conectarlo para recibir alertas?`
            : `Your Telegram isn't connected yet. Want to connect to receive alerts and run commands?`;
          setMessages(prev=>[...prev,{role:"assistant",id:aid,ts:aid,blocks:[{type:"text" as const,title:"Telegram",content:txt}]}]);
        }
      } catch {
        const eid = Date.now()+2;
        setMessages(prev=>[...prev,{role:"assistant",id:eid,ts:eid,blocks:[{type:"warning",title:"Erro",content:lang==="pt"?"Não foi possível verificar o Telegram. Tente novamente.":"Could not check Telegram status. Try again."}]}]);
      }
      setLoading(false);
      return;
    }

    setInput("");
    if(textareaRef.current)textareaRef.current.style.height="auto";
    setActiveTool(null);
    const uid=Date.now();
    setMessages(prev=>[...prev,{role:"user",userText:userText,ts:uid,id:uid,imagePreview:pendingImage?.preview||undefined}]);
    trackEvent("ai_message_sent");
    // Scroll imediato ao enviar — não espera a resposta
    requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"instant"}));
    setLoading(true);
    try{
      // Compress history: user = plain text; assistant = readable summary including table data
      const history = messages.slice(-12).map(m => {
        if (m.role === "user") return { role: "user" as const, content: m.userText || "" };
        const text = (m.blocks || []).map((b: any) => {
          // Table blocks: serialize rows so AI remembers campaign data
          if (b.table) {
            const rows = (b.table.rows || []).slice(0, 5).map((r: any[]) =>
              (b.table.headers || []).map((h: string, i: number) => `${h}:${r[i]||"—"}`).join(" ")
            ).join(" | ");
            return `${b.title||"Dados"}: ${rows}`.slice(0, 300);
          }
          const parts = [
            b.title?.trim(),
            b.content?.slice(0, 180),
            (b.items || []).slice(0, 3).join(" | "),
          ].filter(Boolean);
          return parts.join(": ");
        }).filter(Boolean).join(" | ").slice(0, 500);
        return { role: "assistant" as const, content: text || "(response)" };
      });
      // Tone: free-text from localStorage (replaces hardcoded 3 options)
      const aiTonePref = (() => { return storage.get("adbrief_ai_tone", "") })();
      const invokeBody: any = {message:msg,context,user_id:user.id,persona_id:selectedPersona?.id||null,user_language:lang,history,user_prefs:{tone:aiTonePref||undefined}};
      // active_metric_alert tells the backend we're in a structured
      // resolution flow for a specific Feed metric alert (CTR/CPA/ROAS).
      // Backend swaps to Resolution Mode in the system prompt: diagnose →
      // propose 1 specific action → emit meta_action → close loop.
      if (activeMetricAlert) invokeBody.active_metric_alert = activeMetricAlert;
      // Pass image to vision-capable adbrief-ai-chat
      if(pendingImage) {
        invokeBody.image_base64 = pendingImage.base64;
        invokeBody.image_media_type = pendingImage.mediaType || "image/jpeg";
      } else if (lastAnalyzedImage) {
        // ── Image memory across turns ──
        // The user already analyzed an image earlier in this conversation.
        // Re-attach it so the AI can see the pixels when answering follow-up
        // questions like "como ficaria 10/10?" or "o que trocar?". Without this,
        // the AI loses the image context after the first turn and hallucinates
        // generic advice (e.g. "hook nos primeiros 3 segundos" for a static image).
        invokeBody.image_base64 = lastAnalyzedImage.base64;
        invokeBody.image_media_type = lastAnalyzedImage.mediaType;
        invokeBody.message = `[FOLLOW_UP_ON_PRIOR_IMAGE]\nFile already analyzed: ${lastAnalyzedImage.name}\nThis is a STATIC image — do not give video-only advice. Refer back to the scores and observations from your earlier analysis. Be consistent.\n\nUser question: ${msg}`;
      }
      const selectedAccId2 = selectedPersona?.id ? (storage.get(`meta_sel_${selectedPersona.id}`, "") || undefined) : undefined;
      if(selectedAccId2) invokeBody.account_id = selectedAccId2;
      const{data,error}=await supabase.functions.invoke("adbrief-ai-chat",{body:invokeBody});

      // Handle non-2xx errors — supabase returns them as errors with context
      if(error) {
        // Try multiple strategies to parse the error body from Supabase edge function errors
        let parsedErr: any = null;
        try {
          const ctx = (error as any).context;
          if (ctx instanceof Response) {
            const txt = await ctx.clone().text();
            try { parsedErr = JSON.parse(txt); } catch { parsedErr = { raw: txt }; }
          } else if (typeof ctx === "string") {
            try { parsedErr = JSON.parse(ctx); } catch { parsedErr = { raw: ctx }; }
          } else if (ctx && typeof ctx === "object") {
            parsedErr = ctx;
          }
        } catch {}
        // Fallback: try parsing the error message itself
        if (!parsedErr) {
          try { parsedErr = JSON.parse(error?.message || "{}"); } catch {}
        }
        // Fallback: try data field (some supabase versions return it here)
        if (!parsedErr && data) {
          parsedErr = data;
        }

        if(parsedErr?.error==="daily_limit"){
          if(profile?.plan&&profile.plan!=="free"){window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"));}else{setShowUpgradeWall(true);}
          setLoading(false);return;
        }
        // Credits exhausted — show tier-specific inline blocks
        if(parsedErr?.error==="insufficient_credits"||parsedErr?.type==="credits_exhausted"){
          if(parsedErr?.blocks){
            const aid=Date.now()+1;
            setMessages(prev=>[...prev,{role:"assistant",blocks:parsedErr.blocks,ts:aid,id:aid}]);
          } else {
            // Fallback: show upgrade wall if blocks parsing failed
            setShowUpgradeWall(true);
          }
          setLoading(false);return;
        }
        if(parsedErr?.error==="monthly_softcap"){
          const aid=Date.now()+1;
          const warningBlocks=parsedErr.blocks||[{type:"warning",title:lang==="pt"?"Limite mensal":lang==="es"?"Límite mensual":"Monthly limit",content:lang==="pt"?"Você está se aproximando do limite do plano. Considere fazer upgrade.":"You're approaching your plan limit. Consider upgrading."}];
          setMessages(prev=>[...prev,{role:"assistant",blocks:warningBlocks,ts:aid,id:aid}]);
          setLoading(false);
          return;
        }
        // If error has blocks in it, show them instead of crashing
        if(parsedErr?.blocks){
          const aid=Date.now()+1;
          setMessages(prev=>[...prev,{role:"assistant",blocks:parsedErr.blocks,ts:aid,id:aid}]);
          setLoading(false);
          return;
        }
        // Final fallback: if we couldn't parse and it's a non-2xx, show a friendly credits/limit message
        // instead of the raw "Edge Function returned a non-2xx status code"
        const errMsg = error?.message || "";
        if (errMsg.includes("non-2xx") || errMsg.includes("FunctionsHttpError")) {
          // Likely a credit or auth issue — show upgrade wall for free, capacity modal for paid
          if (!profile?.plan || profile.plan === "free") {
            setShowUpgradeWall(true);
          } else {
            const aid = Date.now() + 1;
            setMessages(prev => [...prev, { role: "assistant", blocks: [{
              type: "warning",
              title: lang === "pt" ? "Limite atingido" : lang === "es" ? "Límite alcanzado" : "Limit reached",
              content: lang === "pt"
                ? "Seus créditos acabaram este mês. Faça upgrade para continuar usando o AdBrief."
                : lang === "es"
                ? "Tus créditos se agotaron este mes. Haz upgrade para seguir usando AdBrief."
                : "Your credits ran out this month. Upgrade to keep using AdBrief.",
            }], ts: aid, id: aid }]);
          }
          setLoading(false); return;
        }
        throw new Error(errMsg || "No response");
      }

      if(!data?.blocks)throw new Error("No response");

      // Update credit balance from response
      if(data?.usage) {
        setCreditBalance({ remaining: data.usage.remaining_credits, total: data.usage.total_credits });
        window.dispatchEvent(new CustomEvent("adbrief:credits-updated"));
      }

      // Show upgrade popup on daily limit (in case returned with 200)
      if(data?.error==="daily_limit"){
        if(profile?.plan&&profile.plan!=="free"){window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"));}else{setShowUpgradeWall(true);}
        setLoading(false);return;
      }
      // Strip all markdown from text fields
      const stripMd=(s:string)=>String(s)
        .replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1")
        .replace(/#+\s/g,"").replace(/^\d+\.\s/gm,"").replace(/^[-*]\s/gm,"").trim();

      let blocks:Block[]=Array.isArray(data.blocks)?data.blocks:[{type:"insight",title:"Response",content:String(data.blocks)}];
      // Detect creative check response — blocks[0] has verdict field directly
      if(pendingImage && blocks.length > 0 && (blocks[0] as any).verdict) {
        const ccData = blocks[0] as any;
        blocks = [{ type: "creative_check" as any, title: ccData.verdict_reason || "Análise do criativo", content: "" } as any];
        (blocks[0] as any)._ccData = ccData;
        (blocks[0] as any)._fileName = pendingImage.name;
      }
      // Detect trend/evolution requests — auto-inject sparkline from snapshots
      const isTrendReq = /roas.*tempo|ctr.*tempo|evolu|tendên|trend|histórico.*performance|30.*dias|semanas?.*performance|performance.*semana|como.*está.*indo/i.test(msg);
      if (isTrendReq && user?.id) {
        // Fire and forget — load snapshots and prepend trend block
        const _trendQ = (supabase as any).from("daily_snapshots")
          .select("date,avg_ctr,avg_roas,total_spend")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .limit(30);
        // Strict persona isolation — only show trends for current persona
        (selectedPersona?.id ? _trendQ.eq("persona_id", selectedPersona.id) : _trendQ.is("persona_id", null))
          .then((r: any) => {
            const rows = (r.data || []).filter((d: any) => d.date);
            if (rows.length >= 2) {
              const trendBlock: Block = {
                type: "trend_chart",
                title: lang === "pt" ? "Evolução da conta" : lang === "es" ? "Evolución de cuenta" : "Account evolution",
                trend: {
                  dates: rows.map((d: any) => d.date.slice(5)), // MM-DD
                  ctr: rows.map((d: any) => { const v = d.avg_ctr || 0; return v > 1 ? v / 100 : v; }),
                  roas: rows.map((d: any) => d.avg_roas || 0),
                  spend: rows.map((d: any) => d.total_spend || 0),
                }
              };
              // Prepend trend block to the AI response
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return [...prev.slice(0, -1), { ...last, blocks: [trendBlock, ...(last.blocks || [])] }];
                }
                return prev;
              });
            }
          }).catch(() => {});
      }

      // Title translation map — converts technical API terms to human-readable labels
      const TITLE_MAP: Record<string, Record<string, string>> = {
        pt: {
          "list_campaigns": "Campanhas da conta",
          "list_ads": "Anúncios ativos",
          "get_campaigns": "Campanhas",
          "get_ads": "Anúncios",
          "list_adsets": "Conjuntos de anúncios",
          "get_insights": "Performance",
          "meta_action": "Ação no Meta Ads",
          "tool_call": "Processando...",
          "hooks": "Hooks gerados",
          "script": "Roteiro",
          "brief": "Brief criativo",
          "off_topic": "Fora do escopo",
          "insight": "",
          "analysis": "",
          "Análise": "",
          "action": "",
          "warning": "Atenção",
          "navigate": "Ver mais",
          "pause": "Pausar campanha",
          "enable": "Ativar campanha",
          "update_budget": "Atualizar orçamento",
          "publish": "Publicar",
          "duplicate": "Duplicar",
        },
        es: {
          "list_campaigns": "Campañas de la cuenta",
          "list_ads": "Anuncios activos",
          "get_campaigns": "Campañas",
          "get_ads": "Anuncios",
          "meta_action": "Acción en Meta Ads",
          "tool_call": "Procesando...",
          "hooks": "Hooks generados",
          "script": "Guión",
          "brief": "Brief creativo",
          "off_topic": "Fuera del alcance",
          "insight": "",
          "analysis": "",
          "action": "",
          "warning": "Atención",
        },
        en: {
          "list_campaigns": "Account campaigns",
          "list_ads": "Active ads",
          "get_campaigns": "Campaigns",
          "get_ads": "Ads",
          "meta_action": "Meta Ads action",
          "tool_call": "Processing...",
          "hooks": "Generated hooks",
          "script": "Script",
          "brief": "Creative brief",
          "off_topic": "Out of scope",
          "insight": "",
          "analysis": "",
          "Analysis": "",
          "action": "",
          "warning": "Attention",
        },
      };
      const translateTitle = (title: string, type: string): string => {
        const map = TITLE_MAP[lang] || TITLE_MAP.en;
        // Check if title is a known technical term
        if (map[title]) return map[title];
        // Check if title is a type name
        if (map[type]) return map[type];
        // Check for patterns like "list_X" or "get_X"
        if (/^(list|get|fetch|update|create|delete|pause|enable)_/.test(title)) {
          const action = title.split('_')[0];
          const subject = title.split('_').slice(1).join(' ');
          const actionMap: Record<string, Record<string,string>> = {
            pt: { list: 'Listar', get: 'Buscar', fetch: 'Buscar', update: 'Atualizar', create: 'Criar', delete: 'Remover', pause: 'Pausar', enable: 'Ativar' },
            es: { list: 'Listar', get: 'Buscar', fetch: 'Buscar', update: 'Actualizar' },
            en: { list: 'List', get: 'Get', fetch: 'Fetch', update: 'Update' },
          };
          const aMap = actionMap[lang] || actionMap.en;
          if (aMap[action]) return `${aMap[action]} ${subject}`;
        }
        return title;
      };

      blocks=blocks.map(b=>{
        // Clean all text
        const c={...b,
          // stripMd only on title — content/items need markdown preserved for renderMarkdown
          title:b.title?translateTitle(stripMd(b.title), b.type):b.title,
          content:b.content, // preserve markdown for renderMarkdown (**bold**, \n\n)
          items:b.items, // preserve markdown in hook items too
        };
        // Intercept empty hooks block (AI returned {type:"hooks", items:[]}) — execute generate-hooks
        if(c.type==="hooks" && (!c.items || c.items.length === 0)){
          const countMatch=msg.match(/(\d+)\s+hooks?/i);
          const params={
            product:(profile as any)?.product || selectedPersona?.name || "produto",
            niche:(profile as any)?.industry || (profile as any)?.niche || "geral",
            market:lang.toUpperCase()||"BR",
            platform:connections.includes("meta")?"Meta Feed":false /* google disabled */?"Google":"Meta Feed",
            tone:"human, direct",
            count:countMatch?parseInt(countMatch[1]):5,
            context:msg,
            user_id:user.id,
            persona_id:selectedPersona?.id||null,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"generate-hooks",_toolParams:params};
        }

        // Convert meta_action tool_call — read-only: execute immediately, destructive: show confirm
        if(c.type==="tool_call"&&c.tool_params?.meta_action){
          const p=c.tool_params;
          const DESTRUCTIVE=["pause","enable","update_budget","publish","duplicate","delete","archive","rename","set_","change_"];
          const isDestructive=DESTRUCTIVE.some(d=>String(p.meta_action||"").toLowerCase().includes(d));
          if(!isDestructive){
            return{...c,type:"meta_action" as const,meta_action:p.meta_action,target_id:p.target_id,target_type:p.target_type,target_name:p.target_name,value:p.value,_autoExec:true};
          }
          return{...c,type:"meta_action" as const,meta_action:p.meta_action,target_id:p.target_id,target_type:p.target_type,target_name:p.target_name,value:p.value};
        }
        // When AI emits a tool_call for content tools, open the panel with prefilled context
        if(c.type==="tool_call"&&["hooks","script","brief","competitor","translate"].includes(c.tool||"")&&!(c as any)._pendingTool){
          // Auto-open panel with AI-populated context + prefill from tool_params
          const p=c.tool_params||{};
          const prefill: Record<string,string>={};
          if(p.competitor_url||p.url||p.brand||p.ad_text) prefill.val=p.competitor_url||p.url||p.brand||p.ad_text||"";
          if(p.source_text||p.text) prefill.val=p.source_text||p.text||"";
          if(p.angle) prefill.val=p.angle;
          setTimeout(()=>{setActiveTool(c.tool||null);setActiveToolParams(prefill);},100);
        }
        // Execute competitor tool_calls inline — invoke decode-competitor
        if(c.type==="tool_call"&&c.tool==="competitor"){
          const p=c.tool_params||{};
          const params={
            ad_text: p.competitor_url||p.url||p.brand||p.ad_text||p.context||"",
            observation: p.angle||p.context||"",
            ui_language: lang,
            user_id: user.id,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"decode-competitor",_toolParams:params};
        }
        // Execute translate tool_calls inline — invoke translate-text
        if(c.type==="tool_call"&&c.tool==="translate"){
          const p=c.tool_params||{};
          const params={
            source_text: p.source_text||p.text||p.content||"",
            to_language: p.target_language||p.to_language||"en",
            to_language_name: p.target_language_name||p.to_language_name||"English",
            tone: p.tone||"Persuasive",
            context: p.context||p.angle||"",
            user_id: user.id,
          };
          return{...c,type:"tool_call" as const,_pendingTool:"translate-text",_toolParams:params};
        }
        // Execute hooks/script/brief tool_calls inline — fire and replace
        if(c.type==="tool_call"&&["hooks","script","brief"].includes(c.tool||"")){
          const p=c.tool_params||{};
          const fn=c.tool==="hooks"?"generate-hooks":c.tool==="script"?"generate-script":"generate-brief";
          // generate-script expects: product, offer, audience, format, duration, market, angle, extra_context
          // generate-hooks expects: product, niche, market, platform, tone, count, context
          const params = fn === "generate-script" ? {
            user_id: user.id,
            persona_id: selectedPersona?.id || null,
            product: p.product || p.niche || "produto",
            offer: p.cta || "",
            audience: p.audience || p.target || "",
            format: p.format || "ugc",
            duration: p.duration || "30s",
            market: p.market || (lang === "pt" ? "BR" : lang === "es" ? "MX" : "US"),
            angle: p.angle || p.tone || "",
            extra_context: p.context || p.extra_context || "",
            ui_language: lang, // user's app language — primary for output language
          } : {
            ...p,
            user_id: user.id,
            persona_id: selectedPersona?.id || null,
            product: p.product || p.niche || "produto",
            niche: p.niche || p.product || "produto",
            market: p.market || (lang === "pt" ? "BR" : lang === "es" ? "MX" : "US"),
            platform: p.platform || "Meta Feed",
            tone: p.tone || "human, credible, specific",
            count: p.count || 5,
            context: p.context || p.angle || "",
            angle: p.angle || "",
          };
          return{...c,type:"tool_call" as const,_pendingTool:fn,_toolParams:params};
        }
        return c;
      });

      const aid=Date.now()+1;
      // Context lock: discard response if persona changed during request
      if (sendPersonaId !== (selectedPersona?.id || null)) {
        console.warn("[AdBrief] Discarding stale AI response — persona changed during request");
        setLoading(false); return;
      }
      setMessages(prev=>[...prev,{role:"assistant",blocks,ts:aid,id:aid}]);
      // Trigger streaming effect for this message
      setStreamingMsgId(aid);
      if(streamTimerRef.current) clearTimeout(streamTimerRef.current);
      // Dynamic timeout — cover the full word-reveal duration so the stream
      // prop never clears mid-animation (which would cause a visible flash).
      // 22ms per word + 120ms reveal + 500ms buffer, min 3.5s, max 30s.
      const totalText = (blocks || [])
        .map((b:any) => `${b.title || ""} ${b.content || ""}`)
        .join(" ");
      const wordCount = totalText.split(/\s+/).filter(Boolean).length;
      const streamDuration = Math.min(30000, Math.max(3500, wordCount * 22 + 620));
      streamTimerRef.current=setTimeout(()=>setStreamingMsgId(null),streamDuration);


      // Memory extraction runs backend-side in adbrief-ai-chat → extract-chat-memory.
      // The edge function already fires Haiku with dedup + 50/persona cap; doing it
      // again from the browser would require exposing ANTHROPIC_API_KEY client-side.
      // Credit balance already updated above from response payload
    }catch(e:any){
      const eid=Date.now()+1;
      setMessages(prev=>[...prev,{role:"assistant",ts:eid,id:eid,blocks:[{type:"warning",title:lang==="pt"?"Erro de conexão":"Connection error",content:e?.message||"Network error."}]}]);
    }finally{
      setLoading(false);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
    }
  };

  // ── Auto-send prompt from navigation state (e.g. tracking diagnosis from Feed) ──
  const pendingNavPrompt = useRef<string | null>(
    (location.state as any)?.prompt || null
  );
  const navPromptSent = useRef(false);
  // ── Active metric investigation context ──
  // When the user comes from "Melhorar CTR" (or similar feed alert), Feed
  // passes activeMetricAlert in nav state. We hold it for the rest of the
  // chat session so every message tells the backend "this is a resolution
  // flow for ctr_deviation". Backend uses it to swap into Resolution Mode
  // and constrain the AI to a diagnose → propose action → confirm cadence.
  const [activeMetricAlert, setActiveMetricAlert] = useState<string | null>(
    (location.state as any)?.activeMetricAlert || null
  );
  useEffect(() => {
    // Also capture on location change (in case ref missed it)
    if (!navPromptSent.current && (location.state as any)?.prompt) {
      pendingNavPrompt.current = (location.state as any).prompt;
    }
    if ((location.state as any)?.activeMetricAlert) {
      setActiveMetricAlert((location.state as any).activeMetricAlert);
    }
  }, [location.state]);
  useEffect(() => {
    if (!pendingNavPrompt.current || navPromptSent.current) return;
    // Wait for persona + context to be ready + not currently sending
    if (!selectedPersona?.id || !contextReady || loading) return;
    const prompt = pendingNavPrompt.current;
    navPromptSent.current = true;
    pendingNavPrompt.current = null;
    // Clear navigation state so refresh doesn't re-send
    navigate(location.pathname, { replace: true, state: {} });
    // Small delay for UI to settle
    setTimeout(() => send(prompt), 300);
  }, [selectedPersona?.id, contextReady, loading]);

    // Base toolbar for this language. Brief is intentionally missing from
    // the public toolbar (see TOOLBAR definition above). Re-add it when
    // the URL carries ?brief=1 so the owner can still trigger the
    // in-chat InlineToolPanel for brief generation. Everyone else just
    // doesn't see the pill.
    const BRIEF_UNLOCK = typeof window !== "undefined" && /[?&]brief=1\b/.test(window.location.search);
    const baseTools = TOOLBAR[lang] || TOOLBAR.en;
    const briefPill = BRIEF_PILL_BY_LANG[lang] || BRIEF_PILL_BY_LANG.en;
    const TOOLS = BRIEF_UNLOCK
      ? [baseTools[0], baseTools[1], briefPill, ...baseTools.slice(2)]
      : baseTools;
  const hasData=connections.length>0;

  const LABEL: Record<string,Record<string,string>>={
    pt:{clear:"Limpar",placeholder:"Pergunte sobre sua conta...",footer:"Somente performance de anúncios e inteligência criativa",connecting:"Conectando...",soon:"Em breve"},
    es:{clear:"Limpiar",placeholder:"Pregunta sobre tu cuenta...",footer:"Solo inteligencia de rendimiento publicitario",connecting:"Conectando...",soon:"Pronto"},
    en:{clear:"Clear",placeholder:"Ask anything...",footer:"Strictly ad performance & creative intelligence",connecting:"Connecting...",soon:"Soon"},
  };
  const L=LABEL[lang]||LABEL.en;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",...j,background:"var(--bg-main)",position:"relative" as const}}>
      {/* Background — ultra minimal */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        {/* Grid — edges only, invisible in center */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)",backgroundSize:"100% 56px",opacity:0.6,maskImage:"radial-gradient(ellipse 60% 55% at 50% 42%,transparent 20%,black 75%)",WebkitMaskImage:"radial-gradient(ellipse 60% 55% at 50% 42%,transparent 20%,black 75%)"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)",backgroundSize:"56px 100%",opacity:0.6,maskImage:"radial-gradient(ellipse 60% 55% at 50% 42%,transparent 20%,black 75%)",WebkitMaskImage:"radial-gradient(ellipse 60% 55% at 50% 42%,transparent 20%,black 75%)"}}/>
        {/* Fade edges */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:60,background:"linear-gradient(to bottom,var(--bg-main),transparent)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:80,background:"linear-gradient(to top,var(--bg-main),transparent)"}}/>
      </div>

      {/* ── LivePanel compact bar — show when Meta is connected (or loading connections) ── */}
      {(connections.includes("meta") || connectionsLoading) && (
        <LivePanel user={user} selectedPersona={selectedPersona} connections={connections} lang={lang} onSend={send} />
      )}

      {/* Skills panel removed */}

      {/* ── Messages ── */}
      <div style={{flex:1,overflowY:"auto",padding:"0",background:"transparent",position:"relative" as const,zIndex:1,display:"flex",flexDirection:"column" as const,paddingTop:8}}>
        
        {/* ── Urgent Alert Banner — aggressive PriorityStack style ── */}
        {accountAlerts.length > 0 && (
          <div style={{maxWidth:720,margin:"0 auto 16px",padding:"0 16px"}}>
            {/* Section header */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#F87171",boxShadow:"0 0 10px rgba(248,113,113,0.5)",animation:"chatAlertPulse 2s ease-in-out infinite"}} />
              <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#F87171",fontFamily:"'Inter','Plus Jakarta Sans',system-ui,sans-serif"}}>
                {accountAlerts.filter((a:any)=>a.urgency==="high").length > 0
                  ? `${accountAlerts.filter((a:any)=>a.urgency==="high").length} ALERTA${accountAlerts.filter((a:any)=>a.urgency==="high").length>1?"S":""} URGENTE${accountAlerts.filter((a:any)=>a.urgency==="high").length>1?"S":""}`
                  : `${accountAlerts.length} ALERTA${accountAlerts.length>1?"S":""}`}
              </span>
              <div style={{flex:1,height:1,background:"rgba(248,113,113,0.15)"}} />
            </div>
            {/* Alert cards */}
            {[...accountAlerts].sort((a:any,b:any) => {
              if(a.urgency==="high"&&b.urgency!=="high") return -1;
              if(a.urgency!=="high"&&b.urgency==="high") return 1;
              return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
            }).map((alert:any,i:number) => {
              const isHigh = alert.urgency === "high";
              const isDismissing = alertsDismissing.has(alert.id);
              const alertIcons: Record<string,string> = {FADIGA_CRITICA:"🔥",ROAS_CRITICO:"💸",ROAS_COLAPSOU:"📉",CTR_COLAPSOU:"🧊",RETENCAO_VIDEO_BAIXA:"⏭️",SPEND_SEM_RETORNO:"🕳️"};
              const alertVerbs: Record<string,string> = {FADIGA_CRITICA:"Pause agora",ROAS_CRITICO:"Corte já",ROAS_COLAPSOU:"Ação imediata",CTR_COLAPSOU:"Troque o criativo",RETENCAO_VIDEO_BAIXA:"Refaça o hook",SPEND_SEM_RETORNO:"Pare o sangramento"};
              const icon = alertIcons[alert.type] || (isHigh ? "🚨" : "⚠️");
              const verb = alertVerbs[alert.type] || (isHigh ? "Ação urgente" : "Atenção");
              const color = isHigh ? "#F87171" : "#FBBF24";
              const adLabel = alert.ad_name || alert.campaign_name || "";
              const diff = Date.now()-new Date(alert.created_at).getTime();
              const mins = Math.floor(diff/60000);
              const ago = mins<1?"agora":mins<60?`${mins}min atrás`:mins<1440?`${Math.floor(mins/60)}h atrás`:`${Math.floor(mins/1440)}d atrás`;
              return (
                <div key={alert.id} style={{
                  background: isHigh ? "linear-gradient(135deg,rgba(248,113,113,0.08) 0%,rgba(13,17,23,0.95) 100%)" : "rgba(13,17,23,0.7)",
                  border:`1px solid ${isHigh ? "rgba(248,113,113,0.25)" : "rgba(251,191,36,0.2)"}`,
                  borderLeft:`3px solid ${color}`,
                  borderRadius:10,padding:"12px 16px",marginBottom:8,
                  opacity:isDismissing?0:1,
                  transform:isDismissing?"translateX(12px) scale(0.97)":"translateX(0) scale(1)",
                  transition:isDismissing?"all 0.25s cubic-bezier(0.4,0,0.2,1)":"opacity 0.15s",
                  pointerEvents:isDismissing?"none" as const:"auto" as const,
                }}>
                  {/* Top: type badge + time */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14}}>{icon}</span>
                      <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color,fontFamily:"'Inter',sans-serif"}}>
                        {alert.type?.replace(/_/g," ")||"ALERTA"}
                      </span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"rgba(240,246,252,0.48)",fontFamily:"'Inter',sans-serif"}}>{ago}</span>
                      <button onClick={()=>dismissAlert(alert.id)} disabled={isDismissing}
                        style={{background:"none",border:"none",cursor:"pointer",color:"rgba(240,246,252,0.3)",fontSize:14,padding:"0 2px",lineHeight:1}}
                        title="Dispensar">×</button>
                    </div>
                  </div>
                  {/* Headline — ACTION + LOSS */}
                  <p style={{fontSize:14,fontWeight:700,color:"#F0F6FC",margin:"0 0 4px",lineHeight:1.45,fontFamily:"'Inter',sans-serif"}}>
                    {verb}{adLabel ? ` '${adLabel}'` : ""}
                  </p>
                  {/* Detail — loss framing */}
                  <p style={{fontSize:12.5,color:isHigh?"rgba(248,113,113,0.85)":"rgba(240,246,252,0.72)",margin:"0 0 8px",lineHeight:1.5,fontFamily:"'Inter',sans-serif",fontWeight:isHigh?500:400}}>
                    {alert.detail}
                  </p>
                  {/* Action button for high urgency */}
                  {isHigh && (
                    <button onClick={()=>{
                      setInput(alert.action_suggestion || `Analise urgente: ${alert.detail}`);
                    }} style={{
                      background:color,color:"#fff",border:"none",borderRadius:5,
                      padding:"5px 12px",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",
                      cursor:"pointer",boxShadow:`0 2px 8px ${color}40`,transition:"all 0.15s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 12px ${color}60`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 2px 8px ${color}40`;}}
                    >
                      {alert.action_suggestion || "Analisar agora"}
                    </button>
                  )}
                </div>
              );
            })}
            <style>{`@keyframes chatAlertPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.85;transform:scale(1.08)}}`}</style>
          </div>
        )}

        {/* ── Loading state — premium progress bar ── */}
        {messages.length===0&&(proactiveLoading||!contextReady)&&(
          <div style={{maxWidth:680,margin:"0 auto",padding:"clamp(60px,12vw,100px) 24px 32px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(13,162,231,0.06)",border:"1px solid rgba(13,162,231,0.10)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0da2e7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.30)",fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:"0.02em",margin:0}}>
              {lang==="pt"?"Carregando seus dados...":lang==="es"?"Cargando tus datos...":"Loading your data..."}
            </p>
            <div style={{width:140,height:2,borderRadius:1,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:1,background:"linear-gradient(90deg, transparent, #0da2e7, transparent)",animation:"chatLoadBar 1.5s ease-in-out infinite"}}/>
            </div>
            <style>{`@keyframes chatLoadBar{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
          </div>
        )}

        {messages.length===0&&!proactiveLoading&&contextReady&&!hasData&&(
          <div style={{maxWidth:720,margin:"16px auto 0",padding:"0 16px"}}>
            {/* ── No account connected — force connect ── */}
            <div style={{textAlign:"center",padding:"48px 24px"}}>
              <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.08))",border:"1px solid rgba(148,163,184,0.08)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg>
              </div>
              <h3 style={{...j,fontSize:24,fontWeight:800,color:"#F1F5F9",margin:"0 0 10px",letterSpacing:"-0.03em"}}>
                {lang==="pt"?"Conecte seus dados":lang==="es"?"Conecta tus datos":"Connect your data"}
              </h3>
              <p style={{...m,fontSize:13,color:"#64748B",lineHeight:1.65,margin:"0 0 28px",maxWidth:360,marginLeft:"auto",marginRight:"auto"}}>
                {lang==="pt"?"Com seus dados conectados, a IA vê CTR, spend, o que pausar e escalar em tempo real.":lang==="es"?"Con tus datos, la IA ve CTR, spend, qué pausar y escalar en tiempo real.":"With your data connected, AI sees CTR, spend, what to pause and scale in real time."}
              </p>
              {selectedPersona ? (
                <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
                  <button onClick={()=>handleConnect("meta","meta-oauth")}
                    style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,background:"#2563EB",color:"#fff",border:"none",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 0 20px rgba(37,99,235,0.30)",transition:"all 0.2s"}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-1px)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(0)";}}>
                    {PLATFORM_ICONS_INLINE.meta} {lang==="pt"?"Conectar Meta Ads":lang==="es"?"Conectar Meta Ads":"Connect Meta Ads"}
                  </button>
                </div>
              ) : (
                <button onClick={()=>navigate("/dashboard/accounts")}
                  style={{...j,display:"inline-flex",alignItems:"center",gap:8,padding:"12px 28px",borderRadius:12,background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",fontSize:14,fontWeight:700}}>
                  {lang==="pt"?"Criar conta primeiro":lang==="es"?"Crear cuenta primero":"Create account first"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Load more — shown when there are older messages not rendered */}
        {hasOlderMessages && (
          <div style={{maxWidth:720,width:"100%",margin:"0 auto 8px",padding:"0 clamp(12px,4vw,28px)",boxSizing:"border-box" as const}}>
            <button onClick={()=>setVisibleCount(c=>c+MSG_PAGE)}
              style={{width:"100%",padding:"8px 0",background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:10,color:"var(--text-muted)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans', sans-serif",transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border-default)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border-subtle)"}}>
              ↑ Ver {Math.min(MSG_PAGE, messages.length - visibleCount)} mensagens anteriores
            </button>
          </div>
        )}
        {visibleMessages.length > 0 && <div style={{height:8,flexShrink:0}}/>}
        {visibleMessages.map((msg, mi)=>{
          const isLatest = msg.role === "assistant" && msg.id === streamingMsgId;
          return (
          <div key={msg.id} className="msg-wrap-inner" style={{maxWidth:720,width:"100%",margin:"0 auto 14px",padding:"0 clamp(12px,4vw,28px)",boxSizing:"border-box" as const}}>
            {msg.role==="user"?(
              /* ── Bolha do usuário — direita, azul sólido ── */
              <div style={{display:"flex",justifyContent:"flex-end"}} className="user-msg-row">
                <div className="user-bubble-wrap" style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4,maxWidth:"min(72%,calc(100vw - 80px))"}}>
                  <div style={{
                    borderRadius:"18px 18px 4px 18px",
                    background:"#2563EB",
                    boxShadow:"0 2px 12px rgba(37,99,235,0.30)",
                    overflow:"hidden",
                    animation:"bubbleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    {(msg as any).imagePreview && (
                      <div style={{padding:"8px 8px 4px"}}>
                        <img src={(msg as any).imagePreview} alt="criativo"
                          style={{width:"100%",maxWidth:260,height:"auto",borderRadius:10,display:"block",maxHeight:180,objectFit:"contain",background:"rgba(0,0,0,0.15)"}}/>
                      </div>
                    )}
                    <div style={{
                      padding:"10px 16px",
                      fontSize:14,fontWeight:400,
                      color:"#fff",
                      lineHeight:1.65,
                      ...m,
                    }}>
                      {(msg.userText||"").replace(/^\[(?:CRIATIVO ESTÁTICO PARA ANÁLISE|STATIC CREATIVE FOR ANALYSIS|SCRIPT|HOOKS|COMPETITOR):[^\]]*\]\s*/i, "").trim() || msg.userText}
                    </div>
                  </div>
                  {/* Ações no hover */}
                  <div className="user-msg-actions" style={{display:"flex",alignItems:"center",gap:4,opacity:0,transition:"opacity 0.15s",pointerEvents:"none" as const}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.18)"}}>
                      {new Date(typeof msg.ts === "number" ? msg.ts : Date.now()).toLocaleTimeString(lang==="pt"?"pt-BR":"en-US",{hour:"2-digit",minute:"2-digit"})}
                    </span>
                    <button onClick={(e)=>{navigator.clipboard.writeText(msg.userText||"");const b=e.currentTarget;b.style.color="#34d399";setTimeout(()=>{b.style.color="rgba(255,255,255,0.25)";},1600);}}
                      style={{display:"flex",alignItems:"center",gap:3,height:22,padding:"0 7px",borderRadius:5,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,...m,transition:"color 0.18s"}}>
                      <Copy size={8}/>Copiar
                    </button>
                    <button onClick={()=>send(msg.userText||"")}
                      style={{display:"flex",alignItems:"center",gap:3,height:22,padding:"0 7px",borderRadius:5,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,...m,transition:"color 0.12s"}}>
                      <RefreshCw size={8}/>Retry
                    </button>
                  </div>
                </div>
              </div>
            ):(
              /* ── Bolha da IA — esquerda, card escuro ── */
              /* Se todos blocks são _pendingTool, suprimir tudo — ThinkingIndicator cobre */
              <div key={msg.blocks?.every((b:any)=>b._pendingTool) ? "pending" : "resolved"}>
                {/* Avatar + label — só mostra se há blocks reais */}
                {!!(msg.blocks?.length) && !(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && (
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,animation:"fadeUp 0.15s ease-out"}}>
                    <div style={{width:26,height:26,borderRadius:8,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.22)"}}>
                      <ABAvatar size={26}/>
                    </div>
                    <span style={{fontFamily:"'Plus Jakarta Sans', sans-serif",fontSize:12,fontWeight:600,color:"rgba(37,99,235,0.75)",letterSpacing:"-0.01em"}}>AdBrief AI</span>
                  </div>
                )}
                {/* Blocks — card da IA */}
                {!(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && !msg.blocks?.every((b:any)=>b._pendingTool) ? (
                  <div style={{
                    background:"var(--bg-card)",
                    border:"1px solid var(--border-subtle)",
                    borderRadius:"4px 18px 18px 18px",
                    padding:"16px 20px",
                    boxShadow:"0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
                    backdropFilter:"blur(8px)",
                    animation:"cardIn 0.25s cubic-bezier(0.16,1,0.3,1)",
                  }}>
                    {msg.blocks?.map((b,bi)=>
                      b.type==="meta_action"?<ConfirmActionBlock key={bi} block={b} lang={lang} onConfirm={executeMetaAction}/>:
                      (b.type as string)==="limit_warning"?(
                        <div key={bi} style={{marginTop:8,padding:"10px 14px",borderRadius:10,background:"rgba(14,165,233,0.05)",border:"1px solid rgba(14,165,233,0.15)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" as const}}>
                          <p style={{...m,fontSize:13,color:"rgba(14,165,233,0.8)",lineHeight:1.5,margin:0,flex:1}}>{b.content}</p>
                          {(b as any).will_hit_limit&&(
                            <button onClick={()=>setShowUpgradeWall(true)}
                              style={{...j,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,background:"#0ea5e9",color:"#fff",border:"none",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" as const}}>
                              {lang==="pt"?"Ver planos →":lang==="es"?"Ver planes →":"See plans →"}
                            </button>
                          )}
                        </div>
                      ):
                      (b as any)._pendingTool?null:
                      <BlockCard key={bi} block={b} lang={lang} onNavigate={handleNavigate} onSend={send} accountCtx={{product:(profile as any)?.product||selectedPersona?.name,niche:(profile as any)?.industry||(profile as any)?.niche,market:(profile as any)?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US"),platform:connections.includes("meta")?"Meta":undefined}} stream={isLatest}/>
                    )}
                  </div>
                ) : (
                  /* Proactive — sem card, renderiza direto */
                  msg.blocks?.map((b,bi)=>
                    (b.type as string)==="proactive"?<ProactiveBlock key={bi} block={b} lang={lang} onSend={send} connections={connections} personaName={selectedPersona?.name||undefined}/>:
                    <BlockCard key={bi} block={b} lang={lang} onNavigate={handleNavigate} onSend={send} accountCtx={{product:(profile as any)?.product||selectedPersona?.name,niche:(profile as any)?.industry||(profile as any)?.niche,market:(profile as any)?.market||(lang==="pt"?"BR":lang==="es"?"MX":"US"),platform:connections.includes("meta")?"Meta":undefined}} stream={isLatest}/>
                  )
                )}
                {/*   Copy Retry row — hidden for proactive messages */}
                {!(msg.blocks?.length === 1 && (msg.blocks[0].type as string) === "proactive") && (
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4,paddingLeft:0,opacity:0,transition:"opacity 0.15s",animation:"fadeUp 0.25s ease-out"}} className="msg-actions-row" onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="0.6"}}>
                  <button onClick={()=>handleFeedback(msg.id,"like",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:24,height:22,borderRadius:6,background:feedback[msg.id]==="like"?"rgba(52,211,153,0.12)":"transparent",border:`1px solid ${feedback[msg.id]==="like"?"rgba(52,211,153,0.3)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:feedback[msg.id]==="like"?"#34d399":"rgba(255,255,255,0.25)",transition:"all 0.12s"}}
                    onMouseEnter={e=>{if(feedback[msg.id]!=="like")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(feedback[msg.id]!=="like")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <ThumbsUp size={10}/>
                  </button>
                  <button onClick={()=>handleFeedback(msg.id,"dislike",msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",width:24,height:22,borderRadius:6,background:feedback[msg.id]==="dislike"?"rgba(248,113,113,0.12)":"transparent",border:`1px solid ${feedback[msg.id]==="dislike"?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:feedback[msg.id]==="dislike"?"#f87171":"rgba(255,255,255,0.25)",transition:"all 0.12s"}}
                    onMouseEnter={e=>{if(feedback[msg.id]!=="dislike")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(feedback[msg.id]!=="dislike")(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <ThumbsDown size={10}/>
                  </button>
                  <div style={{width:1,height:14,background:"rgba(255,255,255,0.07)",margin:"0 2px"}}/>
                  <button onClick={()=>handleCopy(msg.id,msg.blocks||[])}
                    style={{display:"flex",alignItems:"center",gap:3,height:26,padding:"0 8px",borderRadius:6,background:copiedId===msg.id?"rgba(52,211,153,0.08)":"transparent",border:`1px solid ${copiedId===msg.id?"rgba(52,211,153,0.25)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",color:copiedId===msg.id?"#34d399":"rgba(255,255,255,0.25)",fontSize:12,...m,transition:"all 0.18s",transform:copiedId===msg.id?"scale(1.06)":"scale(1)"}}
                    onMouseEnter={e=>{if(copiedId!==msg.id)(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{if(copiedId!==msg.id)(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    {copiedId===msg.id?<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<Copy size={9}/>}
                    {copiedId===msg.id?"Copiado!":lang==="es"?"Copiar":"Copiar"}
                  </button>
                  <button onClick={()=>{
                    // Find the user message that immediately precedes this assistant message
                    const idx = messages.indexOf(msg);
                    const prevUser = [...messages].slice(0, idx).reverse().find(m => m.role === "user");
                    send(prevUser?.userText || "");
                  }}
                    style={{display:"flex",alignItems:"center",gap:3,height:26,padding:"0 8px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:12,...m,transition:"all 0.12s"}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"}}>
                    <RefreshCw size={9}/>Retry
                  </button>
                </div>
                )}
              </div>
            )}
          </div>
          );
        })}

        <div style={{maxWidth:720,width:"100%",margin:"0 auto",padding:"0 clamp(12px,4vw,40px)",boxSizing:"border-box" as const}}>{loading&&<ThinkingIndicator lang={lang} variant="chat" userMessage={messages.filter(m=>m.role==="user").slice(-1)[0]?.userText||""} label={(() => {
              const pendingFn = (messages.flatMap(m=>m.blocks||[]) as any[]).find(b=>b._pendingTool)?._pendingTool as string|undefined;
              if(pendingFn==="generate-hooks")  return lang==="pt"?"Criando hooks de alta conversão...":lang==="es"?"Creando hooks de alta conversión...":"Crafting high-converting hooks...";
              if(pendingFn==="generate-script") return lang==="pt"?"Estruturando roteiro...":lang==="es"?"Estructurando guión...":"Building your script...";
              if(pendingFn==="generate-brief")  return lang==="pt"?"Montando brief criativo...":lang==="es"?"Montando brief creativo...":"Building creative brief...";
              return undefined; // let ThinkingIndicator derive from userMessage
            })()}/>}</div>
        {!loading&&messages.some(m=>m.blocks?.some(b=>(b as any)._pendingTool))&&(
          <div style={{maxWidth:720,width:"100%",margin:"0 auto",padding:"0 32px",boxSizing:"border-box"}}>
          <ThinkingIndicator lang={lang} variant="chat" userMessage={messages.filter(m=>m.role==="user").slice(-1)[0]?.userText||""} label={(() => {
              const pendingFn = (messages.flatMap(m=>m.blocks||[]) as any[]).find(b=>b._pendingTool)?._pendingTool as string|undefined;
              if(pendingFn==="generate-hooks")  return lang==="pt"?"Criando hooks de alta conversão...":lang==="es"?"Creando hooks de alta conversión...":"Crafting high-converting hooks...";
              if(pendingFn==="generate-script") return lang==="pt"?"Estruturando roteiro...":lang==="es"?"Estructurando guión...":"Building your script...";
              if(pendingFn==="generate-brief")  return lang==="pt"?"Montando brief criativo...":lang==="es"?"Montando brief creativo...":"Building creative brief...";
              return undefined; // let ThinkingIndicator derive from userMessage
            })()}/>
          </div>
        )}
        {/* Inline tool panel — only show when not loading */}
        {activeTool&&!loading&&!messages.some(m=>m.blocks?.some(b=>(b as any)._pendingTool))&&(
          <div style={{maxWidth:720,margin:"0 auto 8px",padding:"0 40px",boxSizing:"border-box" as const}}>
            <InlineToolPanel
              action={activeTool}
              onClose={()=>setActiveTool(null)}
              onSend={send}
              lang={lang}
              accountCtx={{
                product: (profile as any)?.product || selectedPersona?.name || undefined,
                niche: (profile as any)?.industry || (profile as any)?.niche || undefined,
                market: (profile as any)?.market || lang.toUpperCase(),
                platform: connections.includes("meta") ? "Meta" : false /* google disabled */ ? "Google" : undefined,
                angle: undefined,
              }}
            />
          </div>
        )}

        <div style={{flexShrink:0,height:16}}/>
        <div ref={bottomRef} style={{height:4}}/>
      </div>

      {/* ── Composer (rebuild do zero) ──
          Layout Claude/ChatGPT: textarea full-width em cima, action bar
          com [+], anexo, limpar e send em baixo. Tudo dentro de UM card
          sólido #141924. Sem fade, sem station, sem banner externo. */}
      <div style={{flexShrink:0,position:"relative" as const,zIndex:2,padding:"16px 0 max(env(safe-area-inset-bottom, 0px), 20px)"}}>
        <div className="chat-input-wrap" style={{maxWidth:720,margin:"0 auto",padding:"0 20px",boxSizing:"border-box" as const,position:"relative" as const}}>

            {/* Floating tool-menu — "thought bubbles" opened from [+] trigger inside composer */}
            {showToolMenu && (
              <div
                ref={toolMenuRef}
                className="tool-bubble-stack"
                style={{
                  position:"absolute" as const,
                  bottom:"calc(100% - 8px)",
                  left:20,
                  right:20,
                  display:"flex",flexDirection:"column-reverse",gap:7,
                  pointerEvents:"none" as const,
                  zIndex:30,
                }}
              >
                {/* Goal bubble — separate kind of action (focus/context) */}
                <button
                  key="__goal__"
                  onClick={()=>{ setShowGoalInput(true); setShowToolMenu(false); }}
                  className="tool-bubble"
                  style={{
                    pointerEvents:"auto" as const,
                    display:"flex",alignItems:"center",gap:12,
                    textAlign:"left" as const,
                    padding:"11px 14px 11px 12px",
                    border:"1px solid rgba(14,165,233,0.28)",
                    borderLeft:"3px solid #0ea5e9",
                    borderRadius:14,
                    backgroundColor:"#0c121f",
                    backgroundImage:"linear-gradient(135deg, rgba(14,165,233,0.14), transparent 62%)",
                    color:"#f0f2f8",
                    cursor:"pointer",
                    fontFamily:"'Plus Jakarta Sans', sans-serif",
                    boxShadow:"0 14px 36px -14px rgba(0,0,0,0.85), 0 8px 24px -16px rgba(14,165,233,0.35), 0 1px 0 0 rgba(255,255,255,0.04) inset",
                    animation:`bubblePop 0.32s cubic-bezier(0.34,1.56,0.64,1) ${TOOLS.length*0.04}s backwards`,
                    transition:"transform 0.15s ease, border-color 0.15s",
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateX(-2px)";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="translateX(0)";}}
                >
                  <div style={{
                    width:34,height:34,flexShrink:0,
                    borderRadius:10,
                    background:"rgba(14,165,233,0.14)",
                    border:"1px solid rgba(14,165,233,0.35)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"#7dd3fc",
                  }}>
                    <Target size={16} strokeWidth={2.2}/>
                  </div>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{
                      fontSize:13.5,fontWeight:600,letterSpacing:"-0.01em",
                      color:"#f5f7fb",
                      lineHeight:1.1,marginBottom:3,
                    }}>
                      {lang==="pt"?"Foco da semana":lang==="es"?"Foco semanal":"Weekly focus"}
                      {sessionGoal && <span style={{fontSize:10,marginLeft:6,color:"#7dd3fc",opacity:0.85}}>✓ definido</span>}
                    </div>
                    <div style={{
                      fontSize:11,color:"rgba(255,255,255,0.50)",
                      lineHeight:1.3,
                      overflow:"hidden",textOverflow:"ellipsis",
                      display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical" as const,
                    }}>
                      {sessionGoal || (lang==="pt"?"O que você quer destravar essa semana?":lang==="es"?"¿Qué quieres desbloquear esta semana?":"What are you trying to unlock this week?")}
                    </div>
                  </div>
                  <ChevronRight size={14} strokeWidth={2} color="rgba(125,211,252,0.6)" style={{flexShrink:0}}/>
                </button>

                {TOOLS.map((tool,i)=>{
                  const isOn = activeTool===tool.action;
                  return (
                    <button
                      key={tool.action}
                      onClick={()=>{
                        if(tool.action === "analyze_ad"){
                          imageInputRef.current?.click();
                          setShowToolMenu(false);
                          return;
                        }
                        setActiveTool(isOn?null:tool.action);
                        setShowToolMenu(false);
                      }}
                      className="tool-bubble"
                      style={{
                        pointerEvents:"auto" as const,
                        display:"flex",alignItems:"center",gap:12,
                        textAlign:"left" as const,
                        padding:"11px 14px 11px 12px",
                        border:`1px solid ${tool.color}30`,
                        borderLeft:`3px solid ${tool.color}`,
                        borderRadius:14,
                        backgroundColor:"#0c121f",
                        backgroundImage:`linear-gradient(135deg, ${tool.color}1a, transparent 62%)`,
                        color:"#f0f2f8",
                        cursor:"pointer",
                        fontFamily:"'Plus Jakarta Sans', sans-serif",
                        boxShadow:`0 14px 36px -14px rgba(0,0,0,0.85), 0 8px 24px -16px ${tool.color}45, 0 1px 0 0 rgba(255,255,255,0.04) inset`,
                        animation:`bubblePop 0.32s cubic-bezier(0.34,1.56,0.64,1) ${i*0.04}s backwards`,
                        transition:"transform 0.15s ease, border-color 0.15s",
                      }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform="translateX(-2px)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="translateX(0)";}}
                    >
                      <div style={{
                        width:34,height:34,flexShrink:0,
                        borderRadius:10,
                        background:`${tool.color}1c`,
                        border:`1px solid ${tool.color}40`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:tool.color,
                      }}>
                        <tool.icon size={16} strokeWidth={2.2}/>
                      </div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{
                          fontSize:13.5,fontWeight:600,letterSpacing:"-0.01em",
                          color:isOn?tool.color:"#f5f7fb",
                          lineHeight:1.1,marginBottom:3,
                        }}>
                          {tool.label}{isOn && <span style={{fontSize:10,marginLeft:6,color:tool.color,opacity:0.85}}>✓ ativo</span>}
                        </div>
                        <div style={{
                          fontSize:11,color:"rgba(255,255,255,0.50)",
                          lineHeight:1.3,
                          overflow:"hidden",textOverflow:"ellipsis",
                          display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical" as const,
                        }}>
                          {tool.desc}
                        </div>
                      </div>
                      <ChevronRight size={14} strokeWidth={2} color={`${tool.color}99`} style={{flexShrink:0}}/>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Meta-row: active tool chip + goal chip (only shown when set) */}
            {(activeTool || sessionGoal) && (
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,flexWrap:"wrap" as const}}>
                {activeTool && (()=>{
                  const t=TOOLS.find(x=>x.action===activeTool);
                  if(!t) return null;
                  return (
                    <div style={{
                      display:"flex",alignItems:"center",gap:6,
                      padding:"5px 6px 5px 10px",borderRadius:99,
                      background:`${t.color}14`,
                      border:`1px solid ${t.color}38`,
                      color:t.color,
                      fontSize:11,fontWeight:600,letterSpacing:"-0.01em",
                      fontFamily:"'Plus Jakarta Sans', sans-serif",
                      animation:"fadeUp 0.18s ease",
                    }}>
                      <t.icon size={11} strokeWidth={2.4}/>
                      {t.label}
                      <button onClick={()=>setActiveTool(null)} style={{
                        width:16,height:16,borderRadius:"50%",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        background:"rgba(255,255,255,0.06)",border:"none",cursor:"pointer",
                        color:t.color,fontSize:12,lineHeight:1,padding:0,
                      }}>×</button>
                    </div>
                  );
                })()}
                {sessionGoal && (
                  <button
                    onClick={()=>setShowGoalInput(s=>!s)}
                    style={{
                      display:"flex",alignItems:"center",gap:5,
                      padding:"5px 10px",borderRadius:99,
                      background:"rgba(14,165,233,0.08)",
                      border:"1px solid rgba(14,165,233,0.25)",
                      color:"rgba(125,211,252,0.95)",
                      fontSize:11,fontWeight:500,cursor:"pointer",
                      fontFamily:"'Plus Jakarta Sans', sans-serif",
                      maxWidth:240,overflow:"hidden",
                      animation:"fadeUp 0.18s ease",
                    }}
                  >
                    <Target size={10} strokeWidth={2.4}/>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{sessionGoal}</span>
                  </button>
                )}
              </div>
            )}

            {/* Goal input — expandable */}
            {showGoalInput && (
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,animation:"fadeUp 0.15s ease"}}>
                <input
                  autoFocus
                  placeholder={lang==="pt"?"Foco desta semana (ex: escalar winners, cortar CPA)…":lang==="es"?"Foco esta semana (ej: escalar ganadores, cortar CPA)…":"This week's focus (e.g. scale winners, cut CPA)…"}
                  defaultValue={sessionGoal}
                  onKeyDown={e=>{
                    if(e.key==="Enter") saveGoal((e.target as HTMLInputElement).value.trim());
                    if(e.key==="Escape"){setShowGoalInput(false);}
                  }}
                  onBlur={e=>saveGoal(e.target.value.trim())}
                  style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(14,165,233,0.20)",borderRadius:10,padding:"7px 12px",color:"#f0f2f8",fontSize:12,outline:"none",fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif",caretColor:"#0ea5e9",transition:"border-color 0.15s"}}
                />
                <button onClick={()=>setShowGoalInput(false)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:14,lineHeight:1,padding:"0 4px"}}>×</button>
              </div>
            )}

            {/* Composer card — stacked layout:
                  [image preview?]
                  [textarea full-width]
                  [action bar: + attach | clear send]
                Sólido #141924, borda 9%, shadow suave. O card é o
                único elemento visual — nada em volta. */}
            <div className="input-box-wrap" style={{
              background: chatDragOver ? "#0E1C2E" : "#141924",
              border: chatDragOver
                ? "1px solid rgba(37,99,235,0.40)"
                : "1px solid rgba(255,255,255,0.09)",
              borderRadius:16,
              overflow:"hidden" as const,
              boxShadow: chatDragOver
                ? "0 0 0 3px rgba(37,99,235,0.12), 0 8px 32px rgba(0,0,0,0.40)"
                : "0 8px 32px rgba(0,0,0,0.40)",
              transition:"border-color 0.2s, box-shadow 0.2s, background 0.2s",
            }}
            onDragOver={e => { e.preventDefault(); setChatDragOver(true); }}
            onDragLeave={() => setChatDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setChatDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = ev => {
                  const dataUrl = ev.target?.result as string;
                  const base64 = dataUrl.split(",")[1];
                  const mediaType = dataUrl.split(",")[0].split(":")[1]?.split(";")[0] || "image/jpeg";
                  setChatImage({ base64, name: file.name, preview: dataUrl, mediaType });
                };
                reader.readAsDataURL(file);
              }
            }}
            >
              {/* Image preview — appears above textarea when user attached a file */}
              {chatImage && (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px 0" }}>
                  <img src={chatImage.preview} alt="criativo" style={{ width:40, height:40, borderRadius:8, objectFit:"cover", border:"1px solid rgba(255,255,255,0.08)" }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ ...m, fontSize:11, color:"rgba(255,255,255,0.65)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", margin:0 }}>{chatImage.name}</p>
                    <p style={{ ...m, fontSize:10, color:"rgba(13,162,231,0.7)", margin:"2px 0 0" }}>{lang==="pt"?"Descreva o que quer analisar":lang==="es"?"Describe qué quieres analizar":"Describe what to analyze"}</p>
                  </div>
                  <button onClick={() => setChatImage(null)} style={{ background:"rgba(255,255,255,0.04)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.35)", padding:"4px 6px", lineHeight:1, borderRadius:6, fontSize:12 }}>×</button>
                </div>
              )}

              {/* Row 1 — Textarea, full width */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder={L.placeholder}
                rows={1}
                className="chat-textarea"
                style={{
                  display:"block",
                  width:"100%",
                  boxSizing:"border-box" as const,
                  background:"transparent",
                  border:"none",
                  outline:"none",
                  padding:"14px 16px 6px",
                  color:"#f0f2f8",
                  fontSize:15,
                  resize:"none" as const,
                  ...m,
                  lineHeight:1.55,
                  minHeight:28,
                  maxHeight:140,
                  caretColor:"#0ea5e9",
                }}
                onInput={e=>{const t=e.target as HTMLTextAreaElement;requestAnimationFrame(()=>{t.style.height="auto";t.style.height=Math.min(t.scrollHeight,140)+"px";});}}
              />

              {/* Row 2 — Action bar */}
              <div style={{
                display:"flex",
                alignItems:"center",
                justifyContent:"space-between",
                padding:"6px 8px 8px",
                gap:8,
              }}>
                {/* Left group: [+] tools + image attach */}
                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                  <button
                    ref={toolTriggerRef}
                    onClick={()=>setShowToolMenu(s=>!s)}
                    title={lang==="pt"?"Ferramentas":lang==="es"?"Herramientas":"Tools"}
                    aria-expanded={showToolMenu}
                    aria-haspopup="menu"
                    className={`tool-trigger${showToolMenu?" tool-trigger-on":""}`}
                    style={{
                      width:32,height:32,borderRadius:9,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      background: showToolMenu ? "rgba(14,165,233,0.12)" : "transparent",
                      border: showToolMenu ? "1px solid rgba(14,165,233,0.40)" : "1px solid transparent",
                      color: showToolMenu ? "#7dd3fc" : "rgba(255,255,255,0.55)",
                      cursor:"pointer",
                      transition:"all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                      transform: showToolMenu ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <Plus size={16} strokeWidth={2.2}/>
                  </button>

                  <label
                    title={lang==="pt"?"Anexar criativo":lang==="es"?"Adjuntar imagen":"Attach image"}
                    style={{
                      width:32,height:32,borderRadius:9,background:"transparent",cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                      transition:"all 0.15s",color:"rgba(255,255,255,0.45)",
                    }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="rgba(125,211,252,0.95)";(e.currentTarget as HTMLElement).style.background="rgba(14,165,233,0.08)";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.45)";(e.currentTarget as HTMLElement).style.background="transparent";}}
                  >
                    <input ref={imageInputRef} type="file" accept="image/*" style={{display:"none"}}
                      onChange={e=>{
                        const file=e.target.files?.[0];
                        if(file){
                          const reader=new FileReader();
                          reader.onload=ev=>{
                            const dataUrl=ev.target?.result as string;
                            const mediaType=dataUrl.split(",")[0].split(":")[1]?.split(";")[0]||"image/jpeg";
                            setChatImage({base64:dataUrl.split(",")[1],name:file.name,preview:dataUrl,mediaType});
                          };
                          reader.readAsDataURL(file);
                          e.target.value="";
                        }
                      }}
                    />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </label>
                </div>

                {/* Right group: clear + send */}
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {messages.length>0 && (
                    <button
                      onClick={async()=>{
                        const confirmed = await confirmAsync({
                          variant: "default",
                          title: lang==="pt" ? "Limpar conversa" : lang==="es" ? "Limpiar conversación" : "Clear chat",
                          message:
                            lang==="pt" ? "Limpar toda a conversa? Isso não pode ser desfeito." :
                            lang==="es" ? "¿Limpiar toda la conversación? Esto no se puede deshacer." :
                            "Clear the entire conversation? This cannot be undone.",
                          confirmLabel: lang==="pt" ? "Limpar tudo" : lang==="es" ? "Limpiar todo" : "Clear everything",
                          cancelLabel: lang==="pt" ? "Cancelar" : lang==="es" ? "Cancelar" : "Cancel",
                        });
                        if(!confirmed) return;
                        setMessages([]);
                        storage.remove(SK);
                        executedTools.current.clear();
                        onboardingSessionDone.current = true;
                        setShowOnboardingWelcome(false);
                        setOnboardingStep(-1);
                        setVisibleCount(MSG_PAGE);
                        proactiveFired.current = false;
                        setProactiveLoading(true);
                        setGreetingKey(k => k + 1);
                      }}
                      title={lang==="pt"?"Limpar conversa":lang==="es"?"Limpiar chat":"Clear chat"}
                      style={{
                        width:32,height:32,borderRadius:9,background:"transparent",cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"none",
                        transition:"all 0.15s",color:"rgba(255,255,255,0.45)",
                      }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.75)";(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.45)";(e.currentTarget as HTMLElement).style.background="transparent";}}
                    >
                      <RotateCcw size={13}/>
                    </button>
                  )}
                  <button
                    onClick={()=>{
                      if(creditBalance&&creditBalance.remaining<=0){
                        if(profile?.plan&&profile.plan!=="free"){window.dispatchEvent(new CustomEvent("adbrief:open-capacity-modal"));}else{setShowUpgradeWall(true);}
                        return;
                      }
                      send();
                    }}
                    disabled={!input.trim()||loading||!contextReady}
                    title={lang==="pt"?"Enviar":lang==="es"?"Enviar":"Send"}
                    style={{
                      width:36,height:32,borderRadius:9,border:"none",
                      background: input.trim()&&!loading&&contextReady ? "#0ea5e9" : "rgba(255,255,255,0.06)",
                      cursor: input.trim()&&contextReady ? "pointer" : "not-allowed",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                      transition:"all 0.2s",
                    }}
                  >
                    {loading
                      ? <Loader2 size={14} color="rgba(255,255,255,0.85)" className="animate-spin"/>
                      : <Send size={14} color={input.trim()&&contextReady?"#fff":"rgba(255,255,255,0.25)"}/>
                    }
                  </button>
                </div>
              </div>
            </div>{/* close input-box-wrap */}

            {/* Footer hint */}
            <p className="chat-footer-hint" style={{margin:"6px 0 0",fontSize:10,color:"rgba(255,255,255,0.12)",textAlign:"center",fontFamily:"'Plus Jakarta Sans', sans-serif",letterSpacing:"0.02em"}}>
              {L.footer}
            </p>

          </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.4);opacity:1}}
        @keyframes orbFloat1{0%{transform:translate(0,0) scale(1)}100%{transform:translate(8%,12%) scale(1.08)}}
        @keyframes orbFloat2{0%{transform:translate(0,0) scale(1)}100%{transform:translate(-10%,-8%) scale(1.05)}}
        @keyframes toolSlideIn{from{opacity:0;transform:translateY(10px) scale(0.98);filter:blur(3px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0px)}}
        @keyframes bubblePop{0%{opacity:0;transform:translateY(14px) scale(0.88);filter:blur(4px)}60%{opacity:1;transform:translateY(-2px) scale(1.02);filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
        .tool-trigger:hover{background:rgba(14,165,233,0.08)!important;border-color:rgba(14,165,233,0.28)!important;color:#7dd3fc!important;}
        .tool-trigger-on{box-shadow:0 0 0 3px rgba(14,165,233,0.14);}
        .tool-bubble:hover{border-color:currentColor;filter:brightness(1.1);}
        @keyframes lp-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bubbleIn{from{opacity:0;transform:translateX(10px) scale(0.95);filter:blur(2px)}to{opacity:1;transform:translateX(0) scale(1);filter:blur(0px)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(8px) scale(0.995)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wordReveal{from{opacity:0}to{opacity:1}}
        @keyframes blockSlideIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes typeIn{from{opacity:0;transform:translateY(3px) scale(0.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lp-glow{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.75)}}
        @keyframes lp-spin{to{transform:rotate(360deg)}}
        @keyframes lp-sk{0%,100%{opacity:0.2}50%{opacity:0.5}}
        .lp *{box-sizing:border-box;}
        .lp-kpi{transition:border-color 0.15s,background 0.15s;}
        .lp-kpi:hover{border-color:rgba(255,255,255,0.1)!important;background:rgba(255,255,255,0.04)!important;}
        .lp-row{transition:background 0.12s;}
        .lp-row:hover{background:rgba(148,163,184,0.05)!important;}
        .input-box-wrap:focus-within{border-color:rgba(14,165,233,0.4)!important;box-shadow:0 0 0 3px rgba(14,165,233,0.08)!important;}
        .lp-chip:hover{background:rgba(14,165,233,0.08)!important;border-color:rgba(14,165,233,0.2)!important;color:rgba(255,255,255,0.8)!important;}
        .lp-alert{transition:opacity 0.12s;}
        .lp-alert:hover{opacity:0.75;}
        .lp-btn:hover{color:rgba(255,255,255,0.7)!important;background:rgba(255,255,255,0.07)!important;}
        .lp-tab:hover{color:rgba(255,255,255,0.6)!important;}
        .lp-bar:hover{background:rgba(255,255,255,0.025)!important;}
        .tool-pill:not(.tool-pill-on):hover{background:rgba(255,255,255,0.10)!important;border-color:rgba(255,255,255,0.18)!important;color:rgba(255,255,255,0.85)!important;}
        .input-box-wrap:focus-within{border-color:rgba(14,165,233,0.4)!important;}
        .chat-textarea{caret-color:#0ea5e9;}
        .chat-textarea::placeholder{color:rgba(255,255,255,0.32)!important}
        .user-msg-row:hover .user-msg-actions{opacity:1!important;pointer-events:auto!important;}
        .user-msg-row>div{box-shadow:none!important;}
        .msg-wrap-inner:hover .msg-actions-row{opacity:1!important;}
        .msg-body{font-size:14px;line-height:1.75;color:rgba(235,240,248,0.90);}
        .msg-body p{margin:0 0 10px;}
        .msg-body p:last-child{margin-bottom:0;}
        .msg-body strong{font-weight:600;color:rgba(255,255,255,0.95);letter-spacing:-0.01em;}
        .msg-body code{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:2px 6px;font-family:'DM Mono',monospace;font-size:12.5px;}
        .user-msg-row .user-msg-actions button:hover{color:rgba(255,255,255,0.6)!important;}
        @media(max-width:768px){
          /* Chat: mensagens ocupam largura total */
          .msg-wrap-inner{padding:0 12px!important;margin-bottom:12px!important}
          .user-bubble-wrap{max-width:86%!important}
          /* Card da IA: padding menor */
          .msg-wrap-inner [style*="border-radius: 4px"],[style*="borderRadius: \\"4px\\""]{ padding:14px 16px!important }
          /* Actions row: menor */
          .msg-actions-row{gap:3px!important}
          /* Body text: levemente menor */
          .msg-body p{font-size:13.5px!important;line-height:1.7!important}
          /* Input: sem hint desktop, font 16px anti-zoom */
          .chat-footer-hint{display:none!important}
          .chat-textarea{font-size:16px!important}
          .chat-textarea::placeholder{font-size:14px!important;opacity:0.25!important}
          /* LivePanel: KPIs 2 por linha */
          .lp-kpi{min-width:calc(50% - 4px)!important;flex:1 1 calc(50% - 4px)!important}
          .lp-kpis-row{gap:6px!important;flex-wrap:wrap!important}
          .lp-chip{font-size:11px!important;padding:4px 9px!important}
          /* Tool pills: scroll horizontal */
          .tool-pills-row{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding-bottom:4px!important;flex-wrap:nowrap!important;scrollbar-width:none}
          .tool-pills-row::-webkit-scrollbar{display:none}
          /* Proactive block: padding menor */
          .proactive-wrap{padding:32px 20px 24px!important}
          /* Input fade: menor no mobile para não roubar tanto espaço */
          .chat-input-fade{height:24px!important}
          /* Input wrap: padding horizontal apenas; vertical vem do parent */
          .chat-input-wrap{padding:0 12px!important}
          /* Input box: padding interno mais justo no mobile */
          .input-box-wrap{padding:10px 10px 10px 12px!important;border-radius:16px!important}
          /* Tool trigger e action buttons um pouco menores no mobile */
          .input-box-wrap .tool-trigger{width:30px!important;height:30px!important}
          /* Suggestions: scroll horizontal */
          .suggestions-bar{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}
          .suggestions-bar::-webkit-scrollbar{display:none}
          /* LivePanel collapsed bar: metrics scroll horizontal */
          .lp-bar{padding:0 10px!important;height:52px!important;gap:0!important}
          .lp-metrics-scroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;gap:10px!important;margin-left:8px!important;scrollbar-width:none;mask-image:linear-gradient(to right,#000 85%,transparent 100%);-webkit-mask-image:linear-gradient(to right,#000 85%,transparent 100%)}
          .lp-metrics-scroll::-webkit-scrollbar{display:none}
          /* LivePanel bar metric cards: compact on mobile */
          .lp-metrics-scroll > div{padding:4px 10px!important;min-width:50px!important;border-radius:8px!important}
          .lp-metrics-scroll > div span:first-child span{font-size:7.5px!important}
          .lp-metrics-scroll > div > span:last-child{font-size:12px!important}
          /* LivePanel full-width on mobile */
          .lp{width:100%!important;max-width:100vw!important}
          /* LivePanel EXPANDED: limit height on mobile so chat remains usable */
          .lp-expanded{max-height:55vh!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
          .lp-expanded-body{overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;flex:1!important;min-height:0!important}
          .lp-expanded-header{flex-shrink:0!important}
          /* Expanded header: more compact */
          .lp-expanded-header{padding:8px 12px!important}
          .lp-expanded-header .lp-tab{padding:4px 8px!important;font-size:11px!important}
          .lp-expanded-body{padding:10px 12px 14px!important}
          /* KPIs in expanded: 2-col grid instead of flex row */
          .lp-expanded-body .lp-kpi{min-width:calc(50% - 4px)!important;flex:1 1 calc(50% - 4px)!important;padding:8px 10px!important}
          .lp-expanded-body .lp-kpi .kpi-spark{display:none!important}
          /* Quick action chips: horizontal scroll */
          .lp-expanded-body .lp-chip{font-size:10px!important;padding:4px 8px!important;white-space:nowrap!important}
        }
        @media(max-width:480px){
          .msg-wrap-inner{padding:0 10px!important;margin-bottom:10px!important}
          .user-bubble-wrap{max-width:90%!important}
          .lp-bar{height:38px!important;padding:0 10px!important}
          /* Metric chips na bar: menores, scrollable */
          .lp-bar [style*="padding: 3px"]{padding:2px 7px!important}
          .lp-metrics-scroll{gap:10px!important;margin-left:8px!important}
        }
      `}</style>

      {showUpgradeWall&&<UpgradeWall trigger="chat" onClose={()=>setShowUpgradeWall(false)}/>}
      {/* ── Custom confirm modal — replaces native browser dialog ─────── */}
      {confirmModal && (() => {
        const isWarn = confirmModal.variant === "warning";
        // Color tokens echo the inline confirmation card (orange for warn,
        // neutral white-on-dark for default). Keeps visual language tight.
        const accent = isWarn ? "#fb923c" : "rgba(255,255,255,0.85)";
        const accentBg = isWarn ? "rgba(251,146,60,0.04)" : "rgba(255,255,255,0.02)";
        const accentBorder = isWarn ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.08)";
        const accentBorderSoft = isWarn ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.06)";
        const detailBg = isWarn ? "rgba(251,146,60,0.06)" : "rgba(255,255,255,0.03)";
        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) confirmModal.onResolve(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "16px", animation: "fadeIn 120ms ease-out",
            }}
          >
            <div
              style={{
                width: "100%", maxWidth: 460,
                borderRadius: 16, border: `1px solid ${accentBorder}`,
                background: `linear-gradient(180deg, #0e0e0e 0%, #0a0a0a 100%)`,
                boxShadow: "0 24px 56px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)",
                overflow: "hidden",
                animation: "modalIn 140ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              {/* Header — title + question */}
              <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${accentBorderSoft}`, background: accentBg }}>
                <p style={{ ...j, fontSize: 13, fontWeight: 700, color: accent, margin: "0 0 8px", letterSpacing: 0.2 }}>
                  {confirmModal.title}
                </p>
                <p style={{ ...m, fontSize: 14, color: "rgba(255,255,255,0.88)", lineHeight: 1.5, margin: 0 }}>
                  {confirmModal.message}
                </p>
              </div>
              {/* Detail (optional secondary line, dimmer) */}
              {confirmModal.detail && (
                <div style={{ padding: "10px 20px", background: detailBg, borderBottom: `1px solid ${accentBorderSoft}` }}>
                  <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, margin: 0 }}>
                    {confirmModal.detail}
                  </p>
                </div>
              )}
              {/* Buttons */}
              <div style={{ padding: 16, display: "flex", gap: 8 }}>
                <button
                  onClick={() => confirmModal.onResolve(true)}
                  style={{
                    ...j, fontSize: 13, fontWeight: 700, padding: "11px 20px", borderRadius: 10,
                    background: isWarn ? "#fb923c" : "rgba(255,255,255,0.95)",
                    color: "#000", border: "none", cursor: "pointer",
                    flex: 1, textAlign: "center",
                  }}
                >
                  {confirmModal.confirmLabel}
                </button>
                <button
                  onClick={() => confirmModal.onResolve(false)}
                  style={{
                    ...m, fontSize: 12, padding: "11px 16px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)", cursor: "pointer", fontWeight: 500,
                  }}
                >
                  {confirmModal.cancelLabel}
                </button>
              </div>
            </div>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
          </div>
        );
      })()}
      <ReferralNudge messageCount={messages.filter(m=>m.role==="user").length}/>
    </div>
  );
}

// 1775424742
