import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Check, ArrowLeft, Loader2, Link as LinkIcon } from "lucide-react";

const steps = [
  "Extracting frames",
  "Transcribing audio",
  "Translating to English",
  "Analyzing creative model",
  "Generating insights",
];

const NewAnalysis = () => {
  const { user, refreshUsage } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("video/")) {
      setFile(droppedFile);
      if (!title) setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const startAnalysis = async () => {
    if (!file && !videoUrl) {
      toast.error("Please upload a video or paste a URL");
      return;
    }

    setIsProcessing(true);
    setActiveStep(0);

    // Create analysis record
    const { data, error } = await supabase.from("analyses").insert({
      user_id: user.id,
      title: title || "Untitled Analysis",
      video_url: videoUrl || null,
      status: "pending",
    }).select().single();

    if (error) {
      toast.error("Failed to create analysis");
      setIsProcessing(false);
      return;
    }

    // Simulate processing
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          // Update status to completed
          supabase
            .from("analyses")
            .update({ status: "completed" })
            .eq("id", data.id)
            .then(() => {
              refreshUsage();
              setTimeout(() => navigate("/dashboard/analyses"), 1000);
            });
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/analyses")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a video or paste a URL to analyze.
          </p>
        </div>
      </div>

      {!isProcessing ? (
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="e.g. Nike Running Q1 Campaign"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted border-border"
            />
          </div>

          {/* Drop zone */}
          <div
            className={`relative rounded-2xl transition-all duration-200 border-2 border-dashed p-12 text-center ${
              isDragging ? "border-foreground bg-muted/50" : "border-border bg-card"
            } ${file ? "border-accent bg-accent/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-accent-foreground" />
                </div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-foreground font-medium">Drop your video here</p>
                <p className="text-sm text-muted-foreground">MP4, MOV, AVI up to 500MB</p>
                <label className="mt-2">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button variant="outline" className="border-border cursor-pointer" asChild>
                    <span>Browse files</span>
                  </Button>
                </label>
              </div>
            )}
          </div>

          {/* OR */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">or paste a URL</span>
            </div>
          </div>

          {/* URL Input */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="https://www.tiktok.com/@brand/video/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="pl-10 bg-muted border-border"
              />
            </div>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 h-12 text-base"
            onClick={startAnalysis}
            disabled={!file && !videoUrl}
          >
            Start Analysis
          </Button>
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-8 space-y-5">
            <div className="text-center mb-6">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent mb-3" />
              <h3 className="text-lg font-semibold text-foreground">Analyzing your video...</h3>
              <p className="text-sm text-muted-foreground">This usually takes under 60 seconds.</p>
            </div>
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  index <= activeStep ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {index < activeStep ? (
                  <Check className="h-4 w-4 text-accent shrink-0" />
                ) : index === activeStep ? (
                  <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  </div>
                ) : (
                  <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-muted" />
                  </div>
                )}
                <span className="text-sm">{step}</span>
              </div>
            ))}
            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewAnalysis;
