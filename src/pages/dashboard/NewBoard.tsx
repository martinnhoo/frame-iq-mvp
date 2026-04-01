import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2, Globe, Clock, Video, User, Package, Layers, Zap, TrendingUp } from "lucide-react";
import { PersonaWarningModal } from "@/components/dashboard/PersonaWarningModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

const getFunnelStages = (dt: (key: any) => string) => [
  { value: "tofu", label: dt("bo_tofu"), full: "Top of Funnel", desc: "Cold audience — awareness", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  { value: "mofu", label: dt("bo_mofu"), full: "Mid of Funnel", desc: "Warm — consideration", color: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)" },
  { value: "bofu", label: dt("bo_bofu"), full: "Bottom of Funnel", desc: "Hot — conversion", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
];

const MARKETS = [
  { code: "ANY", flag: "🌍", name: "Global" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia" },
];

const PLATFORMS = [
  { value: "tiktok", label: "TikTok", ratio: "9:16" },
  { value: "reels", label: "Instagram Reels", ratio: "9:16" },
  { value: "youtube_shorts", label: "YouTube Shorts", ratio: "9:16" },
  { value: "youtube", label: "YouTube", ratio: "16:9" },
  { value: "facebook", label: "Facebook", ratio: "1:1" },
  { value: "all", label: "All Platforms", ratio: "9:16" },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

const promptSuggestions = [
  "UGC-style ad for a fitness app targeting women 25-34",
  "Problem-solution ad for a fintech savings product",
  "Testimonial-driven ad for an iGaming platform",
  "Before/after transformation for a skincare brand",
];

interface LocationState {
  templatePrompt?: string;
  templateName?: string;
  templateDuration?: number;
}

function detectMarketFromPersona(style: string): string {
  if (!style) return "ANY";
  const s = style.toLowerCase();
  if (s.includes("portug") || s.includes("brasil")) return "BR";
  if (s.includes("espanh") || s.includes("español") || s.includes("spanish")) return "MX";
  if (s.includes("english") || s.includes("inglês")) return "US";
  if (s.includes("hindi")) return "IN";
  if (s.includes("french") || s.includes("françai")) return "FR";
  if (s.includes("german") || s.includes("deutsch")) return "DE";
  if (s.includes("italian")) return "IT";
  if (s.includes("arabic") || s.includes("árabe")) return "AE";
  if (s.includes("japan")) return "JP";
  if (s.includes("thai")) return "TH";
  if (s.includes("indonesi")) return "ID";
  if (s.includes("filipino") || s.includes("tagalog")) return "PH";
  return "ANY";
}

const NewBoard = () => {
  const { user, refreshUsage, selectedPersona } = useOutletContext<DashboardContext>();

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const location = useLocation();
  const state = location.state as LocationState | null;

  const personaMarket = selectedPersona ? detectMarketFromPersona(selectedPersona.language_style) : "ANY";

  // Form state
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [market, setMarket] = useState(personaMarket);
  const [marketOverridden, setMarketOverridden] = useState(false);
  const [prevPersonaMarket, setPrevPersonaMarket] = useState(personaMarket);
  const [platform, setPlatform] = useState("tiktok");
  const [duration, setDuration] = useState(30);
  const [hasTalent, setHasTalent] = useState(true);
  const [talentName, setTalentName] = useState("");
  const [productOnly, setProductOnly] = useState(false);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);
  const [hookPreview, setHookPreview] = useState<{ score: number; type: string; feedback: string } | null>(null);
  const [hookScoring, setHookScoring] = useState(false);
  const [funnelStage, setFunnelStage] = useState("tofu");
  const [showPersonaWarning, setShowPersonaWarning] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const hookDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-sync market from persona
  if (personaMarket !== prevPersonaMarket) {
    setPrevPersonaMarket(personaMarket);
    if (!marketOverridden) setMarket(personaMarket);
  }

  // Pre-fill from template if navigating from templates page
  useEffect(() => {
    if (state?.templatePrompt) {
      setPrompt(state.templatePrompt);
      setFromTemplate(state.templateName || null);
      if (state.templateDuration) {
        setDuration(state.templateDuration);
      }
      // Clear location state to prevent re-filling on refresh
      window.history.replaceState({}, document.title);
    }
  }, [state]);

  // Live hook score preview — debounced 1.5s after typing
  useEffect(() => {
    if (hookDebounceRef.current) clearTimeout(hookDebounceRef.current);
    if (prompt.trim().length < 20) { setHookPreview(null); return; }
    hookDebounceRef.current = setTimeout(async () => {
      setHookScoring(true);
      try {
        const { data } = await supabase.functions.invoke("generate-hooks", {
          body: { product: prompt.trim(), count: 1, market, platform, tone: "Aggressive / Urgent" },
        });
        const first = data?.hooks?.[0];
        if (first) {
          setHookPreview({ score: first.predicted_score, type: first.hook_type, feedback: first.why });
        }
      } catch { /* silent */ } finally { setHookScoring(false); }
    }, 1500);
    return () => { if (hookDebounceRef.current) clearTimeout(hookDebounceRef.current); };
  }, [prompt, market, platform]);

  const selectedMarket = MARKETS.find((m) => m.code === market)!;
  const selectedPlatform = PLATFORMS.find((p) => p.value === platform)!;

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 10) {
      toast.error("Please describe your video idea in more detail (minimum 10 characters)");
      return;
    }

    // Warn if no persona selected
    if (!selectedPersona && !pendingGenerate) {
      setShowPersonaWarning(true);
      return;
    }
    setPendingGenerate(false);

    setGenerating(true);
    setProgress("Validating and analyzing your brief...");

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      setProgress("Generating creative strategy...");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-board`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            title: title.trim() || undefined,
            market,
            platform,
            duration,
            has_talent: hasTalent && !productOnly,
            talent_name: hasTalent && talentName.trim() ? talentName.trim() : undefined,
            product_only: productOnly,
            context: context.trim() || undefined,
            user_id: user.id,
            persona_id: selectedPersona?.id || null,
            funnel_stage: funnelStage,
            persona_context: selectedPersona ? {
              name: selectedPersona.name, age: selectedPersona.age, gender: selectedPersona.gender,
              pains: selectedPersona.pains, desires: selectedPersona.desires, triggers: selectedPersona.triggers,
              hook_angles: selectedPersona.hook_angles, language_style: selectedPersona.language_style,
              cta_style: selectedPersona.cta_style, best_platforms: selectedPersona.best_platforms,
              best_formats: selectedPersona.best_formats, bio: selectedPersona.bio,
              brand_kit: (selectedPersona as any).brand_kit || undefined,
            } : null,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate board");
      }

      await refreshUsage();
      toast.success("Board generated successfully!");
      navigate(`/dashboard/boards/${data.board_id}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate board");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="page-enter p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <PersonaWarningModal
        open={showPersonaWarning}
        onClose={() => setShowPersonaWarning(false)}
        toolName="Board Generator"
        onContinue={() => { setShowPersonaWarning(false); setPendingGenerate(true); setTimeout(handleGenerate, 50); }}
      />
      {/* Template banner */}
      {fromTemplate && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Layers className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Using template: <span className="text-primary">{fromTemplate}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Edit the prompt below to customize before generating.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setFromTemplate(null); setPrompt(""); }}>
            Clear
          </Button>
        </div>
      )}

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
            Describe your ad concept. AI generates a complete production board.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Creative Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label htmlFor="prompt">
                  Describe your video idea <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Example: A UGC-style testimonial ad for a meditation app targeting stressed professionals aged 30-45. The creator should share their personal story of burnout and how the app helped them find calm. Include a strong hook in the first 3 seconds and end with a limited-time offer CTA."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="bg-muted border-border resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 10 characters. Be specific about product, audience, tone, and format.
                </p>
              </div>

              {/* Live Hook Score Preview */}
              {(hookPreview || hookScoring) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.13] bg-white/[0.07]">
                  {hookScoring ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50 shrink-0" />
                      <span className="text-xs text-white/50">Scoring hook preview...</span>
                    </>
                  ) : hookPreview ? (
                    <>
                      <Zap className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">Predicted hook score</span>
                          <span className={`text-sm font-bold font-mono ${hookPreview.score >= 8 ? "text-green-400" : hookPreview.score >= 6.5 ? "text-yellow-400" : "text-red-400"}`}>
                            {hookPreview.score.toFixed(1)}/10
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/[0.15] text-white/45 capitalize">
                            {hookPreview.type?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/45 mt-0.5 truncate">{hookPreview.feedback}</p>
                      </div>
                      <TrendingUp className="h-3.5 w-3.5 text-white/15 shrink-0" />
                    </>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Try a suggestion:</p>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions.map((suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="outline"
                      className="cursor-pointer border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion.length > 35 ? suggestion.slice(0, 35) + "..." : suggestion}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional context (optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Any additional notes, brand guidelines, competitor references, or specific requirements..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                  className="bg-muted border-border resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Talent settings */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Talent / Creator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Product-only video</Label>
                  <p className="text-xs text-muted-foreground">No person on camera, focus on product</p>
                </div>
                <Switch
                  checked={productOnly}
                  onCheckedChange={(v) => {
                    setProductOnly(v);
                    if (v) setHasTalent(false);
                  }}
                />
              </div>

              {!productOnly && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Features a person/creator</Label>
                      <p className="text-xs text-muted-foreground">UGC creator or influencer on camera</p>
                    </div>
                    <Switch checked={hasTalent} onCheckedChange={setHasTalent} />
                  </div>

                  {hasTalent && (
                    <div className="space-y-2">
                      <Label htmlFor="talent">Specific influencer/person (optional)</Label>
                      <Input
                        id="talent"
                        placeholder="e.g. MrBeast, Charli D'Amelio, or leave blank for generic UGC"
                        value={talentName}
                        onChange={(e) => setTalentName(e.target.value)}
                        className="bg-muted border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        If left blank, we'll generate a generic UGC creator profile.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          {/* Market */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Target Market
                {selectedPersona && !marketOverridden && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto"
                    style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)", color: "#0ea5e9" }}>
                    via {(selectedPersona.name || "Account").split(" ")[0]}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={market} onValueChange={(v) => { setMarket(v); setMarketOverridden(true); }}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      <span className="flex items-center gap-2">
                        <span>{m.flag}</span>
                        <span>{m.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {marketOverridden && selectedPersona ? (
                <button onClick={() => { setMarket(personaMarket); setMarketOverridden(false); }}
                  className="text-[10px] text-white/50 hover:text-white/60 transition-colors underline mt-2">
                  Reset to persona market
                </button>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedPersona ? "Auto-detected from active persona" : "Script language auto-detected from market"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Platform */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Video className="h-4 w-4" />
                Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={platform} onValueChange={setPlatform} className="space-y-2">
                {PLATFORMS.map((p) => (
                  <div key={p.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={p.value} id={p.value} />
                    <Label htmlFor={p.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      {p.label}
                      <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                        {p.ratio}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <Button
                    key={d}
                    variant={duration === d ? "default" : "outline"}
                    size="sm"
                    className={
                      duration === d
                        ? "bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }
                    onClick={() => setDuration(d)}
                  >
                    {d}s
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market</span>
                <span className="font-medium">
                  {selectedMarket.flag} {selectedMarket.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium">{selectedPlatform.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aspect</span>
                <span className="font-medium">{selectedPlatform.ratio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{duration}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {productOnly ? "Product-only" : hasTalent ? "With talent" : "Other"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Funnel stage */}
      <div className="rounded-2xl border border-white/[0.13] bg-[#0a0a0a] p-5">
        <label className="block text-xs text-white/50 mb-3">Funnel stage — who are you talking to?</label>
        <div className="grid grid-cols-3 gap-2">
          {getFunnelStages(dt).map(f => (
            <button key={f.value} onClick={() => setFunnelStage(f.value)}
              className="flex flex-col items-center p-3 rounded-xl border text-center transition-all"
              style={funnelStage === f.value
                ? { background: f.bg, borderColor: f.border, color: f.color }
                : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
              <span className="text-xs font-bold font-mono">{f.label}</span>
              <span className="text-[10px] mt-0.5 opacity-70">{f.full}</span>
              <span className="text-[9px] mt-1 opacity-40 leading-tight">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0 h-14 text-base font-semibold"
        onClick={handleGenerate}
        disabled={!prompt.trim() || prompt.trim().length < 10 || generating}
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {progress || dt("bo_generating")}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 mr-2" />
            Generate Production Board
          </>
        )}
      </Button>
    </div>
  );
};

export default NewBoard;
