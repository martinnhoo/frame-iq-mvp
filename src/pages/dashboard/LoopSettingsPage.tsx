import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const j = { fontFamily: "'Inter', system-ui, sans-serif" } as const;
const m = { fontFamily: "'Inter', 'Inter', system-ui, sans-serif" } as const;

interface NomenclatureField {
  position: number;
  name: string;
  label: string;
}

const DEFAULT_FIELDS: NomenclatureField[] = [
  { position: 0, name: "creative_type", label: "Creative Type" },
  { position: 1, name: "market", label: "Market" },
  { position: 2, name: "editor", label: "Editor" },
  { position: 3, name: "date_code", label: "Date Code" },
  { position: 4, name: "talent", label: "Talent/Model" },
  { position: 5, name: "client", label: "Client" },
  { position: 6, name: "aspect_ratio", label: "Aspect Ratio" },
  { position: 7, name: "version", label: "Version" },
];

const FIELD_OPTIONS = [
  { name: "creative_type", label: "Creative Type" },
  { name: "market", label: "Market" },
  { name: "editor", label: "Editor" },
  { name: "date_code", label: "Date Code" },
  { name: "talent", label: "Talent/Model" },
  { name: "client", label: "Client" },
  { name: "aspect_ratio", label: "Aspect Ratio" },
  { name: "version", label: "Version" },
  { name: "platform", label: "Platform" },
  { name: "hook_type", label: "Hook Type" },
  { name: "hook_angle", label: "Hook Angle" },
  { name: "audience_temp", label: "Audience Temp" },
  { name: "custom_1", label: "Custom 1" },
  { name: "custom_2", label: "Custom 2" },
];

export default function LoopSettingsPage() {
  const { user } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();

  const navigate = useNavigate();
  const [separator, setSeparator] = useState("-");
  const [fields, setFields] = useState<NomenclatureField[]>(DEFAULT_FIELDS);
  const [exampleFilename, setExampleFilename] = useState("UGC-BR-JD-260314-MT-ACME-9v16-01");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("nomenclature_config" as any).select("*").eq("user_id", user.id).single();
      if (data) {
        setSeparator((data as any).separator || "-");
        setFields((data as any).fields as NomenclatureField[]);
        setExampleFilename((data as any).example_filename || exampleFilename);
      }
      setLoading(false);
    };
    load();
  }, [user.id]);

  const save = async () => {
    setSaving(true);
    try {
      // Upsert
      const { error } = await supabase.from("nomenclature_config" as any).upsert({
        user_id: user.id,
        separator,
        fields,
        example_filename: exampleFilename,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success(language === "pt" ? "Configuração salva" : language === "es" ? "Configuración guardada" : "Settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    const next = fields.length;
    setFields([...fields, { position: next, name: `custom_${next}`, label: `Field ${next + 1}` }]);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, position: i })));
  };

  const updateField = (idx: number, updates: Partial<NomenclatureField>) => {
    setFields(fields.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  // Live preview
  const parsedPreview = (() => {
    const base = exampleFilename.replace(/\.(mp4|mov|avi|csv|xlsx?)$/i, "");
    const parts = base.split(separator);
    const result: Record<string, string> = {};
    for (const field of fields) {
      if (parts[field.position]) {
        result[field.label] = parts[field.position];
      }
    }
    return result;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/dashboard/ai")} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors" style={m}>
        <ArrowLeft size={14} /> Back to Loop
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-foreground" style={j}>Naming Convention</h1>
        <p className="text-sm text-muted-foreground mt-1" style={m}>
          Configure how your creative filenames are structured. The AI uses this to extract metadata automatically.
        </p>
      </div>

      {/* Example */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "20px" }} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 col-span-2">
            <label style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>Example filename</label>
            <Input value={exampleFilename} onChange={e => setExampleFilename(e.target.value)} placeholder="UGC-BR-JD-260314-MT-ACME-9v16-01" />
          </div>
          <div className="space-y-2">
            <label style={{ ...m, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>Separator</label>
            <Input value={separator} onChange={e => setSeparator(e.target.value)} placeholder="-" className="text-center" />
          </div>
        </div>

        {/* Live preview */}
        <div style={{ background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.12)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>LIVE PREVIEW</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(parsedPreview).map(([label, value]) => (
              <span key={label} style={{ ...m, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", color: "#0ea5e9" }}>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{label}:</span> {value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "20px" }} className="space-y-3">
        <div className="flex items-center justify-between">
          <p style={{ ...j, fontSize: 14, fontWeight: 700, color: "#fff" }}>Field Mapping</p>
          <Button size="sm" variant="outline" onClick={addField} className="gap-1.5">
            <Plus size={12} /> Add Field
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-3" style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)", width: 20, textAlign: "center" }}>{idx}</span>
              <select
                value={field.name}
                onChange={e => {
                  const opt = FIELD_OPTIONS.find(o => o.name === e.target.value);
                  updateField(idx, { name: e.target.value, label: opt?.label || e.target.value });
                }}
                style={{ ...m, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", color: "#fff", flex: 1 }}>
                {FIELD_OPTIONS.map(o => (
                  <option key={o.name} value={o.name}>{o.label}</option>
                ))}
              </select>
              <span style={{ ...m, fontSize: 12, color: "rgba(14,165,233,0.6)", minWidth: 60 }}>
                → {exampleFilename.split(separator)[idx] || "—"}
              </span>
              <button onClick={() => removeField(idx)} style={{ color: "rgba(255,255,255,0.15)", cursor: "pointer", background: "none", border: "none" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full gap-2"
        style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000" }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Salvando..." : "Salvar configuração"}
      </Button>
    </div>
  );
}
