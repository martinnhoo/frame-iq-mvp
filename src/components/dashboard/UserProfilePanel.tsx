import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import {
  X, LogOut, Save, Trash2, RefreshCw, Sparkles,
  Loader2, Check, User, Palette, CreditCard, Shield,
  ChevronRight, Zap, Settings, Camera, ArrowLeft, Edit3,
} from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
import Persona3DAvatar from "./Persona3DAvatar";
import { useLanguage } from "@/i18n/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string | null;
  preferred_market: string | null;
  preferred_language: string | null;
  onboarding_data?: Record<string, unknown> | null;
}

interface PersonaRecord {
  id: string;
  created_at: string;
  name: string;
  age: string;
  gender?: string;
  headline: string;
  bio: string;
  pains?: string[];
  desires?: string[];
  triggers?: string[];
  hook_angles?: string[];
  best_formats?: string[];
  best_platforms?: string[];
  language_style?: string;
  cta_style?: string;
  avatar_emoji?: string;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: SupaUser;
  profile: Profile | null;
  onProfileUpdate: (p: Profile) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MARKETS = [
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "US", flag: "🇺🇸", name: "USA" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "GB", flag: "🇬🇧", name: "UK" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "GLOBAL", flag: "🌍", name: "Global" },
];

const LANGUAGES = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "Hindi" },
];

const PLAN_INFO: Record<string, { label: string; color: string; desc: string; price: string }> = {
  free:    { label: "Free",    color: "#9ca3af", desc: "3 mensagens grátis · conecte o Meta Ads",        price: "$0" },
  maker:   { label: "Maker",   color: "#60a5fa", desc: "50 mensagens/dia · 1 conta · ferramentas básicas", price: "$19/mo" },
  pro:     { label: "Pro",     color: "#0ea5e9", desc: "200 mensagens/dia · 3 contas · todas as tools",   price: "$49/mo" },
  studio:  { label: "Studio",  color: "#a78bfa", desc: "Mensagens ilimitadas · contas ilimitadas · agência", price: "$149/mo" },
  creator: { label: "Maker",   color: "#60a5fa", desc: "50 mensagens/dia · 1 conta",                      price: "$19/mo" },
  starter: { label: "Pro",     color: "#0ea5e9", desc: "200 mensagens/dia · 3 contas",                    price: "$49/mo" },
  scale:   { label: "Studio",  color: "#a78bfa", desc: "Mensagens ilimitadas · agência",                  price: "$149/mo" },
};

// ── Persona Detail View (Editable) ─────────────────────────────────────────────

function PersonaDetailView({
  persona,
  onBack,
  onSave,
  onDelete,
  isDeleting,
  userId,
}: {
  persona: PersonaRecord;
  onBack: () => void;
  onSave: (updated: PersonaRecord) => void;
  onDelete: () => void;
  isDeleting: boolean;
  userId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(persona);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...resultData } = draft;
    const { error } = await supabase
      .from("personas" as never)
      .update({ result: resultData } as never)
      .eq("id" as never, id)
      .eq("user_id" as never, userId);
    if (!error) {
      onSave(draft);
      setEditing(false);
      toast.success("Persona updated!");
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const Field = ({ label, value, field }: { label: string; value: string; field: keyof PersonaRecord }) => (
    <div className="space-y-1">
      <label className="text-[9px] uppercase tracking-widest text-white/40">{label}</label>
      {editing ? (
        <input value={value} onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.1] text-white text-xs outline-none focus:border-sky-500/40 transition-colors" />
      ) : (
        <p className="text-xs text-white/60">{value || "—"}</p>
      )}
    </div>
  );

  const ListField = ({ label, values, field }: { label: string; values: string[]; field: keyof PersonaRecord }) => (
    <div className="space-y-1.5">
      <label className="text-[9px] uppercase tracking-widest text-white/40">{label}</label>
      {editing ? (
        <textarea
          value={(values || []).join("\n")}
          onChange={e => setDraft(d => ({ ...d, [field]: e.target.value.split("\n").filter(Boolean) }))}
          rows={Math.max(2, (values || []).length)}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.1] text-white text-xs outline-none focus:border-sky-500/40 transition-colors resize-none"
          placeholder="One per line"
        />
      ) : (
        <div className="space-y-1">
          {(values || []).map((v, i) => (
            <p key={i} className="text-[11px] text-white/50 flex gap-1.5">
              <span className="text-sky-400/60 shrink-0">·</span>
              <span>{v}</span>
            </p>
          ))}
          {(!values || values.length === 0) && <p className="text-xs text-white/45">—</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="h-8 w-8 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.09] text-white/50 text-xs font-medium hover:bg-white/[0.1] hover:text-white transition-all">
            <Edit3 className="h-3 w-3" /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setDraft(persona); setEditing(false); }}
              className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/60 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-purple-300 text-xs font-medium hover:bg-sky-500/30 transition-all">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        )}
        <button onClick={onDelete} disabled={isDeleting}
          className="h-8 w-8 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <Persona3DAvatar emoji={draft.avatar_emoji || "👤"} name={draft.name} gender={draft.gender || ""} size="lg" />
        {editing ? (
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            className="text-center text-lg font-bold text-white bg-transparent border-b border-white/20 outline-none" />
        ) : (
          <p className="text-lg font-bold text-white">{draft.name}</p>
        )}
        <p className="text-xs text-purple-300/60 text-center">{editing
          ? <input value={draft.headline} onChange={e => setDraft(d => ({ ...d, headline: e.target.value }))}
              className="text-center text-xs text-purple-300/60 bg-transparent border-b border-white/10 outline-none w-full" />
          : draft.headline}</p>
      </div>

      <div className="space-y-4 px-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" value={draft.age} field="age" />
          <Field label="Gender" value={draft.gender || ""} field="gender" />
        </div>
        <Field label="Language style" value={draft.language_style || ""} field="language_style" />
        <Field label="CTA style" value={draft.cta_style || ""} field="cta_style" />
        {editing ? (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-white/40">Bio</label>
            <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
              rows={3} className="w-full px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.1] text-white text-xs outline-none focus:border-sky-500/40 transition-colors resize-none" />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-white/40">Bio</label>
            <p className="text-xs text-white/50 leading-relaxed">{draft.bio || "—"}</p>
          </div>
        )}
        <ListField label="Pains" values={draft.pains || []} field="pains" />
        <ListField label="Desires" values={draft.desires || []} field="desires" />
        <ListField label="Triggers" values={draft.triggers || []} field="triggers" />
        <ListField label="Hook angles" values={draft.hook_angles || []} field="hook_angles" />
        <ListField label="Best platforms" values={draft.best_platforms || []} field="best_platforms" />
        <ListField label="Best formats" values={draft.best_formats || []} field="best_formats" />
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function UserProfilePanel({ open, onClose, user, profile, onProfileUpdate }: Props) {
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("GLOBAL");
  const [lang, setLang] = useState("en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const { setLanguage: setGlobalLanguage, language } = useLanguage();

  // Load intelligence data when tab changes to intelligence
  useEffect(() => {
    if (tab !== "intelligence" || !user?.id) return;
    setIntelLoading(true);
    Promise.all([
      (supabase as any).from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, sample_size")
        .eq("user_id", user.id).order("confidence", { ascending: false }).limit(15),
      (supabase as any).from("creative_memory")
        .select("hook_type, hook_score, platform, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("user_ai_profile")
        .select("ai_summary, avg_hook_score, total_analyses, top_performing_models, ai_recommendations, last_updated")
        .eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("daily_snapshots")
        .select("date, total_spend, avg_ctr, active_ads, winners_count, losers_count, ai_insight")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(7),
    ]).then(([patterns, memory, aiProfile, snaps]) => {
      setIntel({ patterns: patterns.data || [], memory: memory.data || [], profile: aiProfile.data, snaps: snaps.data || [] });
    }).catch(() => {}).finally(() => setIntelLoading(false));
  }, [tab, user?.id]);

  // Sync fields when panel opens
  useEffect(() => {
    if (open) {
      setName(profile?.name || "");
      setMarket(profile?.preferred_market || "GLOBAL");
      const savedLang = profile?.preferred_language || "en";
      setLang(savedLang);
      // Apply profile language to global context (without overriding localStorage)
      setGlobalLanguage(savedLang as any, false);
      setAvatarUrl(profile?.avatar_url || null);
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ name: name.trim() || null, preferred_market: market, preferred_language: lang })
      .eq("id", user.id)
      .select()
      .single();

    if (!error && data) {
      onProfileUpdate(data as Profile);
      setGlobalLanguage(lang as any, true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      toast.success(language === "pt" ? "Salvo!" : "Saved!");
    } else {
      toast.error(language === "pt" ? "Erro ao salvar" : "Failed to save");
    }
    setSaving(false);
  };

  const compressImage = (file: File, maxSize = 256, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
          "image/webp",
          quality
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file, 256, 0.75);
      const path = `${user.id}/avatar.webp`;

      await supabase.storage.from("avatars").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/webp" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(newUrl);
      onProfileUpdate({ ...profile!, avatar_url: newUrl });
      toast.success("Avatar updated!");
    } catch (err: unknown) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const plan = PLAN_INFO[profile?.plan || "free"] || PLAN_INFO.free;
  const initials = profile?.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U";

  // Block scroll on body when panel open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const F = "'Plus Jakarta Sans', sans-serif";
  const M = "'Inter', sans-serif";

  const TABS_NEW = [
    { id: "profile",      label: language === "pt" ? "Perfil"        : language === "es" ? "Perfil"        : "Profile",      icon: User },
    { id: "intelligence", label: language === "pt" ? "Inteligência"  : language === "es" ? "Inteligencia"  : "Intelligence", icon: Zap },
    { id: "plan",         label: language === "pt" ? "Plano"         : language === "es" ? "Plan"           : "Plan",         icon: CreditCard },
    { id: "security",     label: language === "pt" ? "Segurança"     : language === "es" ? "Seguridad"      : "Security",     icon: Shield },
  ];

  return (
    <>
      <style>{`
        @keyframes panelIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .panel-enter { animation: panelIn 0.25s cubic-bezier(.23,1,.32,1) both; }
      `}</style>

      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div role="dialog" aria-label="User profile" className="panel-enter fixed right-0 top-0 bottom-0 z-[61] w-full flex flex-col"
        style={{ maxWidth: 400, background: "#0e1118", borderLeft: "1px solid rgba(255,255,255,0.10)", boxShadow: "-24px 0 80px rgba(0,0,0,0.6)", fontFamily: F }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <Logo size="md" />
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* User card */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(255,255,255,0.10)" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>
                  {initials}
                </div>
              )}
              <label style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#1d2438", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {uploadingAvatar ? <Loader2 className="h-2.5 w-2.5 text-white/40 animate-spin" /> : <Camera className="h-2.5 w-2.5" style={{ color: "rgba(255,255,255,0.5)" }} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#eef0f6", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || user.email?.split("@")[0]}</p>
              <p style={{ fontFamily: M, fontSize: 11, color: "rgba(238,240,246,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
            </div>
            <div style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 20, background: `${plan.color}18`, border: `1px solid ${plan.color}40`, fontFamily: M, fontSize: 11, fontWeight: 700, color: plan.color }}>{plan.label}</div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 3 }}>
            {TABS_NEW.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: M, fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                  background: tab === t.id ? "rgba(255,255,255,0.09)" : "transparent",
                  color: tab === t.id ? "#eef0f6" : "rgba(238,240,246,0.38)" }}>
                <t.icon className="h-3 w-3" />{t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 0 0", flexShrink: 0 }} />

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 32px" }}>

          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontFamily: M, fontSize: 10, fontWeight: 600, color: "rgba(238,240,246,0.35)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>{language === "pt" ? "Nome" : language === "es" ? "Nombre" : "Name"}</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={language === "pt" ? "Seu nome" : language === "es" ? "Tu nombre" : "Your name"}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#1a2032", border: "1px solid rgba(255,255,255,0.10)", color: "#eef0f6", fontFamily: M, fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)"; }} onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: M, fontSize: 10, fontWeight: 600, color: "rgba(238,240,246,0.35)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>Email</label>
                <input value={user.email || ""} disabled style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(238,240,246,0.30)", fontFamily: M, fontSize: 13, boxSizing: "border-box" as const, cursor: "not-allowed" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: M, fontSize: 10, fontWeight: 600, color: "rgba(238,240,246,0.35)", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>{language === "pt" ? "Idioma" : language === "es" ? "Idioma" : "Language"}</label>
                <select value={lang} onChange={e => setLang(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#1a2032", border: "1px solid rgba(255,255,255,0.10)", color: "#eef0f6", fontFamily: M, fontSize: 13, outline: "none", boxSizing: "border-box" as const, cursor: "pointer" }}>
                  <option value="pt">🇧🇷 Português</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇲🇽 Español</option>
                </select>
              </div>
              <button onClick={handleSave} disabled={saving}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 20px", borderRadius: 10, background: saved ? "#34d399" : "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff", opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? (language === "pt" ? "Salvando..." : "Saving...") : saved ? (language === "pt" ? "Salvo!" : "Saved!") : (language === "pt" ? "Salvar alterações" : language === "es" ? "Guardar cambios" : "Save changes")}
              </button>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)", cursor: "pointer", fontFamily: M, fontSize: 13, fontWeight: 600, color: "#f87171" }}>
                <LogOut className="h-4 w-4" />{language === "pt" ? "Sair da conta" : language === "es" ? "Cerrar sesión" : "Sign out"}
              </button>
            </div>
          )}

          {tab === "plan" && (() => {
            const currentPlan = profile?.plan || "free";
            const isPro = currentPlan === "pro";
            const isStudio = currentPlan === "studio";
            const isFree = currentPlan === "free";
            const isMaker = currentPlan === "maker";

            const FEATURES: Record<string, { icon: string; label: string }[]> = {
              free:   [{ icon:"💬", label: language==="pt"?"3 mensagens IA/dia":"3 AI messages/day" }, { icon:"🔗", label: language==="pt"?"Conectar Meta Ads":"Connect Meta Ads" }],
              maker:  [{ icon:"💬", label: language==="pt"?"50 mensagens IA/dia":"50 AI messages/day" }, { icon:"🔗", label: language==="pt"?"1 conta de anúncios":"1 ad account" }, { icon:"🛠️", label: language==="pt"?"Ferramentas básicas":"Basic tools" }],
              pro:    [{ icon:"💬", label: language==="pt"?"200 mensagens IA/dia":"200 AI messages/day" }, { icon:"🔗", label: language==="pt"?"3 contas de anúncios":"3 ad accounts" }, { icon:"⚡", label: language==="pt"?"Todas as ferramentas":"All tools" }, { icon:"🌍", label: language==="pt"?"Multi-mercado":"Multi-market" }, { icon:"📊", label: language==="pt"?"Dashboards avançados":"Advanced dashboards" }],
              studio: [{ icon:"∞", label: language==="pt"?"Mensagens ilimitadas":"Unlimited messages" }, { icon:"🔗", label: language==="pt"?"Contas ilimitadas":"Unlimited accounts" }, { icon:"⚡", label: language==="pt"?"Todas as ferramentas":"All tools" }, { icon:"🏢", label: language==="pt"?"Workspace agência":"Agency workspace" }, { icon:"🚀", label: language==="pt"?"Prioridade máxima":"Maximum priority" }],
            };

            const planKey = ["maker","pro","studio"].includes(currentPlan) ? currentPlan : (["creator"].includes(currentPlan) ? "maker" : ["starter"].includes(currentPlan) ? "pro" : ["scale"].includes(currentPlan) ? "studio" : "free");
            const features = FEATURES[planKey] || FEATURES.free;

            const NEXT_PLAN: Record<string, { key: string; label: string; price: string; pitch: string }> = {
              free:   { key: "maker",  label: "Maker",  price: "$19/mo", pitch: language==="pt"?"Desbloqueie mais mensagens e ferramentas de criativo":"Unlock more messages and creative tools" },
              maker:  { key: "pro",    label: "Pro",    price: "$49/mo", pitch: language==="pt"?"3 contas, todas as tools, multi-mercado — tudo desbloqueado":"3 accounts, all tools, multi-market" },
              pro:    { key: "studio", label: "Studio", price: "$149/mo", pitch: language==="pt"?"Ilimitado. Para agências e times que produzem todos os dias":"Unlimited. For agencies that produce every day" },
            };
            const next = NEXT_PLAN[planKey];

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Current plan card */}
                <div style={{ padding: "18px", borderRadius: 14, background: `${plan.color}12`, border: `1px solid ${plan.color}35`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${plan.color}20, transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontFamily: F, fontSize: 18, fontWeight: 900, color: "#eef0f6", letterSpacing: "-0.02em" }}>{plan.label}</p>
                    <span style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: plan.color, padding: "3px 10px", borderRadius: 20, background: `${plan.color}18`, border: `1px solid ${plan.color}40` }}>
                      {language==="pt"?"Plano atual":"Current plan"}
                    </span>
                  </div>
                  {(isPro || isStudio) && (
                    <p style={{ fontFamily: M, fontSize: 12, color: "#34d399", fontWeight: 600, marginBottom: 10 }}>
                      {isStudio ? "🏆 " : "⭐ "}{language==="pt" ? (isStudio?"Você está no topo! Máximo poder da IA.":"Ótima escolha! Você tem acesso a tudo.") : (isStudio?"You're at the top! Maximum AI power.":"Great choice! You have access to everything.")}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {features.map((f,i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, width: 20, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                        <span style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.70)" }}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upgrade CTA */}
                {next && (
                  <div style={{ padding: "16px", borderRadius: 14, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.20)" }}>
                    <p style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#eef0f6", marginBottom: 4 }}>
                      {language==="pt"?`Próximo: ${next.label} — ${next.price}`:`Next: ${next.label} — ${next.price}`}
                    </p>
                    <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.50)", lineHeight: 1.5, marginBottom: 12 }}>{next.pitch}</p>
                    <button onClick={() => setPlanModalOpen(true)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 10, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      <Zap className="h-4 w-4" />
                      {language==="pt"?`Fazer upgrade para ${next.label}`:`Upgrade to ${next.label}`}
                    </button>
                  </div>
                )}

                {/* Support */}
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: "rgba(238,240,246,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    {language==="pt"?"Suporte":"Support"}
                  </p>
                  <a href="mailto:support@adbrief.pro"
                    style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: M, fontSize: 12, color: "#38bdf8", textDecoration: "none", fontWeight: 500 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    support@adbrief.pro
                  </a>
                </div>
              </div>
            );
          })()}

          {tab === "intelligence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {intelLoading ? (
                <div style={{ padding: "32px", textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(238,240,246,0.40)" }}>
                    {language === "pt" ? "Carregando inteligência..." : "Loading intelligence..."}
                  </p>
                </div>
              ) : !intel ? null : (
                <>
                  {/* AI Profile Summary */}
                  {intel.profile?.ai_summary && (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)" }}>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(14,165,233,0.60)", letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 7 }}>
                        {language === "pt" ? "O que aprendi sobre você" : language === "es" ? "Lo que aprendí sobre ti" : "What I learned about you"}
                      </p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(238,240,246,0.75)", lineHeight: 1.65, margin: 0 }}>{intel.profile.ai_summary}</p>
                      {intel.profile.last_updated && (
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.25)", marginTop: 6 }}>
                          {language === "pt" ? "Atualizado" : "Updated"}: {new Date(intel.profile.last_updated).toLocaleDateString(language === "pt" ? "pt-BR" : "en")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" as const }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, color: "#0ea5e9", margin: 0 }}>{intel.memory.length}</p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.38)", margin: "2px 0 0" }}>{language === "pt" ? "Criativos" : "Creatives"}</p>
                    </div>
                    <div style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" as const }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, color: "#34d399", margin: 0 }}>
                        {intel.patterns.filter((p: any) => p.is_winner).length}
                      </p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.38)", margin: "2px 0 0" }}>{language === "pt" ? "Padrões ✓" : "Patterns ✓"}</p>
                    </div>
                    <div style={{ padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" as const }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, color: "#fbbf24", margin: 0 }}>
                        {intel.profile?.avg_hook_score ? intel.profile.avg_hook_score.toFixed(1) : "—"}
                      </p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.38)", margin: "2px 0 0" }}>Score médio</p>
                    </div>
                  </div>

                  {/* Daily snapshots */}
                  {intel.snaps.length > 0 && (
                    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.30)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                          {language === "pt" ? "Histórico diário" : language === "es" ? "Historial diario" : "Daily history"}
                        </p>
                      </div>
                      <div style={{ padding: "8px" }}>
                        {intel.snaps.map((s: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: i === 0 ? "rgba(14,165,233,0.06)" : "transparent" }}>
                            <div>
                              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(238,240,246,0.65)" }}>{s.date}</span>
                              {s.ai_insight && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.35)", margin: "2px 0 0", lineHeight: 1.4 }}>{s.ai_insight.slice(0, 70)}...</p>}
                            </div>
                            <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 8 }}>
                              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, color: "#34d399", margin: 0 }}>CTR {(s.avg_ctr * 100).toFixed(2)}%</p>
                              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.35)", margin: "1px 0 0" }}>R${s.total_spend?.toFixed(0)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Winner patterns */}
                  {intel.patterns.filter((p: any) => p.is_winner).length > 0 && (
                    <div style={{ borderRadius: 12, border: "1px solid rgba(52,211,153,0.18)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: "rgba(52,211,153,0.05)", borderBottom: "1px solid rgba(52,211,153,0.12)" }}>
                        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(52,211,153,0.60)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                          {language === "pt" ? "Padrões vencedores" : language === "es" ? "Patrones ganadores" : "Winning patterns"}
                        </p>
                      </div>
                      <div style={{ padding: "8px" }}>
                        {intel.patterns.filter((p: any) => p.is_winner).slice(0, 5).map((p: any, i: number) => (
                          <div key={i} style={{ padding: "9px 12px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.025)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, color: "#34d399" }}>✓ {p.pattern_key.replace(/_/g, " ").slice(0, 35)}</span>
                              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(238,240,246,0.35)" }}>{(p.confidence * 100).toFixed(0)}% conf.</span>
                            </div>
                            {p.insight_text && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(238,240,246,0.55)", margin: 0, lineHeight: 1.4 }}>{p.insight_text.slice(0, 80)}</p>}
                            {p.avg_ctr > 0 && <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "rgba(52,211,153,0.60)", margin: "3px 0 0" }}>CTR {(p.avg_ctr * 100).toFixed(3)}% · {p.sample_size} amostras</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {intel.patterns.length === 0 && intel.memory.length === 0 && intel.snaps.length === 0 && (
                    <div style={{ padding: "32px 16px", textAlign: "center" as const, borderRadius: 12, border: "1px dashed rgba(255,255,255,0.09)" }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>🧠</div>
                      <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(238,240,246,0.42)", margin: "0 0 6px" }}>
                        {language === "pt" ? "Ainda aprendendo..." : "Still learning..."}
                      </p>
                      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "rgba(238,240,246,0.22)", margin: 0, lineHeight: 1.5 }}>
                        {language === "pt" ? "Use o chat, gere hooks e analise concorrentes — o produto aprende automaticamente." : "Use chat, generate hooks and analyze competitors — the product learns automatically."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "18px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: "#eef0f6", marginBottom: 6 }}>
                  {language==="pt"?"Redefinir senha":language==="es"?"Restablecer contraseña":"Reset password"}
                </p>
                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.42)", lineHeight: 1.6, marginBottom: 14 }}>
                  {language==="pt"?"Enviaremos um link para o seu email para redefinir a senha.":language==="es"?"Enviaremos un enlace a tu correo para restablecer la contraseña.":"We'll send a link to your email to reset your password."}
                </p>
                <button onClick={async () => { await supabase.auth.resetPasswordForEmail(user.email || ""); toast.success(language==="pt"?"Link enviado para "+user.email:"Link sent to "+user.email); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, color: "#eef0f6" }}>
                  <Shield className="h-4 w-4" />
                  {language==="pt"?"Enviar link de redefinição":language==="es"?"Enviar enlace de restablecimiento":"Send reset link"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {planModalOpen && (
        <PlanUpgradeModal open={planModalOpen} onClose={() => setPlanModalOpen(false)} currentPlan={profile?.plan || "free"} />
      )}
    </>
  );
}
