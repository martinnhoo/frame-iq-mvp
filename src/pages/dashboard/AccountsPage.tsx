import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Globe, Upload, Loader2, Save, X, CheckCircle2, ChevronRight, Building2, Link2, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

// ── Design tokens (Login style) ─────────────────────────────────────────────
const F = "'Plus Jakarta Sans', sans-serif";
const BLUE = "#0ea5e9", CYAN = "#06b6d4";
const CARD_BG  = "linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)";
const CARD_SHD = "0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.35)";
const INPUT_BG = "rgba(255,255,255,0.06)";
const INPUT_BD = "1px solid rgba(255,255,255,0.12)";

// ── Translations ─────────────────────────────────────────────────────────────
const T = {
  pt: {
    title: "Contas", sub: "Cada conta tem seus próprios anúncios e contexto de IA.",
    new: "Nova conta", no_accounts: "Nenhuma conta ainda",
    no_accounts_sub: "Crie sua primeira conta para conectar anúncios e usar a IA.",
    create_first: "Criar primeira conta",
    active_badge: "Ativa no chat", set_active: "Usar no chat",
    delete_confirm: "Excluir esta conta? Essa ação não pode ser desfeita.",
    deleted: "Conta excluída", saving: "Salvando...", save: "Salvar",
    cancel: "Cancelar", create: "Criar conta", edit: "Editar",
    name_label: "Nome da conta", name_ph: "Ambulatório Premium, Nike BR, Eluck MX…",
    website_label: "Website", website_ph: "seusite.com.br",
    desc_label: "Contexto para a IA",
    desc_ph: "O que essa conta vende? Quem é o público? Qualquer detalhe que a IA deve saber ao responder…",
    desc_hint: "A IA lê isso como contexto em todas as respostas.",
    logo_label: "Logo da conta", logo_hint: "PNG, JPG ou SVG · Máx 2MB",
    platforms_title: "Plataformas conectadas",
    connect: "Conectar", disconnect: "Desconectar", connecting: "Conectando…",
    soon: "Em breve", connected: "Conectado", not_connected: "Não conectado",
    active_label: "ATIVO", select_account: "Selecionar conta de anúncios",
    no_ad_accounts: "Nenhuma conta de anúncios encontrada",
    customer_id_label: "Customer ID do Google Ads",
    customer_id_ph: "Ex: 512-522-3131",
    verify: "Verificar", verifying: "Verificando…",
    invalid_id: "ID inválido — deve ter 10 dígitos",
    remove_logo: "Remover logo", optional: "opcional",
    unnamed: "Conta sem nome",
    details_title: "Detalhes da conta",
    connections_title: "Conexões de anúncios",
  },
  es: {
    title: "Cuentas", sub: "Cada cuenta tiene sus propios anuncios y contexto de IA.",
    new: "Nueva cuenta", no_accounts: "Sin cuentas aún",
    no_accounts_sub: "Crea tu primera cuenta para conectar anuncios y usar la IA.",
    create_first: "Crear primera cuenta",
    active_badge: "Activa en chat", set_active: "Usar en chat",
    delete_confirm: "¿Eliminar esta cuenta? Esta acción no se puede deshacer.",
    deleted: "Cuenta eliminada", saving: "Guardando…", save: "Guardar",
    cancel: "Cancelar", create: "Crear cuenta", edit: "Editar",
    name_label: "Nombre de la cuenta", name_ph: "Clínica Premium, Nike MX, Eluck MX…",
    website_label: "Sitio web", website_ph: "tusitio.com",
    desc_label: "Contexto para la IA",
    desc_ph: "¿Qué vende esta cuenta? ¿Quién es el público? Cualquier detalle que la IA debe saber…",
    desc_hint: "La IA lee esto como contexto en todas las respuestas.",
    logo_label: "Logo de la cuenta", logo_hint: "PNG, JPG o SVG · Máx 2MB",
    platforms_title: "Plataformas conectadas",
    connect: "Conectar", disconnect: "Desconectar", connecting: "Conectando…",
    soon: "Próximamente", connected: "Conectado", not_connected: "Sin conectar",
    active_label: "ACTIVO", select_account: "Seleccionar cuenta de anuncios",
    no_ad_accounts: "No se encontraron cuentas de anuncios",
    customer_id_label: "Customer ID de Google Ads",
    customer_id_ph: "Ej: 512-522-3131",
    verify: "Verificar", verifying: "Verificando…",
    invalid_id: "ID inválido — debe tener 10 dígitos",
    remove_logo: "Quitar logo", optional: "opcional",
    unnamed: "Cuenta sin nombre",
    details_title: "Detalles de la cuenta",
    connections_title: "Conexiones de anuncios",
  },
  en: {
    title: "Accounts", sub: "Each account has its own ads and AI context.",
    new: "New account", no_accounts: "No accounts yet",
    no_accounts_sub: "Create your first account to connect ads and use the AI.",
    create_first: "Create first account",
    active_badge: "Active in chat", set_active: "Use in chat",
    delete_confirm: "Delete this account? This cannot be undone.",
    deleted: "Account deleted", saving: "Saving…", save: "Save",
    cancel: "Cancel", create: "Create account", edit: "Edit",
    name_label: "Account name", name_ph: "FitCore US, Nike BR, Eluck MX…",
    website_label: "Website", website_ph: "yoursite.com",
    desc_label: "AI context",
    desc_ph: "What does this account sell? Who is the audience? Any detail the AI should know…",
    desc_hint: "The AI reads this as context for every response.",
    logo_label: "Account logo", logo_hint: "PNG, JPG or SVG · Max 2MB",
    platforms_title: "Connected platforms",
    connect: "Connect", disconnect: "Disconnect", connecting: "Connecting…",
    soon: "Coming soon", connected: "Connected", not_connected: "Not connected",
    active_label: "ACTIVE", select_account: "Select ad account",
    no_ad_accounts: "No ad accounts found",
    customer_id_label: "Google Ads Customer ID",
    customer_id_ph: "e.g. 512-522-3131",
    verify: "Verify", verifying: "Verifying…",
    invalid_id: "Invalid ID — must be 10 digits",
    remove_logo: "Remove logo", optional: "optional",
    unnamed: "Unnamed account",
    details_title: "Account details",
    connections_title: "Ad connections",
  },
} as const;

// ── Platform config ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "meta",   label: "Meta Ads",   color: "#1877F2", fn: "meta-oauth",   soon: false },
  { id: "google", label: "Google Ads", color: "#4285F4", fn: "google-oauth", soon: false },
  { id: "tiktok", label: "TikTok Ads", color: "#ffffff", fn: "tiktok-oauth", soon: true  },
];

const PlatformIcon = ({ id }: { id: string }) => {
  if (id === "meta") return (
    <svg width="18" height="12" viewBox="0 0 36 18" fill="none">
      <path d="M8.5 0C5.5 0 3.2 1.6 1.6 3.8 0.6 5.2 0 7 0 9c0 2 0.6 3.8 1.6 5.2C3.2 16.4 5.5 18 8.5 18c2.2 0 4-0.9 5.5-2.4L18 12l4 3.6C23.5 17.1 25.3 18 27.5 18c3 0 5.3-1.6 6.9-3.8 1-1.4 1.6-3.2 1.6-5.2 0-2-0.6-3.8-1.6-5.2C32.8 1.6 30.5 0 27.5 0c-2.2 0-4 0.9-5.5 2.4L18 6l-4-3.6C12.5 0.9 10.7 0 8.5 0z" fill="#1877F2"/>
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
  return <span style={{ fontSize: 14 }}>📱</span>;
};

// ── Input component ──────────────────────────────────────────────────────────
function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <label style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        {optional && <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>opcional</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", fontFamily: F, fontSize: 14, color: "#f0f2f8",
  background: INPUT_BG, border: INPUT_BD, borderRadius: 12,
  padding: "11px 14px", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
};

// ── Platform row ─────────────────────────────────────────────────────────────
function PlatformRow({ p, userId, accountId, language, t }: {
  p: typeof PLATFORMS[0]; userId: string; accountId: string;
  language: string; t: typeof T.en;
}) {
  const [conn, setConn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("platform_connections_safe" as any)
      .select("id, platform, ad_accounts, selected_account_id, connection_label, connected_at")
      .eq("user_id", userId).eq("persona_id", accountId).eq("platform", p.id).eq("status", "active")
      .maybeSingle();
    setConn(data || null);
    setLoading(false);
  }, [userId, accountId, p.id]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data } = await supabase.functions.invoke(p.fn, {
        body: { action: "get_auth_url", user_id: userId, persona_id: accountId },
      });
      if (data?.url) window.location.href = data.url;
      else toast.error(t.connect + " failed");
    } catch { toast.error(t.connect + " failed"); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!confirm(t.disconnect + " " + p.label + "?")) return;
    setDisconnecting(true);
    await supabase.from("platform_connections" as any).delete()
      .eq("user_id", userId).eq("platform", p.id).eq("persona_id", accountId);
    toast.success(t.disconnect + "ed");
    setConn(null);
    setDisconnecting(false);
  };

  const selectAdAccount = async (accId: string) => {
    await supabase.from("platform_connections" as any)
      .update({ selected_account_id: accId })
      .eq("user_id", userId).eq("persona_id", accountId).eq("platform", p.id);
    load();
  };

  const verifyGoogle = async () => {
    const id = customerId.trim().replace(/-/g, "");
    if (!/^\d{10}$/.test(id)) { toast.error(t.invalid_id); return; }
    setVerifying(true);
    try {
      const { data: vd } = await supabase.functions.invoke("verify-google-account", {
        body: { user_id: userId, persona_id: accountId, customer_id: id },
      });
      if (!vd?.valid) {
        toast.error(vd?.reason === "not_found" ? "Account not found" : vd?.reason === "no_access" ? "No access" : t.invalid_id);
        return;
      }
      const accs = conn?.ad_accounts || [];
      const newAcc = { id, name: vd.name || `Account ${id}` };
      const updated = accs.find((a: any) => a.id === id)
        ? accs.map((a: any) => a.id === id ? newAcc : a)
        : [...accs, newAcc];
      await supabase.from("platform_connections" as any)
        .update({ ad_accounts: updated, selected_account_id: id })
        .eq("user_id", userId).eq("persona_id", accountId).eq("platform", p.id);
      toast.success(`✓ ${newAcc.name}`);
      setCustomerId("");
      setExpanded(false);
      load();
    } catch { toast.error("Error verifying"); }
    finally { setVerifying(false); }
  };

  const connected = !!conn;
  const adAccounts: any[] = conn?.ad_accounts || [];
  const selId = conn?.selected_account_id;
  const selAcc = adAccounts.find(a => a.id === selId) || adAccounts[0];

  if (loading) return (
    <div style={{ height: 56, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );

  return (
    <div style={{
      borderRadius: 14,
      background: connected ? `linear-gradient(160deg,${p.color}10 0%,rgba(255,255,255,0.03) 100%)` : CARD_BG,
      border: `1px solid ${connected ? p.color + "35" : "rgba(255,255,255,0.10)"}`,
      boxShadow: connected ? `0 0 0 1px ${p.color}12 inset, 0 4px 20px ${p.color}10` : CARD_SHD,
      backdropFilter: "blur(12px)",
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: connected ? `${p.color}18` : "rgba(255,255,255,0.05)",
          border: `1px solid ${connected ? p.color + "30" : "rgba(255,255,255,0.10)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <PlatformIcon id={p.id} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
            <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: connected ? "#f0f2f8" : "rgba(255,255,255,0.5)" }}>
              {p.label}
            </span>
            {p.soon && (
              <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.06em" }}>
                {t.soon}
              </span>
            )}
            {connected && !p.soon && (
              <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: p.color, background: `${p.color}15`, border: `1px solid ${p.color}30`, borderRadius: 99, padding: "2px 8px", letterSpacing: "0.06em" }}>
                ● {t.active_label}
              </span>
            )}
          </div>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {connected ? (selAcc ? `${selAcc.name || selAcc.id}${adAccounts.length > 1 ? ` · ${adAccounts.length} contas` : ""}` : t.connected) : t.not_connected}
          </p>
        </div>

        {/* Action button */}
        {!p.soon && (
          connected ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontFamily: F, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}>
                {expanded ? <X size={12} /> : <ChevronRight size={12} />}
                {expanded ? t.cancel : "Gerenciar"}
              </button>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                style={{ padding: "7px 10px", borderRadius: 9, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#f87171", fontFamily: F, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}>
                {disconnecting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                {t.disconnect}
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: `linear-gradient(135deg,${BLUE},${CYAN})`, border: "none", color: "#fff", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(14,165,233,0.35)", transition: "all 0.15s", opacity: connecting ? 0.7 : 1 }}>
              {connecting ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              {connecting ? t.connecting : t.connect}
            </button>
          )
        )}
      </div>

      {/* Expanded panel — ad account management */}
      {connected && expanded && (
        <div style={{ borderTop: `1px solid ${p.color}18`, padding: "16px", background: "rgba(0,0,0,0.15)" }}>
          {/* Ad accounts list */}
          {adAccounts.length > 0 && (
            <div style={{ marginBottom: p.id === "google" ? 14 : 0 }}>
              <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
                {t.select_account}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {adAccounts.map((acc: any) => {
                  const isSel = acc.id === selId;
                  return (
                    <button key={acc.id}
                      onClick={() => selectAdAccount(acc.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: isSel ? `${p.color}12` : "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? p.color + "35" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSel ? p.color : "rgba(255,255,255,0.2)"}`, background: isSel ? p.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSel && <Check size={9} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: F, fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? "#f0f2f8" : "rgba(255,255,255,0.6)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {acc.name || acc.id}
                        </p>
                        <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "1px 0 0" }}>{acc.id}</p>
                      </div>
                      {isSel && <CheckCircle2 size={14} color={p.color} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Google: manual customer ID input */}
          {p.id === "google" && (
            <div>
              <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
                {t.customer_id_label}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  placeholder={t.customer_id_ph}
                  style={{ ...inputStyle, flex: 1, padding: "9px 12px", fontSize: 13, borderRadius: 10 }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.55)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(14,165,233,0.15)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = INPUT_BG; e.currentTarget.style.boxShadow = "none"; }}
                  onKeyDown={e => { if (e.key === "Enter") verifyGoogle(); }}
                />
                <button
                  onClick={verifyGoogle}
                  disabled={verifying || !customerId.trim()}
                  style={{ padding: "9px 16px", borderRadius: 10, background: customerId.trim() ? `linear-gradient(135deg,${BLUE},${CYAN})` : "rgba(255,255,255,0.05)", border: "none", color: customerId.trim() ? "#fff" : "rgba(255,255,255,0.25)", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: customerId.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", boxShadow: customerId.trim() ? "0 4px 12px rgba(14,165,233,0.3)" : "none", transition: "all 0.15s" }}>
                  {verifying ? <Loader2 size={13} className="animate-spin" style={{ display: "block" }} /> : t.verify}
                </button>
              </div>
              <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "6px 0 0" }}>
                {p.id === "google" ? "Encontre em Google Ads → Administrador → ID da conta" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Account form ─────────────────────────────────────────────────────────────
function AccountForm({ account, userId, language, t, onSave, onCancel }: {
  account?: any; userId: string; language: string; t: typeof T.en;
  onSave: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name || "");
  const [website, setWebsite] = useState(account?.website || "");
  const [description, setDescription] = useState(account?.description || "");
  const [logoUrl, setLogoUrl] = useState(account?.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), website: website.trim() || null, description: description.trim() || null, logo_url: logoUrl || null };
      if (account?.id) {
        await supabase.from("personas").update(payload).eq("id", account.id);
      } else {
        await supabase.from("personas").insert({ ...payload, user_id: userId });
      }
      toast.success(account?.id ? t.save + "d" : t.create + "d");
      onSave();
    } catch { toast.error("Error saving"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Logo upload */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div
          role="button" tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
          style={{ width: 68, height: 68, borderRadius: 14, flexShrink: 0, overflow: "hidden", cursor: "pointer", background: logoUrl ? "transparent" : "rgba(255,255,255,0.04)", border: `2px dashed ${logoUrl ? "transparent" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          onMouseEnter={e => { if (!logoUrl) (e.currentTarget as HTMLElement).style.borderColor = `rgba(14,165,233,0.45)`; }}
          onMouseLeave={e => { if (!logoUrl) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; }}>
          {uploading ? <Loader2 size={16} color="rgba(255,255,255,0.4)" className="animate-spin" /> :
            logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <div style={{ textAlign: "center" }}>
                <Upload size={16} color="rgba(255,255,255,0.3)" />
                <p style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.25)", margin: "3px 0 0" }}>Logo</p>
              </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        <div>
          <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)", margin: "0 0 3px" }}>{t.logo_label}</p>
          <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.5 }}>{t.logo_hint}</p>
          {logoUrl && (
            <button onClick={() => setLogoUrl("")} style={{ marginTop: 6, fontFamily: F, fontSize: 12, color: "rgba(248,113,113,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
              <X size={10} />{t.remove_logo}
            </button>
          )}
        </div>
      </div>

      {/* Account name — required */}
      <Field label={t.name_label}>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder={t.name_ph} autoFocus
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.55)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(14,165,233,0.15)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = INPUT_BG; e.currentTarget.style.boxShadow = "none"; }}
        />
      </Field>

      {/* Website — optional */}
      <Field label={t.website_label} optional>
        <div style={{ position: "relative" }}>
          <Globe size={13} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={website} onChange={e => setWebsite(e.target.value)}
            placeholder={t.website_ph}
            style={{ ...inputStyle, paddingLeft: 36 }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.55)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(14,165,233,0.15)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = INPUT_BG; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
      </Field>

      {/* AI context description — optional */}
      <Field label={t.desc_label} optional>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder={t.desc_ph} rows={4}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.65 }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.55)"; e.currentTarget.style.background = "rgba(14,165,233,0.06)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(14,165,233,0.15)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = INPUT_BG; e.currentTarget.style.boxShadow = "none"; }}
        />
        <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.25)", margin: "6px 0 0" }}>{t.desc_hint}</p>
      </Field>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
        <button onClick={save} disabled={saving || !name.trim()}
          style={{ flex: 1, height: 46, borderRadius: 12, border: "none", cursor: name.trim() ? "pointer" : "not-allowed", background: name.trim() ? `linear-gradient(135deg,${BLUE},${CYAN})` : "rgba(255,255,255,0.06)", color: name.trim() ? "#fff" : "rgba(255,255,255,0.25)", fontFamily: F, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: name.trim() ? "0 4px 20px rgba(14,165,233,0.35)" : "none", transition: "all 0.2s" }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? t.saving : (account?.id ? t.save : t.create)}
        </button>
        <button onClick={onCancel}
          style={{ padding: "0 20px", height: 46, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)", fontFamily: F, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { user, selectedPersona, setSelectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const t = T[language as keyof typeof T] || T.pt;

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "new" | "edit" | "connections">("list");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPersona?.id) setSelectedId(selectedPersona.id);
  }, [selectedPersona?.id]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("personas").select("id, user_id, name, logo_url, website, description, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: true });
    const list = (data || []) as any[];
    setAccounts(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
      setSelectedPersona({ ...list[0] } as any);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const activateAccount = (acc: any) => {
    setSelectedId(acc.id);
    setSelectedPersona({ ...acc } as any);
  };

  const deleteAccount = async (id: string) => {
    if (!confirm(t.delete_confirm)) return;
    setDeleting(id);
    await supabase.from("personas").delete().eq("id", id);
    toast.success(t.deleted);
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedPersona(null);
    }
    setView("list");
    load();
    setDeleting(null);
  };

  const selectedAcc = accounts.find(a => a.id === selectedId);

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <Loader2 size={20} color="rgba(255,255,255,0.3)" className="animate-spin" />
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <Loader2 size={20} color="rgba(255,255,255,0.3)" className="animate-spin" />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(16px,4vw,32px)", fontFamily: F }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#f0f2f8", letterSpacing: "-0.03em" }}>{t.title}</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.sub}</p>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 12, background: `linear-gradient(135deg,${BLUE},${CYAN})`, border: "none", color: "#fff", fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(14,165,233,0.35)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            <Plus size={15} />{t.new}
          </button>
        )}
      </div>

      {/* Empty state */}
      {accounts.length === 0 && view !== "new" && (
        <div style={{ textAlign: "center", padding: "64px 24px", borderRadius: 20, background: CARD_BG, border: "1px solid rgba(255,255,255,0.10)", boxShadow: CARD_SHD, backdropFilter: "blur(16px)", animation: "fadeUp 0.3s ease" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.20)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Building2 size={24} color={BLUE} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#f0f2f8", letterSpacing: "-0.02em" }}>{t.no_accounts}</h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{t.no_accounts_sub}</p>
          <button onClick={() => setView("new")}
            style={{ padding: "10px 24px", borderRadius: 12, background: `linear-gradient(135deg,${BLUE},${CYAN})`, border: "none", color: "#fff", fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(14,165,233,0.35)" }}>
            {t.create_first}
          </button>
        </div>
      )}

      {/* New account form */}
      {view === "new" && (
        <div style={{ borderRadius: 20, background: CARD_BG, border: "1px solid rgba(14,165,233,0.25)", boxShadow: `${CARD_SHD}, 0 0 60px rgba(14,165,233,0.06)`, backdropFilter: "blur(20px)", padding: "clamp(20px,4vw,32px)", animation: "fadeUp 0.25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f0f2f8", letterSpacing: "-0.02em" }}>{t.new}</h2>
            <button onClick={() => setView("list")} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex" }}>
              <X size={14} />
            </button>
          </div>
          <AccountForm userId={user.id} language={language} t={t}
            onSave={() => { load(); setView("list"); }}
            onCancel={() => setView("list")} />
        </div>
      )}

      {/* Master–detail layout */}
      {accounts.length > 0 && view !== "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>

          {/* LEFT: account list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {accounts.map(acc => {
              const isActive = acc.id === selectedPersona?.id;
              const isSel = acc.id === selectedId;
              return (
                <div key={acc.id}
                  onClick={() => { setSelectedId(acc.id); setView("list"); }}
                  style={{ borderRadius: 12, padding: "11px 12px", cursor: "pointer", transition: "all 0.15s", background: isSel ? "linear-gradient(160deg,rgba(14,165,233,0.12) 0%,rgba(255,255,255,0.05) 100%)" : "rgba(255,255,255,0.03)", border: `1px solid ${isSel ? "rgba(14,165,233,0.30)" : "rgba(255,255,255,0.07)"}`, backdropFilter: "blur(8px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: isSel ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {acc.logo_url
                        ? <img src={acc.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 13, fontWeight: 700, color: isSel ? BLUE : "rgba(255,255,255,0.4)" }}>{(acc.name || "?").charAt(0).toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: isSel ? 600 : 400, color: isSel ? "#f0f2f8" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {acc.name || t.unnamed}
                      </p>
                      {isActive && (
                        <p style={{ margin: "1px 0 0", fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.06em" }}>
                          ● {t.active_badge}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Add account mini button */}
            <button onClick={() => setView("new")}
              style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 12, background: "transparent", border: "1px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)", fontFamily: F, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.3)"; (e.currentTarget as HTMLElement).style.color = BLUE; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}>
              <Plus size={13} />{t.new}
            </button>
          </div>

          {/* RIGHT: detail panel */}
          {selectedAcc && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp 0.2s ease" }}>

              {/* Edit / Details */}
              {view === "edit" ? (
                <div style={{ borderRadius: 20, background: CARD_BG, border: "1px solid rgba(14,165,233,0.25)", boxShadow: CARD_SHD, backdropFilter: "blur(20px)", padding: "clamp(20px,4vw,28px)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f0f2f8" }}>{t.details_title}</h2>
                    <button onClick={() => setView("list")} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex" }}>
                      <X size={14} />
                    </button>
                  </div>
                  <AccountForm account={selectedAcc} userId={user.id} language={language} t={t}
                    onSave={() => { load(); setView("list"); }}
                    onCancel={() => setView("list")} />
                </div>
              ) : (
                <div style={{ borderRadius: 20, background: CARD_BG, border: "1px solid rgba(255,255,255,0.10)", boxShadow: CARD_SHD, backdropFilter: "blur(16px)", padding: "clamp(18px,3vw,24px)" }}>
                  {/* Account header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.20)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selectedAcc.logo_url
                        ? <img src={selectedAcc.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 20, fontWeight: 800, color: BLUE }}>{(selectedAcc.name || "?").charAt(0).toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f0f2f8", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedAcc.name || t.unnamed}
                      </h2>
                      {selectedAcc.website && (
                        <a href={selectedAcc.website.startsWith("http") ? selectedAcc.website : `https://${selectedAcc.website}`} target="_blank" rel="noreferrer"
                          style={{ fontFamily: F, fontSize: 12, color: "rgba(14,165,233,0.7)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Globe size={11} />{selectedAcc.website}
                        </a>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {selectedAcc.id !== selectedPersona?.id && (
                        <button onClick={() => activateAccount(selectedAcc)}
                          style={{ padding: "7px 13px", borderRadius: 9, background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.25)", color: BLUE, fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {t.set_active}
                        </button>
                      )}
                      {selectedAcc.id === selectedPersona?.id && (
                        <span style={{ padding: "7px 11px", borderRadius: 9, background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.25)", color: BLUE, fontFamily: F, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircle2 size={12} />{t.active_badge}
                        </span>
                      )}
                      <button onClick={() => setView("edit")}
                        style={{ padding: "7px 13px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontFamily: F, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                        {t.edit}
                      </button>
                      <button onClick={() => deleteAccount(selectedAcc.id)} disabled={!!deleting}
                        style={{ padding: "7px 10px", borderRadius: 9, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        {deleting === selectedAcc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* AI context description */}
                  {selectedAcc.description ? (
                    <div style={{ marginBottom: 0 }}>
                      <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>{t.desc_label}</p>
                      <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0, padding: "11px 13px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                        {selectedAcc.description}
                      </p>
                    </div>
                  ) : (
                    <button onClick={() => setView("edit")}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.10)", cursor: "pointer", width: "100%", textAlign: "left" }}>
                      <AlertCircle size={13} color="rgba(255,255,255,0.2)" />
                      <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                        {language === "pt" ? "Adicionar contexto de IA — ajuda a IA a entender esta conta" : language === "es" ? "Agregar contexto de IA" : "Add AI context — helps the AI understand this account"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Platform connections card */}
              {view !== "edit" && (
                <div style={{ borderRadius: 20, background: CARD_BG, border: "1px solid rgba(255,255,255,0.10)", boxShadow: CARD_SHD, backdropFilter: "blur(16px)", padding: "clamp(18px,3vw,24px)" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.01em" }}>{t.connections_title}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {PLATFORMS.map(p => (
                      <PlatformRow key={`${p.id}-${selectedAcc.id}`} p={p} userId={user.id} accountId={selectedAcc.id} language={language} t={t} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
