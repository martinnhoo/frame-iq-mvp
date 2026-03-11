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
  hook_angles?: string[];
  best_formats?: string[];
  best_platforms?: string[];
  language_style?: string;
  cta_style?: string;
  avatar_emoji?: string;
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

// ── Persona Card ───────────────────────────────────────────────────────────────

function PersonaCard({
  persona,
  onDelete,
  isDeleting,
}: {
  persona: PersonaRecord;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 50 });
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const targetX = (ny - 0.5) * -18;
    const targetY = (nx - 0.5) * 18;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTilt({ x: targetX, y: targetY, gx: nx * 100, gy: ny * 100 });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovering(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0, gx: 50, gy: 50 });
  }, []);

  const initials = persona.name?.slice(0, 2).toUpperCase() || "??";
  const platformColors: Record<string, string> = {
    tiktok: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
    reels: "text-pink-400 border-pink-500/20 bg-pink-500/10",
    youtube: "text-red-400 border-red-500/20 bg-red-500/10",
    facebook: "text-blue-400 border-blue-500/20 bg-blue-500/10",
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${hovering ? "8px" : "0"})`,
        transition: hovering ? "transform 0.08s linear" : "transform 0.5s cubic-bezier(.23,1,.32,1)",
        willChange: "transform",
      }}
      className="relative rounded-2xl border border-white/[0.09] bg-[#111] overflow-hidden"
    >
      {/* Shimmer glow follow cursor */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(139,92,246,0.18) 0%, transparent 65%)`,
        }}
      />

      {/* Floating emoji */}
      <div
        className="absolute top-3 right-12 text-4xl select-none pointer-events-none"
        style={{
          transform: hovering ? "translateY(-4px) scale(1.1)" : "translateY(0) scale(1)",
          transition: "transform 0.4s cubic-bezier(.23,1,.32,1)",
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.6))",
        }}
      >
        {persona.avatar_emoji || "👤"}
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all z-10"
        title="Delete persona"
      >
        {isDeleting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Trash2 className="h-3.5 w-3.5" />}
      </button>

      {/* Content */}
      <div className="p-4 relative">
        {/* Name + meta */}
        <div className="pr-14">
          <p className="text-base font-bold text-white leading-tight">{persona.name}</p>
          <p className="text-xs text-purple-300/60 mt-0.5">{persona.headline}</p>
          <p className="text-[11px] text-white/25 mt-1">{persona.age}{persona.gender ? ` · ${persona.gender}` : ""}</p>
        </div>

        {/* Bio */}
        {persona.bio && (
          <p className="text-xs text-white/40 mt-3 leading-relaxed line-clamp-2">{persona.bio}</p>
        )}

        {/* Platforms */}
        {persona.best_platforms && persona.best_platforms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {persona.best_platforms.slice(0, 3).map((p) => (
              <span
                key={p}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${platformColors[p.toLowerCase()] || "text-white/40 border-white/10 bg-white/5"}`}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Hook angles */}
        {persona.hook_angles && persona.hook_angles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[9px] uppercase tracking-wider text-white/20 mb-2">Hook angles</p>
            <div className="space-y-1">
              {persona.hook_angles.slice(0, 2).map((h, i) => (
                <p key={i} className="text-[11px] text-white/40 flex gap-1.5">
                  <span className="text-purple-400/60 shrink-0">·</span>
                  <span className="line-clamp-1">{h}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Created */}
        <p className="text-[10px] text-white/15 mt-3">
          {new Date(persona.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
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

  const [personas, setPersonas] = useState<PersonaRecord[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Sync fields when panel opens
  useEffect(() => {
    if (open) {
      setName(profile?.name || "");
      setMarket(profile?.preferred_market || "GLOBAL");
      setLang(profile?.preferred_language || "en");
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
            ...(row.result as Omit<PersonaRecord, "id" | "created_at">),
          }))
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
              ) : (
                <div className="space-y-3">
                  {personas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      onDelete={() => handleDelete(persona.id)}
                      isDeleting={deletingId === persona.id}
                    />
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
