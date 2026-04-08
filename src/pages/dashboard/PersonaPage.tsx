import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, ArrowLeft, Check, Copy, Loader2, Sparkles, RefreshCw, Plus, Trash2, ChevronLeft, Save, Edit3, Link2, CheckCircle2, ChevronDown, Building2, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Persona3DAvatar from "@/components/dashboard/Persona3DAvatar";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import { TEMPLATES, CAT_META, type Template } from "@/pages/dashboard/TemplatesPage";
import { getTemplateTranslation } from "@/i18n/templateTranslations";

// ─── Platform connections per persona ─────────────────────────────────────────

const PLATFORMS = [
  { id: "meta",   label: "Meta Ads",   color: "#60a5fa", fn: "meta-oauth"   },
  { id: "tiktok", label: "TikTok Ads", color: "#06b6d4", fn: "tiktok-oauth" },
  { id: "google", label: "Google Ads", color: "#34d399", fn: "google-oauth"  },
];

function PersonaPlatformConnections({ personaId, userId }: { personaId: string; userId: string }) {
  const [connections, setConnections] = useState<Record<string, { connected: boolean; accounts: any[]; selectedId: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [changingAccount, setChangingAccount] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  const F = "'Inter', sans-serif";

  const loadConnections = async () => {
    if (!personaId) { setLoading(false); return; }
    // Use meta-oauth get_connections (service_role) — bypasses RLS
    const { data: gcRes } = await supabase.functions.invoke("meta-oauth", {
      body: { action: "get_connections", user_id: userId }
    });
    let data: any[] | null = (gcRes?.connections || []) as any[];
    const map: Record<string, { connected: boolean; accounts: any[]; selectedId: string | null }> = {};
    (data || []).forEach((r: any) => {
      const accounts = (r.ad_accounts as any[]) || [];
      map[r.platform] = {
        connected: true,
        accounts,
        // If no selected_account_id, auto-select first active account
        selectedId: r.selected_account_id || accounts.find((a: any) => a.account_status === 1)?.id || accounts[0]?.id || null,
      };
    });
    setConnections(map);
    setLoading(false);
  };

  useEffect(() => { loadConnections(); }, [personaId, userId]);

  const selectAccount = async (platform: string, accountId: string) => {
    setChangingAccount(platform);
    await supabase.from("platform_connections" as any)
      .update({ selected_account_id: accountId })
      .eq("user_id", userId).eq("platform", platform);
    loadConnections();
    setChangingAccount(null);
  };

  const connect = async (platform: string, fn: string) => {
    setConnecting(platform);
    try {
      const { data } = await supabase.functions.invoke(fn, {
        body: { action: "get_auth_url", user_id: userId, persona_id: personaId },
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setConnecting(null);
    }
  };

  if (loading) return null;

  return (
    <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        Connected Ad Accounts
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PLATFORMS.map(p => {
          const conn = connections[p.id];
          const connected = !!conn;
          const accounts = conn?.accounts || [];
          const selectedId = conn?.selectedId || accounts[0]?.id;
          const selectedAcc = accounts.find((a: any) => a.id === selectedId) || accounts[0];

          return (
            <div key={p.id} style={{ borderRadius: 10, overflow: "hidden", background: connected ? `${p.color}07` : "rgba(255,255,255,0.02)", border: `1px solid ${connected ? p.color + "22" : "rgba(255,255,255,0.07)"}` }}>
              {/* Platform row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: connected ? `${p.color}18` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {connected ? <CheckCircle2 size={14} color={p.color} /> : <Link2 size={13} color="rgba(255,255,255,0.3)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: connected ? "#fff" : "rgba(255,255,255,0.45)" }}>{p.label}</p>
                  <p style={{ fontFamily: F, fontSize: 12, color: connected ? p.color : "rgba(255,255,255,0.25)" }}>
                    {connected
                      ? selectedAcc ? `Active: ${selectedAcc.name || selectedAcc.id}` : `${accounts.length} account${accounts.length !== 1 ? "s" : ""} connected`
                      : "Not connected"}
                  </p>
                </div>
                {!connected && (
                  <button onClick={() => connect(p.id, p.fn)} disabled={connecting === p.id}
                    style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, background: `${p.color}14`, color: p.color, border: `1px solid ${p.color}28`, cursor: "pointer" }}>
                    {connecting === p.id ? "Connecting..." : "Connect"}
                  </button>
                )}
                {connected && accounts.length <= 1 && (
                  <span style={{ fontFamily: F, fontSize: 12, padding: "3px 8px", borderRadius: 99, background: `${p.color}10`, color: p.color, border: `1px solid ${p.color}22`, fontWeight: 600 }}>
                    ACTIVE
                  </span>
                )}
              </div>

              {/* Account selector — collapsible, only if multiple accounts */}
              {connected && accounts.length > 1 && (
                <>
                  <button
                    onClick={() => setExpandedPlatform(expandedPlatform === p.id ? null : p.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "transparent", border: "none", borderTop: `1px solid ${p.color}15`, cursor: "pointer" }}>
                    <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                      {accounts.length} accounts available — change
                    </span>
                    <ChevronDown size={13} color="rgba(255,255,255,0.3)" style={{ transform: expandedPlatform === p.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>
                  {expandedPlatform === p.id && (
                    <div style={{ borderTop: `1px solid ${p.color}10`, padding: "6px 12px 10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {accounts.map((acc: any) => {
                          const isSelected = acc.id === selectedId;
                          return (
                            <button key={acc.id} onClick={() => { selectAccount(p.id, acc.id); setExpandedPlatform(null); }}
                              disabled={changingAccount === p.id}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: isSelected ? `${p.color}14` : "rgba(255,255,255,0.03)", border: `1px solid ${isSelected ? p.color + "35" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.1s" }}>
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: isSelected ? p.color : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontFamily: F, fontSize: 12, color: isSelected ? "#fff" : "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                                  {acc.name || acc.id}
                                </span>
                                <span style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                                  {acc.id}{acc.currency ? ` · ${acc.currency}` : ""}
                                </span>
                              </div>
                              {isSelected && <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: p.color, letterSpacing: "0.06em" }}>ACTIVE</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.22)", marginTop: 8, lineHeight: 1.5 }}>
        The AI uses the active account when you switch to this persona.
      </p>
    </div>
  );
}



// ─── Stable sub-components (outside parent to avoid re-mount on each render) ──

function EditableTextField({ field, value, className = "", rows, editing, onChange }: {
  field: string; value: string; className?: string; rows?: number; editing: boolean;
  onChange: (field: string, value: string) => void;
}) {
  if (!editing) return <span className={className}>{value || "—"}</span>;
  return rows ? (
    <textarea value={value} onChange={e => onChange(field, e.target.value)} rows={rows}
      className={`w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-sm outline-none focus:border-sky-500/40 transition-colors resize-none ${className}`} />
  ) : (
    <input value={value} onChange={e => onChange(field, e.target.value)}
      className={`w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-sm outline-none focus:border-sky-500/40 transition-colors ${className}`} />
  );
}

function EditableListField({ field, items, color, editing, onChange }: {
  field: string; items: string[]; color: string; editing: boolean;
  onChange: (field: string, value: string) => void;
}) {
  const normalizedItems = Array.isArray(items)
    ? items
    : typeof items === "string"
      ? [items]
      : [];

  if (!editing) return (
    <ul className="space-y-2">
      {normalizedItems.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white/60">
          <span className="text-white/40 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <textarea
      value={normalizedItems.join("\n")}
      onChange={e => onChange(field, e.target.value)}
      rows={Math.max(2, normalizedItems.length)}
      className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-sm outline-none focus:border-sky-500/40 transition-colors resize-none"
    />
  );
}

interface PersonaResult {
  name: string;
  age: string;
  gender: string;
  headline: string;
  bio: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  media_habits: string[];
  best_platforms: string[];
  best_formats: string[];
  hook_angles: string[];
  language_style: string;
  cta_style: string;
  avatar_emoji: string;
}

interface BrandKit {
  logo_data_url?: string;  // base64 data URL stored directly in JSONB
  file_name?: string;
  primary_color?: string;  // hex e.g. "#6D28D9"
  secondary_color?: string;
  font_name?: string;
  brand_name?: string;
  uploaded_at?: string;
}

interface SavedPersona {
  id: string;
  result: PersonaResult;
  answers: Record<string, string>;
  brand_kit?: BrandKit;
  created_at: string;
}

// ─── Smart Template Suggestions ──────────────────────────────────────────
// Maps persona attributes to the most relevant template categories & specific templates
// Ensure a field is always a proper string array regardless of what came from the DB
const toArr = (v: any): string[] =>
  Array.isArray(v) ? v.filter((x: any) => typeof x === "string") :
  typeof v === "string" && v.trim() ? v.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : [];

function getSmartTemplates(persona: PersonaResult, language: string): { template: Template; reason: string }[] {
  const platforms = toArr(persona.best_platforms).map((p: string) => p.toLowerCase());
  const formats  = toArr(persona.best_formats).map((f: string) => f.toLowerCase());
  const pains    = toArr(persona.pains).map((p: string) => p.toLowerCase()).join(" ");
  const desires  = toArr(persona.desires).map((d: string) => d.toLowerCase()).join(" ");
  const hooks    = toArr(persona.hook_angles).map((h: string) => h.toLowerCase()).join(" ");
  const gender = String(persona.gender || "").toLowerCase();
  const age = String(persona.age || "");
  const allText = `${pains} ${desires} ${hooks} ${persona.bio || ""}`.toLowerCase();

  const scored: { template: Template; score: number; reason: string }[] = [];

  for (const t of TEMPLATES) {
    let score = 0;
    let reason = "";
    const cat = t.category;
    const desc = t.description.toLowerCase();
    const prompt = t.prompt.toLowerCase();

    // Platform match: if persona targets TikTok → UGC, hook, react templates score higher
    if (platforms.some(p => p.includes("tiktok"))) {
      if (["ugc", "hook", "react"].includes(cat)) { score += 3; reason = "TikTok"; }
    }
    if (platforms.some(p => p.includes("meta") || p.includes("facebook") || p.includes("instagram"))) {
      if (["testimonial", "promo", "story", "product"].includes(cat)) { score += 3; reason = "Meta/Instagram"; }
    }
    if (platforms.some(p => p.includes("youtube"))) {
      if (["tutorial", "story", "testimonial"].includes(cat)) { score += 3; reason = "YouTube"; }
    }

    // Format match
    if (formats.some(f => f.includes("ugc")) && cat === "ugc") { score += 4; reason = reason || "UGC format"; }
    if (formats.some(f => f.includes("testimonial")) && cat === "testimonial") { score += 4; reason = reason || "Testimonial"; }
    if (formats.some(f => f.includes("tutorial")) && cat === "tutorial") { score += 3; reason = reason || "Tutorial"; }

    // Pain/desire keyword matching
    const keywords = ["transformation", "before", "after", "trust", "price", "expensive", "cheap", "fear", "risk", 
      "health", "beauty", "money", "save", "fast", "easy", "pain", "sleep", "energy", "weight", "fitness",
      "food", "game", "gaming", "bet", "invest", "credit", "debt"];
    for (const kw of keywords) {
      if (allText.includes(kw) && (desc.includes(kw) || prompt.includes(kw) || cat.includes(kw))) {
        score += 2; reason = reason || kw;
      }
    }

    // Age-based: younger audiences → UGC, challenges, react
    if (age.includes("18") || age.includes("25") || age.includes("24")) {
      if (["ugc", "react", "hook"].includes(cat)) score += 1;
    }
    // Older audiences → testimonial, tutorial, b2b
    if (age.includes("35") || age.includes("45") || age.includes("55")) {
      if (["testimonial", "tutorial", "b2b"].includes(cat)) score += 1;
    }

    // Hook angle keyword matching
    if (hooks.includes("myth") && t.id.includes("myth")) score += 5;
    if (hooks.includes("transformation") && t.id.includes("transformation")) score += 5;
    if (hooks.includes("honest") && t.id.includes("honest")) score += 5;
    if (hooks.includes("comparison") && t.id.includes("comparison")) score += 5;
    if (hooks.includes("challenge") && t.id.includes("challenge")) score += 5;

    if (score > 0) scored.push({ template: t, score, reason });
  }

  // Sort by score desc, take top 6, deduplicate categories (max 2 per category)
  scored.sort((a, b) => b.score - a.score);
  const result: { template: Template; reason: string }[] = [];
  const catCount: Record<string, number> = {};
  for (const item of scored) {
    const c = item.template.category;
    catCount[c] = (catCount[c] || 0) + 1;
    if (catCount[c] > 2) continue;
    result.push({ template: item.template, reason: item.reason });
    if (result.length >= 6) break;
  }
  return result;
}

function SuggestedTemplates({ persona, dt, language, navigate }: {
  persona: PersonaResult; dt: (k: any) => string; language: string; navigate: (path: string, opts?: any) => void;
}) {
  const suggestions = useMemo(() => getSmartTemplates(persona, language), [persona, language]);
  if (suggestions.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.15)" }}>
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-400" /> {dt("pe_suggested_templates")}
        </h3>
        <p className="text-[11px] text-white/50 mt-0.5">{dt("pe_suggested_templates_desc")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {suggestions.map(({ template: tpl, reason }) => {
          const tt = language !== "en" ? getTemplateTranslation(tpl.id, language) : null;
          const name = tt?.name || tpl.name;
          const desc = tt?.desc || tpl.description;
          const prompt = tt?.prompt || tpl.prompt;
          const catMeta = CAT_META[tpl.category];
          return (
            <button key={tpl.id}
              onClick={() => navigate("/dashboard/boards/new", {
                state: {
                  templatePrompt: prompt,
                  templateName: name,
                  templateDuration: tpl.duration,
                }
              })}
              className="group flex flex-col gap-2 p-3 rounded-xl text-left transition-all hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{catMeta?.emoji || "📄"}</span>
                <span className="text-xs font-semibold text-white/80 flex-1 truncate">{name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/45"
                  style={{ background: "rgba(255,255,255,0.05)" }}>{tpl.duration}s</span>
              </div>
              <p className="text-[11px] text-white/55 line-clamp-2 leading-relaxed">{desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-yellow-400/50 italic">↳ {reason}</span>
                <span className="text-[10px] text-sky-400/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {dt("pe_use_template")} <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function PersonaDetailEditable({
  result: initial, activeDetail, globalPersona, setGlobalPersona,
  onCopy, copied, onNew, onBack, onSave, dt, language, userId,
}: {
  result: PersonaResult; activeDetail: SavedPersona | null;
  globalPersona: any; setGlobalPersona: (p: any) => void;
  onCopy: () => void; copied: boolean; onNew: () => void; onBack: () => void;
  onSave: (updated: PersonaResult) => Promise<void>;
  dt: (key: any) => string;
  language: string;
  userId: string;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PersonaResult>(initial);
  const [brandKit, setBrandKit] = useState<BrandKit>(activeDetail?.brand_kit || {});
  const [kitUploading, setKitUploading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const kitRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(initial); }, [initial]);
  useEffect(() => { setBrandKit(activeDetail?.brand_kit || {}); }, [activeDetail]);

  // Helper: read file as base64 data URL
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("Read failed"));
      r.readAsDataURL(file);
    });

  // Helper: extract first image from ZIP as data URL
  const extractLogoFromZip = async (file: File): Promise<string | null> => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const imageExts = [".png", ".svg", ".jpg", ".jpeg", ".webp"];
      // Prefer files named "logo" first, then any image
      const files = Object.keys(zip.files).filter(n => !zip.files[n].dir);
      const logoFile = files.find(n => /logo/i.test(n) && imageExts.some(e => n.toLowerCase().endsWith(e)))
        || files.find(n => imageExts.some(e => n.toLowerCase().endsWith(e)));
      if (!logoFile) return null;
      const blob = await zip.files[logoFile].async("blob");
      const ext = logoFile.split(".").pop()?.toLowerCase() || "png";
      const mimeMap: Record<string, string> = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", svg:"image/svg+xml", webp:"image/webp" };
      const namedFile = new File([blob], logoFile, { type: mimeMap[ext] || "image/png" });
      return fileToDataUrl(namedFile);
    } catch {
      return null;
    }
  };

  const handleBrandKitUpload = async (file: File) => {
    if (!activeDetail) return;
    const isZip = file.type === "application/zip" || file.type === "application/x-zip-compressed" || file.name.endsWith(".zip");
    const isImage = file.type.startsWith("image/");
    if (!isZip && !isImage) { setKitError("Accepted: ZIP with brand kit, or PNG/JPG/SVG logo"); return; }
    // Cap: images 2MB, ZIP 20MB
    const maxSize = isZip ? 20 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) { setKitError(isZip ? "ZIP max 20MB" : "Logo max 2MB — tip: use SVG for best quality"); return; }
    setKitError(null);
    setKitUploading(true);
    try {
      const { supabase: _sb } = { supabase }; const _supabase = _sb;
      let logoDataUrl: string | null = null;
      let fileName = file.name;

      if (isZip) {
        logoDataUrl = await extractLogoFromZip(file);
        if (!logoDataUrl) { setKitError("No image found in ZIP. Include a PNG, SVG or JPG logo file."); setKitUploading(false); return; }
      } else {
        logoDataUrl = await fileToDataUrl(file);
      }

      const newKit: BrandKit = {
        ...brandKit,
        logo_data_url: logoDataUrl,   // base64 stored directly in JSONB
        file_name: fileName,
        uploaded_at: new Date().toISOString(),
      };
      setBrandKit(newKit);
      await supabase.from("personas").update({ result: { ...activeDetail.result, brand_kit: newKit } as any }).eq("id", activeDetail.id);
      toast.success(dt("pe_brand_logo_done"));
    } catch (e: any) {
      setKitError(e.message || "Upload failed");
    } finally {
      setKitUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Include brand_kit in the saved result
    const updatedDraft = { ...draft, brand_kit: brandKit } as any;
    await onSave(updatedDraft);
    setEditing(false);
    setSaving(false);
  };

  const handleFieldChange = (field: string, value: string) =>
    setDraft(d => ({ ...d, [field]: value }));
  const handleListChange = (field: string, value: string) =>
    setDraft(d => ({ ...d, [field]: value.split("\n").filter(Boolean) }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/60 transition-colors">
          <ChevronLeft className="h-4 w-4" /> {dt("pe_all")}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {activeDetail && globalPersona?.id === activeDetail.id ? (
            <button onClick={() => setGlobalPersona(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.4)", color: "#0ea5e9" }}>
              <Check className="h-3.5 w-3.5" /> {dt("pe_active_deactivate")}
            </button>
          ) : activeDetail ? (
            <button onClick={() => setGlobalPersona({ id: activeDetail.id, ...activeDetail.result } as any)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.2),rgba(6,182,212,0.2))", border: "1px solid rgba(14,165,233,0.3)", color: "#c4b5fd" }}>
              <Users className="h-3.5 w-3.5" /> {dt("pe_activate")}
            </button>
          ) : null}

          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white text-xs font-medium transition-all border border-white/[0.09]">
              <Edit3 className="h-3.5 w-3.5" /> {dt("pe_edit")}
            </button>
          ) : (
            <>
              <button onClick={() => { setDraft(initial); setEditing(false); }}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/60 transition-colors">{dt("pe_cancel")}</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/30 transition-all">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {dt("pe_save_btn")}
              </button>
            </>
          )}

          <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white text-xs transition-all">
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />} {dt("pe_copy")}
          </button>
          <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white text-xs transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> {dt("pe_new_persona")}
          </button>
        </div>
      </div>

      {/* Identity card */}
      <div
        className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/10 p-6">
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            <Persona3DAvatar emoji={draft.avatar_emoji} name={draft.name} gender={draft.gender} size="lg" />
          </div>
          <div className="pt-2 flex-1 space-y-2">
            <EditableTextField field="name" value={draft.name} editing={editing} onChange={handleFieldChange} className={editing ? "" : "text-2xl font-bold text-white block"} />
            <div className="flex items-center gap-3">
              <EditableTextField field="age" value={draft.age} editing={editing} onChange={handleFieldChange} className={editing ? "!w-20" : "text-white/40 text-sm"} />
              {!editing && <span className="text-white/40">·</span>}
              <EditableTextField field="gender" value={draft.gender} editing={editing} onChange={handleFieldChange} className={editing ? "!w-28" : "text-white/40 text-sm"} />
            </div>
            <EditableTextField field="headline" value={draft.headline} editing={editing} onChange={handleFieldChange} className={editing ? "" : "text-purple-300 font-semibold block"} />
            <EditableTextField field="bio" value={draft.bio} rows={3} editing={editing} onChange={handleFieldChange} className={editing ? "" : "text-white/50 text-sm leading-relaxed block mt-3"} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { title: `😤 ${dt("pe_pain_points")}`, items: draft.pains, color: "text-red-400", field: "pains" as keyof PersonaResult },
          { title: `✨ ${dt("pe_desires")}`, items: draft.desires, color: "text-yellow-400", field: "desires" as keyof PersonaResult },
          { title: `🚧 ${dt("pe_objections")}`, items: draft.objections, color: "text-orange-400", field: "objections" as keyof PersonaResult },
          { title: `⚡ ${dt("pe_triggers")}`, items: draft.triggers, color: "text-green-400", field: "triggers" as keyof PersonaResult },
        ].map(({ title, items, color, field }, idx) => (
          <div key={title}
            className="rounded-2xl border border-white/[0.15] bg-white/[0.06] p-5">
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</h3>
            <EditableListField field={field} items={items} color={color} editing={editing} onChange={handleListChange} />
          </div>
        ))}
      </div>

      {/* Ad strategy */}
      <div
        className="rounded-2xl border border-white/[0.15] bg-white/[0.06] p-5 space-y-5">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">{dt("pe_ad_strategy")} {draft.name}</h3>

        <div>
          <p className="text-xs text-white/45 mb-2 uppercase tracking-wider">{dt("pe_hook_angles")}</p>
          <EditableListField field="hook_angles" items={draft.hook_angles} color="text-sky-400" editing={editing} onChange={handleListChange} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/45 mb-2 uppercase tracking-wider">{dt("pe_best_formats")}</p>
            <EditableListField field="best_formats" items={draft.best_formats} color="text-blue-300" editing={editing} onChange={handleListChange} />
          </div>
          <div>
            <p className="text-xs text-white/45 mb-2 uppercase tracking-wider">{dt("pe_best_platforms")}</p>
            <EditableListField field="best_platforms" items={draft.best_platforms} color="text-purple-300" editing={editing} onChange={handleListChange} />
          </div>
        </div>

        {/* ── Connected ad platforms ── */}
        <PersonaPlatformConnections personaId={activeDetail?.id || ""} userId={userId} />

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.12]">
          <div>
            <p className="text-xs text-white/45 mb-1 uppercase tracking-wider">{dt("pe_lang_style")}</p>
            <EditableTextField field="language_style" value={draft.language_style} editing={editing} onChange={handleFieldChange} className={editing ? "" : "text-sm text-white/60"} />
          </div>
          <div>
            <p className="text-xs text-white/45 mb-1 uppercase tracking-wider">{dt("pe_cta_style")}</p>
            <EditableTextField field="cta_style" value={draft.cta_style} editing={editing} onChange={handleFieldChange} className={editing ? "" : "text-sm text-white/60"} />
          </div>
        </div>
      </div>

      {/* Media habits */}
      {(draft.media_habits?.length > 0 || editing) && (
        <div
          className="rounded-2xl border border-white/[0.15] bg-white/[0.06] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-cyan-400">📺 {dt("pe_media_habits")}</h3>
          <EditableListField field="media_habits" items={draft.media_habits} color="text-cyan-400" editing={editing} onChange={handleListChange} />
        </div>
      )}

      {/* ── BRAND KIT ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.18)" }}>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🎨</span> {dt("pe_brand_kit")}
            </h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              {dt("pe_brand_kit_desc")}
            </p>
          </div>
          {(brandKit.logo_data_url || brandKit.uploaded_at) && (
            <span className="text-[10px] text-green-400/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> {dt("pe_brand_uploaded")}
            </span>
          )}
        </div>

        {/* Upload zone */}
        <input ref={kitRef} type="file"
          accept=".zip,.png,.jpg,.jpeg,.svg,.webp,application/zip,image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleBrandKitUpload(f); }} />

        <div
          onClick={() => kitRef.current?.click()}
          className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-8 px-4 text-center"
          style={{
            borderColor: brandKit.logo_data_url ? "rgba(52,211,153,0.35)" : "rgba(139,92,246,0.25)",
            background: brandKit.logo_data_url ? "rgba(52,211,153,0.04)" : "rgba(139,92,246,0.03)",
          }}>

          {kitUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-sky-400/40 border-t-purple-400 animate-spin" />
              <span className="text-xs text-white/40">{dt("pe_brand_uploading")}</span>
            </div>
          ) : brandKit.logo_data_url ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(52,211,153,0.35)" }}>
                <img src={brandKit.logo_data_url} alt="logo"
                  className="w-full h-full object-contain p-1.5" />
              </div>
              <p className="text-sm font-semibold text-green-300">{dt("pe_brand_logo_done")}</p>
              <p className="text-[11px] text-white/50">{brandKit.file_name || "brand kit"} · {dt("pe_brand_click_replace")}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
                📦
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70">{dt("pe_brand_upload_cta")}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{dt("pe_brand_upload_hint")}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["ZIP", "PNG", "SVG", "JPG"].map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full text-white/50"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {kitError && (
          <p className="text-[11px] text-red-400 text-center">{kitError}</p>
        )}

        {/* Asset summary when logo uploaded */}
        {brandKit.logo_data_url && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <p className="text-[10px] text-white/45 uppercase tracking-wider">{dt("pe_brand_assets_used")}</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(52,211,153,0.25)" }}>
                <img src={brandKit.logo_data_url} alt="logo" className="w-full h-full object-contain p-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 truncate">{brandKit.file_name || "brand-logo"}</p>
                <p className="text-[10px] text-green-400/50">{dt("pe_brand_note")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SUGGESTED TEMPLATES ─────────────────────────────── */}
      <SuggestedTemplates persona={draft} dt={dt} language={language} navigate={navigate} />
    </div>
  );
}

type View = "list" | "builder" | "detail";

function PersonaPageInner({ ctx }: { ctx: DashboardContext }) {
  const { user, selectedPersona: globalPersona, setSelectedPersona: setGlobalPersona } = ctx;

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [view, setView] = useState<View>("list");
  const [listTab, setListTab] = useState<"personas" | "companies">("personas");
  const [companies, setCompanies] = useState<any[]>([]);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", industry: "", website: "", description: "", instagram: "", facebook: "", tiktok: "" });
  const [fetchingWebsite, setFetchingWebsite] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Load companies
  const loadCompanies = async () => {
    const { data } = await (supabase as any).from("companies").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setCompanies((data as any[]) || []);
  };
  useEffect(() => { if (listTab === "companies") loadCompanies(); }, [listTab]);

  const fetchWebsiteInfo = async (url: string) => {
    if (!url || !url.includes(".")) return;
    setFetchingWebsite(true);
    try {
      const { data } = await supabase.functions.invoke("adbrief-ai-chat", {
        body: { message: `Extract business info from this website: ${url}. Return JSON only: { "name": "", "industry": "", "description": "" }`, user_id: user.id },
      });
      if (data?.blocks?.[0]?.content) {
        try {
          const info = JSON.parse(data.blocks[0].content.replace(/```json|```/g, "").trim());
          setCompanyForm(prev => ({ ...prev, name: info.name || prev.name, industry: info.industry || prev.industry, description: info.description || prev.description }));
        } catch {}
      }
    } catch {} finally { setFetchingWebsite(false); }
  };

  const saveCompany = async () => {
    if (!companyForm.name) return;
    setSavingCompany(true);
    try {
      await (supabase as any).from("companies").insert({ user_id: user.id, ...companyForm });
      setShowCompanyForm(false);
      setCompanyForm({ name: "", industry: "", website: "", description: "", instagram: "", facebook: "", tiktok: "" });
      loadCompanies();
    } catch {} finally { setSavingCompany(false); }
  };
  const [saved, setSaved] = useState<SavedPersona[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [activeDetail, setActiveDetail] = useState<SavedPersona | null>(null);

  // Builder state
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonaResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(35);

  // ─── Steps (translated) ───
  const STEPS = [
    {
      id: "product", q: dt("pe_q_product"), sub: dt("pe_q_product_sub"),
      type: "text", placeholder: dt("pe_q_product_ph"),
    },
    {
      id: "gender", q: dt("pe_q_gender"), sub: "", type: "single",
      options: [
        { value: "male", label: dt("pe_opt_male"), emoji: "👨" },
        { value: "female", label: dt("pe_opt_female"), emoji: "👩" },
        { value: "both", label: dt("pe_opt_both"), emoji: "👥" },
      ],
    },
    { id: "age", q: dt("pe_q_age"), sub: "", type: "range" },
    {
      id: "income", q: dt("pe_q_income"), sub: "", type: "single",
      options: [
        { value: "low", label: dt("pe_opt_low"), emoji: "💵" },
        { value: "mid", label: dt("pe_opt_mid"), emoji: "💰" },
        { value: "high", label: dt("pe_opt_high"), emoji: "💎" },
        { value: "mixed", label: dt("pe_opt_mixed"), emoji: "🎯" },
      ],
    },
    {
      id: "market", q: dt("pe_q_market"), sub: "", type: "single",
      options: [
        { value: "BR", label: "Brazil", emoji: "🇧🇷" },
        { value: "US", label: "United States", emoji: "🇺🇸" },
        { value: "MX", label: "Mexico", emoji: "🇲🇽" },
        { value: "GLOBAL", label: "Global", emoji: "🌍" },
      ],
    },
    {
      id: "platform", q: dt("pe_q_platform"), sub: "", type: "single",
      options: [
        { value: "tiktok", label: "TikTok", emoji: "📱" },
        { value: "meta", label: "Meta / IG", emoji: "📸" },
        { value: "youtube", label: "YouTube", emoji: "▶️" },
        { value: "google", label: "Google UAC", emoji: "🔍" },
      ],
    },
    {
      id: "pain", q: dt("pe_q_pain"), sub: dt("pe_q_pain_sub"),
      type: "text", placeholder: dt("pe_q_pain_ph"),
    },
  ];

  // ── Fetch saved personas ──
  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const { data } = await supabase
          .from("personas")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (data) {
          setSaved(
            data
              .filter((d: any) => d.result && typeof d.result === "object")
              .map((d: any) => ({
                id: d.id,
                result: sanitizeResult(d.result),
                answers: (d.answers || {}) as Record<string, string>,
                brand_kit: (d.result as any)?.brand_kit as BrandKit | undefined,
                created_at: d.created_at,
              }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch personas:", err);
      }
      setLoadingSaved(false);
    };
    fetchSaved();
  }, [user.id]);

  const current = STEPS[step];
  const answer = answers[current?.id] || "";
  const canNext = current?.type === "range" ? true : answer.trim().length > 0;

  const selectSingle = (value: string) => {
    setAnswers((a) => ({ ...a, [current.id]: value }));
    setTimeout(() => {
      if (step < STEPS.length - 1) setStep((s) => s + 1);
      else generatePersona({ ...answers, [current.id]: value });
    }, 260);
  };

  const handleRangeNext = () => {
    const label = ageMax >= 55 ? `${ageMin}-55+` : `${ageMin}-${ageMax}`;
    const updated = { ...answers, age: label };
    setAnswers(updated);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else generatePersona(updated);
  };

  const handleTextNext = () => {
    if (!canNext) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else generatePersona(answers);
  };

  const generatePersona = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-persona", {
        body: { answers: finalAnswers, user_id: user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: PersonaResult = data.persona;
      setResult(parsed);

      // Save
      let newPersona: SavedPersona | null = null;
      try {
        const { data: inserted } = await supabase
          .from("personas" as never)
          .insert({ user_id: user.id, answers: finalAnswers, result: parsed } as never)
          .select()
          .single();
        if (inserted) {
          newPersona = {
            id: (inserted as any).id,
            result: parsed,
            answers: finalAnswers,
            created_at: (inserted as any).created_at,
          };
          setSaved((prev) => [newPersona!, ...prev]);
        }
      } catch {}

      setView("detail");
      setActiveDetail(newPersona);
    } catch (err: any) {
      toast.error(err?.message || dt("cm_error"));
    } finally {
      setLoading(false);
    }
  };

  const deletePersona = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("personas").delete().eq("id", id);
    setSaved((prev) => prev.filter((p) => p.id !== id));
    if (activeDetail?.id === id) {
      setActiveDetail(null);
      setView("list");
    }
    // If this was the globally active persona, clear it
    if (globalPersona?.id === id) {
      setGlobalPersona(null);
    }
    toast.success(dt("pe_deleted"));
  };

  const handleCopy = (persona: PersonaResult) => {
    const text = `PERSONA: ${persona.name}, ${persona.age} — ${persona.headline}

BIO: ${persona.bio}

PAINS:\n${persona.pains.map((p) => `• ${p}`).join("\n")}

DESIRES:\n${persona.desires.map((d) => `• ${d}`).join("\n")}

HOOK ANGLES:\n${persona.hook_angles.map((h) => `• ${h}`).join("\n")}

BEST FORMATS: ${persona.best_formats.join(", ")}
LANGUAGE: ${persona.language_style}
CTA: ${persona.cta_style}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(dt("pe_copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  // Sanitize PersonaResult so no field is null/undefined — prevents black screen on any browser
  const sanitizeResult = (r: any): PersonaResult => ({
    name:           String(r?.name   || "—"),
    age:            String(r?.age    || "—"),
    gender:         String(r?.gender || "—"),
    headline:       r?.headline       || "",
    bio:            r?.bio            || "",
    pains:          toArr(r?.pains),
    desires:        toArr(r?.desires),
    objections:     toArr(r?.objections),
    triggers:       toArr(r?.triggers),
    media_habits:   toArr(r?.media_habits),
    best_platforms: toArr(r?.best_platforms),
    best_formats:   toArr(r?.best_formats),
    hook_angles:    toArr(r?.hook_angles),
    language_style: r?.language_style || "",
    cta_style:      r?.cta_style      || "",
    avatar_emoji:   r?.avatar_emoji   || "👤",
  });

  const openPersona = (p: SavedPersona) => {
    const safe = { ...p, result: sanitizeResult(p.result) };
    setActiveDetail(safe);
    setResult(safe.result);
    setView("detail");
  };

  const startNew = () => {
    setStep(0);
    setAnswers({});
    setResult(null);
    setActiveDetail(null);
    setView("builder");
  };

  const backToList = () => {
    setView("list");
    setResult(null);
    setActiveDetail(null);
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  // ── LOADING ──
  if (loading)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-sky-500/40 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-sky-500/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-sky-400" />
          </div>
        </div>
        <p className="text-white/40 text-sm">{dt("pe_building")}</p>
      </div>
    );

  // ── LIST VIEW ──
  const F_COMP = "'Inter', sans-serif";
  const INDUSTRIES = ["E-commerce","iGaming / Betting","SaaS / Software","Health & Wellness","Finance / Fintech","Education","Real Estate","Fashion / Apparel","Food & Beverage","Beauty & Cosmetics","Travel & Tourism","Fitness","Entertainment","Marketing / Agency","Consulting","Legal","Automotive","Non-profit","Media / Publishing","Crypto / Web3","Other"];

  if (view === "list")
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-400" />
              Personas &amp; Companies
            </h1>
            <p className="text-white/50 text-sm mt-1">Define who you're targeting. The AI uses this to answer with market context.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => listTab === "personas" ? startNew() : setShowCompanyForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition-all"
            >
              <Plus className="h-4 w-4" /> {listTab === "personas" ? "New Persona" : "New Company"}
            </button>
            <button
              onClick={() => {
                setLoadingSaved(true);
                supabase
                  .from("personas")
                  .select("*")
                  .eq("user_id", user.id)
                  .order("created_at", { ascending: false })
                  .then(({ data }) => {
                    if (data)
                      setSaved(
                        data
                          .filter((d: any) => d.result && typeof d.result === "object")
                          .map((d: any) => ({
                            id: d.id,
                            result: sanitizeResult(d.result),
                            answers: (d.answers || {}) as Record<string, string>,
                            brand_kit: (d.result as any)?.brand_kit as BrandKit | undefined,
                            created_at: d.created_at,
                          }))
                      );
                    setLoadingSaved(false);
                  });
              }}
              className="p-2 rounded-lg bg-white/[0.06] text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadingSaved ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : saved.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-sky-400/50" />
            </div>
            <h3 className="text-white/50 font-medium mb-2">{dt("pe_empty")}</h3>
            <p className="text-white/45 text-sm mb-6 max-w-xs">
              {dt("pe_create_desc")}
            </p>
            <button
              onClick={startNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              <Sparkles className="h-4 w-4" /> {dt("pe_create_first_btn")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {saved.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => openPersona(p)}
                  className="group relative flex flex-col items-center p-5 rounded-2xl border border-white/[0.15] bg-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all cursor-pointer"
                >
                  <button
                    onClick={(e) => deletePersona(p.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all z-10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="mb-4">
                    <Persona3DAvatar emoji={p.result.avatar_emoji} name={p.result.name} gender={p.result.gender} size="md" />
                  </div>

                  <h3 className="text-white font-bold text-sm text-center">{p.result.name}</h3>
                  <p className="text-purple-300 text-xs text-center mt-0.5 line-clamp-1">{p.result.headline}</p>
                  <p className="text-white/45 text-[11px] mt-1">
                    {p.result.age} · {p.result.gender}
                  </p>

                  <div className="flex flex-wrap justify-center gap-1 mt-3">
                    {(p.result.best_platforms || []).slice(0, 3).map((pl) => (
                      <span key={pl} className="px-2 py-0.5 rounded-full text-[10px] border border-sky-500/20 text-purple-300 bg-sky-500/5">
                        {pl}
                      </span>
                    ))}
                  </div>

                  <p className="text-white/15 text-[10px] mt-3">
                    {new Date(p.created_at).toLocaleDateString(language === "pt" ? "pt-BR" : language === "es" ? "es-ES" : language === "fr" ? "fr-FR" : language === "de" ? "de-DE" : language === "zh" ? "zh-CN" : language === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>

                  {globalPersona?.id === p.id ? (
                    <div className="mt-3 px-3 py-1 rounded-full text-[10px] font-semibold" style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9" }}>
                      ✓ {dt("pe_active")}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setGlobalPersona({ id: p.id, ...p.result } as any); }}
                      className="mt-3 px-3 py-1 rounded-full text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: "rgba(14,165,233,0.12)", color: "#c4b5fd", border: "1px solid rgba(14,165,233,0.25)" }}>
                      {dt("pe_use")}
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    );

  // ── DETAIL VIEW ──
  if (view === "detail" && result) {
    return <PersonaDetailEditable
      result={result}
      activeDetail={activeDetail}
      globalPersona={globalPersona}
      setGlobalPersona={setGlobalPersona}
      onCopy={() => handleCopy(result)}
      copied={copied}
      onNew={startNew}
      onBack={backToList}
      dt={dt}
      language={language}
      userId={user.id}
      onSave={async (updated) => {
        if (activeDetail) {
          const resultWithBrandKit = { ...updated, brand_kit: activeDetail.brand_kit } as any;
          await supabase.from("personas" as never)
            .update({ result: resultWithBrandKit } as never)
            .eq("id" as never, activeDetail.id);
          setSaved(prev => prev.map(p => p.id === activeDetail.id ? { ...p, result: updated } : p));
        }
        setResult(updated);
        toast.success(dt("pe_saved_msg"));
      }}
    />;
  }

  // ── BUILDER STEPS ──
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <button onClick={backToList} className="flex items-center gap-1 text-sm text-white/45 hover:text-white/50 transition-colors mr-2">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Users className="h-5 w-5 text-white/40" />
        <h1 className="text-lg font-bold text-white">{dt("pe_builder")}</h1>
        <span className="ml-auto text-xs font-mono text-white/40">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <div className="h-1 bg-white/[0.05] rounded-full mb-8 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">{current.q}</h2>
      {current.sub && <p className="text-white/55 text-sm mb-6">{current.sub}</p>}

      {/* Text input */}
      {current.type === "text" && (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswers((a) => ({ ...a, [current.id]: e.target.value }))}
            placeholder={(current as { placeholder?: string }).placeholder}
            rows={3}
            autoFocus
            className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/40 text-sm resize-none outline-none focus:border-white/25 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleTextNext();
              }
            }}
          />
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm text-white/45 hover:text-white/50 transition-colors">
                <ArrowLeft className="h-4 w-4" /> {dt("pe_back")}
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleTextNext}
              disabled={!canNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-30 transition-all"
            >
              {step === STEPS.length - 1 ? dt("pe_generate_btn") : dt("pe_continue")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Single select */}
      {current.type === "single" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {(current as { options: { value: string; label: string; emoji: string }[] }).options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectSingle(opt.value)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                  answer === opt.value
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/[0.15] bg-white/[0.06] text-white/50 hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-sm font-medium">{opt.label}</span>
                {answer === opt.value && <Check className="ml-auto h-3.5 w-3.5 text-white/50" />}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm text-white/40 hover:text-white/40 transition-colors mt-2">
              <ArrowLeft className="h-4 w-4" /> {dt("pe_back")}
            </button>
          )}
        </div>
      )}

      {/* Dual range slider */}
      {current.type === "range" && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="px-5 py-3 rounded-2xl bg-white/[0.07] border border-white/[0.12] text-center min-w-[80px]">
              <p className="text-xs text-white/50 mb-0.5">{dt("pe_from")}</p>
              <p className="text-2xl font-bold text-white">{ageMin}</p>
            </div>
            <div className="h-px w-8 bg-white/20" />
            <div className="px-5 py-3 rounded-2xl bg-white/[0.07] border border-white/[0.12] text-center min-w-[80px]">
              <p className="text-xs text-white/50 mb-0.5">{dt("pe_to")}</p>
              <p className="text-2xl font-bold text-white">{ageMax >= 55 ? "55+" : ageMax}</p>
            </div>
          </div>

          <div className="relative px-2">
            <div className="relative h-2 mx-2">
              <div className="absolute inset-0 rounded-full bg-white/[0.08]" />
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{
                  left: `${((ageMin - 18) / (55 - 18)) * 100}%`,
                  right: `${100 - ((Math.min(ageMax, 55) - 18) / (55 - 18)) * 100}%`,
                }}
              />
              <input
                type="range" min={18} max={54} value={ageMin}
                onChange={(e) => { const v = Number(e.target.value); if (v < ageMax) setAgeMin(v); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                style={{ zIndex: ageMin > 50 ? 5 : 3 }}
              />
              <input
                type="range" min={19} max={55} value={ageMax}
                onChange={(e) => { const v = Number(e.target.value); if (v > ageMin) setAgeMax(v); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                style={{ zIndex: 4 }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-sky-500 pointer-events-none transition-all"
                style={{ left: `calc(${((ageMin - 18) / (55 - 18)) * 100}% - 10px)` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-pink-500 pointer-events-none transition-all"
                style={{ left: `calc(${((Math.min(ageMax, 55) - 18) / (55 - 18)) * 100}% - 10px)` }}
              />
            </div>
            <div className="flex justify-between mt-4 px-2 text-[10px] text-white/40">
              <span>18</span><span>25</span><span>35</span><span>45</span><span>55+</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm text-white/45 hover:text-white/50 transition-colors">
                <ArrowLeft className="h-4 w-4" /> {dt("pe_back")}
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleRangeNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              {step === STEPS.length - 1 ? dt("pe_generate_btn") : dt("pe_continue")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PersonaPage() {
  const ctx = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  if (!ctx || !ctx.user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  // Free users can VIEW persona page but not create personas — they see an upsell
  const plan = ctx.profile?.plan || "free";
  const isFreeUser = !plan || plan === "free";
  if (isFreeUser) {
    const F = "'Plus Jakarta Sans', sans-serif";
    const BRAND = "linear-gradient(135deg, #0ea5e9, #06b6d4)";
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32, fontFamily: F }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🎯</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10, letterSpacing: "-0.03em" }}>
            Personas are a paid feature
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, marginBottom: 24 }}>
            Personas let you organize campaigns by client, brand or market — and give AdBrief the context it needs to give you relevant, precise answers.
          </p>
          <button onClick={() => navigate("/pricing")}
            style={{ padding: "12px 28px", borderRadius: 12, background: BRAND, color: "#000", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: F }}>
            Upgrade to create personas →
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 12 }}>3-day free trial on any plan</p>
        </div>
      </div>
    );
  }

  return <PersonaPageInner ctx={ctx} />;
}
