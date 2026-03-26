// IntelligencePage — O que a IA aprendeu sobre você
// Redesign completo: 3 seções claras, zero confusão
import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Star, TrendingUp, Trash2, MessageSquare, Zap, ChevronRight, RefreshCw } from "lucide-react";

interface Memory { id: string; memory_text: string; memory_type: string; importance: number; created_at: string; }
interface Example { id: string; user_message: string; quality_score: number; created_at: string; }
interface Pattern { id: string; pattern_key: string; insight_text: string; avg_ctr: number; confidence: number; is_winner: boolean; }

const TYPE_PT: Record<string, string> = { preference: "Preferência", rule: "Regra", decision: "Decisão", context: "Contexto" };
const TYPE_COLOR: Record<string, string> = { preference: "#60a5fa", rule: "#a78bfa", decision: "#34d399", context: "#fbbf24" };

function SectionHeader({ icon, color, title, subtitle, count }: { icon: React.ReactNode; color: string; title: string; subtitle: string; count: number }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:14 }}>
      <div style={{ width:28, height:28, borderRadius:8, background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center", color, flexShrink:0, marginTop:1 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14, fontWeight:600, color:"#fff" }}>{title}</span>
          {count > 0 && <span style={{ fontSize:11, fontWeight:600, color, background:`${color}18`, border:`1px solid ${color}30`, borderRadius:20, padding:"1px 8px" }}>{count}</span>}
        </div>
        <p style={{ margin:"3px 0 0", fontSize:12, color:"rgba(255,255,255,0.38)", lineHeight:1.5 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function MemoryRow({ text, importance, typeColor, deleting, onDelete }: { text: string; importance: number; typeColor: string; deleting: boolean; onDelete: () => void }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:9, padding:"10px 12px 10px 14px" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:13, color:"rgba(255,255,255,0.82)", lineHeight:1.55 }}>{text}</p>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <span style={{ fontSize:10, color:typeColor, letterSpacing:1 }}>{"★".repeat(Math.min(importance,5))}</span>
        <button onClick={onDelete} disabled={deleting} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.2)", padding:2, display:"flex", alignItems:"center", opacity:deleting?0.4:1 }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [actionCount, setActionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [mR, eR, pR, aR] = await Promise.all([
        (supabase as any).from("chat_memory").select("id,memory_text,memory_type,importance,created_at").eq("user_id", user.id).order("importance", { ascending: false }).limit(25),
        (supabase as any).from("chat_examples").select("id,user_message,quality_score,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        (supabase as any).from("learned_patterns").select("id,pattern_key,insight_text,avg_ctr,confidence,is_winner").eq("user_id", user.id).order("confidence", { ascending: false }).limit(15),
        (supabase as any).from("ai_action_log").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setMemories(mR.data || []);
      setExamples(eR.data || []);
      setPatterns(pR.data || []);
      setActionCount(aR.count || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?.id, selectedPersona?.id]);

  const deleteMemory = async (id: string) => { setDeleting(id); await (supabase as any).from("chat_memory").delete().eq("id", id); setMemories(p => p.filter(m => m.id !== id)); setDeleting(null); };
  const deleteExample = async (id: string) => { setDeleting(id); await (supabase as any).from("chat_examples").delete().eq("id", id); setExamples(p => p.filter(e => e.id !== id)); setDeleting(null); };

  const accountName = selectedPersona?.name || "sua conta";

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:400 }}>
      <div style={{ width:28, height:28, border:"2px solid rgba(255,255,255,0.1)", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth:820, margin:"0 auto", padding:"28px 24px 60px", fontFamily:"'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:32 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Brain size={22} color="#0ea5e9" />
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#fff", letterSpacing:-0.5 }}>O que a IA sabe sobre {accountName}</h1>
          </div>
          <p style={{ margin:0, fontSize:13.5, color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>Tudo que aprendi em conversas — usado automaticamente para melhorar cada resposta</p>
        </div>
        <button onClick={load} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:32 }}>
        {[
          { n:memories.length, label:"memórias", color:"#0ea5e9", desc:"fatos sobre você e a conta" },
          { n:examples.length, label:"exemplos", color:"#a78bfa", desc:"respostas que você aprovou" },
          { n:patterns.length, label:"padrões", color:"#34d399", desc:"do que funcionou nos ads" },
          { n:actionCount, label:"ações", color:"#fb923c", desc:"executadas no Meta/Google" },
        ].map(s => (
          <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1 }}>{s.n}</div>
            <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.7)", marginTop:4 }}>{s.label}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {memories.length === 0 && examples.length === 0 && patterns.length === 0 && (
        <div style={{ background:"rgba(14,165,233,0.05)", border:"1px solid rgba(14,165,233,0.15)", borderRadius:14, padding:"32px 28px", textAlign:"center" }}>
          <Brain size={36} color="rgba(14,165,233,0.4)" style={{ marginBottom:12 }} />
          <p style={{ margin:"0 0 8px", fontSize:15, fontWeight:600, color:"#fff" }}>Ainda sem inteligência acumulada</p>
          <p style={{ margin:"0 0 20px", fontSize:13, color:"rgba(255,255,255,0.4)", maxWidth:400, marginInline:"auto" }}>Converse com a IA sobre sua conta. Curta (👍) respostas que gostar.</p>
          <button onClick={() => navigate("/dashboard/ai")} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 18px", background:"#0ea5e9", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Abrir IA Chat <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* SEÇÃO 1 — MEMÓRIAS */}
      {memories.length > 0 && (
        <section style={{ marginBottom:36 }}>
          <SectionHeader icon={<Brain size={15} />} color="#0ea5e9" title="Memórias persistentes" subtitle="Fatos que aprendi em conversas — usados em todas as respostas sem você precisar repetir" count={memories.length} />
          {(["preference","decision","rule","context"] as const).map(type => {
            const group = memories.filter(m => m.memory_type === type);
            if (!group.length) return null;
            return (
              <div key={type} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:TYPE_COLOR[type]||"#888", marginBottom:8, paddingLeft:2 }}>{TYPE_PT[type]||type}s</div>
                <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                  {group.map(m => <MemoryRow key={m.id} text={m.memory_text} importance={m.importance} typeColor={TYPE_COLOR[m.memory_type]||"#888"} deleting={deleting===m.id} onDelete={() => deleteMemory(m.id)} />)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* SEÇÃO 2 — PADRÕES */}
      <section style={{ marginBottom:36 }}>
        <SectionHeader icon={<TrendingUp size={15} />} color="#34d399" title="Padrões aprendidos dos seus anúncios" subtitle="Extraídos dos dados reais de campanha — criativos vencedores, o que parar e o que escalar" count={patterns.length} />
        {patterns.length === 0 ? (
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:10, padding:"20px 18px", display:"flex", alignItems:"center", gap:16 }}>
            <TrendingUp size={20} color="rgba(255,255,255,0.2)" />
            <div>
              <p style={{ margin:0, fontSize:13.5, fontWeight:500, color:"rgba(255,255,255,0.5)" }}>Nenhum padrão ainda</p>
              <p style={{ margin:"3px 0 0", fontSize:12, color:"rgba(255,255,255,0.3)" }}>Conecte Meta Ads ou Google Ads e rode campanhas — os padrões são extraídos automaticamente a cada dia</p>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
            {patterns.map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"flex-start", gap:12, background:p.is_winner?"rgba(52,211,153,0.04)":"rgba(255,255,255,0.02)", border:`1px solid ${p.is_winner?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.07)"}`, borderRadius:10, padding:"12px 14px" }}>
                <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{p.is_winner?"✅":"⚠️"}</span>
                <p style={{ flex:1, margin:0, fontSize:13, color:"rgba(255,255,255,0.85)", lineHeight:1.5 }}>{p.insight_text}</p>
                <div style={{ flexShrink:0, textAlign:"right" as const, fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                  {p.avg_ctr > 0 && <div>CTR {(p.avg_ctr * 100).toFixed(2)}%</div>}
                  <div>conf. {(p.confidence * 100).toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 3 — EXEMPLOS */}
      <section style={{ marginBottom:36 }}>
        <SectionHeader icon={<MessageSquare size={15} />} color="#a78bfa" title="Respostas que você aprovou" subtitle="Quando você curte 👍 uma resposta, salvo o estilo para calibrar as próximas" count={examples.length} />
        {examples.length === 0 ? (
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:10, padding:"20px 18px", display:"flex", alignItems:"center", gap:16 }}>
            <Star size={20} color="rgba(255,255,255,0.2)" />
            <div>
              <p style={{ margin:0, fontSize:13.5, fontWeight:500, color:"rgba(255,255,255,0.5)" }}>Nenhum exemplo ainda</p>
              <p style={{ margin:"3px 0 0", fontSize:12, color:"rgba(255,255,255,0.3)" }}>No IA Chat, clique 👍 nas respostas que você gostar</p>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
            {examples.map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(167,139,250,0.04)", border:"1px solid rgba(167,139,250,0.12)", borderRadius:9, padding:"10px 12px 10px 14px" }}>
                <Star size={12} color="#a78bfa" style={{ flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color:"rgba(255,255,255,0.75)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{e.user_message}</span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)", flexShrink:0, marginRight:6 }}>{new Date(e.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}</span>
                <button onClick={() => deleteExample(e.id)} disabled={deleting===e.id} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.2)", padding:2, display:"flex", alignItems:"center" }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 4 — AÇÕES */}
      <section>
        <SectionHeader icon={<Zap size={15} />} color="#fb923c" title="Ações executadas pela IA" subtitle="Pausas, escaladas e ajustes de budget feitos no Meta Ads ou Google Ads, com sua confirmação" count={actionCount} />
        <div style={{ background:"rgba(251,146,60,0.04)", border:"1px solid rgba(251,146,60,0.12)", borderRadius:10, padding:"16px 18px", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:32, fontWeight:700, color:"#fb923c", lineHeight:1 }}>{actionCount}</div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.7)" }}>{actionCount === 0 ? "Nenhuma ação ainda" : `${actionCount} ação${actionCount > 1 ? "ões" : ""} executada${actionCount > 1 ? "s" : ""}`}</p>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"rgba(255,255,255,0.35)" }}>{actionCount === 0 ? "No chat, peça para a IA pausar ou escalar um criativo — ela pede confirmação antes" : "Histórico de ações tomadas com sua confirmação"}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
