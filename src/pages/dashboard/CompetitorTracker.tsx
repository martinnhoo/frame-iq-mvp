import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Search, Eye, TrendingUp, Plus, Trash2, Loader2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Competitor tracker - UI ready, live data needs Meta Ads API + TikTok API keys in Supabase secrets
// Table: competitor_trackers (user_id, name, market, platform, created_at)

const MARKETS = [
  { value: "BR", flag: "🇧🇷", label: "Brazil" },
  { value: "MX", flag: "🇲🇽", label: "Mexico" },
  { value: "IN", flag: "🇮🇳", label: "India" },
  { value: "US", flag: "🇺🇸", label: "United States" },
  { value: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { value: "GLOBAL", flag: "🌐", label: "Global" },
];

const PLATFORMS = ["Meta", "TikTok", "YouTube", "Both"];

interface Competitor {
  id: string;
  name: string;
  market: string;
  platform: string;
  created_at: string;
}

type DateFilter = "7d" | "30d" | "all";

export default function CompetitorTracker() {
  const { user } = useOutletContext<DashboardContext>();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [form, setForm] = useState({ name: "", market: "BR", platform: "Meta" });

  const load = async () => {
    // Try loading from Supabase — will fail gracefully if table doesn't exist yet
    try {
      const { data } = await supabase
        .from("competitor_trackers" as never)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setCompetitors(data as Competitor[]);
    } catch {
      // table may not exist yet — that's ok, show empty state
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      const { data, error } = await supabase
        .from("competitor_trackers" as never)
        .insert({ user_id: user.id, name: form.name.trim(), market: form.market, platform: form.platform } as never)
        .select()
        .single();
      if (error) throw error;
      setCompetitors(p => [data as Competitor, ...p]);
      setForm({ name: "", market: "BR", platform: "Meta" });
      setAdding(false);
      toast.success(`Now tracking "${form.name}"`);
    } catch {
      toast.error("Failed to add — Supabase table may need to be created. Check docs.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from tracking?`)) return;
    setDeleting(id);
    try {
      await supabase.from("competitor_trackers" as never).delete().eq("id", id);
      setCompetitors(p => p.filter(c => c.id !== id));
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove");
    }
    setDeleting(null);
  };

  const filtered = competitors.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter !== "all") {
      const days = dateFilter === "7d" ? 7 : 30;
      if (Date.now() - new Date(c.created_at).getTime() > days * 86400000) return false;
    }
    return true;
  });

  const marketData = (code: string) => MARKETS.find(m => m.value === code);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days}d ago`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-white/40" />
            Competitor Tracker
          </h1>
          <p className="text-white/30 text-sm mt-0.5">
            Track competitor brands — live data requires Meta Ads + TikTok API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1">
            {(["7d", "30d", "all"] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${dateFilter === f ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                {f === "7d" ? "7d" : f === "30d" ? "30d" : "All"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Competitor
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 space-y-3">
          <p className="text-sm font-semibold text-white/70">Track a new competitor</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="Brand name (e.g. Betway)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/25 outline-none focus:border-white/20"
            />
            <select
              value={form.market}
              onChange={e => setForm(f => ({ ...f, market: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm outline-none focus:border-white/20"
            >
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.flag} {m.label}</option>)}
            </select>
            <select
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white text-sm outline-none focus:border-white/20"
            >
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">
              Start tracking
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-white/40 hover:text-white text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <input
          placeholder="Search tracked competitors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/20 outline-none focus:border-white/20"
        />
      </div>

      {/* API notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-300/80 text-xs">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>Live data not connected.</strong> To enable real ad monitoring, add <code className="bg-white/10 px-1 rounded">META_ADS_ACCESS_TOKEN</code> and <code className="bg-white/10 px-1 rounded">TIKTOK_ACCESS_TOKEN</code> to your Supabase Edge Function secrets. Tracked brands are saved and ready.
        </span>
      </div>

      {/* Competitors list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-14 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-white/[0.06] flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white/20" />
          </div>
          <div>
            <p className="text-white/40 font-medium">No competitors tracked yet</p>
            <p className="text-white/20 text-sm mt-1">Add a brand to start monitoring their ads</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-xl border border-white/[0.1] text-white/40 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            Add first competitor
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_80px_100px_80px_40px] gap-4 px-5 py-3 border-b border-white/[0.06] text-[10px] text-white/25 uppercase tracking-widest">
            <span>Brand</span>
            <span>Market</span>
            <span>Platform</span>
            <span>Added</span>
            <span />
          </div>
          {filtered.map((c) => {
            const mkt = marketData(c.market);
            return (
              <div
                key={c.id}
                className="group flex flex-col sm:grid sm:grid-cols-[1fr_80px_100px_80px_40px] gap-2 sm:gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-white font-medium">{c.name}</span>
                <span className="text-white/50 text-sm">{mkt?.flag} {c.market}</span>
                <span className="text-white/50 text-sm">{c.platform}</span>
                <span className="text-white/25 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />{timeAgo(c.created_at)}
                </span>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={deleting === c.id}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
