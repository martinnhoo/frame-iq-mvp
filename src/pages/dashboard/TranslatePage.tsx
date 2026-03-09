import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const TranslatePage = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranslate = () => {
    if (!input.trim()) return;
    setTranslating(true);
    // Simulated translation
    setTimeout(() => {
      setOutput(
        "This is a simulated translation. In production, FrameIQ's AI engine translates your ad scripts while preserving cultural nuance, slang adaptation, and emotional tone for each target market."
      );
      setTranslating(false);
    }, 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auto Translation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Translate ad scripts across languages with cultural context preserved.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Source</span>
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">Auto-detect</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your ad script or transcript here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
              className="bg-muted border-border resize-none"
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>English</span>
              {output && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs text-muted-foreground">
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={output}
              readOnly
              rows={10}
              placeholder="Translation will appear here..."
              className="bg-muted border-border resize-none"
            />
          </CardContent>
        </Card>
      </div>

      <Button
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 h-12"
        onClick={handleTranslate}
        disabled={!input.trim() || translating}
      >
        {translating ? (
          <>
            <Globe className="h-4 w-4 mr-2 animate-spin" />
            Translating...
          </>
        ) : (
          <>
            Translate
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
};

export default TranslatePage;
