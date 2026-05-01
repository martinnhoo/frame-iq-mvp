import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Globe, Upload, Loader2, X, CheckCircle2, Link2, AlertCircle, Check, ChevronDown, Building2, Save, Pencil, Target, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { DESIGN_TOKENS as DT } from "@/hooks/useDesignTokens";
import { getAdAccountLimit } from "@/lib/planLimits";
import UpgradeWall from "@/components/UpgradeWall";

// ── Design tokens — "Alive Interface" premium system ─────────────────────────
const F = DT.font;
const EASE = 'cubic-bezier(0.4,0,0.2,1)';

// Primary palette
const BLUE   = '#2563EB';
const CYAN   = '#06B6D4';
const GREEN  = '#22C55E';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';

// Deep layered surfaces (blue-black, not pure black)
const BG0 = '#060A14';
const BG1 = '#0A0F1C';
const BG2 = '#0F172A';
const BG3 = '#1E293B';

// Borders — subtle glass edges
const B0 = 'rgba(148,163,184,0.04)';
const B1 = 'rgba(148,163,184,0.08)';
const B2 = 'rgba(148,163,184,0.14)';

// Text hierarchy — strong contrast
const T1 = '#F1F5F9';     // primary — bright
const T2 = '#94A3B8';     // secondary — slate
const T3 = '#64748B';     // tertiary — muted
const TL = '#475569';     // label — subtle

// Card — glassmorphism
const CARD  = 'rgba(15,23,42,0.80)';
const SHD   = `0 0 0 1px ${B1}, 0 8px 32px rgba(0,0,0,0.40)`;
const GLASS = 'blur(16px) saturate(180%)';
const IBG   = 'rgba(15,23,42,0.60)';
const IBD   = `1px solid ${B2}`;

// Button presets — alive
const BTN_PRIMARY = {
  background: `linear-gradient(135deg, ${BLUE}, ${CYAN})`,
  border: 'none', color: '#fff', cursor: 'pointer',
  fontFamily: F, fontWeight: 700 as const,
  boxShadow: '0 4px 20px rgba(37,99,235,0.35), 0 0 0 1px rgba(37,99,235,0.20)',
  transition: `all 0.2s ${EASE}`,
};
const BTN_SECONDARY = {
  background: 'rgba(30,41,59,0.80)', border: `1px solid ${B2}`,
  color: T2, cursor: 'pointer',
  fontFamily: F, fontWeight: 600 as const,
  backdropFilter: 'blur(8px)',
  transition: `all 0.2s ${EASE}`,
};
const BTN_DANGER = {
  background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.20)`,
  color: '#FCA5A5', cursor: 'pointer',
  fontFamily: F, fontWeight: 600 as const,
  transition: `all 0.2s ${EASE}`,
};

// Glow presets
const GLOW_BLUE = '0 0 20px rgba(37,99,235,0.15)';
const GLOW_GREEN = '0 0 20px rgba(34,197,94,0.15)';

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  pt: {
    title:"Seus negócios", sub:"A IA aprende com cada detalhe que você ensina aqui.",
    new:"Novo negócio", no_accounts:"A IA ainda não conhece seu negócio",
    no_accounts_sub:"Ensine à IA o que você vende, quem é seu público e quanto custa — ela precisa disso para tomar decisões inteligentes.",
    create_first:"Ensinar meu negócio à IA",
    active_in_chat:"IA ativa", use_in_chat:"Ativar IA",
    delete_confirm:"Remover este negócio? A IA perderá todo o contexto aprendido.",
    deleted:"Negócio removido", saving:"Salvando…", save:"Salvar",
    cancel:"Cancelar", create:"Salvar negócio", edit:"Editar",
    name_label:"Qual é o negócio?", name_ph:"Ambulatório M., Nike BR, Eluck MX…",
    website_label:"Site", website_ph:"seusite.com.br",
    desc_label:"O que a IA precisa saber", optional:"opcional, mas recomendado",
    desc_ph:"O que você vende? Quem compra? Ticket médio? Diferenciais? Quanto mais a IA souber, melhores as decisões…",
    desc_hint:"A IA usa isso como base de conhecimento em todas as análises e recomendações.",
    logo_label:"Logo", logo_hint:"PNG, JPG ou SVG · Máx 2MB", remove_logo:"Remover logo",
    platforms:"Fonte de dados",
    connect:"Conectar dados", disconnect:"Desconectar", connecting:"Conectando…",
    soon:"Em breve", connected:"Dados conectados", not_connected:"Sem dados — a IA não consegue analisar",
    active_label:"ATIVO", select_account:"Conta que a IA analisa",
    cid_label:"Customer ID", cid_ph:"Ex: 512-522-3131",
    verify:"Verificar", verifying:"Verificando…",
    invalid_id:"ID inválido — deve ter 10 dígitos",
    unnamed:"Negócio sem nome", details:"Detalhes",
    no_context:"A IA não conhece este negócio — ensine para decisões melhores",
    add_context:"Ensinar contexto à IA",
    cid_hint:"Encontre em Google Ads → Admin → ID da conta",
    manage:"Gerenciar",
  },
  es: {
    title:"Tus negocios", sub:"La IA aprende con cada detalle que le enseñas aquí.",
    new:"Nuevo negocio", no_accounts:"La IA aún no conoce tu negocio",
    no_accounts_sub:"Enséñale a la IA qué vendes, quién es tu público y cuánto cuesta — lo necesita para tomar decisiones inteligentes.",
    create_first:"Enseñar mi negocio a la IA",
    active_in_chat:"IA activa", use_in_chat:"Activar IA",
    delete_confirm:"¿Eliminar este negocio? La IA perderá todo el contexto aprendido.",
    deleted:"Negocio eliminado", saving:"Guardando…", save:"Guardar",
    cancel:"Cancelar", create:"Guardar negocio", edit:"Editar",
    name_label:"¿Cuál es el negocio?", name_ph:"Clínica Premium, Nike MX…",
    website_label:"Sitio web", website_ph:"tusitio.com",
    desc_label:"Lo que la IA necesita saber", optional:"opcional, pero recomendado",
    desc_ph:"¿Qué vendes? ¿Quién compra? ¿Ticket promedio? Cuanto más sepa la IA, mejores las decisiones…",
    desc_hint:"La IA usa esto como base de conocimiento en cada análisis y recomendación.",
    logo_label:"Logo", logo_hint:"PNG, JPG o SVG · Máx 2MB", remove_logo:"Quitar logo",
    platforms:"Fuente de datos",
    connect:"Conectar datos", disconnect:"Desconectar", connecting:"Conectando…",
    soon:"Próximamente", connected:"Datos conectados", not_connected:"Sin datos — la IA no puede analizar",
    active_label:"ACTIVO", select_account:"Cuenta que la IA analiza",
    cid_label:"Customer ID", cid_ph:"Ej: 512-522-3131",
    verify:"Verificar", verifying:"Verificando…",
    invalid_id:"ID inválido — debe tener 10 dígitos",
    unnamed:"Negocio sin nombre", details:"Detalles",
    no_context:"La IA no conoce este negocio — enséñale para mejores decisiones",
    add_context:"Enseñar contexto a la IA",
    cid_hint:"En Google Ads → Admin → ID de cuenta",
    manage:"Administrar",
  },
  en: {
    title:"Your businesses", sub:"The AI learns from every detail you teach it here.",
    new:"New business", no_accounts:"The AI doesn't know your business yet",
    no_accounts_sub:"Teach the AI what you sell, who your audience is, and your margins — it needs this to make smart decisions with your money.",
    create_first:"Teach my business to the AI",
    active_in_chat:"AI active", use_in_chat:"Activate AI",
    delete_confirm:"Remove this business? The AI will lose all learned context.",
    deleted:"Business removed", saving:"Saving…", save:"Save",
    cancel:"Cancel", create:"Save business", edit:"Edit",
    name_label:"What's the business?", name_ph:"FitCore US, Nike BR, Eluck MX…",
    website_label:"Website", website_ph:"yoursite.com",
    desc_label:"What the AI needs to know", optional:"optional, but recommended",
    desc_ph:"What do you sell? Who buys it? Average ticket? The more the AI knows, the better its decisions…",
    desc_hint:"The AI uses this as its knowledge base for every analysis and recommendation.",
    logo_label:"Logo", logo_hint:"PNG, JPG or SVG · Max 2MB", remove_logo:"Remove logo",
    platforms:"Data source",
    connect:"Connect data", disconnect:"Disconnect", connecting:"Connecting…",
    soon:"Coming soon", connected:"Data connected", not_connected:"No data — AI can't analyze",
    active_label:"ACTIVE", select_account:"Account the AI analyzes",
    cid_label:"Customer ID", cid_ph:"e.g. 512-522-3131",
    verify:"Verify", verifying:"Verifying…",
    invalid_id:"Invalid ID — must be 10 digits",
    unnamed:"Unnamed business", details:"Details",
    no_context:"AI doesn't know this business — teach it for better decisions",
    add_context:"Teach context to the AI",
    cid_hint:"Find in Google Ads → Admin → Account ID",
    manage:"Manage",
  },
} as const;
type Lang = keyof typeof T;
type TStrings = typeof T[Lang];

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORMS = [
  { id:"meta",   label:"Meta Ads",   color:"#1877F2", fn:"meta-oauth",   soon:false },
  // Google Ads and TikTok coming after Meta scale
];


// ── Account avatar — consistent color per name, clean letter ─────────────────
const AVATAR_PALETTE = [
  { bg:"rgba(14,165,233,0.15)",  border:"rgba(14,165,233,0.28)",  text:"#38bdf8"  },
  { bg:"rgba(167,139,250,0.15)", border:"rgba(167,139,250,0.28)", text:"#c4b5fd"  },
  { bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.25)",  text:"#6ee7b7"  },
  { bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.25)",  text:"#fcd34d"  },
  { bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.25)", text:"#fca5a5"  },
  { bg:"rgba(6,182,212,0.13)",   border:"rgba(6,182,212,0.26)",   text:"#67e8f9"  },
  { bg:"rgba(244,114,182,0.12)", border:"rgba(244,114,182,0.25)", text:"#f9a8d4"  },
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function AccountAvatar({ name, logoUrl, size = 44, radius = 12 }: { name: string; logoUrl?: string | null; size?: number; radius?: number }) {
  const c = avatarColor(name || "?");
  const letter = (name || "?").charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.42);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden",
      background: c.bg, border: `1px solid ${c.border}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {logoUrl
        ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        : <span style={{ fontFamily: F, fontSize, fontWeight: 800, color: c.text, letterSpacing: "-0.02em", lineHeight: 1, userSelect: "none" }}>
            {letter}
          </span>
      }
    </div>
  );
}
// ── Helpers ───────────────────────────────────────────────────────────────────
const focusOn  = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "rgba(37,99,235,0.50)";
  e.currentTarget.style.background  = "rgba(15,23,42,0.90)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(37,99,235,0.12), 0 0 16px rgba(37,99,235,0.08)";
};
const focusOff = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = B2;
  e.currentTarget.style.background  = IBG;
  e.currentTarget.style.boxShadow   = "none";
};
const iStyle: React.CSSProperties = {
  width:"100%", fontFamily:F, fontSize:14, color:T1,
  background:IBG, border:`1px solid ${B2}`, borderRadius:10,
  padding:"11px 14px", outline:"none", boxSizing:"border-box",
  transition:`all 0.2s ${EASE}`,
};

const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 10000): Promise<T> => {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
};

/**
 * Resolves Meta connection + ensures a v2 ad_accounts row exists for this persona.
 * Shared by GoalSection and MarginSection so both can reliably save data.
 * Returns { v2Id, metaAccountId } or null if no Meta connection.
 */
/** Connection row returned by meta-oauth get_connections.
 *  Local declaration since the edge fn JSON isn't part of the
 *  generated supabase types. */
interface ConnRow {
  platform: string;
  persona_id: string;
  status: string;
  selected_account_id?: string | null;
  ad_accounts?: Array<{ id: string; name?: string; currency?: string }>;
  // Index signature lets call sites read free-form fields the edge fn
  // sometimes attaches (token_expires_at, last_synced, etc.) without
  // having to widen ConnRow every time.
  [k: string]: unknown;
}

async function resolveV2Account(userId: string, personaId: string): Promise<{ v2Id: string; metaAccountId: string } | null> {
  const { data: connRes } = await supabase.functions.invoke("meta-oauth", {
    body: { action: "get_connections", user_id: userId }
  });
  const conns: ConnRow[] = (connRes?.connections || []) as ConnRow[];
  const metaConn = conns.find((c) => c.platform === "meta" && c.persona_id === personaId && c.status === "active");
  if (!metaConn) return null;

  const ads = metaConn.ad_accounts || [];
  const selId = localStorage.getItem(`meta_sel_${personaId}`) || metaConn.selected_account_id || ads[0]?.id;
  if (!selId) return null;

  // Try to find existing v2 row
  const { data: existing } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('meta_account_id', selId)
    .maybeSingle();

  if (existing?.id) return { v2Id: existing.id, metaAccountId: selId };

  // Auto-create v2 row (same logic as useActiveAccount.ensureV2Account).
  // ad_accounts has a few columns (currency, timezone, total_*) that aren't
  // in the generated insert types yet — cast the client to skip the strict
  // shape check while keeping the local row narrowed.
  const selMeta = ads.find((a) => a.id === selId) || ads[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertErr } = await (supabase as any)
    .from('ad_accounts')
    .insert({
      user_id: userId,
      meta_account_id: selId,
      name: selMeta?.name || selId,
      currency: selMeta?.currency || 'BRL',
      timezone: 'America/Sao_Paulo',
      status: 'active',
      total_ads_synced: 0,
      total_spend_30d: 0,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { code?: string } | null };

  if (insertErr) {
    // Unique constraint race — row may exist now
    if (insertErr.code === '23505') {
      const { data: retry } = await supabase
        .from('ad_accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('meta_account_id', selId)
        .maybeSingle();
      if (retry?.id) return { v2Id: retry.id, metaAccountId: selId };
    }
    console.error('[resolveV2Account] insert error:', insertErr);
    return null;
  }

  return created?.id ? { v2Id: created.id, metaAccountId: selId } : null;
}

function PlatformIcon({ id }: { id:string }) {
  if (id === "meta") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lobe-icons-meta-fill-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lobe-icons-meta-fill-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lobe-icons-meta-fill-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lobe-icons-meta-fill-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lobe-icons-meta-fill-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lobe-icons-meta-fill-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lobe-icons-meta-fill-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lobe-icons-meta-fill-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lobe-icons-meta-fill-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lobe-icons-meta-fill-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lobe-icons-meta-fill-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lobe-icons-meta-fill-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lobe-icons-meta-fill-12)"></path><defs><linearGradient id="lobe-icons-meta-fill-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"></stop><stop offset="45.39%" stopColor="#0668E1"></stop><stop offset="85.91%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"></stop><stop offset="99.88%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"></stop><stop offset="68.81%" stopColor="#0064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"></stop><stop offset="99.43%" stopColor="#0072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"></stop><stop offset="91.41%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"></stop><stop offset="99.95%" stopColor="#0081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"></stop><stop offset="99.94%" stopColor="#0279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"></stop><stop offset="100%" stopColor="#0377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"></stop><stop offset="100%" stopColor="#0471E9"></stop></linearGradient></defs>
    </svg>
  );
  if (id === "google") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  return <span style={{fontSize:14}}></span>;
}

// ── Platform row ──────────────────────────────────────────────────────────────
function PlatformRow({ p, userId, accountId, t }: {
  p: typeof PLATFORMS[0]; userId:string; accountId:string; t: TStrings;
}) {
  const { language: lang } = useLanguage();
  const [conn, setConn]           = useState<ConnRow | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [connecting, setConn2]    = useState(false);
  const [disconnecting, setDisc]  = useState(false);
  const [expanded, setExpanded]   = useState(false);
  const [custId, setCustId]       = useState("");
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // meta-oauth get_connections uses service_role — bypasses RLS, always works
      const { data: res, error: fnErr } = await supabase.functions.invoke("meta-oauth", {
        body: { action: "get_connections", user_id: userId }
      });
      if (fnErr) throw fnErr;
      const all: ConnRow[] = (res?.connections || []) as ConnRow[];
      const match = all.find((c) => c.platform === p.id && c.persona_id === accountId) || null;
      setConn(match);
    } catch (e) {
      console.error("[AdBrief] platform row load error:", String(e));
      setConn(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, accountId, p.id]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setConn2(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(p.fn, {
        body: { action:"get_auth_url", user_id:userId, persona_id:accountId },
      });
      if (fnErr) throw new Error(fnErr.message || String(fnErr));
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Não foi possível iniciar conexão — tente novamente");
      }
    } catch (e) {
      console.error("[AdBrief] connect:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao conectar: " + (msg.slice(0,80) || "tente novamente"));
      setConn2(false);
    }
  };

  const disconnect = async () => {
    if (!confirm(t.disconnect + " " + p.label + "?")) return;
    setDisc(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("platform_connections").delete()
        .eq("user_id", userId).eq("platform", p.id).eq("persona_id", accountId);
      if (error) throw error;
      toast.success(p.label + " desconectado");
      setConn(null); setExpanded(false);
    } catch (e) {
      console.error("[AdBrief] disconnect:", e);
      toast.error("Erro ao desconectar — tente novamente");
    }
    setDisc(false);
  };

  const selectAcc = async (id: string) => {
    // Update DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("platform_connections")
      .update({ selected_account_id: id })
      .eq("user_id", userId).eq("persona_id", accountId).eq("platform", p.id);
    // Persist locally so UI remembers after page reload
    localStorage.setItem(`meta_sel_${accountId}`, id);
    // Update local state immediately
    setConn((prev) => prev ? { ...prev, selected_account_id: id } : prev);
    // Notify LivePanel and AI to reload with new account
    window.dispatchEvent(new CustomEvent("meta-account-changed", { detail: { personaId: accountId, accountId: id } }));
  };

  const verifyGoogle = async () => {
    const id = custId.trim().replace(/-/g,"");
    if (!/^\d{10}$/.test(id)) { toast.error(t.invalid_id); return; }
    setVerifying(true);
    try {
      const { data:vd, error:fnErr } = await supabase.functions.invoke("verify-google-account", {
        body: { user_id:userId, persona_id:accountId, customer_id:id },
      });
      if (fnErr) {
        // Edge function invocation error (network, auth, timeout)
        const msg = fnErr?.message || String(fnErr);
        if (msg.includes("401") || msg.includes("unauthorized")) {
          toast.error("Sessão expirada — faça login novamente");
        } else if (msg.includes("non_2xx") || msg.includes("500")) {
          toast.error("Erro no servidor — tente novamente em instantes");
        } else {
          toast.error("Erro ao verificar: " + msg.slice(0, 60));
        }
        return;
      }
      if (!vd?.valid) {
        const reason = vd?.reason;
        if (reason === "not_found") toast.error("Conta não encontrada — verifique o ID");
        else if (reason === "no_access") toast.error("Sem acesso a esta conta — verifique as permissões do Google Ads");
        else if (reason === "no_token") toast.error("Reconecte o Google Ads — token expirado");
        else if (reason === "invalid_format") toast.error(t.invalid_id);
        else toast.error(vd?.message || t.invalid_id);
        return;
      }
      type AdAccount = { id: string; name?: string; currency?: string };
      const accs: AdAccount[] = conn?.ad_accounts || [];
      const newAcc: AdAccount = { id, name: vd.name || `Account ${id}`, currency: vd.currency };
      const updated = accs.find((a) => a.id === id)
        ? accs.map((a) => a.id === id ? newAcc : a)
        : [...accs, newAcc];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any).from("platform_connections")
        .update({ ad_accounts:updated, selected_account_id:id })
        .eq("user_id",userId).eq("persona_id",accountId).eq("platform",p.id);
      if (updateErr) { toast.error("Erro ao salvar conta"); return; }
      toast.success(` ${newAcc.name}${vd.currency ? " · " + vd.currency : ""}`);
      setCustId(""); setExpanded(false); load();
    } catch (e) {
      console.error("[AdBrief] verifyGoogle:", e);
      toast.error("Erro inesperado: " + (e instanceof Error ? e.message : "tente novamente"));
    }
    finally { setVerifying(false); }
  };

  const ads: Array<{ id: string; name?: string; currency?: string }> = conn?.ad_accounts || [];
  // Read from localStorage first (persisted selection), then DB field, then first account
  const selId = localStorage.getItem(`meta_sel_${accountId}`) || conn?.selected_account_id || ads[0]?.id;
  const selAcc = ads.find(a => a.id === selId) || ads[0];

  if (loading) return (
    <div style={{ height:64, borderRadius:14, background:"rgba(15,23,42,0.40)", animation:"pulse 1.5s ease-in-out infinite" }} />
  );

  const isConnected = !!conn;
  const pc = p.color;

  return (
    <div style={{
      borderRadius:14,
      background: isConnected ? `linear-gradient(160deg, ${pc}08 0%, rgba(15,23,42,0.50) 100%)` : "rgba(15,23,42,0.30)",
      border: `1px solid ${isConnected ? pc+"25" : B1}`,
      boxShadow: isConnected ? `0 0 20px ${pc}08` : "none",
      overflow:"hidden", transition:`all 0.25s ${EASE}`,
      backdropFilter: "blur(8px)",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 18px" }}>
        <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, position:"relative",
          background: isConnected ? `${pc}15` : "rgba(148,163,184,0.06)",
          border: `1px solid ${isConnected ? pc+"22" : B1}`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <PlatformIcon id={p.id}/>
          {/* Live status dot */}
          {isConnected && !p.soon && (
            <div style={{
              position:"absolute", bottom:-2, right:-2,
              width:10, height:10, borderRadius:"50%",
              background:pc, border:"2px solid #0A0F1C",
              animation:"statusPulse 2s ease-in-out infinite",
              boxShadow:`0 0 6px ${pc}60`,
            }}/>
          )}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
            <span style={{ fontFamily:F, fontSize:14, fontWeight:600,
              color: isConnected ? T1 : T3 }}>{p.label}</span>
            {p.soon && (
              <span style={{ fontFamily:F, fontSize:10, fontWeight:600, color:T3,
                background:"rgba(148,163,184,0.06)", border:`1px solid ${B1}`,
                borderRadius:5, padding:"2px 8px", letterSpacing:"0.06em" }}>{t.soon}</span>
            )}
            {isConnected && !p.soon && (
              <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color:pc,
                background:`${pc}12`, borderRadius:5,
                padding:"3px 8px", letterSpacing:"0.06em" }}>{t.active_label}</span>
            )}
          </div>
          <p style={{ fontFamily:F, fontSize:12, color:T3, margin:0,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {loadError
              ? "Erro ao verificar dados"
              : isConnected
              ? (selAcc ? `${selAcc.name || selAcc.id}${ads.length>1?` · ${ads.length} contas`:""}` : t.connected)
              : t.not_connected}
          </p>
        </div>

        {/* Right actions */}
        {p.soon ? null : isConnected ? (
          <div style={{ display:"flex", gap:6 }}>
            <button className="acc-btn" onClick={() => setExpanded(e => !e)}
              style={{ ...BTN_SECONDARY, display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8,
                fontSize:12 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(30,41,59,1)";(e.currentTarget as HTMLElement).style.borderColor="rgba(148,163,184,0.20)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(30,41,59,0.80)";(e.currentTarget as HTMLElement).style.borderColor=B2}}>
              <ChevronDown size={12} style={{ transform: expanded?"rotate(180deg)":"none", transition:`transform 0.25s ${EASE}` }}/>
              {t.manage}
            </button>
            <button className="acc-btn" onClick={disconnect} disabled={disconnecting}
              style={{ ...BTN_DANGER, padding:"7px 9px", borderRadius:8,
                display:"flex", alignItems:"center" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.20)";(e.currentTarget as HTMLElement).style.borderColor="rgba(239,68,68,0.30)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.12)";(e.currentTarget as HTMLElement).style.borderColor="rgba(239,68,68,0.20)"}}>
              {disconnecting ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>}
            </button>
          </div>
        ) : (
          <button className="acc-btn" onClick={connect} disabled={connecting}
            style={{ ...BTN_PRIMARY, display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10,
              fontSize:13, opacity:connecting?0.7:1 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="0 6px 28px rgba(37,99,235,0.45)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow=BTN_PRIMARY.boxShadow}}>
            {connecting ? <Loader2 size={13} className="animate-spin"/> : <Link2 size={13}/>}
            {connecting ? t.connecting : t.connect}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {isConnected && expanded && (
        <div style={{ borderTop:`1px solid ${pc}18`, padding:"16px 16px 18px", background:"rgba(0,0,0,0.15)" }}>
          {/* Ad accounts — select active account */}
          {ads.length > 0 && p.id === "meta" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:TL,
                textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>
                {lang==="pt"?"Conta de anúncios ativa":lang==="es"?"Cuenta de anuncios activa":"Active ad account"}
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {ads.map((acc) => {
                  const isActive = acc.id === selId;
                  return (
                    <button key={acc.id} onClick={() => selectAcc(acc.id)}
                      style={{
                        display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                        borderRadius:10, border: isActive ? `1px solid ${pc}40` : `1px solid ${B1}`,
                        background: isActive ? `${pc}12` : B0,
                        cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%",
                      }}>
                      <div style={{
                        width:18, height:18, borderRadius:"50%", border: isActive ? `2px solid ${pc}` : `2px solid ${B2}`,
                        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                        background: isActive ? pc : "transparent",
                      }}>
                        {isActive && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontFamily:F, fontSize:13, fontWeight: isActive ? 600 : 400,
                          color: isActive ? T1 : T2, margin:0,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {acc.name || acc.id}
                        </p>
                        {acc.currency && (
                          <p style={{ fontFamily:F, fontSize:11, color:T3, margin:"2px 0 0" }}>
                            ID: {acc.id}{acc.currency ? ` · ${acc.currency}` : ""}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color:pc,
                          background:`${pc}15`, border:`1px solid ${pc}28`, borderRadius:99,
                          padding:"2px 8px", letterSpacing:"0.04em", flexShrink:0 }}>
                          {lang==="pt"?"ATIVO":lang==="es"?"ACTIVO":"ACTIVE"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Google: manual Customer ID */}
          {p.id === "google" && (
            <div>
              <div style={{ marginBottom:8 }}>
                <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:TL,
                  textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 3px" }}>{t.cid_label}</p>
                <p style={{ fontFamily:F, fontSize:11, color:T3, margin:0 }}>
                  O Google não compartilha a conta automaticamente — é preciso informar o ID
                </p>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                <input value={custId} onChange={e=>setCustId(e.target.value)}
                  placeholder={t.cid_ph}
                  id="google-ads-customer-id"
                  name="googleAdsCustomerId"
                  style={{ ...iStyle, flex:1, padding:"9px 12px", fontSize:13, borderRadius:10 }}
                  onFocus={focusOn} onBlur={focusOff}
                  onKeyDown={e=>{ if(e.key==="Enter") verifyGoogle(); }}
                />
                <button onClick={verifyGoogle} disabled={verifying || !custId.trim()}
                  style={{ ...BTN_PRIMARY, padding:"9px 16px", borderRadius:10, whiteSpace:"nowrap",
                    background: custId.trim() ? BTN_PRIMARY.background : B0,
                    color: custId.trim() ? "#fff" : T3,
                    boxShadow: custId.trim() ? BTN_PRIMARY.boxShadow : "none",
                    cursor: custId.trim()?"pointer":"not-allowed",
                    fontSize:13, transition:"all 0.15s" }}>
                  {verifying ? <Loader2 size={13} className="animate-spin" style={{display:"block"}}/> : t.verify}
                </button>
              </div>
              <p style={{ fontFamily:F, fontSize:11, color:T3, margin:"6px 0 0", lineHeight:1.5 }}>
                {t.cid_hint}<br/>
                <span style={{ color:"rgba(14,165,233,0.55)" }}>Formato: 123-456-7890 (10 dígitos)</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Events that need Meta Pixel / CAPI on the website
const NEEDS_PIXEL = new Set(['complete_registration', 'contact', 'schedule', 'submit_application', 'purchase', 'initiate_checkout', 'add_to_cart']);

// ── Goal objectives (reuse from GoalSetup) ──────────────────────────────────
const GOAL_OBJECTIVES = [
  {
    key: 'leads' as const, label: 'Leads / Cadastros', icon: '🎯',
    metric: 'cpa' as const, metricLabel: 'CPA',
    events: [
      { value: 'lead', label: 'Lead (formulário)' },
      { value: 'complete_registration', label: 'Cadastro completo' },
      { value: 'contact', label: 'Contato (WhatsApp/chat)' },
      { value: 'schedule', label: 'Agendamento' },
      { value: 'submit_application', label: 'Envio de aplicação' },
    ],
    unit: 'R$',
    formatTarget: (v: number) => `R$ ${(v / 100).toFixed(2)}`,
  },
  {
    key: 'sales' as const, label: 'Vendas / E-commerce', icon: '💰',
    metric: 'roas' as const, metricLabel: 'ROAS',
    events: [
      { value: 'purchase', label: 'Compra' },
      { value: 'initiate_checkout', label: 'Início de checkout' },
      { value: 'add_to_cart', label: 'Adicionou ao carrinho' },
    ],
    unit: 'x',
    formatTarget: (v: number) => `${(v / 10000).toFixed(1)}x`,
  },
  {
    key: 'traffic' as const, label: 'Tráfego / Visitas', icon: '🔗',
    metric: 'cpc' as const, metricLabel: 'CPC',
    events: [
      { value: 'link_click', label: 'Clique no link' },
      { value: 'landing_page_view', label: 'Visualização da página' },
    ],
    unit: 'R$',
    formatTarget: (v: number) => `R$ ${(v / 100).toFixed(2)}`,
  },
];

// ── Business profile — smart margin calculator ──────────────────────────────
// Three modes based on business type:
// 1. "Produto físico" → asks price + cost → auto-calculates margin
// 2. "Serviço / Digital" → asks margin directly (typically high)
// 3. "Não sei" → uses conservative default (30%) with explanation
type BusinessMode = 'product' | 'service' | 'unknown' | null;

function MarginSection({ userId, personaId }: { userId: string; personaId: string }) {
  const [margin, setMargin] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [v2Id, setV2Id] = useState<string | null>(null);
  const [goalObj, setGoalObj] = useState<string | null>(null);

  // Edit state
  const [mode, setMode] = useState<BusinessMode>(null);
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [directMargin, setDirectMargin] = useState('');

  const DEFAULT_MARGIN = 30;

  useEffect(() => {
    (async () => {
      try {
        const resolved = await resolveV2Account(userId, personaId);
        if (!resolved) { setLoading(false); return; }
        setV2Id(resolved.v2Id);
        // Now load the actual data
        type MarginRow = { id: string; profit_margin_pct: number | null; goal_objective: string | null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: row } = await ((supabase as any).from('ad_accounts')
          .select('id, profit_margin_pct, goal_objective')
          .eq('id', resolved.v2Id).maybeSingle() as Promise<{ data: MarginRow | null }>);
        if (row) {
          setMargin(row.profit_margin_pct);
          setGoalObj(row.goal_objective);
        }
      } catch (e) {
        console.error('[MarginSection] load error:', e);
      }
      setLoading(false);
    })();
  }, [userId, personaId]);

  const calculatedMargin = (() => {
    if (mode === 'product') {
      const p = parseFloat(price), c = parseFloat(cost);
      if (p > 0 && c >= 0 && c < p) return Math.round(((p - c) / p) * 100);
      return null;
    }
    if (mode === 'service') {
      const v = parseFloat(directMargin);
      if (v >= 1 && v <= 99) return Math.round(v);
      return null;
    }
    if (mode === 'unknown') return DEFAULT_MARGIN;
    return null;
  })();

  const breakEvenPreview = calculatedMargin && calculatedMargin > 0
    ? (1 / (calculatedMargin / 100)).toFixed(2) : null;

  const save = async () => {
    if (!calculatedMargin) { toast.error('Preencha os dados para a IA calcular sua margem'); return; }
    if (!v2Id) { toast.error('Conecte o Meta Ads primeiro — a IA precisa dos dados.'); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await ((supabase as any).from('ad_accounts').update({ profit_margin_pct: calculatedMargin }).eq('id', v2Id) as Promise<{ error: { message?: string } | null }>);
      if (updateErr) throw updateErr;
      setMargin(calculatedMargin);
      setEditing(false);
      setMode(null);
      toast.success('Margem salva — a IA já está usando');
    } catch (e) {
      console.error('[MarginSection] save error:', e);
      toast.error('Erro ao salvar: ' + (e instanceof Error ? e.message : 'tente novamente'));
    }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s ease-in-out infinite" }} />;
  if (!v2Id) return null;

  const displayMargin = margin ?? DEFAULT_MARGIN;
  const breakEven = displayMargin > 0 ? (1 / (displayMargin / 100)).toFixed(2) : '—';
  const isDefault = margin === null;

  // ── Smart context from goal ──
  const goalHint = goalObj === 'sales'
    ? 'A IA precisa saber sua margem para calcular se cada anúncio está gerando lucro ou prejuízo.'
    : goalObj === 'leads'
    ? 'A IA usa sua margem para definir o custo máximo por lead que ainda gera lucro.'
    : 'Sem essa informação, a IA não consegue distinguir anúncios lucrativos de prejuízos.';

  // ── EDIT MODE ──
  if (editing) {
    return (
      <div>
        <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL,
          textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px",
          display: "flex", alignItems: "center", gap: 6 }}>
          <Target size={12} color={TL} />
          Quanto você lucra por venda?
        </p>
        <div style={{
          background: "rgba(52,211,153,0.03)", border: "1px solid rgba(52,211,153,0.15)",
          borderRadius: 12, padding: "16px 16px 18px", overflow: "hidden",
        }}>
          {/* Explanation */}
          <p style={{ fontFamily: F, fontSize: 12, color: T2, margin: "0 0 14px", lineHeight: 1.5 }}>
            {goalHint}
          </p>

          {/* Business type selector */}
          <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL, margin: "0 0 8px", letterSpacing: "0.04em" }}>
            Tipo de negócio
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {([
              { key: 'product' as const, label: 'Produto físico', sub: 'E-commerce, loja', icon: '📦' },
              { key: 'service' as const, label: 'Serviço / Digital', sub: 'Info, SaaS, consultoria', icon: '💻' },
              { key: 'unknown' as const, label: 'Ainda não sei', sub: 'A IA usa 30% (conservador)', icon: '🤔' },
            ]).map(opt => {
              const sel = mode === opt.key;
              return (
                <button key={opt.key} onClick={() => { setMode(opt.key); setPrice(''); setCost(''); setDirectMargin(''); }}
                  style={{
                    flex: "1 1 140px", display: "flex", flexDirection: "column", alignItems: "flex-start",
                    gap: 3, padding: "10px 12px", borderRadius: 8,
                    background: sel ? "rgba(52,211,153,0.08)" : BG3,
                    border: "none",
                    color: sel ? "#34d399" : T2,
                    fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s", textAlign: "left",
                  }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{opt.icon}</span>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 400, color: sel ? "rgba(52,211,153,0.55)" : T3 }}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode-specific inputs */}
          {mode === 'product' && (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL, margin: "0 0 8px" }}>
                Quanto entra e quanto sai por venda?
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: F, fontSize: 10, color: T3, display: "block", marginBottom: 4 }}>Preço de venda</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: F, fontSize: 12, color: T3 }}>R$</span>
                    <input type="number" min="0" step="0.01" placeholder="150"
                      value={price} onChange={e => setPrice(e.target.value)} autoFocus
                      style={{
                        width: "100%", background: IBG, border: IBD,
                        borderRadius: 6, padding: "8px 10px", color: T1, fontSize: 14, fontWeight: 700,
                        fontFamily: F, outline: "none", fontVariant: "tabular-nums",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.35)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(52,211,153,0.10)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = B2; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: 16, color: B2, marginTop: 18 }}>—</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: F, fontSize: 10, color: T3, display: "block", marginBottom: 4 }}>Custo (produto + frete)</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: F, fontSize: 12, color: T3 }}>R$</span>
                    <input type="number" min="0" step="0.01" placeholder="60"
                      value={cost} onChange={e => setCost(e.target.value)}
                      style={{
                        width: "100%", background: IBG, border: IBD,
                        borderRadius: 6, padding: "8px 10px", color: T1, fontSize: 14, fontWeight: 700,
                        fontFamily: F, outline: "none", fontVariant: "tabular-nums",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.35)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(52,211,153,0.10)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = B2; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'service' && (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL, margin: "0 0 8px" }}>
                Quanto % sobra de cada venda, antes de pagar ads?
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="number" min="1" max="99" step="1" placeholder="70"
                  value={directMargin} onChange={e => setDirectMargin(e.target.value)} autoFocus
                  style={{
                    width: 80, background: IBG, border: IBD,
                    borderRadius: 6, padding: "8px 10px", color: T1, fontSize: 14, fontWeight: 700,
                    fontFamily: F, outline: "none", fontVariant: "tabular-nums", textAlign: "center",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.35)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(52,211,153,0.10)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = B2; e.currentTarget.style.boxShadow = "none"; }}
                  onKeyDown={e => e.key === 'Enter' && save()}
                />
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T3 }}>%</span>
              </div>
              <p style={{ fontFamily: F, fontSize: 10, color: T3, margin: 0, lineHeight: 1.5 }}>
                Referência: Infoprodutos 80-95% · SaaS 70-90% · Consultoria 50-80%
              </p>
            </div>
          )}

          {mode === 'unknown' && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(251,191,36,0.04)", border: "none",
              marginBottom: 8, animation: "fadeIn 0.2s ease",
            }}>
              <p style={{ fontFamily: F, fontSize: 12, color: "rgba(251,191,36,0.70)", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                A IA vai usar 30% como margem padrão — ou seja, vai exigir ROAS 3.33x mínimo para considerar um anúncio lucrativo. Quando souber sua margem real, volte aqui e ajuste.
              </p>
            </div>
          )}

          {/* Live preview */}
          {calculatedMargin && calculatedMargin > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderRadius: 8, background: "rgba(52,211,153,0.06)",
              border: "1px solid rgba(52,211,153,0.12)", marginTop: 12, marginBottom: 12,
              animation: "fadeIn 0.15s ease",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: "#34d399", letterSpacing: "-0.02em" }}>
                    {calculatedMargin}%
                  </span>
                  <span style={{ fontFamily: F, fontSize: 11, color: "rgba(52,211,153,0.55)", fontWeight: 500 }}>de lucro</span>
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: TL, marginTop: 2 }}>
                  A IA vai exigir no mínimo <span style={{ fontWeight: 700, color: T2 }}>{breakEvenPreview}x</span>
                  <span style={{ color: T3 }}> de ROAS para considerar lucrativo</span>
                </div>
              </div>
              {mode === 'product' && price && cost && (
                <div style={{ fontFamily: F, fontSize: 10, color: T3, textAlign: "right", lineHeight: 1.5 }}>
                  R${price} - R${cost} = R${(parseFloat(price) - parseFloat(cost)).toFixed(2)} lucro
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {mode && (
            <div style={{ display: "flex", gap: 8, marginTop: mode === 'unknown' ? 12 : 0 }}>
              <button onClick={save} disabled={saving || !calculatedMargin}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  background: calculatedMargin ? "linear-gradient(135deg, #34d399 0%, #10b981 100%)" : B0,
                  border: "none", color: calculatedMargin ? "#fff" : T3,
                  fontFamily: F, fontSize: 12, fontWeight: 700,
                  cursor: calculatedMargin ? "pointer" : "not-allowed",
                  boxShadow: calculatedMargin ? "0 3px 10px rgba(52,211,153,0.25)" : "none",
                  transition: "all 0.15s",
                }}>
                {saving ? 'Salvando...' : 'Ensinar margem à IA'}
              </button>
              <button onClick={() => { setEditing(false); setMode(null); }}
                style={{
                  ...BTN_SECONDARY, padding: "10px 16px", borderRadius: 8, fontSize: 12,
                }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DISPLAY MODE — inline KPI ──
  const marginColor = displayMargin >= 50 ? GREEN : displayMargin >= 25 ? AMBER : RED;
  const marginPct = Math.min(displayMargin, 100);

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => { setEditing(true); if (margin) setMode(null); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(true); if (margin) setMode(null); } }}
      style={{
        padding: "14px 16px",
        background: "rgba(15,23,42,0.40)",
        border: `1px solid ${B1}`,
        borderRadius: 12, cursor: "pointer",
        transition: `all 0.2s ${EASE}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${marginColor}30`;
        (e.currentTarget as HTMLElement).style.background = "rgba(15,23,42,0.60)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = B1;
        (e.currentTarget as HTMLElement).style.background = "rgba(15,23,42,0.40)";
      }}>
      {/* Value row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: F, fontSize: 28, fontWeight: 800, color: marginColor,
            letterSpacing: "-0.03em", lineHeight: 1 }}>
            {displayMargin}%
          </span>
          {isDefault ? (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              padding: "2px 7px", borderRadius: 4, background: `${AMBER}15`, color: AMBER }}>PADRÃO</span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              padding: "2px 7px", borderRadius: 4, background: `${GREEN}15`, color: GREEN }}>CONFIGURADO</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: T3, fontSize: 11, fontFamily: F, fontWeight: 500 }}>
          Ajustar <Pencil size={10} />
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 3, background: "rgba(148,163,184,0.06)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: `${marginPct}%`,
          background: `linear-gradient(90deg, ${marginColor}CC, ${marginColor})`,
          boxShadow: `0 0 8px ${marginColor}35`,
          transition: `width 0.6s ${EASE}`,
        }}/>
      </div>

      {/* Break-even */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: F, fontSize: 12, color: T2 }}>
          A IA exige mínimo <strong style={{ color: T1, fontWeight: 700 }}>{breakEven}x</strong> de ROAS
        </span>
        {isDefault && (
          <span style={{ fontFamily: F, fontSize: 10, color: AMBER, fontWeight: 500 }}>
            Ensine sua margem real →
          </span>
        )}
      </div>
    </div>
  );
}

function GoalSection({ userId, personaId }: { userId: string; personaId: string }) {
  const navigate = useNavigate();
  const [goalData, setGoalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [v2AccountId, setV2AccountId] = useState<string | null>(null);
  const [noMetaConn, setNoMetaConn] = useState(false);

  // Edit state
  const [editObj, setEditObj] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadGoal = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Resolve Meta connection + ensure v2 row exists
      const resolved = await resolveV2Account(userId, personaId);
      if (!resolved) { setNoMetaConn(true); setLoading(false); return; }

      setV2AccountId(resolved.v2Id);

      // 2. Load goal data from v2 row
      type GoalRow = {
        id: string;
        goal_objective: string | null;
        goal_primary_metric: string | null;
        goal_conversion_event: string | null;
        goal_target_value: number | null;
        goal_configured_at: string | null;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: accRow } = await ((supabase as any)
        .from('ad_accounts')
        .select('id, goal_objective, goal_primary_metric, goal_conversion_event, goal_target_value, goal_configured_at')
        .eq('id', resolved.v2Id)
        .maybeSingle() as Promise<{ data: GoalRow | null }>);

      if (accRow) {
        setGoalData(accRow.goal_objective ? accRow : null);
        // Pre-fill edit state
        if (accRow.goal_objective) {
          setEditObj(accRow.goal_objective);
          setEditEvent(accRow.goal_conversion_event);
          const obj = GOAL_OBJECTIVES.find(o => o.key === accRow.goal_objective);
          if (obj && accRow.goal_target_value) {
            const display = obj.metric === 'roas'
              ? (accRow.goal_target_value / 10000).toString()
              : (accRow.goal_target_value / 100).toString();
            setEditTarget(display);
          }
        }
      }
    } catch (e) {
      console.error('[GoalSection] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, personaId]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  const handleSave = async () => {
    if (!editObj || !editEvent) {
      toast.error('Diga à IA o que otimizar e qual evento conta como sucesso');
      return;
    }
    if (!v2AccountId) {
      toast.error('Conecte o Meta Ads primeiro — a IA precisa dos dados.');
      return;
    }
    setSaving(true);
    const obj = GOAL_OBJECTIVES.find(o => o.key === editObj);
    if (!obj) { setSaving(false); return; }

    let targetCentavos = 0;
    const raw = parseFloat(editTarget);
    if (!isNaN(raw) && raw > 0) {
      targetCentavos = obj.metric === 'roas' ? Math.round(raw * 10000) : Math.round(raw * 100);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await ((supabase as any).from('ad_accounts').update({
        goal_objective: editObj,
        goal_primary_metric: obj.metric,
        goal_conversion_event: editEvent,
        goal_target_value: targetCentavos > 0 ? targetCentavos : null,
        goal_configured_at: new Date().toISOString(),
      }).eq('id', v2AccountId) as Promise<{ error: { message?: string } | null }>);

      if (updateErr) throw updateErr;

      toast.success('A IA agora sabe o que otimizar');
      setEditing(false);
      loadGoal();
    } catch (e) {
      console.error('[GoalSection] save error:', e);
      toast.error('Erro ao salvar: ' + (e instanceof Error ? e.message : 'tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ height: 48, borderRadius: 10, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
  if (noMetaConn) return null; // No Meta connection — don't show goal section

  const obj = goalData ? GOAL_OBJECTIVES.find(o => o.key === goalData.goal_objective) : null;
  const eventLabel = obj?.events.find(e => e.value === goalData?.goal_conversion_event)?.label;

  // ── Edit mode ──
  if (editing) {
    const selObj = GOAL_OBJECTIVES.find(o => o.key === editObj);
    return (
      <div>
        <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL,
          textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
          O que a IA deve otimizar?
        </p>
        <div style={{
          background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.15)",
          borderRadius: 12, padding: "16px 16px 18px",
        }}>
          {/* Step 1: Objective */}
          <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T2, margin: "0 0 8px" }}>
            Qual é o resultado que importa?
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {GOAL_OBJECTIVES.map(o => {
              const sel = editObj === o.key;
              return (
              <button key={o.key} onClick={() => { setEditObj(o.key); setEditEvent(null); setEditTarget(''); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
                  background: sel ? "rgba(56,189,248,0.12)" : BG3,
                  border: "none",
                  color: sel ? "#38BDF8" : T2,
                  fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                }}>
                <span style={{ fontSize: 14 }}>{o.icon}</span>{o.label}
              </button>
              );
            })}
          </div>

          {/* Step 2: Conversion Event */}
          {selObj && (
            <>
              <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T2, margin: "0 0 8px" }}>
                O que conta como sucesso?
              </p>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {selObj.events.map(ev => {
                  const sel = editEvent === ev.value;
                  return (
                  <button key={ev.value} onClick={() => setEditEvent(ev.value)}
                    style={{
                      padding: "7px 12px", borderRadius: 7,
                      background: sel ? "rgba(56,189,248,0.10)" : BG3,
                      border: "none",
                      color: sel ? "#38BDF8" : T2,
                      fontFamily: F, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                    }}>
                    {ev.label}
                  </button>
                  );
                })}
              </div>

              {/* Step 3: Target (optional) */}
              <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T2, margin: "0 0 4px" }}>
                Meta de {selObj.metricLabel} <span style={{ fontWeight: 400, color: T3 }}>(opcional)</span>
              </p>
              <p style={{ fontFamily: F, fontSize: 11, color: T3, margin: "0 0 8px" }}>
                Se não souber, deixe vazio — a IA analisa sem meta fixa.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TL }}>{selObj.unit}</span>
                <input type="number" step="0.01" min="0"
                  placeholder={selObj.metric === 'roas' ? 'Ex: 3.0' : 'Ex: 20.00'}
                  value={editTarget} onChange={e => setEditTarget(e.target.value)}
                  style={{
                    flex: 1, background: IBG, border: IBD,
                    borderRadius: 8, padding: "9px 12px", color: T1, fontSize: 13, fontWeight: 600,
                    fontFamily: F, outline: "none", fontVariant: "tabular-nums",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(56,189,248,0.40)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(56,189,248,0.12)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = B2; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </>
          )}

          {/* Pixel hint */}
          {editEvent && NEEDS_PIXEL.has(editEvent) && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "9px 12px", borderRadius: 7, marginBottom: 2,
              background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)",
            }}>
              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚡</span>
              <div style={{ fontSize: 11, color: T3, lineHeight: 1.55 }}>
                A IA precisa do <strong style={{ color: T2 }}>Pixel do Meta</strong> instalado no site para rastrear esse evento.
                {" "}
                <button
                  onClick={() => navigate("/dashboard/ai?prompt=" + encodeURIComponent("Preciso instalar o Pixel do Meta no meu site para rastrear conversões. Me ajude passo a passo."))}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "#38BDF8", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: F, textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                >
                  Peça ajuda à IA →
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving || !editObj || !editEvent}
              style={{
                ...BTN_PRIMARY, flex: 1, padding: "9px 14px", borderRadius: 8,
                background: (editObj && editEvent) ? BTN_PRIMARY.background : B0,
                color: (editObj && editEvent) ? "#fff" : T3,
                fontSize: 12, cursor: (editObj && editEvent) ? "pointer" : "not-allowed",
                boxShadow: (editObj && editEvent) ? BTN_PRIMARY.boxShadow : "none",
              }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{
                ...BTN_SECONDARY, padding: "9px 16px", borderRadius: 8, fontSize: 12,
              }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Display mode ──
  return (
    <div>
      <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TL,
        textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px",
        display: "flex", alignItems: "center", gap: 6 }}>
        <Target size={11} /> O que a IA otimiza
      </p>

      {goalData && obj ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.12)",
          borderRadius: 10, justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{obj.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T1 }}>
                {obj.label}
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: TL, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {eventLabel || goalData.goal_conversion_event}
                {goalData.goal_target_value ? ` · Meta: ${obj.formatTarget(goalData.goal_target_value)}` : ''}
                {' · '}{obj.metricLabel}
              </div>
            </div>
          </div>
          <button onClick={() => setEditing(true)}
            style={{
              ...BTN_SECONDARY, display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7,
              fontSize: 11, flexShrink: 0, transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#242A34"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = BG3; }}>
            <Settings2 size={11} /> Mudar
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{
            ...BTN_SECONDARY, display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 10,
            width: "100%", textAlign: "left", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#242A34"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = BG3; }}>
          <Target size={13} color={BLUE} />
          <span style={{ fontFamily: F, fontSize: 12, color: BLUE }}>
            Ensinar à IA o que otimizar
          </span>
        </button>
      )}
    </div>
  );
}

// ── Account form (inline) ─────────────────────────────────────────────────────
/** Persona row used by the account form. Captures only the columns the
 *  form reads/writes so we don't have to keep the full DB shape in sync. */
interface AccountFormPersona {
  id?: string;
  name?: string | null;
  website?: string | null;
  description?: string | null;
  logo_url?: string | null;
}
function AccountForm({ account, userId, t, onSave, onCancel }: {
  account?: AccountFormPersona; userId:string; t: TStrings;
  onSave:()=>void; onCancel:()=>void;
}) {
  const [name, setName]         = useState(account?.name || "");
  const [website, setWebsite]   = useState(account?.website || "");
  const [desc, setDesc]         = useState(account?.description || "");
  const [logo, setLogo]         = useState(account?.logo_url || "");
  const [saving, setSaving]     = useState(false);
  const [uploading, setUp]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File) => {
    if (file.size > 2*1024*1024) { toast.error("Max 2MB"); return; }
    setUp(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/logos/${Date.now()}.${ext}`; // userId first = matches RLS foldername[1] check
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert:true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      setLogo(url);
      // Auto-save logo_url immediately for existing accounts
      if (account?.id) {
        await supabase.from("personas").update({ logo_url: url }).eq("id", account.id);
        window.dispatchEvent(new CustomEvent('persona-updated'));
        toast.success("Logo salvo");
      }
    } catch (e) {
      toast.error("Upload falhou: " + (e instanceof Error ? e.message : "tente novamente"));
    }
    finally { setUp(false); }
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name:name.trim(), website:website.trim()||null, description:desc.trim()||null, logo_url:logo||null };
      let personaId = account?.id || null;
      if (account?.id) {
        await supabase.from("personas").update(payload).eq("id", account.id);
      } else {
        const { data: inserted } = await supabase.from("personas").insert({ ...payload, user_id:userId }).select("id");
        personaId = inserted?.[0]?.id || null;
      }
      // Fire business-profiler when website is set — gives the AI real context about this business
      if (personaId && (website.trim() || name.trim())) {
        supabase.functions.invoke("business-profiler", {
          body: {
            user_id: userId,
            persona_id: personaId,
            product_name: name.trim(),
            website: website.trim() || "",
            market: "BR",
            niche: desc.trim() || "",
            force_refresh: !!account?.id, // force refresh on edit so website change is picked up
          }
        }).catch(() => {});
      }
      onSave();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Logo + name row */}
      <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
        {/* Logo */}
        <div role="button" tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key==="Enter" && fileRef.current?.click()}
          style={{ width:64, height:64, borderRadius:14, flexShrink:0, overflow:"hidden", cursor:"pointer",
            background: logo ? "transparent" : B0,
            border: `2px solid ${logo ? "transparent" : B2}`,
            display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
          onMouseEnter={e=>{ if(!logo) (e.currentTarget as HTMLElement).style.borderColor="rgba(14,165,233,0.4)"; }}
          onMouseLeave={e=>{ if(!logo) (e.currentTarget as HTMLElement).style.borderColor=B2; }}>
          {uploading ? <Loader2 size={16} color={T3} className="animate-spin"/>
            : logo ? <img src={logo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ textAlign:"center" }}>
                <Upload size={16} color={T3}/>
                <p style={{ fontFamily:F, fontSize:11, color:T3, margin:"3px 0 0" }}>Logo</p>
              </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}/>

        {/* Name */}
        <div style={{ flex:1 }}>
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:T2,
            textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:7 }}>
            {t.name_label}
          </label>
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder={t.name_ph} autoFocus style={iStyle}
            onFocus={focusOn} onBlur={focusOff}/>
          {logo && (
            <button onClick={()=>setLogo("")}
              style={{ marginTop:6, fontFamily:F, fontSize:11, color:"#F87171",
                background:"none", border:"none", cursor:"pointer", padding:0,
                display:"flex", alignItems:"center", gap:3 }}>
              <X size={10}/>{t.remove_logo}
            </button>
          )}
        </div>
      </div>

      {/* Website — optional */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:T2,
            textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.website_label}</label>
          <span style={{ fontFamily:F, fontSize:11, color:T3 }}>{t.optional}</span>
        </div>
        <div style={{ position:"relative" }}>
          <Globe size={13} color={T3}
            style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
          <input value={website} onChange={e=>setWebsite(e.target.value)}
            placeholder={t.website_ph}
            style={{ ...iStyle, paddingLeft:36 }}
            onFocus={focusOn} onBlur={focusOff}/>
        </div>
      </div>

      {/* AI context — optional */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:T2,
            textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.desc_label}</label>
          <span style={{ fontFamily:F, fontSize:11, color:T3 }}>{t.optional}</span>
        </div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder={t.desc_ph} rows={4}
          style={{ ...iStyle, resize:"none", lineHeight:1.65 }}
          onFocus={focusOn} onBlur={focusOff}/>
        <p style={{ fontFamily:F, fontSize:12, color:T3, margin:"6px 0 0" }}>{t.desc_hint}</p>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, paddingTop:4 }}>
        <button onClick={save} disabled={saving || !name.trim()}
          style={{ flex:1, height:46, borderRadius:12, border:"none",
            cursor: name.trim() ? "pointer" : "not-allowed",
            background: name.trim() ? `linear-gradient(135deg,${BLUE},${CYAN})` : "rgba(255,255,255,0.06)",
            color: name.trim() ? "#fff" : T3,
            fontFamily:F, fontSize:14, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
            boxShadow: name.trim() ? "0 4px 20px rgba(14,165,233,0.35)" : "none",
            transition:"all 0.2s" }}>
          {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
          {saving ? t.saving : (account?.id ? t.save : t.create)}
        </button>
        <button onClick={onCancel}
          style={{ ...BTN_SECONDARY, padding:"0 22px", height:46, borderRadius:12,
            fontSize:14, transition:"all 0.15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#242A34"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=BG3}}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { user, profile, selectedPersona, setSelectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = T[(language as Lang)] || T.pt;
  const [searchParams] = useSearchParams();
  // Plan-based gate for creating new businesses (personas).
  // Free=1, Maker=1, Pro=3, Studio=∞ (-1). When the user is at the
  // limit, "+ Novo negócio" opens an UpgradeWall instead of the form.
  const [showUpgradeWall, setShowUpgradeWall] = React.useState(false);

  /** Persona row shape used by the accounts list (subset of the personas
   *  table). Mirrors the columns this page reads. */
  type AccountRow = {
    id: string;
    user_id: string;
    name: string | null;
    logo_url: string | null;
    website: string | null;
    description: string | null;
    created_at: string;
  };
  const [accounts, setAccounts]   = useState<AccountRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId]       = useState<string | null>(null);     // which account card is expanded
  const [editingId, setEditingId] = useState<string | null>(null);     // which is in edit mode
  const [creating, setCreating]   = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [platformRefreshKey, setPlatformRefreshKey] = useState(0);

  useEffect(() => {
    if (selectedPersona?.id && !openId) setOpenId(selectedPersona.id);
  }, [selectedPersona?.id]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setLoadError("Sessão não encontrada. Recarregue a página.");
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await withTimeout(
        supabase.from("personas")
          .select("id,user_id,name,logo_url,website,description,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending:true })
      );

      if (error) throw error;

      const list: AccountRow[] = (data || []) as AccountRow[];
      setAccounts(list);
      setOpenId(prev => prev || list[0]?.id || null);
    } catch (e) {
      console.error("[AdBrief] accounts load:", e);
      setAccounts([]);
      setLoadError("Não foi possível carregar suas contas agora.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Show hint after returning from Google OAuth + force reload accounts
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      setTimeout(() => {
        // Reload accounts AND force PlatformRow to re-fetch connection state
        load();
        setPlatformRefreshKey(k => k + 1);
        if (connected === "google") {
          toast.success("Google Ads conectado! Expanda a conta e insira seu Customer ID para finalizar.", { duration: 7000 });
        }
      }, 600);
    }
  }, []);

  const activate = (acc: AccountRow) => {
    // ActivePersona has many required fields the AccountRow doesn't carry
    // (headline, age, bio, etc.) — this on-the-fly activation only fills
    // the identity fields, the rest defaults to empty per ActivePersona's
    // shape. Cast through unknown to skip the strict required-field check.
    setSelectedPersona({ ...acc } as unknown as Parameters<typeof setSelectedPersona>[0]);
    window.dispatchEvent(new CustomEvent('persona-updated'));
    toast.success("IA ativada para " + acc.name);
  };

  const del = async (id: string, name: string) => {
    if (!confirm(t.delete_confirm)) return;
    setDeleting(id);
    await supabase.from("personas").delete().eq("id", id);
    toast.success(t.deleted);
    if (selectedPersona?.id === id) setSelectedPersona(null);
    if (openId === id) setOpenId(null);
    load();
    setDeleting(null);
    window.dispatchEvent(new CustomEvent('persona-updated'));
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300 }}>
      <Loader2 size={22} color={BLUE} className="animate-spin" style={{ filter:`drop-shadow(0 0 8px ${BLUE})` }}/>
    </div>
  );

  if (!user) return (
    <div style={{ maxWidth:740, margin:"0 auto", padding:"clamp(16px,4vw,40px)", fontFamily:F }}>
      <div style={{ borderRadius:14, padding:"18px 20px", background:"rgba(239,68,68,0.06)", border:`1px solid rgba(239,68,68,0.15)`, backdropFilter:GLASS }}>
        <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#FCA5A5" }}>Sessão não encontrada</p>
        <p style={{ margin:"6px 0 0", fontSize:13, color:T2 }}>Recarregue a página para reconectar.</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:740, margin:"0 auto", padding:"clamp(16px,4vw,40px)", fontFamily:F, animation:"pageReveal 0.3s ease both" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pageReveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0}to{opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes statusPulse{0%,100%{opacity:1}50%{opacity:.5}}
        .acc-card{transition:all 0.25s ${EASE}}
        .acc-card:hover{transform:translateY(-1px)}
        .acc-btn{transition:all 0.15s ${EASE}}
        .acc-btn:hover{transform:translateY(-1px)}
        .acc-btn:active{transform:scale(0.97)}
      `}</style>

      {/* ── Header ── */}
      {/* Plan-based gate: when the user is at their persona limit, the
          "+ Novo negócio" button opens an UpgradeWall instead of the
          create form. Limit per plan (Free=1, Maker=1, Pro=3, Studio=∞)
          comes from getAdAccountLimit(profile.plan). */}
      {(() => {
        const accountLimit = getAdAccountLimit(profile?.plan);
        const atLimit = accountLimit !== -1 && accounts.length >= accountLimit;
        const handleCreateClick = () => {
          if (atLimit) {
            setShowUpgradeWall(true);
          } else {
            setCreating(true); setEditingId(null); setOpenId(null);
          }
        };
        return (
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:28, gap:16, flexWrap:"wrap" }}>
            <div>
              <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:T1, letterSpacing:"-0.04em", lineHeight:1.2 }}>{t.title}</h1>
              <p style={{ margin:"6px 0 0", fontSize:14, color:T3, lineHeight:1.5 }}>{t.sub}</p>
              {/* Counter pill — "1/1", "2/3", "Ilimitado" — gives the
                  user a clear sense of where they stand vs the plan. */}
              {accounts.length > 0 && (
                <p style={{ margin:"8px 0 0", fontSize:11.5, fontWeight:600, color:T3, letterSpacing:"0.02em" }}>
                  {accountLimit === -1
                    ? `${accounts.length} negócio${accounts.length === 1 ? '' : 's'} · plano ${profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Studio'} ilimitado`
                    : `${accounts.length}/${accountLimit} negócio${accountLimit === 1 ? '' : 's'} · plano ${profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Free'}`}
                </p>
              )}
            </div>
            {!creating && (
              <button className="acc-btn" onClick={handleCreateClick}
                style={{
                  ...BTN_PRIMARY,
                  display:"flex", alignItems:"center", gap:8, padding:"11px 22px",
                  borderRadius:10, fontSize:13, whiteSpace:"nowrap",
                  // At-limit visual: still cyan-blue but slightly muted +
                  // changed copy hints at upgrade. Click still works (opens
                  // wall instead of form), so we don't disable it.
                  opacity: atLimit ? 0.85 : 1,
                }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="0 8px 32px rgba(37,99,235,0.50), 0 0 0 1px rgba(37,99,235,0.30)";(e.currentTarget as HTMLElement).style.transform="translateY(-2px)"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow=BTN_PRIMARY.boxShadow;(e.currentTarget as HTMLElement).style.transform="translateY(0)"}}>
                <Plus size={15} strokeWidth={2.5}/>
                {atLimit ? "Faça upgrade" : t.new}
              </button>
            )}
          </div>
        );
      })()}

      {/* Upgrade wall modal — opens when user clicks "+ Novo negócio"
          but is already at their plan's persona limit. */}
      {showUpgradeWall && (
        <UpgradeWall trigger="account" onClose={() => setShowUpgradeWall(false)} />
      )}

      {/* ── Create new form ── */}
      {creating && (
        <div style={{ borderRadius:16, background:CARD, border:`1px solid ${B2}`,
          boxShadow:SHD, backdropFilter:GLASS, padding:"clamp(22px,4vw,30px)", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
            <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:T1, letterSpacing:"-0.02em" }}>{t.new}</h2>
            <button onClick={() => setCreating(false)}
              style={{ ...BTN_SECONDARY, borderRadius:8, padding:"5px 7px", display:"flex" }}>
              <X size={14}/>
            </button>
          </div>
          <AccountForm userId={user.id} t={t}
            onSave={() => { load(); setCreating(false); window.dispatchEvent(new CustomEvent('persona-updated')); }}
            onCancel={() => setCreating(false)}/>
        </div>
      )}

      {loadError && !creating && (
        <div style={{ marginBottom:16, borderRadius:14, padding:"16px 20px", background:"rgba(239,68,68,0.06)", border:`1px solid rgba(239,68,68,0.12)`, backdropFilter:GLASS, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#FCA5A5" }}>Não foi possível carregar seus negócios</p>
            <p style={{ margin:"4px 0 0", fontSize:13, color:T3 }}>{loadError}</p>
          </div>
          <button className="acc-btn" onClick={() => load()}
            style={{ ...BTN_SECONDARY, padding:"9px 18px", borderRadius:10, fontSize:13 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {accounts.length === 0 && !creating && !loadError && (
        <div style={{ textAlign:"center", padding:"72px 32px", borderRadius:20,
          background:CARD, border:`1px solid ${B1}`,
          boxShadow:`${SHD}, ${GLOW_BLUE}`, backdropFilter:GLASS }}>
          <div style={{ width:64, height:64, borderRadius:18,
            background:`linear-gradient(135deg, rgba(37,99,235,0.15), rgba(6,182,212,0.10))`,
            display:"flex", alignItems:"center",
            justifyContent:"center", margin:"0 auto 24px",
            boxShadow:`0 0 24px rgba(37,99,235,0.12)`,
          }}>
            <Building2 size={28} color={BLUE}/>
          </div>
          <h3 style={{ margin:"0 0 10px", fontSize:20, fontWeight:700, color:T1, letterSpacing:"-0.02em" }}>{t.no_accounts}</h3>
          <p style={{ margin:"0 0 28px", fontSize:14, color:T2, lineHeight:1.7, maxWidth:380, marginLeft:"auto", marginRight:"auto" }}>{t.no_accounts_sub}</p>
          <button className="acc-btn" onClick={() => setCreating(true)}
            style={{ ...BTN_PRIMARY, padding:"12px 30px", borderRadius:10, fontSize:14 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="0 8px 32px rgba(37,99,235,0.50)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow=BTN_PRIMARY.boxShadow}}>
            {t.create_first}
          </button>
        </div>
      )}

      {/* ── Account cards ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {accounts.map(acc => {
          const isOpen    = openId === acc.id;
          const isActive  = selectedPersona?.id === acc.id;
          const isEditing = editingId === acc.id;
          const isDel     = deleting === acc.id;

          return (
            <div key={acc.id} className="acc-card" style={{
              borderRadius:16,
              background: isOpen ? CARD : 'rgba(10,15,28,0.60)',
              border: `1px solid ${isOpen ? (isActive ? "rgba(37,99,235,0.25)" : B2) : B1}`,
              boxShadow: isOpen ? (isActive ? `${SHD}, ${GLOW_BLUE}` : SHD) : "none",
              backdropFilter: isOpen ? GLASS : "none",
              overflow:"hidden",
              transition:`all 0.25s ${EASE}`,
            }}>

              {/* ── Card header — always visible ── */}
              <button onClick={() => { setOpenId(isOpen ? null : acc.id); setEditingId(null); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px 20px",
                  background:"none", border:"none", cursor:"pointer", textAlign:"left", transition:`all 0.2s ${EASE}` }}>
                <AccountAvatar name={acc.name||"?"} logoUrl={acc.logo_url} size={44} radius={12}/>
                <div style={{ flex:1, minWidth:0, textAlign:"left" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontFamily:F, fontSize:15, fontWeight:700,
                      color: isOpen ? T1 : T2,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      transition:`color 0.2s ${EASE}`, letterSpacing:"-0.01em" }}>
                      {acc.name || t.unnamed}
                    </span>
                    {isActive && (
                      <span style={{ fontFamily:F, fontSize:9, fontWeight:700, color:"#60A5FA",
                        background:"rgba(37,99,235,0.15)", borderRadius:5, padding:"2px 7px",
                        letterSpacing:"0.04em", flexShrink:0 }}>
                        {t.active_in_chat}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily:F, fontSize:12, color:T3, margin:0,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {acc.website || (acc.description ? acc.description.slice(0,48)+"…" : t.no_context)}
                  </p>
                </div>
                <ChevronDown size={16} color={T3}
                  style={{ flexShrink:0, transform:isOpen?"rotate(180deg)":"none", transition:`transform 0.3s ${EASE}` }}/>
              </button>

              {/* ── Expanded: everything inside one card ── */}
              {isOpen && (
                <div style={{ animation:"slideDown 0.25s ease" }}>
                  <div style={{ height:"1px", background:`linear-gradient(90deg, transparent, ${B2}, transparent)`, margin:"0 20px" }}/>

                  <div style={{ padding:"20px 20px 24px" }}>
                    {isEditing ? (
                      /* ── Edit form ── */
                      <div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T1 }}>{t.edit}</h3>
                          <button onClick={() => setEditingId(null)}
                            style={{ ...BTN_SECONDARY, borderRadius:7, padding:"4px 6px", display:"flex" }}>
                            <X size={13}/>
                          </button>
                        </div>
                        <AccountForm account={acc} userId={user.id} t={t}
                          onSave={() => { load(); setEditingId(null); window.dispatchEvent(new CustomEvent('persona-updated')); }}
                          onCancel={() => setEditingId(null)}/>
                      </div>
                    ) : (
                      /* ── Detail view — all sections together ── */
                      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

                        {/* Action bar */}
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {!isActive && (
                            <button className="acc-btn" onClick={() => activate(acc)}
                              style={{ ...BTN_PRIMARY, display:"flex", alignItems:"center", gap:6,
                                padding:"9px 18px", borderRadius:10, fontSize:12 }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow="0 6px 28px rgba(37,99,235,0.50)"}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow=BTN_PRIMARY.boxShadow}}>
                              <CheckCircle2 size={12}/>{t.use_in_chat}
                            </button>
                          )}
                          <button className="acc-btn" onClick={() => setEditingId(acc.id)}
                            style={{ ...BTN_SECONDARY, display:"flex", alignItems:"center", gap:5,
                              padding:"9px 16px", borderRadius:10, fontSize:12 }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(30,41,59,1)";(e.currentTarget as HTMLElement).style.borderColor="rgba(148,163,184,0.20)"}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(30,41,59,0.80)";(e.currentTarget as HTMLElement).style.borderColor=B2}}>
                            <Pencil size={11}/>{t.edit}
                          </button>
                          <div style={{ flex:1 }}/>
                          <button className="acc-btn" onClick={() => del(acc.id, acc.name)} disabled={isDel}
                            style={{ ...BTN_DANGER, display:"flex", alignItems:"center", gap:5,
                              padding:"9px 12px", borderRadius:10, fontSize:12 }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.20)"}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.12)"}}>
                            {isDel ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                          </button>
                        </div>

                        {/* ── Margem ── */}
                        <div>
                          <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:T3,
                            textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px",
                            display:"flex", alignItems:"center", gap:6 }}>
                            <Target size={11} /> Lucro por venda
                          </p>
                          <MarginSection userId={user.id} personaId={acc.id} />
                        </div>

                        {/* ── Conexões ── */}
                        <div>
                          <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:T3,
                            textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px" }}>{t.platforms}</p>
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {PLATFORMS.map(p => (
                              <PlatformRow key={`${p.id}-${acc.id}-${platformRefreshKey}`} p={p}
                                userId={user.id} accountId={acc.id} t={t}/>
                            ))}
                          </div>
                        </div>

                        {/* ── Objetivo ── */}
                        <GoalSection userId={user.id} personaId={acc.id} />

                        {/* ── Contexto + Website ── */}
                        {acc.description && (
                          <div>
                            <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:T3,
                              textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>{t.desc_label}</p>
                            <p style={{ fontFamily:F, fontSize:13, color:T2, lineHeight:1.7,
                              margin:0, padding:"12px 14px", background:"rgba(15,23,42,0.40)",
                              border:`1px solid ${B1}`, borderRadius:10 }}>
                              {acc.description}
                            </p>
                          </div>
                        )}
                        {!acc.description && (
                          <button className="acc-btn" onClick={() => setEditingId(acc.id)}
                            style={{ ...BTN_SECONDARY, display:"flex", alignItems:"center", gap:8,
                              padding:"10px 14px", borderRadius:10, width:"100%", textAlign:"left", fontSize:12 }}>
                            <AlertCircle size={12} color={T3}/>
                            <span>{t.add_context}</span>
                          </button>
                        )}
                        {acc.website && (
                          <div>
                            <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:T3,
                              textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 6px" }}>{t.website_label}</p>
                            <a href={acc.website.startsWith("http") ? acc.website : `https://${acc.website}`}
                              target="_blank" rel="noreferrer"
                              style={{ fontFamily:F, fontSize:13, color:"#60A5FA", textDecoration:"none",
                                display:"inline-flex", alignItems:"center", gap:6 }}
                              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#93C5FD"}}
                              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#60A5FA"}}>
                              <Globe size={12}/>{acc.website}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add another account ── */}
      {accounts.length > 0 && !creating && (
        <button className="acc-btn" onClick={() => { setCreating(true); setOpenId(null); }}
          style={{ ...BTN_SECONDARY, marginTop:14, display:"flex", alignItems:"center", gap:8, padding:"11px 20px",
            borderRadius:12, width:"100%", justifyContent:"center", fontSize:13 }}
          onMouseEnter={e=>{
            (e.currentTarget as HTMLElement).style.background="rgba(30,41,59,1)";
            (e.currentTarget as HTMLElement).style.borderColor="rgba(37,99,235,0.25)";
            (e.currentTarget as HTMLElement).style.color="#60A5FA";
          }}
          onMouseLeave={e=>{
            (e.currentTarget as HTMLElement).style.background="rgba(30,41,59,0.80)";
            (e.currentTarget as HTMLElement).style.borderColor=B2;
            (e.currentTarget as HTMLElement).style.color=T2;
          }}>
          <Plus size={15}/>{t.new}
        </button>
      )}
    </div>
  );
}
