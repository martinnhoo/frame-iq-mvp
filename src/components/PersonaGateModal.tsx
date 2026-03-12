import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Target, Sparkles, BarChart3, LayoutGrid, Zap } from "lucide-react";

interface PersonaGateModalProps {
  open: boolean;
  onClose: () => void;
  /** The action the user was trying to do — used in copy */
  intent?: "analysis" | "board" | "hook" | "generic";
}

const INTENT_COPY: Record<string, { action: string; impact: string }> = {
  analysis: {
    action: "analisar seu ad",
    impact: "Hook score, diagnóstico e sugestões ajustadas ao seu público-alvo",
  },
  board: {
    action: "gerar um production board",
    impact: "Scenes, formatos e VO alinhados com a linguagem e estilo da sua persona",
  },
  hook: {
    action: "testar hooks",
    impact: "Ângulos de hook calibrados para as dores e gatilhos do seu público",
  },
  generic: {
    action: "continuar",
    impact: "Resultados calibrados ao seu público, mercado e estilo de comunicação",
  },
};

const BENEFITS = [
  {
    icon: Target,
    color: "#a78bfa",
    title: "Diagnóstico contextualizado",
    desc: "O AI sabe quem é seu público — e analisa o ad com esse filtro.",
  },
  {
    icon: BarChart3,
    color: "#60a5fa",
    title: "Hook score mais preciso",
    desc: "Pontuação baseada no que funciona para aquele perfil específico.",
  },
  {
    icon: LayoutGrid,
    color: "#34d399",
    title: "Boards prontos para produzir",
    desc: "Scenes e VO já escritos no tom certo para a persona ativa.",
  },
  {
    icon: Zap,
    color: "#fbbf24",
    title: "Sem ajustes manuais",
    desc: "Menos vai-e-vem com o editor. O brief já sai certo.",
  },
];

export default function PersonaGateModal({ open, onClose, intent = "generic" }: PersonaGateModalProps) {
  const navigate = useNavigate();
  const copy = INTENT_COPY[intent] || INTENT_COPY.generic;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed z-[81] left-0 right-0 top-1/2 -translate-y-1/2 mx-auto w-[calc(100%-2rem)] max-w-[480px]"
          >
            <div className="relative rounded-3xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #0e0e0e 0%, #111 100%)",
                border: "1px solid rgba(167,139,250,0.25)",
                boxShadow: "0 0 80px rgba(139,92,246,0.15), 0 24px 64px rgba(0,0,0,0.6)",
              }}>

              {/* Ambient glow top */}
              <div className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)" }} />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 -translate-y-12 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(139,92,246,0.18)" }} />

              {/* Close */}
              <button onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all z-10">
                <X className="w-4 h-4" />
              </button>

              <div className="p-7 pt-8 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.15))", border: "1px solid rgba(167,139,250,0.3)" }}>
                    <span className="text-2xl">🎯</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white" style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}>
                    Ative uma persona primeiro
                  </h2>
                  <p className="text-sm text-white/45 leading-relaxed max-w-xs mx-auto">
                    Para {copy.action}, o AI precisa saber <span className="text-white/70 font-medium">quem é seu público</span>. Sem isso, os resultados são genéricos.
                  </p>
                </div>

                {/* Benefits grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {BENEFITS.map((b, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="rounded-2xl p-3.5 space-y-1.5"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${b.color}15`, border: `1px solid ${b.color}25` }}>
                          <b.icon style={{ width: 12, height: 12, color: b.color }} />
                        </div>
                        <p className="text-xs font-bold text-white leading-tight">{b.title}</p>
                      </div>
                      <p className="text-[11px] text-white/35 leading-snug pl-0">{b.desc}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Example impact */}
                <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.18)" }}>
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <p className="text-[11px] text-white/50 leading-snug">
                    <span className="text-purple-300 font-semibold">Com persona ativa:</span> {copy.impact}
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => { navigate("/dashboard/persona"); onClose(); }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)", fontFamily: "'Syne', sans-serif" }}>
                    <Target className="w-4 h-4" />
                    Criar minha persona agora
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-2xl text-sm text-white/25 hover:text-white/50 transition-colors">
                    Continuar sem persona
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
