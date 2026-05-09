/**
 * Brands — gestão simples de marcas customizadas do user.
 *
 * Lista de marcas (cards) → click abre modal de edit com:
 *   - Nome
 *   - Notas (tom, palavras proibidas, paleta, regulação)
 *   - Upload area pra screenshots/promos do site (vão pra hub-images bucket
 *     no path {user_id}/brand-assets/{brand_id}/)
 *   - Grid dos assets uploaded — click pra deletar
 *
 * Quando o user vai pro Studio e seleciona essa marca, o server
 * (generate-creatives) carrega 3 assets aleatórios e usa como referência
 * visual no GPT-image-2.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, X, Upload, Trash2, Edit3, Image as ImageIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface UserBrand {
  id: string;
  name: string;
  notes: string;
  asset_count: number;
  cover_url: string | null;
  created_at: string;
}

interface BrandAsset {
  id: string;
  asset_url: string;
  position: number;
}

const BUCKET = "hub-images";

export default function Brands() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadBrands = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      // Fetch brands
      const { data: brandsData } = await supabase
        .from("user_brands")
        .select("id, name, notes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!brandsData) { setLoading(false); return; }

      // Fetch counts + first asset cover por marca (em paralelo)
      const enriched = await Promise.all(
        brandsData.map(async (b) => {
          const { data: assets } = await supabase
            .from("brand_assets")
            .select("asset_url")
            .eq("brand_id", b.id)
            .order("position", { ascending: true })
            .limit(1);
          const { count } = await supabase
            .from("brand_assets")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", b.id);
          return {
            id: b.id as string,
            name: (b.name as string) || "Sem nome",
            notes: (b.notes as string) || "",
            asset_count: count || 0,
            cover_url: assets?.[0]?.asset_url || null,
            created_at: b.created_at as string,
          };
        })
      );
      setBrands(enriched);
    } catch (e) {
      setError(String(e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadBrands(); }, []);

  const editingBrand = useMemo(() => {
    if (editingId === "new" || editingId === null) return null;
    return brands.find(b => b.id === editingId) || null;
  }, [editingId, brands]);

  return (
    <>
      <Helmet><title>Marcas — Hub</title></Helmet>
      <div style={{
        minHeight: "100%", background: "#06070a", color: "#fff",
        padding: isMobile ? "16px 14px 28px" : "24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard/hub")} style={btnGhost}>
            <ArrowLeft size={13} /> Voltar ao Hub
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Marcas</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "6px 0 0", maxWidth: 720, lineHeight: 1.5 }}>
              Cadastre suas marcas com screenshots do site, promos e referências visuais. A IA usa esses assets como contexto quando você gera criativos no Studio.
            </p>
          </div>
          <button
            onClick={() => setEditingId("new")}
            style={{
              ...btnPrimary,
              padding: "10px 16px", fontSize: 13,
            }}
          >
            <Plus size={14} /> Nova marca
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: "10px 14px",
            background: "rgba(248,113,113,0.10)",
            border: "1px solid rgba(248,113,113,0.30)",
            borderRadius: 8, fontSize: 12.5, color: "#FCA5A5",
          }}>{error}</div>
        )}

        {loading ? (
          <div style={emptyState}>Carregando marcas...</div>
        ) : brands.length === 0 ? (
          <div style={emptyState}>
            <ImageIcon size={36} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Nenhuma marca ainda</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", maxWidth: 380, margin: "0 auto" }}>
              Crie sua primeira marca pra começar a gerar criativos com referências visuais consistentes.
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}>
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => setEditingId(b.id)}
                style={brandCardStyle}
              >
                <div style={{
                  width: "100%", aspectRatio: "16/9",
                  background: "rgba(255,255,255,0.03)",
                  borderTopLeftRadius: 11, borderTopRightRadius: 11,
                  overflow: "hidden", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {b.cover_url ? (
                    <img src={b.cover_url} alt="" loading="lazy" decoding="async" style={{
                      width: "100%", height: "100%", objectFit: "cover",
                    }} />
                  ) : (
                    <ImageIcon size={28} style={{ color: "rgba(255,255,255,0.20)" }} />
                  )}
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{b.name}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.50)" }}>
                    {b.asset_count} {b.asset_count === 1 ? "referência" : "referências"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {editingId !== null && (
        <BrandEditor
          brandId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); reloadBrands(); }}
          onDeleted={() => { setEditingId(null); reloadBrands(); }}
        />
      )}
    </>
  );
}

// ── Brand editor (modal) ──────────────────────────────────────────
function BrandEditor({
  brandId, onClose, onSaved, onDeleted,
}: {
  brandId: string | "new";
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isMobile = useIsMobile();
  const isNew = brandId === "new";

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [savedBrandId, setSavedBrandId] = useState<string | null>(isNew ? null : brandId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const { data: brand } = await supabase
          .from("user_brands")
          .select("name, notes")
          .eq("id", brandId)
          .maybeSingle();
        if (brand) {
          setName((brand.name as string) || "");
          setNotes((brand.notes as string) || "");
        }
        const { data: assetsData } = await supabase
          .from("brand_assets")
          .select("id, asset_url, position")
          .eq("brand_id", brandId)
          .order("position", { ascending: true });
        if (assetsData) setAssets(assetsData as BrandAsset[]);
      } catch (e) {
        setError(`Falha ao carregar marca: ${String(e).slice(0, 100)}`);
      }
    })();
  }, [brandId, isNew]);

  // Salva nome+notas. Pra novo, cria; pra existente, faz update.
  const saveCore = async (): Promise<string | null> => {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Nome é obrigatório");
      return null;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Sessão expirada"); return null; }

      if (savedBrandId) {
        // Update
        const { error: upErr } = await supabase
          .from("user_brands")
          .update({ name: cleanName, notes: notes.trim() })
          .eq("id", savedBrandId);
        if (upErr) { setError(`Falha ao salvar: ${upErr.message}`); return null; }
        return savedBrandId;
      } else {
        // Insert
        const { data: inserted, error: insErr } = await supabase
          .from("user_brands")
          .insert({ user_id: user.id, name: cleanName, notes: notes.trim() })
          .select("id")
          .single();
        if (insErr || !inserted) { setError(`Falha ao criar: ${insErr?.message || "?"}`); return null; }
        const newId = inserted.id as string;
        setSavedBrandId(newId);
        return newId;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    const id = await saveCore();
    if (id) onSaved();
  };

  // Upload de asset(s). Se brand é novo (sem ID), salva primeiro.
  const handleUpload = async (filesList: FileList | File[]) => {
    setError(null);
    const files = Array.from(filesList).filter(f => /^image\/(png|jpe?g|webp)$/i.test(f.type));
    if (files.length === 0) {
      setError("Apenas PNG/JPG/WEBP");
      return;
    }
    // Garante que brand existe
    let bid = savedBrandId;
    if (!bid) {
      bid = await saveCore();
      if (!bid) return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Sessão expirada"); return; }

      // Upload em paralelo (cada file vai pro Storage + insert no DB)
      let done = 0;
      const total = files.length;
      setUploadProgress(`Enviando 0/${total}`);

      const uploaded = await Promise.all(files.map(async (file) => {
        const ext = file.type === "image/png" ? "png"
          : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/brand-assets/${bid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type, cacheControl: "3600", upsert: false,
        });
        if (upErr) {
          console.warn("upload failed:", upErr.message);
          done++; setUploadProgress(`Enviando ${done}/${total}`);
          return null;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const url = urlData?.publicUrl;
        if (!url) { done++; return null; }

        // Insert no brand_assets
        const { data: inserted } = await supabase
          .from("brand_assets")
          .insert({
            brand_id: bid!, user_id: user.id,
            asset_url: url, kind: "general",
            position: assets.length + done,
          })
          .select("id, asset_url, position")
          .single();
        done++;
        setUploadProgress(`Enviando ${done}/${total}`);
        return inserted as BrandAsset | null;
      }));

      const validAssets = uploaded.filter((a): a is BrandAsset => !!a);
      setAssets(prev => [...prev, ...validAssets]);
    } catch (e) {
      setError(`Falha no upload: ${String(e).slice(0, 100)}`);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const { error: delErr } = await supabase
        .from("brand_assets")
        .delete()
        .eq("id", assetId);
      if (delErr) { setError(`Falha ao deletar: ${delErr.message}`); return; }
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (e) {
      setError(String(e).slice(0, 100));
    }
  };

  const handleDeleteBrand = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); return; }
    if (!savedBrandId) { onClose(); return; }
    setDeleting(true);
    try {
      // Cascade delete via FK on user_brands
      const { error: delErr } = await supabase
        .from("user_brands")
        .delete()
        .eq("id", savedBrandId);
      if (delErr) { setError(`Falha ao deletar marca: ${delErr.message}`); setDeleting(false); return; }
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? 8 : 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
        maxWidth: 720, width: "100%", maxHeight: isMobile ? "95vh" : "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>
            {isNew ? "Nova marca" : "Editar marca"}
          </h3>
          <button onClick={onClose} style={btnGhost}><X size={13} /></button>
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {/* Nome */}
          <div style={field}>
            <label style={fieldLabel}>Nome *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="ex: BETBUS, ELUCK, Meu Cassino..."
              style={inputStyle}
            />
          </div>

          {/* Notas */}
          <div style={field}>
            <label style={fieldLabel}>Notas (tom, regras, paleta)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder={"ex:\n• Tom direto e moderno\n• Cores: vermelho + dourado\n• Sempre incluir disclaimer 18+\n• Mercado: México (es-MX)\n• Evitar mariachi, sombreros, clichês"}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", minHeight: 100 }}
            />
            <div style={fieldHint}>
              Quanto mais específico, melhor a IA respeita o estilo da marca.
            </div>
          </div>

          {/* Upload area */}
          <div style={field}>
            <label style={fieldLabel}>
              Referências visuais
              {assets.length > 0 && <span style={{ color: "#A78BFA", marginLeft: 6 }}>({assets.length})</span>}
            </label>
            <div style={fieldHint}>
              Suba screenshots do site, promos atuais, banners, materiais oficiais. A IA usa como referência visual real.
            </div>
            <label style={uploadAreaStyle}>
              <input
                type="file" multiple accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={e => { if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files); }}
              />
              <Upload size={20} style={{ color: "#A78BFA", marginBottom: 6 }} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
                {uploading ? uploadProgress || "Enviando..." : "Clique pra adicionar referências"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                PNG / JPG / WEBP · até 25MB cada
              </div>
            </label>

            {/* Grid de assets uploaded */}
            {assets.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: 8, marginTop: 12,
              }}>
                {assets.map(a => (
                  <div key={a.id} style={{
                    position: "relative", aspectRatio: "1/1",
                    borderRadius: 7, overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#000",
                  }}>
                    <img src={a.asset_url} alt="" loading="lazy" style={{
                      width: "100%", height: "100%", objectFit: "cover",
                    }} />
                    <button onClick={() => handleDeleteAsset(a.id)} title="Remover" style={{
                      position: "absolute", top: 4, right: 4,
                      width: 22, height: 22, borderRadius: 5,
                      background: "rgba(0,0,0,0.80)", border: "none",
                      color: "#FCA5A5", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: "9px 12px", marginTop: 12,
              background: "rgba(248,113,113,0.10)",
              border: "1px solid rgba(248,113,113,0.30)",
              borderRadius: 7, fontSize: 11.5, color: "#FCA5A5",
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          {!isNew ? (
            <button
              onClick={handleDeleteBrand}
              disabled={deleting}
              style={{
                padding: "8px 12px", borderRadius: 7,
                background: confirmDelete ? "#DC2626" : "rgba(248,113,113,0.10)",
                border: confirmDelete ? "1px solid #EF4444" : "1px solid rgba(248,113,113,0.20)",
                color: confirmDelete ? "#fff" : "#FCA5A5",
                fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              <Trash2 size={11} /> {deleting ? "Deletando..." : confirmDelete ? "Confirmar (deleta tudo)" : "Deletar marca"}
            </button>
          ) : (<div />)}
          <button
            onClick={handleSaveAndClose}
            disabled={saving || !name.trim()}
            style={{
              ...btnPrimary,
              padding: "9px 16px", fontSize: 12.5,
              opacity: (saving || !name.trim()) ? 0.5 : 1,
              cursor: (saving || !name.trim()) ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6, color: "rgba(255,255,255,0.75)",
  fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  background: "#A78BFA",
  border: "1px solid #A78BFA",
  borderRadius: 7, color: "#0a0a0f",
  fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const brandCardStyle: React.CSSProperties = {
  textAlign: "left", background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12, overflow: "hidden", cursor: "pointer",
  color: "#fff", fontFamily: "inherit", padding: 0,
  transition: "transform 0.15s, border-color 0.15s",
};
const emptyState: React.CSSProperties = {
  marginTop: 30, padding: "60px 20px",
  textAlign: "center", color: "rgba(255,255,255,0.55)",
  background: "rgba(255,255,255,0.02)",
  border: "1px dashed rgba(255,255,255,0.10)",
  borderRadius: 12,
};
const field: React.CSSProperties = { marginBottom: 16 };
const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 6,
};
const fieldHint: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8, color: "#fff", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const uploadAreaStyle: React.CSSProperties = {
  display: "block", width: "100%",
  border: "1.5px dashed rgba(167,139,250,0.30)",
  borderRadius: 10, padding: 20, textAlign: "center",
  cursor: "pointer", background: "rgba(167,139,250,0.04)",
  marginTop: 6,
};
