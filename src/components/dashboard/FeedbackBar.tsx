import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackBarProps {
  userId: string;
  sourceType: "analysis" | "board" | "brief" | "hook" | "caption" | "script";
  sourceId?: string;
  outputText?: string;
  context?: Record<string, unknown>;
  className?: string;
  compact?: boolean;
}

const mono = { fontFamily: "'Inter', 'Inter', system-ui, sans-serif" } as const;

export function FeedbackBar({
  userId,
  sourceType,
  sourceId,
  outputText,
  context,
  className = "",
  compact = false,
}: FeedbackBarProps) {
  const [rated, setRated] = useState<-1 | 1 | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (rating: -1 | 1) => {
    if (rated !== null || loading) return;
    setLoading(true);
    try {
      await supabase.from("output_feedback" as never).insert({
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId ?? null,
        rating,
        output_text: outputText?.slice(0, 2000) ?? null,
        context: context ?? null,
      } as never);
      setRated(rating);

      // Fire update-ai-profile async after feedback (no await — fire and forget)
      supabase.functions.invoke("update-ai-profile", {
        body: { user_id: userId, trigger: `feedback_${sourceType}` },
      }).catch(() => {});
    } catch (e) {
      console.error("Feedback submit error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (rated !== null) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Check className="h-3 w-3 text-green-400" />
        <span className="text-[10px] text-white/45" style={mono}>
          {rated === 1 ? "Marcado como útil" : "Registrado — IA vai melhorar"}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!compact && (
        <span className="text-[10px] text-white/40" style={mono}>
          Was this helpful?
        </span>
      )}
      <button
        onClick={() => submit(1)}
        disabled={loading}
        title="Isso foi útil"
        className="h-6 w-6 rounded-lg flex items-center justify-center transition-all hover:bg-green-500/15 hover:text-green-400 text-white/40 disabled:opacity-40"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => submit(-1)}
        disabled={loading}
        title="Isso não foi útil"
        className="h-6 w-6 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/15 hover:text-red-400 text-white/40 disabled:opacity-40"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
