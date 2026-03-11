import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X, LogOut, Save, Trash2, RefreshCw, Sparkles,
  Loader2, Check, User, Palette, CreditCard, Shield,
  ChevronRight, Zap, Settings, Camera, ArrowLeft, Edit3,
} from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { PlanUpgradeModal } from "./PlanUpgradeModal";
import Persona3DAvatar from "./Persona3DAvatar";

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

const PLAN_INFO: Record<string, { label: string; gradient: string; desc: string; price: string }> = {
  free:    { label: "Free",    gradient: "from-white/20 to-white/5",           desc: "3 analyses · 3 boards / mo",                     price: "$0" },
  maker:   { label: "Maker",   gradient: "from-blue-500/30 to-blue-900/10",    desc: "10 analyses · 10 boards · 50 translations / mo", price: "$19/mo" },
  pro:     { label: "Pro",     gradient: "from-purple-500/30 to-purple-900/10", desc: "30 analyses · 30 boards · unlimited hooks",      price: "$49/mo" },
  studio:  { label: "Studio",  gradient: "from-pink-500/30 to-pink-900/10",    desc: "500 analyses · 300 boards · API access",          price: "$149/mo" },
};

const TABS = [
  { id: "profile",     label: "Profile",     icon: User },
  { id: "preferences", label: "Prefs",       icon: Palette },
  { id: "plan",        label: "Plan",        icon: CreditCard },
  { id: "security",    label: "Security",    icon: Shield },
];

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
      <label className="text-[9px] uppercase tracking-widest text-white/20">{label}</label>
      {editing ? (
        <input value={value} onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs outline-none focus:border-purple-500/40 transition-colors" />
      ) : (
        <p className="text-xs text-white/60">{value || "—"}</p>
      )}
    </div>
  );

  const ListField = ({ label, values, field }: { label: string; values: string[]; field: keyof PersonaRecord }) => (
    <div className="space-y-1.5">
      <label className="text-[9px] uppercase tracking-widest text-white/20">{label}</label>
      {editing ? (
        <textarea
          value={(values || []).join("\n")}
          onChange={e => setDraft(d => ({ ...d, [field]: e.target.value.split("\n").filter(Boolean) }))}
          rows={Math.max(2, (values || []).length)}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs outline-none focus:border-purple-500/40 transition-colors resize-none"
          placeholder="One per line"
        />
      ) : (
        <div className="space-y-1">
          {(values || []).map((v, i) => (
            <p key={i} className="text-[11px] text-white/50 flex gap-1.5">
              <span className="text-purple-400/60 shrink-0">·</span>
              <span>{v}</span>
            </p>
          ))}
          {(!values || values.length === 0) && <p className="text-xs text-white/25">—</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="h-8 w-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
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
              className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-all">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        )}
        <button onClick={onDelete} disabled={isDeleting}
          className="h-8 w-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
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
            <label className="text-[9px] uppercase tracking-widest text-white/20">Bio</label>
            <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
              rows={3} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] text-white text-xs outline-none focus:border-purple-500/40 transition-colors resize-none" />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-widest text-white/20">Bio</label>
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [personas, setPersonas] = useState<PersonaRecord[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaRecord | null>(null);

  // Sync fields when panel opens
  useEffect(() => {
    if (open) {
      setName(profile?.name || "");
      setMarket(profile?.preferred_market || "GLOBAL");
      setLang(profile?.preferred_language || "en");
      setAvatarUrl(profile?.avatar_url || null);
      loadPersonas();
    }
  }, [open]);

  const loadPersonas = async () => {
    setPersonasLoading(true);
    try {
      const { data, error } = await supabase
        .from("personas" as never)
        .select("id, created_at, result" as never)
        .eq("user_id" as never, user.id)
        .order("created_at" as never, { ascending: false });

      if (!error && data) {
        const rows = data as Array<{ id: string; created_at: string; result: unknown }>;
        setPersonas(
          rows.map((row) => ({
            id: row.id,
            created_at: row.created_at,
            ...(row.result as Record<string, unknown>),
          } as PersonaRecord))
        );
      }
    } catch (e) {
      console.error("loadPersonas:", e);
    } finally {
      setPersonasLoading(false);
    }
  };

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
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      toast.success("Saved!");
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this persona permanently? This cannot be undone.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("personas" as never).delete().eq("id" as never, id).eq("user_id" as never, user.id);
    if (!error) {
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      toast.success("Persona deleted");
    } else {
      toast.error("Failed to delete");
    }
    setDeletingId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      // Remove old avatar if exists
      await supabase.storage.from("avatars").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

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

  return (
    <>
      <style>{`
        @keyframes panelIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .panel-enter { animation: panelIn 0.28s cubic-bezier(.23,1,.32,1) both; }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-label="User profile"
        className="panel-enter fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[420px] flex flex-col bg-[#0c0c0c] border-l border-white/[0.07] shadow-[−20px_0_80px_rgba(0,0,0,0.8)]"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          {/* Avatar orb */}
          <div className="relative shrink-0">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-500/40 to-pink-500/20 border border-white/[0.12] flex items-center justify-center text-base font-bold text-white shadow-lg">
              {initials}
            </div>
            <label
              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
              title="Change avatar"
            >
              <Camera className="h-2.5 w-2.5 text-white/40" />
              <input type="file" accept="image/*" className="hidden" />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.name || user.email?.split("@")[0]}</p>
            <p className="text-xs text-white/30 truncate">{user.email}</p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0.5 px-4 pt-3 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                tab === t.id
                  ? "bg-white/[0.09] text-white"
                  : "text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
              }`}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ══ PROFILE ══ */}
          {tab === "profile" && (
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-1.5">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/15 outline-none focus:border-white/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-1.5">Email</label>
                <input
                  value={user.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/25 text-sm cursor-not-allowed"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[.98] disabled:opacity-40 transition-all"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved ? "Saved!" : "Save changes"}
              </button>

              {/* Onboarding answers */}
              {profile?.onboarding_data && Object.keys(profile.onboarding_data).length > 0 && (
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/20 mb-3">Setup answers</p>
                  <div className="space-y-2">
                    {Object.entries(profile.onboarding_data).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/25 capitalize shrink-0">{k.replace(/_/g, " ")}</span>
                        <span className="text-xs text-white/50 text-right truncate">
                          {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PREFERENCES ══ */}
          {tab === "preferences" && (
            <div className="px-5 py-5 space-y-5">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-3">Primary market</label>
                <div className="grid grid-cols-4 gap-2">
                  {MARKETS.map((m) => (
                    <button
                      key={m.code}
                      onClick={() => setMarket(m.code)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition-all ${
                        market === m.code
                          ? "border-white/25 bg-white/[0.08] text-white"
                          : "border-white/[0.05] text-white/25 hover:border-white/15 hover:text-white/50"
                      }`}
                    >
                      <span className="text-xl">{m.flag}</span>
                      <span className="text-[10px] leading-tight">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/20 mb-3">Preferred language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      className={`px-4 py-1.5 rounded-xl text-sm border transition-all ${
                        lang === l.code
                          ? "border-white/25 bg-white/[0.08] text-white font-medium"
                          : "border-white/[0.05] text-white/25 hover:border-white/15 hover:text-white/50"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[.98] disabled:opacity-40 transition-all"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "Saved!" : "Save preferences"}
              </button>
            </div>
          )}

          {/* ══ PLAN ══ */}
          {tab === "plan" && (
            <div className="px-5 py-5 space-y-4">
              {/* Current plan card */}
              <div className={`rounded-2xl bg-gradient-to-br ${plan.gradient} border border-white/[0.08] p-5`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-lg font-bold text-white">{plan.label}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                    Current
                  </span>
                </div>
                <p className="text-sm text-white/50">{plan.desc}</p>
                <p className="text-2xl font-bold text-white mt-3">{plan.price}</p>
              </div>

              {/* Upgrade options */}
              {(profile?.plan === "free" || profile?.plan === "maker") && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">Upgrade to</p>
                  <div className="space-y-2">
                    {(["maker", "pro", "studio"] as const)
                      .filter((k) => {
                        const order = ["free", "maker", "pro", "studio"];
                        return order.indexOf(k) > order.indexOf(profile?.plan || "free");
                      })
                      .map((key) => {
                        const p = PLAN_INFO[key];
                        const isPopular = key === "pro";
                        return (
                          <button
                            key={key}
                            onClick={() => window.location.href = "/pricing"}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all group ${
                              isPopular
                                ? "border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50 hover:bg-purple-500/10"
                                : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-white">{p.label}</p>
                                {isPopular && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20 font-bold">POPULAR</span>}
                              </div>
                              <p className="text-xs text-white/30">{p.desc}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-white/60">{p.price}</span>
                              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
                            </div>
                          </button>
                        );
                    })}
                  </div>
                  <p className="text-[11px] text-white/15 text-center pt-1">3-day free trial on all plans · Powered by Stripe</p>
                </>
              )}
            </div>
          )}

          {/* ══ SECURITY ══ */}
          {tab === "security" && (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70 font-medium">Email</p>
                    <p className="text-xs text-white/30 mt-0.5">{user.email}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                    Verified
                  </span>
                </div>

                <div className="h-px bg-white/[0.04]" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70 font-medium">Account created</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/30 active:scale-[.98] transition-all"
              >
                <LogOut className="h-4 w-4" />
                Sign out of AdBrief
              </button>

              <p className="text-[11px] text-white/15 text-center">
                Password changes are handled via email link
              </p>
            </div>
          )}

          {/* ══ PERSONAS SECTION — always at bottom ══ */}
          <div className="px-5 pb-10">
            <div className="border-t border-white/[0.05] pt-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    Saved Personas
                  </p>
                  <p className="text-xs text-white/20 mt-0.5">Your AI audience profiles</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/dashboard/persona"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.09] text-white/50 text-xs font-medium hover:bg-white/[0.1] hover:text-white transition-all"
                    title="Create new persona"
                  >
                    <span className="text-base leading-none">+</span> New
                  </a>
                  <button
                    onClick={loadPersonas}
                    disabled={personasLoading}
                    className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all disabled:opacity-30"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${personasLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {personasLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-white/15" />
                </div>
              ) : personas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.07] py-10 flex flex-col items-center gap-3">
                  <span className="text-4xl select-none">🧠</span>
                  <p className="text-sm text-white/25 font-medium">No personas yet</p>
                  <p className="text-xs text-white/15 text-center px-6 leading-relaxed">
                    Generate one using the Persona Builder in the sidebar to see it here
                  </p>
                </div>
              ) : selectedPersona ? (
                <PersonaDetailView
                  persona={selectedPersona}
                  onBack={() => setSelectedPersona(null)}
                  onSave={(updated) => {
                    setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
                    setSelectedPersona(updated);
                  }}
                  onDelete={() => { handleDelete(selectedPersona.id); setSelectedPersona(null); }}
                  isDeleting={deletingId === selectedPersona.id}
                  userId={user.id}
                />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {personas.map((persona) => (
                    <div key={persona.id} className="flex flex-col items-center gap-2 cursor-pointer group"
                      onClick={() => setSelectedPersona(persona)}>
                      <Persona3DAvatar
                        emoji={persona.avatar_emoji || "👤"}
                        name={persona.name}
                        gender={persona.gender || ""}
                        size="md"
                      />
                      <p className="text-xs text-white/50 group-hover:text-white transition-colors text-center truncate w-full">{persona.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      {planModalOpen && (
        <PlanUpgradeModal
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          currentPlan={profile?.plan || "free"}
        />
      )}
    </>
  );
}
