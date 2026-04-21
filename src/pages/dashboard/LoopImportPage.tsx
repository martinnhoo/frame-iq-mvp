import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

const j = { fontFamily: T.font } as const;
const m = { fontFamily: T.font } as const;

interface NomenclatureField {
  position: number;
  name: string;
  label: string;
}

export default function LoopImportPage() {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState("meta");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string[][]>([]);
  const [nomenclature, setNomenclature] = useState<{ separator: string; fields: NomenclatureField[] } | null>(null);
  const [results, setResults] = useState<{ parsed: number; skipped: number; entries: any[] } | null>(null);

  // Load nomenclature config
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("nomenclature_config" as any).select("*").eq("user_id", user.id).single();
      if (data) {
        setNomenclature({ separator: (data as any).separator, fields: (data as any).fields as NomenclatureField[] });
      } else {
        // Default config
        setNomenclature({
          separator: "-",
          fields: [
            { position: 0, name: "creative_type", label: "Creative Type" },
            { position: 1, name: "market", label: "Market" },
            { position: 2, name: "editor", label: "Editor" },
            { position: 3, name: "date_code", label: "Date Code" },
            { position: 4, name: "talent", label: "Talent" },
            { position: 5, name: "client", label: "Client" },
            { position: 6, name: "aspect_ratio", label: "Aspect Ratio" },
            { position: 7, name: "version", label: "Version" },
          ],
        });
      }
    };
    load();
  }, [user.id]);

  const parseFilename = (filename: string): Record<string, string> => {
    if (!nomenclature) return {};
    const base = filename.replace(/\.(mp4|mov|avi|csv|xlsx?)$/i, "");
    const parts = base.split(nomenclature.separator);
    const result: Record<string, string> = {};
    for (const field of nomenclature.fields) {
      if (parts[field.position]) {
        result[field.name] = parts[field.position];
      }
    }
    return result;
  };

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );


  const handleFile = async (f: File) => {
    setFile(f);
    setResults(null);

    // Preview CSV
    if (f.name.endsWith(".csv")) {
      const text = await f.text();
      const lines = text.split("\n").filter(l => l.trim());
      const rows = lines.slice(0, 6).map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      setPreview(rows);
    } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
      // Load xlsx dynamically
      const { read, utils } = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = read(new Uint8Array(buffer), { codepage: 65001 });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: string[][] = utils.sheet_to_json(sheet, { header: 1 });
      setPreview(data.slice(0, 6));
    }
  };

  const processImport = async () => {
    if (!file || !preview.length) return;
    setLoading(true);

    try {
      const headers = preview[0].map(h => h.toLowerCase().trim());
      const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("creative") || h.includes("ad"));
      const impressIdx = headers.findIndex(h => h.includes("impression"));
      const clickIdx = headers.findIndex(h => h.includes("click") && !h.includes("ctr"));
      const spendIdx = headers.findIndex(h => h.includes("spend") || h.includes("cost") || h.includes("amount"));
      const ctrIdx = headers.findIndex(h => h.includes("ctr"));
      const cpcIdx = headers.findIndex(h => h.includes("cpc"));
      const roasIdx = headers.findIndex(h => h.includes("roas"));

      // Parse full file
      let allRows: string[][] = [];
      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        allRows = text.split("\n").filter(l => l.trim()).map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      } else {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = read(new Uint8Array(buffer), { codepage: 65001 });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        allRows = utils.sheet_to_json(sheet, { header: 1 });
      }

      const dataRows = allRows.slice(1); // skip header
      const entries: any[] = [];
      let skipped = 0;
      const batchId = crypto.randomUUID();

      for (const row of dataRows) {
        const name = nameIdx >= 0 ? row[nameIdx] : null;
        if (!name) { skipped++; continue; }

        const parsed = parseFilename(name);
        const entry = {
          user_id: user.id,
          filename: name,
          creative_type: parsed.creative_type || null,
          market: parsed.market || null,
          editor: parsed.editor || null,
          date_code: parsed.date_code || null,
          talent: parsed.talent || null,
          client: parsed.client || null,
          aspect_ratio: parsed.aspect_ratio || null,
          version: parsed.version || null,
          platform,
          impressions: impressIdx >= 0 ? parseInt(row[impressIdx]) || 0 : 0,
          clicks: clickIdx >= 0 ? parseInt(row[clickIdx]) || 0 : 0,
          spend: spendIdx >= 0 ? parseFloat(row[spendIdx]) || 0 : 0,
          ctr: ctrIdx >= 0 ? parseFloat(row[ctrIdx]) || null : null,
          cpc: cpcIdx >= 0 ? parseFloat(row[cpcIdx]) || null : null,
          roas: roasIdx >= 0 ? parseFloat(row[roasIdx]) || null : null,
          source: "manual",
          import_batch_id: batchId,
        };

        // Calculate CTR if not provided
        if (!entry.ctr && entry.impressions > 0 && entry.clicks > 0) {
          entry.ctr = entry.clicks / entry.impressions;
        }
        if (!entry.cpc && entry.spend > 0 && entry.clicks > 0) {
          entry.cpc = entry.spend / entry.clicks;
        }

        entries.push(entry);
      }

      // Batch insert
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const { error } = await supabase.from("creative_entries" as any).insert(batch as any);
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
      }

      setResults({ parsed: entries.length, skipped, entries: entries.slice(0, 5) });
      toast.success(`Imported ${entries.length} creatives`);

      // ── Auto-trigger learn after import — closes the loop automatically ──
      // Fire and forget — user doesn't need to manually trigger learn
      if (entries.length > 0) {
        supabase.functions.invoke("creative-loop", {
          body: { action: "learn", user_id: user.id }
        }).then(() => {
          toast.success("AI learning updated automatically", { duration: 3000 });
        }).catch(() => {}); // silent fail — import already succeeded
      }
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate("/dashboard/ai")} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors" style={m}>
        <ArrowLeft size={14} /> Back to Loop
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-foreground" style={j}>Import Performance Data</h1>
        <p className="text-sm text-muted-foreground mt-1" style={m}>Upload CSV or XLSX from your ad platform. We'll parse creative names and match performance.</p>
      </div>

      {/* Platform + File */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 20px" }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>Platform</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="tiktok">TikTok Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>File</label>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full gap-2">
              <Upload size={14} /> {file ? file.name : "Choose CSV / XLSX"}
            </Button>
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-3">
            <p style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>Preview (first 5 rows)</p>
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                {preview.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: ri === 0 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                    {row.slice(0, 8).map((cell, ci) => (
                      <td key={ci} style={{ ...m, fontSize: 12, padding: "6px 8px", color: ri === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.5)", fontWeight: ri === 0 ? 700 : 400, whiteSpace: "nowrap" }}>
                        {cell?.toString().slice(0, 30)}
                      </td>
                    ))}
                  </tr>
                ))}
              </table>
            </div>

            {/* Nomenclature preview */}
            {nomenclature && preview[1] && (() => {
              const headers = preview[0].map(h => h.toLowerCase().trim());
              const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("creative") || h.includes("ad"));
              const sampleName = nameIdx >= 0 ? preview[1][nameIdx] : null;
              if (!sampleName) return null;
              const parsed = parseFilename(sampleName);
              return (
                <div style={{ background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.12)", borderRadius: 14, padding: "14px 16px" }}>
                  <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>PARSED FROM: <span style={{ color: "#0ea5e9" }}>{sampleName}</span></p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(parsed).map(([k, v]) => (
                      <span key={k} style={{ ...m, fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ color: "rgba(255,255,255,0.25)" }}>{k}:</span> {v}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <Button onClick={processImport} disabled={loading} className="w-full gap-2"
              style={{ background: "#0ea5e9", color: "#000" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {loading ? "Processando..." : "Importar e analisar criativos"}
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 20, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CheckCircle2 size={18} style={{ color: "#34d399" }} />
            <span style={{ ...j, fontSize: 14, fontWeight: 800, color: "#fff" }}>Import Complete</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <span style={{ ...m, fontSize: 12, color: "#34d399" }}> {results.parsed} parsed</span>
            {results.skipped > 0 && <span style={{ ...m, fontSize: 12, color: "#fbbf24" }}> {results.skipped} skipped</span>}
          </div>
          <Button onClick={() => navigate("/dashboard/ai")} className="gap-2"
            style={{ background: "#0ea5e9", color: "#000" }}>
            Go to Loop → Run Learning
          </Button>
        </div>
      )}
    </div>
  );
}
