import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronDown, Users, Target, Clapperboard, Sparkles, Film, Settings, Shield, Loader2 } from "lucide-react";

interface BoardData {
  id: string;
  title: string;
  prompt: string;
  status: string;
  content: Record<string, unknown> | null;
  created_at: string;
}

const BoardDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true, audience: true, character: false, strategy: true, scenes: true, production: false, compliance: false,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("boards").select("*").eq("id", id).single();
      if (data) setBoard(data as BoardData);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const toggle = (key: string) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!board) return <div className="p-8 text-center text-muted-foreground">Board not found</div>;

  const content = board.content as Record<string, unknown> | null;
  const meta = content?.meta as Record<string, unknown> || {};
  const audience = content?.audience as Record<string, unknown> || {};
  const character = content?.character as Record<string, unknown> | null;
  const strategy = content?.strategy as Record<string, unknown> || {};
  const scenes = (content?.scenes || []) as Record<string, unknown>[];
  const production = content?.production as Record<string, unknown> || {};
  const compliance = content?.compliance as Record<string, unknown> || {};

  const Section = ({ id, icon: Icon, title, children, badge }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode; badge?: React.ReactNode }) => (
    <Collapsible open={openSections[id]} onOpenChange={() => toggle(id)}>
      <Card className="border-border bg-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{title}</span>
              <span className="flex items-center gap-2">{badge}<ChevronDown className={`h-4 w-4 transition-transform ${openSections[id] ? "rotate-180" : ""}`} /></span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent><CardContent className="pt-0">{children}</CardContent></CollapsibleContent>
      </Card>
    </Collapsible>
  );

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/boards")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{board.title || "Untitled Board"}</h1>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{board.prompt}</p>
        </div>
        <Badge variant="outline" className="capitalize border-border">{board.status}</Badge>
      </div>

      {!content ? (
        <Card className="border-border bg-card"><CardContent className="py-12 text-center text-muted-foreground">This board has no generated content yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Section id="overview" icon={Target} title="Campaign Overview" badge={<span className="text-lg">{meta.market_flag}</span>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Market</span><span className="font-medium">{String(meta.market_flag)} {String(meta.market)}</span></div>
              <div><span className="text-muted-foreground block">Platform</span><span className="font-medium capitalize">{String(meta.platform)}</span></div>
              <div><span className="text-muted-foreground block">Duration</span><span className="font-medium">{String(meta.duration)}s</span></div>
              <div><span className="text-muted-foreground block">Aspect</span><span className="font-medium">{String(meta.aspect_ratio)}</span></div>
            </div>
          </Section>

          <Section id="audience" icon={Users} title="Target Audience">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Age range:</span> {String(audience.age_range || "—")}</div>
              <div><span className="text-muted-foreground">Gender:</span> {String(audience.gender_skew || "—")}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Interests:</span> {(audience.interests as string[] || []).join(", ") || "—"}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Cultural notes:</span> {String(audience.cultural_notes || "—")}</div>
            </div>
          </Section>

          {character && (
            <Section id="character" icon={Users} title="Character Profile">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(character, null, 2)}</pre>
            </Section>
          )}

          <Section id="strategy" icon={Sparkles} title="Creative Strategy">
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Hook type:</span> <Badge variant="outline" className="ml-1 border-border">{String(strategy.hook_type)}</Badge></div>
              <div><span className="text-muted-foreground">Narrative:</span> <Badge variant="outline" className="ml-1 border-border">{String(strategy.narrative_arc)}</Badge></div>
              <div><span className="text-muted-foreground">Pacing:</span> {String(strategy.pacing)}</div>
              <div><span className="text-muted-foreground">CTA:</span> {String(strategy.cta_type)}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Key message:</span> <em>{String(strategy.key_message || "—")}</em></div>
            </div>
          </Section>

          <Section id="scenes" icon={Film} title={`Scenes (${scenes.length})`}>
            <div className="space-y-4">
              {scenes.map((scene, i) => (
                <div key={i} className="p-3 bg-muted rounded-lg text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/20 text-primary border-0">Scene {scene.scene_number}</Badge>
                    <span className="text-muted-foreground text-xs">{String(scene.timestamp)}</span>
                  </div>
                  <p className="text-foreground">{String(scene.visual_description)}</p>
                  {scene.vo_script && <p className="text-muted-foreground italic">VO: "{String(scene.vo_script)}"</p>}
                  {scene.onscreen_text && <p className="text-xs text-muted-foreground">On-screen: {String(scene.onscreen_text)}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section id="production" icon={Settings} title="Production Notes">
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{JSON.stringify(production, null, 2)}</pre>
          </Section>

          <Section id="compliance" icon={Shield} title="Compliance" badge={<Badge variant={compliance.platform_safe ? "outline" : "destructive"} className="border-border">{String(compliance.overall_risk)} risk</Badge>}>
            <div className="text-sm space-y-2">
              <p>{compliance.platform_safe ? "✅ Platform safe" : "⚠️ Review required"}</p>
              {(compliance.suggestions as string[] || []).length > 0 && <p className="text-muted-foreground">{(compliance.suggestions as string[]).join(", ")}</p>}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

export default BoardDetail;
