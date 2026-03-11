import { useNavigate } from "react-router-dom";
import { Users, X, Sparkles, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  toolName: string;
}

export function PersonaWarningModal({ open, onClose, onContinue, toolName }: Props) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md rounded-3xl overflow-hidden pointer-events-auto"
              style={{ background: "#0d0d10", border: "1px solid rgba(167,139,250,0.2)" }}>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-4"
                style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(244,114,182,0.05))" }}>
                <button onClick={onClose}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white/50 transition-colors">
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-purple-400/60 font-mono">No persona active</p>
                    <h2 className="text-base font-bold text-white">You'll get generic results</h2>
                  </div>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">
                  <span className="text-white/70 font-medium">{toolName}</span> works best when the AI knows who you're targeting.
                  Without a persona, hooks and scripts are written for a generic audience — not your buyer.
                </p>
              </div>

              {/* Benefits */}
              <div className="px-6 py-4 space-y-2.5">
                {[
                  { emoji: "🎯", text: "Hooks tuned to real pains and desires of your audience" },
                  { emoji: "🧠", text: "Language style and tone matched to your buyer's profile" },
                  { emoji: "⚡", text: "Higher predicted scores — AI has more context to work with" },
                ].map(({ emoji, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="text-base shrink-0">{emoji}</span>
                    <p className="text-xs text-white/50 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 space-y-2">
                <button
                  onClick={() => { onClose(); navigate("/dashboard/persona"); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-black transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)" }}>
                  <Sparkles className="h-4 w-4" /> Create / select a persona
                </button>
                <button
                  onClick={onContinue}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm text-white/30 hover:text-white/50 transition-colors border border-white/[0.06]">
                  Continue without persona <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
