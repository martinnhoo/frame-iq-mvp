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
  // Close on ESC key
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("GLOBAL");
  const [lang, setLang] = useState("en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [telegramConn, setTelegramConn] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [pairingLink, setPairingLink] = useState<string|null>(null);
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
        .select("ai_summary, avg_hook_score, total_analyses, top_performing_models, ai_recommendations, last_updated, pain_point")
        .eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("daily_snapshots")
        .select("date, total_spend, avg_ctr, active_ads, winners_count, losers_count, ai_insight")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(7),
    ]).then(([patterns, memory, aiProfile, snaps]) => {
      setIntel({ patterns: patterns.data || [], memory: memory.data || [], profile: aiProfile.data, snaps: snaps.data || [] });
      // Load existing instructions
      const rawNotes = aiProfile.data?.pain_point as string | null;
      if (rawNotes) {
        const items = rawNotes.split("|||").filter((s: string) => !s.startsWith("Usuário:") && !s.startsWith("Nicho:") && Boolean(s.trim()));
        setInstructionsText(items.join("\n"));
      }
    }).catch(() => {}).finally(() => setIntelLoading(false));
  }, [tab, user?.id]);

  useEffect(() => {
    if (!open || !user?.id) return;
    (supabase as any).from("telegram_connections")
      .select("chat_id, telegram_username, connected_at")
      .eq("user_id", user.id).eq("active", true).maybeSingle()
      .then(({ data }: any) => setTelegramConn(data || null));
  }, [open, user?.id]);

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

      <div role="dialog" aria-label="User profile" className="panel-enter fixed right-0 top-0 bottom-0 z-[61] flex flex-col profile-panel-width"
        style={{ width: "min(400px, 100vw)", background: "#0e1118", borderLeft: "1px solid rgba(255,255,255,0.10)", boxShadow: "-24px 0 80px rgba(0,0,0,0.6)", fontFamily: F }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <Logo size="md" />
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}>
              <X className="h-4 w-4" />
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

                {/* ── Telegram ── */}
                <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ padding: "9px 14px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0, flex: 1 }}>Telegram Alerts</p>
                    {telegramConn && <span style={{ fontFamily: M, fontSize: 10, color: "#34d399", fontWeight: 600 }}>● Ativo</span>}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    {telegramConn ? (
                      <div>
                        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "0 0 6px" }}>
                          {telegramConn.telegram_username ? `@${telegramConn.telegram_username}` : "Conectado"}
                          {telegramConn.connected_at ? ` · ${new Date(telegramConn.connected_at).toLocaleDateString(language === "pt" ? "pt-BR" : "en")}` : ""}
                        </p>
                        <p style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "0 0 10px", lineHeight: 1.5 }}>Recebendo alertas via @AdBriefAlertsBot</p>
                        <button onClick={async () => {
                          await (supabase as any).from("telegram_connections").update({ active: false }).eq("user_id", user.id);
                          setTelegramConn(null); setPairingLink(null);
                        }} style={{ fontFamily: M, fontSize: 11, color: "rgba(248,113,113,0.7)", background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                          Desconectar
                        </button>
                      </div>
                    ) : pairingLink ? (
                      <div>
                        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.55)", margin: "0 0 8px", lineHeight: 1.5 }}>
                          Abra o link no Telegram e toque <b>/start</b>:
                        </p>
                        <a href={pairingLink} target="_blank" rel="noreferrer"
                          style={{ display: "block", fontFamily: M, fontSize: 11, color: "#0ea5e9", wordBreak: "break-all" as const, marginBottom: 6 }}>
                          {pairingLink}
                        </a>
                        <p style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.2)", margin: 0 }}>Expira em 10 minutos</p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 10px", lineHeight: 1.5 }}>
                          Receba alertas críticos e execute comandos direto no Telegram. Tudo registrado no AdBrief.
                        </p>
                        <button disabled={telegramLoading} onClick={async () => {
                          setTelegramLoading(true);
                          try {
                            const tok = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8);
                            await (supabase as any).from("telegram_pairing_tokens").insert({
                              user_id: user.id, token: tok,
                              expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
                            });
                            setPairingLink(`https://t.me/AdBriefAlertsBot?start=${tok}`);
                          } catch {}
                          setTelegramLoading(false);
                        }} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)", color: "#0ea5e9", fontSize: 12, fontWeight: 700, fontFamily: M, cursor: telegramLoading ? "not-allowed" : "pointer" }}>
                          {telegramLoading ? "..." : "✈️ Conectar Telegram"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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

          {tab === "intelligence" && (() => {
            const translatePatternKey = (key: string): string => {
              const map: Record<string, string> = {
                chat_hooks_like: language === "pt" ? "Hooks aprovados no chat" : language === "es" ? "Hooks aprobados" : "Approved hooks",
                chat_hooks_dislike: language === "pt" ? "Hooks rejeitados" : "Rejected hooks",
              };
              if (map[key]) return map[key];
              if (key.startsWith("meta_winner_") || key.startsWith("meta_ad_")) return key.replace(/^meta_(winner|ad)_/, "").replace(/_/g, " ");
              if (key.startsWith("competitor_")) return (language === "pt" ? "Concorrente: " : "Competitor: ") + key.replace("competitor_", "").replace(/_/g, " ");
              if (key.startsWith("perf_")) return (language === "pt" ? "Performance: " : "") + key.replace("perf_", "").replace(/_/g, " ");
              return key.replace(/_/g, " ");
            };
            const realPatterns = (intel?.patterns || []).filter((p: any) => (p.avg_ctr || 0) > 0 || (p.avg_roas || 0) > 0);
            const prefPatterns = (intel?.patterns || []).filter((p: any) => !p.avg_ctr && !p.avg_roas && p.is_winner);
            const hasSnaps = (intel?.snaps || []).length > 0;
            const s0 = intel?.snaps?.[0];
            const s1 = intel?.snaps?.[1];
            const delCtr = s0 && s1 && s1.avg_ctr > 0 ? ((s0.avg_ctr - s1.avg_ctr) / s1.avg_ctr * 100) : null;
            const deletePattern = async (key: string) => {
              await (supabase as any).from("learned_patterns").delete().eq("pattern_key", key).eq("user_id", user.id);
              setIntel((prev: any) => prev ? { ...prev, patterns: prev.patterns.filter((x: any) => x.pattern_key !== key) } : prev);
            };
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {intelLoading ? (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(14,165,233,0.2)", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                    <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.40)" }}>{language === "pt" ? "Carregando..." : "Loading..."}</p>
                  </div>
                ) : (
                  <>
                    {/* Summary card with reload */}
                    {intel?.profile?.ai_summary && (
                      <div style={{ padding: "14px 16px 12px", borderRadius: 12, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)", position: "relative" as const }}>
                        <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(14,165,233,0.60)", letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 7 }}>
                          {language === "pt" ? "O que aprendi sobre você" : language === "es" ? "Lo que aprendí sobre ti" : "What I've learned"}
                        </p>
                        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.75)", lineHeight: 1.65, margin: 0 }}>{intel.profile.ai_summary}</p>
                        {intel.profile.last_updated && (
                          <p style={{ fontFamily: M, fontSize: 10, color: "rgba(238,240,246,0.25)", marginTop: 5 }}>
                            {language === "pt" ? "Atualizado" : "Updated"}: {new Date(intel.profile.last_updated).toLocaleDateString(language === "pt" ? "pt-BR" : "en")}
                          </p>
                        )}
                        <button onClick={() => { setIntel(null); setIntelLoading(true); }}
                          title={language === "pt" ? "Recarregar" : "Reload"}
                          style={{ position: "absolute" as const, bottom: 8, right: 8, width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.45 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0.45")}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(238,240,246,0.7)" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                      </div>
                    )}

                    {/* Meta Ads real performance */}
                    {hasSnaps && s0 ? (
                      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.30)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                            {language === "pt" ? "Performance Meta Ads" : "Meta Ads Performance"}
                          </p>
                          <span style={{ fontFamily: M, fontSize: 10, color: "rgba(238,240,246,0.25)" }}>{s0.date}</span>
                        </div>
                        <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          {[
                            { val: `R$${(s0.total_spend||0).toFixed(0)}`, label: language === "pt" ? "Spend 7d" : "7d Spend", color: "#eef0f6" },
                            { val: `${((s0.avg_ctr||0)*100).toFixed(2)}%`, label: "CTR", color: (s0.avg_ctr||0) >= 0.02 ? "#34d399" : (s0.avg_ctr||0) >= 0.01 ? "#fbbf24" : "#f87171", extra: delCtr !== null ? `${delCtr > 0 ? "↑" : "↓"} ${Math.abs(delCtr).toFixed(1)}%` : null, extraColor: delCtr !== null ? (delCtr > 0 ? "#34d399" : "#f87171") : "transparent" },
                            { val: String(s0.active_ads||0), label: language === "pt" ? "Ads ativos" : "Active ads", color: "#eef0f6" },
                          ].map((item, i) => (
                            <div key={i} style={{ textAlign: "center" as const }}>
                              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 900, color: item.color, margin: 0 }}>{item.val}</p>
                              <p style={{ fontFamily: M, fontSize: 9, color: "rgba(238,240,246,0.35)", margin: "2px 0 0" }}>{item.label}</p>
                              {(item as any).extra && <p style={{ fontFamily: M, fontSize: 9, color: (item as any).extraColor, margin: "1px 0 0" }}>{(item as any).extra}</p>}
                            </div>
                          ))}
                        </div>
                        {(s0.winners_count > 0 || s0.losers_count > 0) && (
                          <div style={{ padding: "0 14px 10px", display: "flex", gap: 6 }}>
                            {s0.winners_count > 0 && <div style={{ flex: 1, padding: "6px 8px", borderRadius: 7, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", textAlign: "center" as const }}>
                              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "#34d399", margin: 0 }}>↑ {s0.winners_count} {language === "pt" ? "escalar" : "scale"}</p>
                            </div>}
                            {s0.losers_count > 0 && <div style={{ flex: 1, padding: "6px 8px", borderRadius: 7, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", textAlign: "center" as const }}>
                              <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "#f87171", margin: 0 }}>⏸ {s0.losers_count} {language === "pt" ? "pausar" : "pause"}</p>
                            </div>}
                          </div>
                        )}
                        {s0.ai_insight && (
                          <div style={{ padding: "8px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <p style={{ fontFamily: M, fontSize: 11, color: "rgba(238,240,246,0.60)", lineHeight: 1.55, margin: 0 }}>💡 {s0.ai_insight}</p>
                          </div>
                        )}
                        {intel.snaps.length > 1 && (
                          <div style={{ padding: "4px 14px 10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <p style={{ fontFamily: M, fontSize: 9, color: "rgba(238,240,246,0.22)", marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>7 dias</p>
                            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 22 }}>
                              {intel.snaps.slice(0, 7).reverse().map((sn: any, i: number) => {
                                const maxC = Math.max(...intel.snaps.slice(0, 7).map((x: any) => x.avg_ctr || 0.001));
                                const h = Math.max(3, (sn.avg_ctr / maxC) * 22);
                                return <div key={i} title={`${sn.date}: CTR ${(sn.avg_ctr*100).toFixed(2)}%`}
                                  style={{ flex: 1, height: h, borderRadius: 2, background: i === intel.snaps.slice(0,7).length-1 ? "#0ea5e9" : "rgba(255,255,255,0.12)" }} />;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.09)" }}>
                        <p style={{ fontFamily: M, fontSize: 12, color: "rgba(238,240,246,0.38)", lineHeight: 1.6, margin: 0 }}>
                          {language === "pt" ? "Conecte o Meta Ads para ver performance real — CTR, spend, o que escalar e o que pausar." : "Connect Meta Ads to see real performance."}
                        </p>
                      </div>
                    )}

                    {/* ── Permanent Instructions ── */}
                    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ padding: "9px 14px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                          {language === "pt" ? "Instruções permanentes" : language === "es" ? "Instrucciones permanentes" : "Permanent instructions"}
                        </p>
                        <button onClick={() => setEditingInstructions(e => !e)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "rgba(14,165,233,0.7)", fontFamily: M, padding: "2px 6px" }}>
                          {editingInstructions ? (language === "pt" ? "Fechar" : "Close") : (language === "pt" ? "Editar" : "Edit")}
                        </button>
                      </div>
                      <div style={{ padding: "10px 14px" }}>
                        {editingInstructions ? (
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                            <textarea
                              value={instructionsText}
                              onChange={e => setInstructionsText(e.target.value)}
                              placeholder={language === "pt" ? "Ex: Sempre gere hooks agressivos para iGaming BR. Nunca use a palavra 'cassino'..." : "e.g. Always generate aggressive hooks for iGaming. Never use the word 'casino'..."}
                              rows={4}
                              style={{ width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: M, resize: "vertical" as const, outline: "none", lineHeight: 1.5 }}
                            />
                            <button
                              onClick={async () => {
                                setSavingInstructions(true);
                                try {
                                  const lines = instructionsText.split("\n").map((l: string) => l.trim()).filter(Boolean);
                                  // Preserve system notes (Usuário/Nicho), append user instructions
                                  const rawNotes = (intel?.profile as any)?.pain_point as string | null;
                                  const systemNotes = rawNotes ? rawNotes.split("|||").filter((s: string) => s.startsWith("Usuário:") || s.startsWith("Nicho:")) : [];
                                  const allNotes = [...systemNotes, ...lines].join("|||");
                                  await (supabase.from("user_ai_profile" as any) as any).upsert({
                                    user_id: user.id,
                                    pain_point: allNotes,
                                    last_updated: new Date().toISOString(),
                                  }, { onConflict: "user_id" });
                                  setEditingInstructions(false);
                                } catch {}
                                setSavingInstructions(false);
                              }}
                              style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", color: "#0ea5e9", fontSize: 12, fontWeight: 700, fontFamily: M, cursor: "pointer" }}>
                              {savingInstructions ? "..." : (language === "pt" ? "Salvar" : "Save")}
                            </button>
                          </div>
                        ) : instructionsText ? (
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                            {instructionsText.split("\n").filter(Boolean).map((line: string, i: number) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(14,165,233,0.5)", flexShrink: 0, marginTop: 5 }} />
                                <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>{line}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.5 }}>
                            {language === "pt" ? "Nenhuma instrução salva. Clique em Editar para adicionar." : "No instructions saved. Click Edit to add."}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Patterns backed by real data */}
                    {realPatterns.length > 0 && (
                      <div style={{ borderRadius: 12, border: "1px solid rgba(52,211,153,0.14)", overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", background: "rgba(52,211,153,0.03)", borderBottom: "1px solid rgba(52,211,153,0.09)" }}>
                          <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(52,211,153,0.50)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                            {language === "pt" ? "Padrões com dados reais" : "Data-backed patterns"}
                          </p>
                        </div>
                        <div style={{ padding: "8px" }}>
                          {realPatterns.slice(0, 6).map((p: any, i: number) => (
                            <div key={i} style={{ padding: "9px 10px", borderRadius: 8, marginBottom: 3, background: "rgba(255,255,255,0.025)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: p.is_winner ? "#34d399" : "rgba(238,240,246,0.55)", margin: 0 }}>
                                  {p.is_winner ? "✓ " : ""}{translatePatternKey(p.pattern_key)}
                                </p>
                                {p.insight_text && <p style={{ fontFamily: M, fontSize: 10, color: "rgba(238,240,246,0.38)", margin: "2px 0 0", lineHeight: 1.4 }}>{p.insight_text.slice(0, 75)}</p>}
                                <div style={{ display: "flex", gap: 7, marginTop: 3 }}>
                                  {p.avg_ctr > 0 && <span style={{ fontFamily: M, fontSize: 9, fontWeight: 700, color: "rgba(52,211,153,0.70)" }}>CTR {(p.avg_ctr*100).toFixed(2)}%</span>}
                                  {p.avg_roas > 0 && <span style={{ fontFamily: M, fontSize: 9, fontWeight: 700, color: "rgba(14,165,233,0.70)" }}>ROAS {p.avg_roas.toFixed(2)}x</span>}
                                  <span style={{ fontFamily: M, fontSize: 9, color: "rgba(238,240,246,0.22)" }}>{p.sample_size}×</span>
                                </div>
                              </div>
                              <button onClick={() => deletePattern(p.pattern_key)}
                                title={language === "pt" ? "Remover" : "Remove"}
                                style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, marginTop: 1 }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.4)"; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Usage-based preferences (no real data yet) */}
                    {prefPatterns.length > 0 && (
                      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <div style={{ padding: "9px 14px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <p style={{ fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.22)", letterSpacing: "0.10em", textTransform: "uppercase" as const, margin: 0 }}>
                            {language === "pt" ? "Preferências de uso" : "Usage preferences"}
                          </p>
                        </div>
                        <div style={{ padding: "8px" }}>
                          {prefPatterns.slice(0, 4).map((p: any, i: number) => (
                            <div key={i} style={{ padding: "8px 10px", borderRadius: 7, marginBottom: 3, background: "rgba(255,255,255,0.015)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <p style={{ fontFamily: M, fontSize: 11, color: "rgba(238,240,246,0.45)", margin: 0 }}>{translatePatternKey(p.pattern_key)}</p>
                              <button onClick={() => deletePattern(p.pattern_key)}
                                style={{ width: 18, height: 18, borderRadius: 4, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, flexShrink: 0 }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}>
                                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty */}
                    {!intel?.profile?.ai_summary && !hasSnaps && realPatterns.length === 0 && prefPatterns.length === 0 && (
                      <div style={{ padding: "32px 16px", textAlign: "center" as const, borderRadius: 12, border: "1px dashed rgba(255,255,255,0.09)" }}>
                        <div style={{ fontSize: 26, marginBottom: 10 }}>🧠</div>
                        <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(238,240,246,0.35)", margin: "0 0 6px" }}>
                          {language === "pt" ? "Ainda aprendendo..." : "Still learning..."}
                        </p>
                        <p style={{ fontFamily: M, fontSize: 11, color: "rgba(238,240,246,0.22)", margin: 0, lineHeight: 1.5 }}>
                          {language === "pt" ? "Conecte o Meta Ads e use o produto — o sistema aprende com os resultados reais." : "Connect Meta Ads and use the product — it learns from real results."}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}


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
