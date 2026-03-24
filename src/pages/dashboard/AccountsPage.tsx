import { useState, useEffect, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, CheckCircle2, Link2, ChevronDown, Globe, Upload, Building2, Loader2, Save, Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { useDashT } from "@/i18n/dashboardTranslations";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Inter', sans-serif";
const BLUE = "#0ea5e9";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  meta: (
    <svg width="16" height="10" viewBox="0 0 36 18" fill="none">
      <path d="M8.5 0C5.5 0 3.2 1.6 1.6 3.8 0.6 5.2 0 7 0 9c0 2 0.6 3.8 1.6 5.2C3.2 16.4 5.5 18 8.5 18c2.2 0 4-0.9 5.5-2.4L18 12l4 3.6C23.5 17.1 25.3 18 27.5 18c3 0 5.3-1.6 6.9-3.8 1-1.4 1.6-3.2 1.6-5.2 0-2-0.6-3.8-1.6-5.2C32.8 1.6 30.5 0 27.5 0c-2.2 0-4 0.9-5.5 2.4L18 6l-4-3.6C12.5 0.9 10.7 0 8.5 0zm0 4c1.2 0 2.2 0.5 3.2 1.4L15 8.9 11.7 12.6C10.7 13.5 9.7 14 8.5 14c-1.6 0-2.9-0.8-3.8-2C4 11 3.6 10 3.6 9s0.4-2 1.1-3C5.6 4.8 6.9 4 8.5 4zm19 0c1.6 0 2.9 0.8 3.8 2 0.7 1 1.1 2 1.1 3s-0.4 2-1.1 3c-0.9 1.2-2.2 2-3.8 2-1.2 0-2.2-0.5-3.2-1.4L21 9.1l3.3-3.7C25.3 4.5 26.3 4 27.5 4z" fill="#1877F2"/>
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.18 8.18 0 004.77 1.52V7.01a4.85 4.85 0 01-1-.32z" fill="#fff"/>
    </svg>
  ),
  google: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
};

const PLATFORMS = [
  { id: "meta",   label: "Meta Ads",   color: "#1877F2", fn: "meta-oauth"   },
  { id: "tiktok", label: "TikTok Ads", color: "#fff",    fn: "tiktok-oauth", soon: true },
  { id: "google", label: "Google Ads", color: "#4285F4", fn: "google-oauth",  soon: true },
];

interface Account {
  id: string;
  user_id: string;
  name: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  created_at: string | null;
}

// ─── Platform Connections per Account ────────────────────────────────────────

function AccountPlatformConnections({ accountId, userId, language = "pt" }: { accountId: string; userId: string; language?: string }) {
  const [connections, setConnections] = useState<Record<string, { connected: boolean; accounts: any[]; selectedId: string | null; isGlobal?: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [changingAccount, setChangingAccount] = useState<string | null>(null);

  const TL: Record<string, Record<string,string>> = {
    pt: { not_connected: "Não conectado", connect_btn: "Conectar", connecting: "Conectando...", coming_soon: "Em breve", active: "Ativo", accounts_switch: "contas — trocar", disconnect: "Desconectar", disconnecting: "Desconectando..." },
    es: { not_connected: "Sin conectar", connect_btn: "Conectar", connecting: "Conectando...", coming_soon: "Próximamente", active: "Activo", accounts_switch: "cuentas — cambiar", disconnect: "Desconectar", disconnecting: "Desconectando..." },
    en: { not_connected: "Not connected", connect_btn: "Connect", connecting: "Connecting…", coming_soon: "Coming soon", active: "Active", accounts_switch: "accounts — switch", disconnect: "Disconnect", disconnecting: "Disconnecting…" },
  };
  const tl = TL[language] || TL.en;

  const load = async () => {
    if (!accountId) return;
    const map: Record<string, any> = {};
    // STRICT: only load connections scoped to THIS account (persona_id = accountId)
    // No global fallback — each account manages its own connections
    const { data: specific } = await supabase.from("platform_connections" as any)
      .select("id, platform, ad_accounts, selected_account_id, connection_label, connected_at")
      .eq("user_id", userId)
      .eq("persona_id", accountId)
      .eq("status", "active");
    (specific || []).forEach((r: any) => {
      const accs = (r.ad_accounts as any[]) || [];
      map[r.platform] = {
        connected: true,
        connectionId: r.id,
        accounts: accs,
        selectedId: r.selected_account_id || accs[0]?.id || null,
        label: r.connection_label,
        connectedAt: r.connected_at,
      };
    });
    setConnections(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [accountId]);

  const connect = async (platform: string, fn: string) => {
    setConnecting(platform);
    try {
      const { data } = await supabase.functions.invoke(fn, {
        body: { action: "get_auth_url", user_id: userId, persona_id: accountId },
      });
      if (data?.url) window.location.href = data.url;
      else { toast.error("Failed to get auth URL"); setConnecting(null); }
    } catch {
      toast.error("Connection failed");
      setConnecting(null);
    }
  };

  const disconnect = async (platform: string) => {
    if (!confirm(language === "pt" ? `Desconectar ${platform} desta conta?` : `Disconnect ${platform} from this account?`)) return;
    setDisconnecting(platform);
    try {
      await supabase.from("platform_connections" as any)
        .delete()
        .eq("user_id", userId)
        .eq("platform", platform)
        .eq("persona_id", accountId);
      toast.success(language === "pt" ? "Desconectado" : "Disconnected");
      load();
    } catch {
      toast.error("Disconnect failed");
    }
    setDisconnecting(null);
  };

  const selectAccount = async (platform: string, accountId2: string) => {
    setChangingAccount(platform);
    // STRICT: only update the connection scoped to this persona
    await supabase.from("platform_connections" as any)
      .update({ selected_account_id: accountId2 })
      .eq("user_id", userId)
      .eq("persona_id", accountId)
      .eq("platform", platform);
    load();
    setChangingAccount(null);
  };

  if (loading) return <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={14} color="rgba(255,255,255,0.3)" className="animate-spin" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {PLATFORMS.map(p => {
        const conn = connections[p.id];
        const connected = !!conn;
        const accs = conn?.accounts || [];
        const selId = conn?.selectedId || accs[0]?.id;
        const selAcc = accs.find((a: any) => a.id === selId) || accs[0];

        return (
          <div key={p.id} style={{ borderRadius: 10, background: connected ? `${p.color}08` : "rgba(255,255,255,0.02)", border: `1px solid ${connected ? p.color + "20" : "rgba(255,255,255,0.07)"}`, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: connected ? `${p.color}15` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {PLATFORM_ICONS[p.id]}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: connected ? "#fff" : "rgba(255,255,255,0.4)", margin: 0 }}>
                  {p.label}
                  {(p as any).soon && <span style={{ marginLeft: 7, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 5px" }}>SOON</span>}
                </p>
                <p style={{ fontFamily: F, fontSize: 11, color: connected ? `${p.color}cc` : "rgba(255,255,255,0.22)", margin: "2px 0 0" }}>
                  {connected
                    ? (accs.length > 1
                        ? `${selAcc?.name || selAcc?.id || "?"} · ${accs.length} ${tl.accounts_switch}`
                        : selAcc?.name || selAcc?.id || "Connected")
                    : tl.not_connected}
                </p>
              </div>
              {/* Connect button */}
              {!connected && !(p as any).soon && (
                <button onClick={() => connect(p.id, p.fn)} disabled={connecting === p.id}
                  style={{ fontFamily: F, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, background: "#0ea5e9", color: "#000", border: "none", cursor: "pointer", flexShrink: 0 }}>
                  {connecting === p.id ? tl.connecting : tl.connect_btn}
                </button>
              )}
              {!connected && (p as any).soon && (
                <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{tl.coming_soon}</span>
              )}
              {/* Connected: active badge + disconnect button */}
              {connected && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: `${p.color}12`, color: p.color, border: `1px solid ${p.color}22`, letterSpacing: "0.06em" }}>
                    {tl.active.toUpperCase()}
                  </span>
                  <button
                    onClick={() => disconnect(p.id)}
                    disabled={disconnecting === p.id}
                    title={tl.disconnect}
                    style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.16)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
                  >
                    {disconnecting === p.id
                      ? <Loader2 size={11} color="#f87171" className="animate-spin" />
                      : <Link2 size={11} color="#f87171" style={{ transform: "rotate(135deg)" }} />
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Ad account switcher */}
            {connected && accs.length > 1 && (
              <>
                <button onClick={() => setExpandedPlatform(expandedPlatform === p.id ? null : p.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 13px", background: "transparent", border: "none", borderTop: `1px solid ${p.color}12`, cursor: "pointer" }}>
                  <span style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{accs.length} {tl.accounts_switch}</span>
                  <ChevronDown size={12} color="rgba(255,255,255,0.3)" style={{ transform: expandedPlatform === p.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {expandedPlatform === p.id && (
                  <div style={{ borderTop: `1px solid ${p.color}10`, padding: "8px 13px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {accs.map((acc: any) => {
                      const isSel = acc.id === selId;
                      return (
                        <button key={acc.id} onClick={() => { selectAccount(p.id, acc.id); setExpandedPlatform(null); }}
                          disabled={changingAccount === p.id}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isSel ? `${p.color}14` : "rgba(255,255,255,0.03)", border: `1px solid ${isSel ? p.color + "35" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? p.color : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: F, fontSize: 12, fontWeight: isSel ? 600 : 400, color: isSel ? "#fff" : "rgba(255,255,255,0.6)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name || acc.id}</p>
                            <p style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "1px 0 0" }}>{acc.id}{acc.currency ? ` · ${acc.currency}` : ""}</p>
                          </div>
                          {isSel && <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, color: p.color, letterSpacing: "0.06em" }}>{tl.active.toUpperCase()}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Account Form (create / edit) ────────────────────────────────────────────

function AccountForm({ account, userId, onSave, onCancel }: {
  account?: Account;
  userId: string;
  onSave: (a: Account) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name || "");
  const [website, setWebsite] = useState(account?.website || "");
  const [description, setDescription] = useState(account?.description || "");
  const [logoUrl, setLogoUrl] = useState(account?.logo_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File) => {
    if (!file || file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${account?.id || "new"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("account-logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("account-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Account name is required"); return; }
    setSaving(true);
    const payload = { user_id: userId, name: name.trim(), website: website.trim() || null, description: description.trim() || null, logo_url: logoUrl || null };
    let result: any;
    if (account?.id) {
      const { data } = await supabase.from("personas").update(payload).eq("id", account.id).select().single();
      result = data;
    } else {
      const { data } = await supabase.from("personas").insert(payload).select().single();
      result = data;
    }
    setSaving(false);
    if (result) { toast.success(account?.id ? "Account updated" : "Account created"); onSave(result as Account); }
    else toast.error("Failed to save");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Logo upload */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ width: 72, height: 72, borderRadius: 16, background: logoUrl ? "transparent" : "rgba(255,255,255,0.04)", border: `2px dashed ${logoUrl ? "transparent" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, transition: "border-color 0.15s", position: "relative" }}
          onMouseEnter={e => { if (!logoUrl) (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.4)"; }}
          onMouseLeave={e => { if (!logoUrl) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}>
          {uploading ? <Loader2 size={18} color="rgba(255,255,255,0.4)" className="animate-spin" /> :
            logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <div style={{ textAlign: "center" }}>
                <Upload size={18} color="rgba(255,255,255,0.25)" />
                <p style={{ fontFamily: F, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 4, lineHeight: 1.2 }}>Logo</p>
              </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Account logo</p>
          <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>PNG, JPG or SVG · Max 2MB<br />Used as avatar in the chat</p>
          {logoUrl && (
            <button onClick={() => setLogoUrl("")} style={{ marginTop: 6, fontFamily: F, fontSize: 11, color: "rgba(248,113,113,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <X size={10} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Account name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="FitCore Brasil, Nike MX, Eluck BR…"
            style={{ width: "100%", fontFamily: F, fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
        </div>

        <div>
          <label style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Website</label>
          <div style={{ position: "relative" }}>
            <Globe size={13} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="fitcore.com.br"
              style={{ width: "100%", fontFamily: F, fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px 10px 33px", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
          </div>
        </div>

        <div>
          <label style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What does this account sell? Who's the target audience? Any context the AI should know…"
            rows={3}
            style={{ width: "100%", fontFamily: F, fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px", outline: "none", resize: "none", boxSizing: "border-box", transition: "border-color 0.15s", lineHeight: 1.6 }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }} />
          <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 5 }}>The AI reads this as context for every question you ask.</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={save} disabled={saving || !name.trim()}
          style={{ flex: 1, fontFamily: F, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 10, background: name.trim() ? `linear-gradient(135deg, ${BLUE}, #06b6d4)` : "rgba(255,255,255,0.06)", color: name.trim() ? "#000" : "rgba(255,255,255,0.25)", border: "none", cursor: name.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={13} />}
          {account?.id ? "Save changes" : "Create account"}
        </button>
        <button onClick={onCancel}
          style={{ fontFamily: F, fontSize: 13, fontWeight: 500, padding: "11px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main AccountsPage ────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { user, selectedPersona, setSelectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const navigate = useNavigate();

  const L: Record<string, Record<string,string>> = {
    pt: { title: "Contas", sub: "Cada conta conecta à sua própria conta de anúncios. A IA usa a ativa no chat.", new_btn: "Nova conta", new_label: "Nova conta", no_accounts: "Nenhuma conta ainda", no_accounts_sub: "Crie uma conta para conectar o Meta Ads e começar a usar o chat de IA.", create_first: "Criar primeira conta", your_accounts: "Suas contas", unnamed: "Conta sem nome", delete_confirm: "Excluir esta conta? Isso não pode ser desfeito.", deleted: "Conta excluída", set_active: "Usar no chat", active: "Ativa no chat" },
    es: { title: "Cuentas", sub: "Cada cuenta conecta a su propia cuenta de anuncios. La IA usa la activa en el chat.", new_btn: "Nueva cuenta", new_label: "Nueva cuenta", no_accounts: "Sin cuentas aún", no_accounts_sub: "Crea una cuenta para conectar Meta Ads y empezar a usar el chat de IA.", create_first: "Crear primera cuenta", your_accounts: "Tus cuentas", unnamed: "Cuenta sin nombre", delete_confirm: "¿Eliminar esta cuenta? Esta acción no se puede deshacer.", deleted: "Cuenta eliminada", set_active: "Usar en chat", active: "Activa en chat" },
    en: { title: "Accounts", sub: "Each account connects to its own ad account. The AI uses the active one in the chat.", new_btn: "New account", new_label: "New account", no_accounts: "No accounts yet", no_accounts_sub: "Create an account to connect Meta Ads and start using the AI chat.", create_first: "Create first account", your_accounts: "Your accounts", unnamed: "Unnamed account", delete_confirm: "Delete this account? This cannot be undone.", deleted: "Account deleted", set_active: "Use in chat", active: "Active in chat" },
  };
  const t = L[language] || L.en;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // activeId synced with global selectedPersona
  const activeId = selectedPersona?.id ?? null;
  const setActiveId = (id: string | null) => {
    const acc = accounts.find(a => a.id === id);
    setSelectedPersona(acc ? { ...acc } as any : null);
  };

  const load = async () => {
    const { data } = await supabase.from("personas").select("id, user_id, name, logo_url, website, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setAccounts((data || []) as Account[]);
    setLoading(false);
    // Auto-select first if nothing active yet
    if (data?.length && !selectedPersona) {
      setSelectedPersona({ ...(data[0] as any) });
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const deleteAccount = async (id: string) => {
    if (!confirm(t.delete_confirm)) return;
    setDeleting(id);
    await supabase.from("personas").delete().eq("id", id);
    toast.success(t.deleted);
    if (activeId === id) setSelectedPersona(null);
    load();
    setDeleting(null);
  };

  const activeAccount = accounts.find(a => a.id === activeId);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
      <Loader2 size={20} color="rgba(255,255,255,0.3)" className="animate-spin" />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(16px,4vw,32px)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: F, fontSize: "clamp(20px,3vw,26px)", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>{t.title}</h1>
          <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{t.sub}</p>
        </div>
        {!creating && (
          <button onClick={() => { setCreating(true); setEditingId(null); }}
            style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: F, fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #06b6d4)`, color: "#000", border: "none", cursor: "pointer" }}>
            <Plus size={14} /> {t.new_btn}
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ marginBottom: 24, padding: "24px", borderRadius: 16, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <p style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> {t.new_label}
          </p>
          <AccountForm userId={user.id} onSave={acc => { setCreating(false); load(); setActiveId(acc.id); }} onCancel={() => setCreating(false)} />
        </div>
      )}

      {accounts.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
          <Building2 size={32} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 14px" }} />
          <p style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{t.no_accounts}</p>
          <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.25)", marginBottom: 20 }}>{t.no_accounts_sub}</p>
          <button onClick={() => setCreating(true)}
            style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 10, background: `linear-gradient(135deg, ${BLUE}, #06b6d4)`, color: "#000", border: "none", cursor: "pointer" }}>
            {t.create_first}
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 280px) 1fr", gap: 16, alignItems: "start" }} className="accounts-grid">

          {/* Account list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{t.your_accounts}</p>
            {accounts.map(acc => {
              const isActive = acc.id === activeId;
              return (
                <button key={acc.id}
                  onClick={() => { setActiveId(acc.id); setEditingId(null); setCreating(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: isActive ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.025)", border: `1px solid ${isActive ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s" }}>
                  {/* Logo / Initial */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isActive ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", fontSize: 14, fontWeight: 700, color: isActive ? BLUE : "rgba(255,255,255,0.4)" }}>
                    {acc.logo_url
                      ? <img src={acc.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (acc.name?.charAt(0)?.toUpperCase() || "A")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "rgba(255,255,255,0.6)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.name || t.unnamed}
                    </p>
                    {acc.website && (
                      <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.website}</p>
                    )}
                  </div>
                  {isActive
                    ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE, flexShrink: 0, boxShadow: `0 0 6px ${BLUE}` }} />
                    : <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0, opacity: 0, transition: "opacity 0.12s" }} className="set-active-hint">→</div>
                  }
                </button>
              );
            })}
          </div>

          {/* Account detail panel */}
          {activeAccount && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>

              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", fontSize: 20, fontWeight: 800, color: BLUE }}>
                  {activeAccount.logo_url
                    ? <img src={activeAccount.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (activeAccount.name?.charAt(0)?.toUpperCase() || "A")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ fontFamily: F, fontSize: 17, fontWeight: 700, color: "#fff", margin: 0 }}>{activeAccount.name || t.unnamed}</h2>
                    <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: BLUE, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.05em" }}>
                      ● {t.active}
                    </span>
                  </div>
                  {activeAccount.website && (
                    <a href={activeAccount.website.startsWith("http") ? activeAccount.website : `https://${activeAccount.website}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BLUE; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}>
                      <Globe size={10} /> {activeAccount.website}
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditingId(editingId === activeAccount.id ? null : activeAccount.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: 12, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                    <Edit3 size={11} /> {editingId === activeAccount.id ? (language === "pt" ? "Cancelar" : language === "es" ? "Cancelar" : "Cancel") : (language === "pt" ? "Editar" : language === "es" ? "Editar" : "Edit")}
                  </button>
                  <button onClick={() => deleteAccount(activeAccount.id)} disabled={deleting === activeAccount.id}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: 12, padding: "7px 10px", borderRadius: 8, background: "transparent", color: "rgba(248,113,113,0.5)", border: "1px solid rgba(248,113,113,0.15)", cursor: "pointer" }}>
                    {deleting === activeAccount.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              </div>

              <div style={{ padding: "20px" }}>
                {editingId === activeAccount.id ? (
                  <AccountForm account={activeAccount} userId={user.id}
                    onSave={() => { setEditingId(null); load(); }}
                    onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    {activeAccount.description && (
                      <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Description</p>
                        <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>{activeAccount.description}</p>
                      </div>
                    )}

                    {/* Platform connections */}
                    <div>
                      <p style={{ fontFamily: F, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Ad account connections</p>
                      <AccountPlatformConnections accountId={activeAccount.id} userId={user.id} language={language} />
                    </div>

                    {/* Chat shortcut */}
                    <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                        Ready to ask the AI about this account?
                      </p>
                      <button onClick={() => navigate("/dashboard/ai")}
                        style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, background: `linear-gradient(135deg, ${BLUE}, #06b6d4)`, color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                        Open AI chat →
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@media(max-width:640px){.accounts-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
