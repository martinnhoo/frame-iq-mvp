import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";

const promptSuggestions = [
  "UGC-style ad for a fitness app targeting women 25-34",
  "Problem-solution ad for a fintech savings product",
  "Testimonial-driven ad for an iGaming platform",
  "Before/after transformation for a skincare brand",
];

const NewBoard = () => {
  const { user, refreshUsage } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setGenerating(true);

    const { error } = await supabase.from("boards").insert({
      user_id: user.id,
      title: title || prompt.slice(0, 50),
      prompt: prompt.trim(),
      status: "generating",
    });

    if (error) {
      toast.error("Failed to create board");
      setGenerating(false);
      return;
    }

    // Simulate generation time
    setTimeout(async () => {
      await refreshUsage();
      toast.success("Board generated successfully!");
      navigate("/dashboard/boards");
    }, 3000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/boards")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Describe your ad concept. AI generates the full production board.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            placeholder="e.g. Summer Campaign — Variant A"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-muted border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Creative Brief</Label>
          <Textarea
            id="prompt"
            placeholder="Describe the ad you want to create... Include target audience, product, tone, format, and any specific requirements."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            className="bg-muted border-border resize-none"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Try a suggestion:</p>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion) => (
              <Badge
                key={suggestion}
                variant="outline"
                className="cursor-pointer border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => setPrompt(suggestion)}
              >
                {suggestion.length > 40 ? suggestion.slice(0, 40) + "..." : suggestion}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 h-12 text-base"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating board...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Board
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default NewBoard;
