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

// TYPE_PT now uses t object (multilanguage)
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
  const { user, selectedPersona, lang } = useOutletContext<DashboardContext>();
  const language = lang || "pt";
  const isPT = language === "pt";
  const isES = language === "es";

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const t = {
    title: isPT ? "O que a IA sabe sobre" : isES ? "Lo que la IA sabe sobre" : "What the AI knows about",
    subtitle: isPT ? "Tudo que aprendi em conversas — usado automaticamente para melhorar cada resposta"
      : isES ? "Todo lo que aprendí en conversaciones — usado automáticamente para mejorar cada respuesta"
      : "Everything I learned in conversations — used automatically to improve every response",
    refresh: isPT ? "Atualizar" : isES ? "Actualizar" : "Refresh",
    memories_title: isPT ? "Memórias persistentes" : isES ? "Memorias persistentes" : "Persistent memories",
    memories_sub: isPT ? "Fatos que aprendi em conversas — usados em todas as respostas sem você precisar repetir"
      : isES ? "Hechos que aprendí en conversaciones — usados en todas las respuestas sin que tengas que repetirlos"
      : "Facts I learned in conversations — used in every response without you repeating yourself",
    patterns_title: isPT ? "Padrões aprendidos dos seus anúncios" : isES ? "Patrones aprendidos de tus anuncios" : "Patterns learned from your ads",
    patterns_sub: isPT ? "Extraídos dos dados reais de campanha — criativos vencedores, o que parar e o que escalar"
      : isES ? "Extraídos de datos reales de campaña — creativos ganadores, qué pausar y qué escalar"
      : "Extracted from real campaign data — winning creatives, what to stop and what to scale",
    examples_title: isPT ? "Respostas que você aprovou" : isES ? "Respuestas que aprobaste" : "Responses you approved",
    examples_sub: isPT ? "Quando você curte 👍 uma resposta, salvo o estilo para calibrar as próximas"
      : isES ? "Cuando das 👍 a una respuesta, guardo el estilo para calibrar las siguientes"
      : "When you 👍 a response, I save the style to calibrate future ones",
    actions_title: isPT ? "Ações executadas pela IA" : isES ? "Acciones ejecutadas por la IA" : "Actions executed by AI",
    actions_sub: isPT ? "Pausas, escaladas e ajustes de budget feitos no Meta Ads ou Google Ads, com sua confirmação"
      : isES ? "Pausas, escaladas y ajustes de presupuesto en Meta Ads o Google Ads, con tu confirmación"
      : "Pauses, scales and budget adjustments on Meta Ads or Google Ads, with your confirmation",
    empty_title: isPT ? "Ainda sem inteligência acumulada" : isES ? "Aún sin inteligencia acumulada" : "No accumulated intelligence yet",
    empty_sub: isPT ? "Converse com a IA sobre sua conta. Curta (👍) respostas que gostar."
      : isES ? "Habla con la IA sobre tu cuenta. Dale 👍 a las respuestas que te gusten."
      : "Chat with the AI about your account. Like (👍) responses you enjoy.",
    open_chat: isPT ? "Abrir IA Chat" : isES ? "Abrir IA Chat" : "Open AI Chat",
    no_patterns: isPT ? "Nenhum padrão ainda" : isES ? "Ningún patrón aún" : "No patterns yet",
    no_patterns_sub: isPT ? "Conecte Meta Ads ou Google Ads e rode campanhas — os padrões são extraídos automaticamente a cada dia"
      : isES ? "Conecta Meta Ads o Google Ads y corre campañas — los patrones se extraen automáticamente cada día"
      : "Connect Meta Ads or Google Ads and run campaigns — patterns are extracted automatically each day",
    no_examples: isPT ? "Nenhum exemplo ainda" : isES ? "Ningún ejemplo aún" : "No examples yet",
    no_examples_sub: isPT ? "No IA Chat, clique 👍 nas respostas que você gostar"
      : isES ? "En el IA Chat, haz 👍 en las respuestas que te gusten"
      : "In the AI Chat, click 👍 on responses you like",
    no_actions: isPT ? "Nenhuma ação ainda" : isES ? "Ninguna acción aún" : "No actions yet",
    no_actions_sub: isPT ? "No chat, peça para a IA pausar ou escalar um criativo — ela pede confirmação antes"
      : isES ? "En el chat, pide a la IA pausar o escalar un creativo — pide confirmación antes"
      : "In chat, ask the AI to pause or scale a creative — it asks for confirmation first",
    type_preference: isPT ? "Preferência" : isES ? "Preferencia" : "Preference",
    type_rule: isPT ? "Regra" : isES ? "Regla" : "Rule",
    type_decision: isPT ? "Decisão" : isES ? "Decisión" : "Decision",
    type_context: isPT ? "Contexto" : isES ? "Contexto" : "Context",
    winner: isPT ? "vencedor" : isES ? "ganador" : "winner",
    loser: isPT ? "problema" : isES ? "problema" : "issue",
    conf: isPT ? "conf." : "conf.",
    memories_label: isPT ? "memórias" : isES ? "memorias" : "memories",
    examples_label: isPT ? "exemplos" : isES ? "ejemplos" : "examples",
    patterns_label: isPT ? "padrões" : isES ? "patrones" : "patterns",
    actions_label: isPT ? "ações" : isES ? "acciones" : "actions",
    mem_desc: isPT ? "fatos sobre você e a conta" : isES ? "hechos sobre ti y la cuenta" : "facts about you and account",
    ex_desc: isPT ? "respostas que você aprovou" : isES ? "respuestas que aprobaste" : "responses you approved",
    pat_desc: isPT ? "do que funcionou nos ads" : isES ? "de lo que funcionó en los ads" : "from what worked in ads",
    act_desc: isPT ? "executadas no Meta/Google" : isES ? "ejecutadas en Meta/Google" : "executed on Meta/Google",
    actions_count: (n: number) => isPT ? `${n} ação${n !== 1 ? "ões" : ""} executada${n !== 1 ? "s" : ""}` : isES ? `${n} acción${n !== 1 ? "es" : ""} ejecutada${n !== 1 ? "s" : ""}` : `${n} action${n !== 1 ? "s" : ""} executed`,
    actions_hist: isPT ? "Histórico de ações tomadas com sua confirmação" : isES ? "Historial de acciones tomadas con tu confirmación" : "History of actions taken with your confirmation",
  };
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

  useEffect(() => {
    load();
  }, [user?.id, selectedPersona?.id]);

  const deleteMemory = async (id: string) => {
    setDeleting(id);
    try { await (supabase as any).from("chat_memory").delete().eq("id", id); setMemories(p => p.filter(m => m.id !== id)); }
    catch { }
    finally { setDeleting(null); }
  };
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
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#fff", letterSpacing:-0.5 }}>{t.title} {accountName}</h1>
          </div>
          <p style={{ margin:0, fontSize:13.5, color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>Tudo que aprendi em conversas — usado automaticamente para melhorar cada resposta</p>
        </div>
        <button onClick={load} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:10, marginBottom:32 }}>
        {[
          { n:memories.length, label:t.memories_label, color:"#0ea5e9", desc:t.mem_desc },
          { n:examples.length, label:t.examples_label, color:"#a78bfa", desc:t.ex_desc },
          { n:patterns.length, label:t.patterns_label, color:"#34d399", desc:t.pat_desc },
          { n:actionCount, label:t.actions_label, color:"#fb923c", desc:t.act_desc },
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
          <SectionHeader icon={<Brain size={15} />} color="#0ea5e9" title={t.memories_title} subtitle={t.memories_sub} count={memories.length} />
          {(["preference","decision","rule","context"] as const).map(type => {
            const group = memories.filter(m => m.memory_type === type);
            if (!group.length) return null;
            return (
              <div key={type} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" as const, color:TYPE_COLOR[type]||"#888", marginBottom:8, paddingLeft:2 }}>{({"preference":t.type_preference,"decision":t.type_decision,"rule":t.type_rule,"context":t.type_context}[type]||type)}s</div>
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
        <SectionHeader icon={<TrendingUp size={15} />} color="#34d399" title={t.patterns_title} subtitle={t.patterns_sub} count={patterns.length} />
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
        <SectionHeader icon={<MessageSquare size={15} />} color="#a78bfa" title={t.examples_title} subtitle={t.examples_sub} count={examples.length} />
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
        <SectionHeader icon={<Zap size={15} />} color="#fb923c" title={t.actions_title} subtitle={t.actions_sub} count={actionCount} />
        <div style={{ background:"rgba(251,146,60,0.04)", border:"1px solid rgba(251,146,60,0.12)", borderRadius:10, padding:"16px 18px", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:32, fontWeight:700, color:"#fb923c", lineHeight:1 }}>{actionCount}</div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.7)" }}>{actionCount === 0 ? t.no_actions : t.actions_count(actionCount)}</p>
            <p style={{ margin:"3px 0 0", fontSize:12, color:"rgba(255,255,255,0.35)" }}>{actionCount === 0 ? "No chat, peça para a IA pausar ou escalar um criativo — ela pede confirmação antes" : "Histórico de ações tomadas com sua confirmação"}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
