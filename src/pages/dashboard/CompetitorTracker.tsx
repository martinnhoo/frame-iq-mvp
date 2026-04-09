import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Search, Eye, TrendingUp, Plus, Trash2, Loader2, Clock, Zap, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const MARKETS = [
  { value: "BR", flag: "🇧🇷", label: "Brazil" },
  { value: "MX", flag: "🇲🇽", label: "Mexico" },
  { value: "IN", flag: "🇮🇳", label: "India" },
  { value: "US", flag: "🇺🇸", label: "United States" },
  { value: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { value: "GLOBAL", flag: "", label: "Global" },
];

const PLATFORMS = ["Meta", "TikTok", "YouTube", "Both"];

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Plus Jakarta Sans', system-ui, sans-serif";

interface Competitor {
  id: string;
  name: string;
  market: string;
  platform: string;
  created_at: string;
  last_analysis?: string | null;
  analysis_count?: number;
}

export default function CompetitorTracker() {
  const { user } = useOutletContext<DashboardContext>();

  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", market: "BR", platform: "Meta" });
  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );


  const load = async () => {
    try {
      const { data } = await supabase
        .from("competitor_trackers" as never)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setCompetitors(data as Competitor[]);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.id]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      const { data, error } = await supabase
        .from("competitor_trackers" as never)
        .insert({ user_id: user.id, name: form.name.trim(), market: form.market, platform: form.platform } as never)
        .select().single();
      if (error) throw error;
      setCompetitors(p => [data as Competitor, ...p]);
      setForm({ name: "", market: "BR", platform: "Meta" });
      setAdding(false);
      toast.success(`"${form.name}" adicionado à lista`);
    } catch {
      toast.error("Erro ao adicionar — tente novamente");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}" do tracker?`)) return;
    setDeleting(id);
    try {
      await supabase.from("competitor_trackers" as never).delete().eq("id", id);
      setCompetitors(p => p.filter(c => c.id !== id));
      toast.success("Removido");
    } catch { toast.error("Erro ao remover"); }
    setDeleting(null);
  };

  // Navigate to CompetitorDecoder with brand pre-filled
  const handleAnalyze = (c: Competitor) => {
    navigate(`/dashboard/competitor?brand=${encodeURIComponent(c.name)}&market=${c.market}&platform=${c.platform.toLowerCase()}`);
  };

  const filtered = competitors.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const mktData = (code: string) => MARKETS.find(m => m.value === code);
  const timeAgo = (d: string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "hoje"; if (days === 1) return "ontem"; return `há ${days}d`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 overflow-x-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: F }}>
            <Eye className="h-5 w-5 text-white/40" />
            Competitor Tracker
          </h1>
          <p className="text-white/45 text-sm mt-0.5" style={{ fontFamily: M }}>
            Salve concorrentes e analise qualquer anúncio deles com IA
          </p>
        </div>
        <button onClick={() => setAdding(a => !a)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
          style={{ fontFamily: F }}>
          <Plus className="h-4 w-4" /> Add Competitor
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-sm font-semibold text-white/60" style={{ fontFamily: F }}>Adicionar concorrente</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input placeholder="Nome da marca (ex: Betway, Bet365)"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus
              className="flex-1 px-3 py-2.5 rounded-xl text-white text-sm placeholder:text-white/35 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: M }} />
            <select value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: M }}>
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.flag} {m.label}</option>)}
            </select>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: M }}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
              style={{ fontFamily: F }}>
              Salvar
            </button>
            <button onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-xl text-white/40 hover:text-white text-sm transition-colors"
              style={{ fontFamily: F }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* How it works — shown only when list is empty */}
      {!loading && competitors.length === 0 && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30" style={{ fontFamily: M }}>Como funciona</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { num: "1", title: "Salva a marca", desc: "Adicione qualquer concorrente à sua lista de monitoramento.", color: "#0ea5e9" },
              { num: "2", title: "Baixa o anúncio", desc: "Viu um anúncio deles no TikTok ou Meta? Baixa o vídeo ou copia o copy.", color: "#34d399" },
              { num: "3", title: "Analisa com IA", desc: "Clique em Analyze → cole o texto ou suba o vídeo. A IA faz o breakdown completo.", color: "#fbbf24" },
            ].map(step => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: `${step.color}18`, border: `1px solid ${step.color}30`, color: step.color, fontFamily: M }}>
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/70" style={{ fontFamily: F }}>{step.title}</p>
                  <p className="text-xs text-white/35 mt-0.5 leading-relaxed" style={{ fontFamily: M }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      {competitors.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
          <input placeholder="Buscar concorrente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm placeholder:text-white/35 outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", fontFamily: M }} />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      ) : filtered.length === 0 && competitors.length > 0 ? (
        <div className="text-center py-10 text-white/35 text-sm" style={{ fontFamily: M }}>
          Nenhum concorrente encontrado para "{search}"
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(c => {
            const mkt = mktData(c.market);
            return (
              <div key={c.id} className="group rounded-2xl transition-all"
                style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-4 px-4 py-4">
                  {/* Brand name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate" style={{ fontFamily: F }}>{c.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-white/40" style={{ fontFamily: M }}>{mkt?.flag} {c.market}</span>
                      <span className="text-white/15">·</span>
                      <span className="text-[11px] text-white/40" style={{ fontFamily: M }}>{c.platform}</span>
                      <span className="text-white/15">·</span>
                      <span className="text-[11px] text-white/30 flex items-center gap-1" style={{ fontFamily: M }}>
                        <Clock className="h-3 w-3" />{timeAgo(c.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Analyze button */}
                  <button onClick={() => handleAnalyze(c)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                    style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#0ea5e9", fontFamily: F }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.18)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.4)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.1)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.2)"; }}>
                    <Zap className="h-3 w-3" /> Analyze
                  </button>

                  {/* Delete */}
                  <button onClick={() => handleDelete(c.id, c.name)} disabled={deleting === c.id}
                    className="opacity-0 group-hover:opacity-100 h-8 w-8 flex items-center justify-center rounded-lg transition-all shrink-0"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    {deleting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Analyze CTA strip — shown when no analysis yet */}
                <div className="px-4 pb-3">
                  <button onClick={() => handleAnalyze(c)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontFamily: M }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,233,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.15)"; (e.currentTarget as HTMLElement).style.color = "#0ea5e9"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
                    <span>Baixou um anúncio deles? Cole aqui e analise →</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Empty state with CTA — after load, no competitors */}
      {!loading && competitors.length === 0 && (
        <div className="rounded-2xl py-14 flex flex-col items-center gap-4 text-center"
          style={{ background: "#0a0a0d", border: "1px dashed rgba(255,255,255,0.08)" }}>
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <TrendingUp className="h-5 w-5 text-white/40" />
          </div>
          <div>
            <p className="text-white/50 font-medium" style={{ fontFamily: F }}>Nenhum concorrente ainda</p>
            <p className="text-white/30 text-sm mt-1 max-w-xs" style={{ fontFamily: M }}>
              Adicione marcas que você monitora para analisar os anúncios delas com IA
            </p>
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#0ea5e9", fontFamily: F }}>
            <Plus className="h-4 w-4" /> Add first competitor
          </button>
        </div>
      )}
    </div>
  );
}
