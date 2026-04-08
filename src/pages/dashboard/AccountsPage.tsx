import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Globe, Upload, Loader2, X, CheckCircle2, Link2, AlertCircle, Check, ChevronDown, Building2, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

// ── Design tokens ─────────────────────────────────────────────────────────────
const F = "'Plus Jakarta Sans', sans-serif";
const BLUE = "#0ea5e9", CYAN = "#06b6d4";
const CARD  = "linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)";
const SHD   = "0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.35)";
const IBG   = "rgba(255,255,255,0.06)";
const IBD   = "1px solid rgba(255,255,255,0.12)";

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  pt: {
    title:"Contas", sub:"Gerencie suas contas de anúncios e contexto de IA.",
    new:"Nova conta", no_accounts:"Nenhuma conta ainda",
    no_accounts_sub:"Crie sua primeira conta para conectar anúncios e usar a IA.",
    create_first:"Criar primeira conta",
    active_in_chat:"Ativa no chat", use_in_chat:"Usar no chat",
    delete_confirm:"Excluir esta conta? Essa ação não pode ser desfeita.",
    deleted:"Conta excluída", saving:"Salvando…", save:"Salvar",
    cancel:"Cancelar", create:"Criar conta", edit:"Editar conta",
    name_label:"Nome da conta", name_ph:"Ambulatório M., Nike BR, Eluck MX…",
    website_label:"Website", website_ph:"seusite.com.br",
    desc_label:"Contexto para a IA", optional:"opcional",
    desc_ph:"O que esta conta vende? Quem é o público? Qualquer detalhe que a IA deve saber ao responder…",
    desc_hint:"A IA lê isso como contexto em todas as respostas para esta conta.",
    logo_label:"Logo", logo_hint:"PNG, JPG ou SVG · Máx 2MB", remove_logo:"Remover logo",
    platforms:"Conexões de anúncios",
    connect:"Conectar", disconnect:"Desconectar", connecting:"Conectando…",
    soon:"Em breve", connected:"Conectado", not_connected:"Não conectado",
    active_label:"ATIVO", select_account:"Conta de anúncios ativa",
    cid_label:"Customer ID", cid_ph:"Ex: 512-522-3131",
    verify:"Verificar", verifying:"Verificando…",
    invalid_id:"ID inválido — deve ter 10 dígitos",
    unnamed:"Conta sem nome", details:"Detalhes",
    no_context:"Sem contexto de IA — a IA usará somente os dados da conta",
    add_context:"Adicionar contexto para a IA",
    cid_hint:"Encontre em Google Ads → Admin → ID da conta",
    manage:"Gerenciar",
  },
  es: {
    title:"Cuentas", sub:"Administra tus cuentas de anuncios y contexto de IA.",
    new:"Nueva cuenta", no_accounts:"Sin cuentas aún",
    no_accounts_sub:"Crea tu primera cuenta para conectar anuncios y usar la IA.",
    create_first:"Crear primera cuenta",
    active_in_chat:"Activa en chat", use_in_chat:"Usar en chat",
    delete_confirm:"¿Eliminar esta cuenta? Esta acción no se puede deshacer.",
    deleted:"Cuenta eliminada", saving:"Guardando…", save:"Guardar",
    cancel:"Cancelar", create:"Crear cuenta", edit:"Editar cuenta",
    name_label:"Nombre", name_ph:"Clínica Premium, Nike MX…",
    website_label:"Sitio web", website_ph:"tusitio.com",
    desc_label:"Contexto para la IA", optional:"opcional",
    desc_ph:"¿Qué vende? ¿Quién es el público? Cualquier detalle que la IA debe saber…",
    desc_hint:"La IA usa esto como contexto en cada respuesta.",
    logo_label:"Logo", logo_hint:"PNG, JPG o SVG · Máx 2MB", remove_logo:"Quitar logo",
    platforms:"Conexiones de anuncios",
    connect:"Conectar", disconnect:"Desconectar", connecting:"Conectando…",
    soon:"Próximamente", connected:"Conectado", not_connected:"Sin conectar",
    active_label:"ACTIVO", select_account:"Cuenta de anuncios activa",
    cid_label:"Customer ID", cid_ph:"Ej: 512-522-3131",
    verify:"Verificar", verifying:"Verificando…",
    invalid_id:"ID inválido — debe tener 10 dígitos",
    unnamed:"Cuenta sin nombre", details:"Detalles",
    no_context:"Sin contexto de IA",
    add_context:"Agregar contexto para la IA",
    cid_hint:"En Google Ads → Admin → ID de cuenta",
    manage:"Administrar",
  },
  en: {
    title:"Accounts", sub:"Manage your ad accounts and AI context.",
    new:"New account", no_accounts:"No accounts yet",
    no_accounts_sub:"Create your first account to connect ads and use the AI.",
    create_first:"Create first account",
    active_in_chat:"Active in chat", use_in_chat:"Use in chat",
    delete_confirm:"Delete this account? This cannot be undone.",
    deleted:"Account deleted", saving:"Saving…", save:"Save",
    cancel:"Cancel", create:"Create account", edit:"Edit account",
    name_label:"Account name", name_ph:"FitCore US, Nike BR, Eluck MX…",
    website_label:"Website", website_ph:"yoursite.com",
    desc_label:"AI context", optional:"optional",
    desc_ph:"What does this account sell? Who's the audience? Any detail the AI should know…",
    desc_hint:"The AI reads this as context for every response on this account.",
    logo_label:"Logo", logo_hint:"PNG, JPG or SVG · Max 2MB", remove_logo:"Remove logo",
    platforms:"Ad connections",
    connect:"Connect", disconnect:"Disconnect", connecting:"Connecting…",
    soon:"Coming soon", connected:"Connected", not_connected:"Not connected",
    active_label:"ACTIVE", select_account:"Active ad account",
    cid_label:"Customer ID", cid_ph:"e.g. 512-522-3131",
    verify:"Verify", verifying:"Verifying…",
    invalid_id:"Invalid ID — must be 10 digits",
    unnamed:"Unnamed account", details:"Details",
    no_context:"No AI context — AI will use only account data",
    add_context:"Add AI context",
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
  e.currentTarget.style.borderColor = "rgba(14,165,233,0.55)";
  e.currentTarget.style.background  = "rgba(14,165,233,0.06)";
  e.currentTarget.style.boxShadow   = "0 0 0 1px rgba(14,165,233,0.15)";
};
const focusOff = (e: React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
  e.currentTarget.style.background  = IBG;
  e.currentTarget.style.boxShadow   = "none";
};
const iStyle: React.CSSProperties = {
  width:"100%", fontFamily:F, fontSize:14, color:"#f0f2f8",
  background:IBG, border:IBD, borderRadius:12,
  padding:"11px 14px", outline:"none", boxSizing:"border-box",
  transition:"border-color 0.2s, background 0.2s, box-shadow 0.2s",
};

const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 10000): Promise<T> => {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
};

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
  return <span style={{fontSize:14}}>📱</span>;
}

// ── Platform row ──────────────────────────────────────────────────────────────
function PlatformRow({ p, userId, accountId, t }: {
  p: typeof PLATFORMS[0]; userId:string; accountId:string; t: TStrings;
}) {
  const [conn, setConn]           = useState<any>(null);
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
      const all = (res?.connections || []) as any[];
      const match = all.find((c: any) => c.platform === p.id && c.persona_id === accountId) || null;
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
    } catch (e:any) {
      console.error("[AdBrief] connect:", e);
      toast.error("Erro ao conectar: " + (e?.message?.slice(0,80) || "tente novamente"));
      setConn2(false);
    }
  };

  const disconnect = async () => {
    if (!confirm(t.disconnect + " " + p.label + "?")) return;
    setDisc(true);
    try {
      const { error } = await supabase.from("platform_connections" as any).delete()
        .eq("user_id", userId).eq("platform", p.id).eq("persona_id", accountId);
      if (error) throw error;
      toast.success(p.label + " desconectado");
      setConn(null); setExpanded(false);
    } catch (e:any) {
      console.error("[AdBrief] disconnect:", e);
      toast.error("Erro ao desconectar — tente novamente");
    }
    setDisc(false);
  };

  const selectAcc = async (id: string) => {
    // Update DB (trigger only reverts token columns, selected_account_id passes through)
    await supabase.from("platform_connections" as any)
      .update({ selected_account_id: id })
      .eq("user_id", userId).eq("persona_id", accountId).eq("platform", p.id);
    // Update local state immediately — don't re-fetch (get_connections lacks this field)
    setConn((prev: any) => prev ? { ...prev, selected_account_id: id } : prev);
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
      const accs: any[] = conn?.ad_accounts || [];
      const newAcc = { id, name: vd.name || `Account ${id}`, currency: vd.currency };
      const updated = accs.find((a:any) => a.id === id)
        ? accs.map((a:any) => a.id === id ? newAcc : a)
        : [...accs, newAcc];
      const { error: updateErr } = await supabase.from("platform_connections" as any)
        .update({ ad_accounts:updated, selected_account_id:id })
        .eq("user_id",userId).eq("persona_id",accountId).eq("platform",p.id);
      if (updateErr) { toast.error("Erro ao salvar conta"); return; }
      toast.success(`✓ ${newAcc.name}${vd.currency ? " · " + vd.currency : ""}`);
      setCustId(""); setExpanded(false); load();
    } catch (e:any) {
      console.error("[AdBrief] verifyGoogle:", e);
      toast.error("Erro inesperado: " + (e?.message || "tente novamente"));
    }
    finally { setVerifying(false); }
  };

  const ads: any[] = conn?.ad_accounts || [];
  const selId = conn?.selected_account_id;
  const selAcc = ads.find(a => a.id === selId) || ads[0];

  if (loading) return (
    <div style={{ height:60, borderRadius:12, background:"rgba(255,255,255,0.04)", animation:"pulse 1.5s ease-in-out infinite" }} />
  );

  const isConnected = !!conn;
  const pc = p.color;

  return (
    <div style={{
      borderRadius:14,
      background: isConnected ? `linear-gradient(160deg,${pc}10 0%,rgba(255,255,255,0.03) 100%)` : "rgba(255,255,255,0.04)",
      border: `1px solid ${isConnected ? pc+"30" : "rgba(255,255,255,0.09)"}`,
      boxShadow: isConnected ? `0 0 0 1px ${pc}10 inset` : "none",
      overflow:"hidden", transition:"all 0.2s",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px" }}>
        <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
          background: isConnected ? `${pc}18` : "rgba(255,255,255,0.05)",
          border: `1px solid ${isConnected ? pc+"28" : "rgba(255,255,255,0.09)"}`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <PlatformIcon id={p.id}/>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
            <span style={{ fontFamily:F, fontSize:14, fontWeight:600,
              color: isConnected ? "#f0f2f8" : "rgba(255,255,255,0.5)" }}>{p.label}</span>
            {p.soon && (
              <span style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.3)",
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
                borderRadius:5, padding:"1px 7px", letterSpacing:"0.06em" }}>{t.soon}</span>
            )}
            {isConnected && !p.soon && (
              <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color:pc,
                background:`${pc}15`, border:`1px solid ${pc}28`, borderRadius:99,
                padding:"2px 8px", letterSpacing:"0.06em" }}>● {t.active_label}</span>
            )}
          </div>
          <p style={{ fontFamily:F, fontSize:12, color:"rgba(255,255,255,0.35)", margin:0,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {loadError
              ? "Erro ao carregar conexão"
              : isConnected
              ? (selAcc ? `${selAcc.name || selAcc.id}${ads.length>1?` · ${ads.length} contas`:""}` : t.connected)
              : t.not_connected}
          </p>
        </div>

        {/* Right actions */}
        {p.soon ? null : isConnected ? (
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setExpanded(e => !e)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:9,
                background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.11)",
                color:"rgba(255,255,255,0.6)", fontFamily:F, fontSize:12, fontWeight:500, cursor:"pointer",
                transition:"all 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.10)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)"}}>
              <ChevronDown size={12} style={{ transform: expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
              {t.manage}
            </button>
            <button onClick={disconnect} disabled={disconnecting}
              style={{ padding:"6px 9px", borderRadius:9, background:"rgba(239,68,68,0.07)",
                border:"1px solid rgba(239,68,68,0.18)", color:"#f87171", cursor:"pointer",
                display:"flex", alignItems:"center", transition:"all 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.14)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.07)"}}>
              {disconnecting ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>}
            </button>
          </div>
        ) : (
          <button onClick={connect} disabled={connecting}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:10,
              background:`linear-gradient(135deg,${BLUE},${CYAN})`, border:"none", color:"#fff",
              fontFamily:F, fontSize:13, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 16px rgba(14,165,233,0.35)", opacity:connecting?0.7:1, transition:"all 0.15s" }}>
            {connecting ? <Loader2 size={13} className="animate-spin"/> : <Link2 size={13}/>}
            {connecting ? t.connecting : t.connect}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {isConnected && expanded && (
        <div style={{ borderTop:`1px solid ${pc}18`, padding:"16px 16px 18px", background:"rgba(0,0,0,0.15)" }}>
          {/* Ad accounts */}
          {ads.length > 0 && (
            <div style={{ marginBottom: p.id==="google" ? 16 : 0 }}>
              <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)",
                textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>{t.select_account}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {ads.map((acc:any) => {
                  const isSel = acc.id === selId;
                  return (
                    <button key={acc.id} onClick={() => selectAcc(acc.id)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
                        background: isSel ? `${pc}12` : "rgba(255,255,255,0.04)",
                        border:`1px solid ${isSel ? pc+"30" : "rgba(255,255,255,0.08)"}`,
                        cursor:"pointer", textAlign:"left", transition:"all 0.12s", width:"100%" }}>
                      <div style={{ width:16, height:16, borderRadius:"50%",
                        border:`2px solid ${isSel ? pc : "rgba(255,255,255,0.2)"}`,
                        background: isSel ? pc : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {isSel && <Check size={9} color="#fff" strokeWidth={3}/>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontFamily:F, fontSize:13, fontWeight:isSel?600:400,
                          color: isSel?"#f0f2f8":"rgba(255,255,255,0.55)", margin:0,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {acc.name || acc.id}
                        </p>
                        <p style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.28)", margin:"1px 0 0" }}>{acc.id}</p>
                      </div>
                      {isSel && <CheckCircle2 size={13} color={pc}/>}
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
                <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)",
                  textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 3px" }}>{t.cid_label}</p>
                <p style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.25)", margin:0 }}>
                  O Google não compartilha a conta automaticamente — é preciso informar o ID
                </p>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                <input value={custId} onChange={e=>setCustId(e.target.value)}
                  placeholder={t.cid_ph}
                  id="google-ads-customer-id"
                  name="googleAdsCustomerId"
                  style={{ ...iStyle, flex:1, padding:"9px 12px", fontSize:13, borderRadius:10 }}
                  onFocus={focusOn as any} onBlur={focusOff as any}
                  onKeyDown={e=>{ if(e.key==="Enter") verifyGoogle(); }}
                />
                <button onClick={verifyGoogle} disabled={verifying || !custId.trim()}
                  style={{ padding:"9px 16px", borderRadius:10, whiteSpace:"nowrap",
                    background: custId.trim() ? `linear-gradient(135deg,${BLUE},${CYAN})` : "rgba(255,255,255,0.05)",
                    border:"none", color: custId.trim() ? "#fff" : "rgba(255,255,255,0.25)",
                    fontFamily:F, fontSize:13, fontWeight:700, cursor: custId.trim()?"pointer":"not-allowed",
                    boxShadow: custId.trim()?"0 4px 12px rgba(14,165,233,0.3)":"none", transition:"all 0.15s" }}>
                  {verifying ? <Loader2 size={13} className="animate-spin" style={{display:"block"}}/> : t.verify}
                </button>
              </div>
              <p style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.22)", margin:"6px 0 0", lineHeight:1.5 }}>
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

// ── Account form (inline) ─────────────────────────────────────────────────────
function AccountForm({ account, userId, t, onSave, onCancel }: {
  account?: any; userId:string; t: TStrings;
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
        toast.success("Logo salvo");
      }
    } catch (e: any) {
      toast.error("Upload falhou: " + (e?.message || "tente novamente"));
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
    } catch { toast.error("Error saving"); }
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
            background: logo ? "transparent" : "rgba(255,255,255,0.04)",
            border: `2px dashed ${logo ? "transparent" : "rgba(255,255,255,0.15)"}`,
            display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
          onMouseEnter={e=>{ if(!logo) (e.currentTarget as HTMLElement).style.borderColor="rgba(14,165,233,0.4)"; }}
          onMouseLeave={e=>{ if(!logo) (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.15)"; }}>
          {uploading ? <Loader2 size={16} color="rgba(255,255,255,0.4)" className="animate-spin"/>
            : logo ? <img src={logo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ textAlign:"center" }}>
                <Upload size={16} color="rgba(255,255,255,0.3)"/>
                <p style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.25)", margin:"3px 0 0" }}>Logo</p>
              </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}/>

        {/* Name */}
        <div style={{ flex:1 }}>
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.55)",
            textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:7 }}>
            {t.name_label}
          </label>
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder={t.name_ph} autoFocus style={iStyle}
            onFocus={focusOn as any} onBlur={focusOff as any}/>
          {logo && (
            <button onClick={()=>setLogo("")}
              style={{ marginTop:6, fontFamily:F, fontSize:11, color:"rgba(248,113,113,0.65)",
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
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.55)",
            textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.website_label}</label>
          <span style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.25)" }}>{t.optional}</span>
        </div>
        <div style={{ position:"relative" }}>
          <Globe size={13} color="rgba(255,255,255,0.3)"
            style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
          <input value={website} onChange={e=>setWebsite(e.target.value)}
            placeholder={t.website_ph}
            style={{ ...iStyle, paddingLeft:36 }}
            onFocus={focusOn as any} onBlur={focusOff as any}/>
        </div>
      </div>

      {/* AI context — optional */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
          <label style={{ fontFamily:F, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.55)",
            textTransform:"uppercase", letterSpacing:"0.06em" }}>{t.desc_label}</label>
          <span style={{ fontFamily:F, fontSize:11, color:"rgba(255,255,255,0.25)" }}>{t.optional}</span>
        </div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder={t.desc_ph} rows={4}
          style={{ ...iStyle, resize:"none", lineHeight:1.65 }}
          onFocus={focusOn as any} onBlur={focusOff as any}/>
        <p style={{ fontFamily:F, fontSize:12, color:"rgba(255,255,255,0.25)", margin:"6px 0 0" }}>{t.desc_hint}</p>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, paddingTop:4 }}>
        <button onClick={save} disabled={saving || !name.trim()}
          style={{ flex:1, height:46, borderRadius:12, border:"none",
            cursor: name.trim() ? "pointer" : "not-allowed",
            background: name.trim() ? `linear-gradient(135deg,${BLUE},${CYAN})` : "rgba(255,255,255,0.06)",
            color: name.trim() ? "#fff" : "rgba(255,255,255,0.25)",
            fontFamily:F, fontSize:14, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
            boxShadow: name.trim() ? "0 4px 20px rgba(14,165,233,0.35)" : "none",
            transition:"all 0.2s" }}>
          {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
          {saving ? t.saving : (account?.id ? t.save : t.create)}
        </button>
        <button onClick={onCancel}
          style={{ padding:"0 22px", height:46, borderRadius:12, background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.55)",
            fontFamily:F, fontSize:14, fontWeight:500, cursor:"pointer", transition:"all 0.15s" }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.09)"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"}}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { user, selectedPersona, setSelectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = T[(language as Lang)] || T.pt;
  const [searchParams] = useSearchParams();

  const [accounts, setAccounts]   = useState<any[]>([]);
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

      const list = (data || []) as any[];
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

  const activate = (acc: any) => {
    setSelectedPersona({ ...acc } as any);
    toast.success(acc.name + " ativada no chat");
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
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300 }}>
      <Loader2 size={20} color="rgba(255,255,255,0.3)" className="animate-spin"/>
    </div>
  );

  if (!user) return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"clamp(16px,4vw,36px)", fontFamily:F }}>
      <div style={{ borderRadius:16, padding:"16px 18px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)" }}>
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#fca5a5" }}>Não foi possível abrir Accounts</p>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(255,255,255,0.55)" }}>Sua sessão não está disponível no momento.</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"clamp(16px,4vw,36px)", fontFamily:F }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32, gap:12, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ margin:0, fontSize:"clamp(20px,3vw,26px)", fontWeight:800, color:"#f0f2f8", letterSpacing:"-0.03em" }}>{t.title}</h1>
          <p style={{ margin:"5px 0 0", fontSize:13, color:"rgba(255,255,255,0.4)" }}>{t.sub}</p>
        </div>
        {!creating && (
          <button onClick={() => { setCreating(true); setEditingId(null); setOpenId(null); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:12,
              background:`linear-gradient(135deg,${BLUE},${CYAN})`, border:"none", color:"#fff",
              fontFamily:F, fontSize:13, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 20px rgba(14,165,233,0.35)", whiteSpace:"nowrap" }}>
            <Plus size={14}/>{t.new}
          </button>
        )}
      </div>

      {/* ── Create new form ── */}
      {creating && (
        <div style={{ borderRadius:20, background:CARD, border:"1px solid rgba(14,165,233,0.28)",
          boxShadow:`${SHD}, 0 0 60px rgba(14,165,233,0.06)`, backdropFilter:"blur(20px)",
          padding:"clamp(20px,4vw,32px)", marginBottom:16, animation:"fadeUp 0.25s ease" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
            <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"#f0f2f8", letterSpacing:"-0.02em" }}>{t.new}</h2>
            <button onClick={() => setCreating(false)}
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)",
                borderRadius:8, padding:"5px 7px", cursor:"pointer", color:"rgba(255,255,255,0.5)", display:"flex" }}>
              <X size={14}/>
            </button>
          </div>
          <AccountForm userId={user.id} t={t}
            onSave={() => { load(); setCreating(false); }}
            onCancel={() => setCreating(false)}/>
        </div>
      )}

      {loadError && !creating && (
        <div style={{ marginBottom:16, borderRadius:16, padding:"16px 18px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#fca5a5" }}>Erro ao carregar Accounts</p>
            <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(255,255,255,0.55)" }}>{loadError}</p>
          </div>
          <button onClick={() => load()}
            style={{ padding:"9px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontFamily:F, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {accounts.length === 0 && !creating && !loadError && (
        <div style={{ textAlign:"center", padding:"64px 24px", borderRadius:20,
          background:CARD, border:"1px solid rgba(255,255,255,0.10)",
          boxShadow:SHD, backdropFilter:"blur(16px)", animation:"fadeUp 0.3s ease" }}>
          <div style={{ width:56, height:56, borderRadius:16, background:"rgba(14,165,233,0.10)",
            border:"1px solid rgba(14,165,233,0.20)", display:"flex", alignItems:"center",
            justifyContent:"center", margin:"0 auto 20px" }}>
            <Building2 size={24} color={BLUE}/>
          </div>
          <h3 style={{ margin:"0 0 8px", fontSize:18, fontWeight:700, color:"#f0f2f8", letterSpacing:"-0.02em" }}>{t.no_accounts}</h3>
          <p style={{ margin:"0 0 24px", fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>{t.no_accounts_sub}</p>
          <button onClick={() => setCreating(true)}
            style={{ padding:"10px 26px", borderRadius:12, background:`linear-gradient(135deg,${BLUE},${CYAN})`,
              border:"none", color:"#fff", fontFamily:F, fontSize:14, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 20px rgba(14,165,233,0.35)" }}>
            {t.create_first}
          </button>
        </div>
      )}

      {/* ── Account cards (accordion) ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {accounts.map(acc => {
          const isOpen    = openId === acc.id;
          const isActive  = selectedPersona?.id === acc.id;
          const isEditing = editingId === acc.id;
          const isDel     = deleting === acc.id;

          return (
            <div key={acc.id} style={{
              borderRadius:18,
              background: isOpen ? CARD : "rgba(255,255,255,0.04)",
              border: `1px solid ${isOpen ? (isActive ? "rgba(14,165,233,0.30)" : "rgba(255,255,255,0.13)") : "rgba(255,255,255,0.08)"}`,
              boxShadow: isOpen ? SHD : "none",
              backdropFilter: isOpen ? "blur(16px)" : "none",
              overflow:"hidden",
              transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}>

              {/* ── Card header — always visible, clickable ── */}
              <button onClick={() => { setOpenId(isOpen ? null : acc.id); setEditingId(null); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px 18px",
                  background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                {/* Avatar */}
                <AccountAvatar name={acc.name||"?"} logoUrl={acc.logo_url} size={44} radius={12}/>

                {/* Name + meta */}
                <div style={{ flex:1, minWidth:0, textAlign:"left" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontFamily:F, fontSize:15, fontWeight:isOpen?700:500,
                      color: isOpen ? "#f0f2f8" : "rgba(255,255,255,0.65)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {acc.name || t.unnamed}
                    </span>
                    {isActive && (
                      <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color:BLUE,
                        background:"rgba(14,165,233,0.12)", border:"1px solid rgba(14,165,233,0.25)",
                        borderRadius:99, padding:"2px 8px", letterSpacing:"0.05em", flexShrink:0 }}>
                        ● {t.active_in_chat}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily:F, fontSize:12, color:"rgba(255,255,255,0.3)", margin:0,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {acc.website || (acc.description ? acc.description.slice(0,48)+"…" : t.no_context)}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronDown size={16} color="rgba(255,255,255,0.3)"
                  style={{ flexShrink:0, transform:isOpen?"rotate(180deg)":"none", transition:"transform 0.25s" }}/>
              </button>

              {/* ── Expanded content ── */}
              {isOpen && (
                <div style={{ animation:"slideDown 0.2s ease" }}>
                  <div style={{ height:"1px", background:"rgba(255,255,255,0.07)", margin:"0 18px" }}/>

                  {isEditing ? (
                    /* Edit form */
                    <div style={{ padding:"20px 18px 22px" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f0f2f8" }}>{t.edit}</h3>
                        <button onClick={() => setEditingId(null)}
                          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)",
                            borderRadius:7, padding:"4px 6px", cursor:"pointer", color:"rgba(255,255,255,0.5)", display:"flex" }}>
                          <X size={13}/>
                        </button>
                      </div>
                      <AccountForm account={acc} userId={user.id} t={t}
                        onSave={() => { load(); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}/>
                    </div>
                  ) : (
                    /* Detail view */
                    <div style={{ padding:"20px 18px 22px", display:"flex", flexDirection:"column", gap:20 }}>

                      {/* Action bar */}
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        {!isActive && (
                          <button onClick={() => activate(acc)}
                            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:10,
                              background:`linear-gradient(135deg,${BLUE},${CYAN})`, border:"none", color:"#fff",
                              fontFamily:F, fontSize:13, fontWeight:700, cursor:"pointer",
                              boxShadow:"0 4px 14px rgba(14,165,233,0.3)" }}>
                            <CheckCircle2 size={13}/>{t.use_in_chat}
                          </button>
                        )}
                        <button onClick={() => setEditingId(acc.id)}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:10,
                            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.11)",
                            color:"rgba(255,255,255,0.65)", fontFamily:F, fontSize:13, fontWeight:500, cursor:"pointer" }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.10)"}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.06)"}}>
                          <Pencil size={12}/>{t.edit}
                        </button>
                        <div style={{ flex:1 }}/>
                        <button onClick={() => del(acc.id, acc.name)} disabled={isDel}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 12px", borderRadius:10,
                            background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.18)",
                            color:"#f87171", cursor:"pointer", fontFamily:F, fontSize:13 }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.14)"}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(239,68,68,0.07)"}}>
                          {isDel ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                        </button>
                      </div>

                      {/* AI context */}
                      {acc.description ? (
                        <div>
                          <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)",
                            textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 8px" }}>{t.desc_label}</p>
                          <p style={{ fontFamily:F, fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7,
                            margin:0, padding:"12px 14px", background:"rgba(255,255,255,0.04)",
                            border:"1px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
                            {acc.description}
                          </p>
                        </div>
                      ) : (
                        <button onClick={() => setEditingId(acc.id)}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px", borderRadius:10,
                            background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.10)",
                            cursor:"pointer", width:"100%", textAlign:"left" }}>
                          <AlertCircle size={13} color="rgba(255,255,255,0.2)"/>
                          <span style={{ fontFamily:F, fontSize:12, color:"rgba(255,255,255,0.35)" }}>{t.add_context}</span>
                        </button>
                      )}

                      {/* Website */}
                      {acc.website && (
                        <div>
                          <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)",
                            textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 6px" }}>{t.website_label}</p>
                          <a href={acc.website.startsWith("http") ? acc.website : `https://${acc.website}`}
                            target="_blank" rel="noreferrer"
                            style={{ fontFamily:F, fontSize:13, color:"rgba(14,165,233,0.75)", textDecoration:"none",
                              display:"inline-flex", alignItems:"center", gap:5 }}>
                            <Globe size={12}/>{acc.website}
                          </a>
                        </div>
                      )}

                      {/* Platform connections */}
                      <div>
                        <p style={{ fontFamily:F, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)",
                          textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 10px" }}>{t.platforms}</p>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          {PLATFORMS.map(p => (
                            <PlatformRow key={`${p.id}-${acc.id}-${platformRefreshKey}`} p={p}
                              userId={user.id} accountId={acc.id} t={t}/>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add another account (bottom) ── */}
      {accounts.length > 0 && !creating && (
        <button onClick={() => { setCreating(true); setOpenId(null); }}
          style={{ marginTop:12, display:"flex", alignItems:"center", gap:7, padding:"11px 18px",
            borderRadius:12, background:"transparent", border:"1px dashed rgba(255,255,255,0.12)",
            color:"rgba(255,255,255,0.35)", fontFamily:F, fontSize:13, fontWeight:500,
            cursor:"pointer", width:"100%", justifyContent:"center", transition:"all 0.15s" }}
          onMouseEnter={e=>{
            (e.currentTarget as HTMLElement).style.borderColor="rgba(14,165,233,0.35)";
            (e.currentTarget as HTMLElement).style.color=BLUE;
          }}
          onMouseLeave={e=>{
            (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.12)";
            (e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.35)";
          }}>
          <Plus size={14}/>{t.new}
        </button>
      )}
    </div>
  );
}
