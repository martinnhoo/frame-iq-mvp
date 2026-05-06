/**
 * HubABVariations — gera N variantes do mesmo brief em paralelo.
 *
 * Reutiliza generate-image-hub (sem nova edge function, sem migration).
 * Cada variante é uma row hub_image com metadata extra no content:
 *   - ab_variant_group_id: agrupa as N variantes do mesmo experiment
 *   - ab_variant_label: rótulo curto da dimensão (ex "Tom: Urgência")
 *   - ab_variant_dim: qual dimensão variou (mood/composition/hook/random)
 *   - ab_is_winner: marcado quando user escolhe a vencedora
 *
 * Layout: 2-coluna SaaS — LEFT = form (mesmo do Image Studio + 2 controles)
 *                       RIGHT = grid de N variantes lado-a-lado
 *
 * UX do winner-pick:
 *   - Click na estrela → marca como vencedora
 *   - Marcar uma desmarca a outra (1 winner por grupo)
 *   - Vencedora sobe pro topo do grid e ganha border azul
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  Copy, RotateCcw, Check, ChevronDown, Search, Plus, Upload, X,
  GitBranch, Star, Trash2,
} from "lucide-react";
import {
  HUB_BRANDS, HUB_MARKETS, getBrand, getBrandName, getMarketLabel,
  type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useLanguage } from "@/i18n/LanguageContext";
import { composeImage } from "@/lib/composeImageWithLicense";
import { addHubNotification } from "@/lib/hubNotifications";
import { saveHubAsset } from "@/lib/saveHubAsset";

// ── Strings i18n ──────────────────────────────────────────────────
const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",        en: "Back to Hub",          es: "Volver al Hub",          zh: "返回中心" },
  title:          { pt: "Variações A/B",         en: "A/B Variations",        es: "Variaciones A/B",        zh: "A/B 变体" },
  subtitle:       { pt: "Gere N variações do mesmo brief em paralelo. Compare lado-a-lado e escolha a vencedora.",
                   en: "Generate N variations of the same brief in parallel. Compare side-by-side and pick the winner.",
                   es: "Genera N variaciones del mismo brief en paralelo. Compara lado a lado y elige la ganadora.",
                   zh: "并行生成同一简报的 N 个变体。并排比较并选择优胜者。" },
  brand:          { pt: "Marca",                 en: "Brand",                 es: "Marca",                  zh: "品牌" },
  brandSubtitle:  { pt: "Selecione a marca para o seu criativo.",
                   en: "Pick the brand for your creative.",
                   es: "Selecciona la marca para tu creativo.",
                   zh: "选择创意的品牌。" },
  selectBrand:    { pt: "Selecionar marca",      en: "Select brand",          es: "Seleccionar marca",      zh: "选择品牌" },
  searchBrand:    { pt: "Buscar marca…",         en: "Search brand…",         es: "Buscar marca…",          zh: "搜索品牌…" },
  describe:       { pt: "Descreva o criativo",   en: "Describe the creative", es: "Describe el creativo",   zh: "描述创意" },
  describeHint:   { pt: "Digite o que você deseja criar.",
                   en: "Type what you want to create.",
                   es: "Escribe lo que deseas crear.",
                   zh: "输入您想创建的内容。" },
  describePlaceholder: { pt: "Ex: Banner de aposta esportiva com Neymar, odds altas, clima de urgência…",
                   en: "Ex: Sports betting banner with Neymar, high odds, sense of urgency…",
                   es: "Ej: Banner de apuesta deportiva con Neymar, cuotas altas, sensación de urgencia…",
                   zh: "例：体育博彩横幅，内马尔，高赔率，紧迫氛围…" },
  format:         { pt: "Formato",                en: "Format",                es: "Formato",                zh: "格式" },
  formatHint:     { pt: "Escolha o formato ideal.",
                   en: "Pick the ideal format.",
                   es: "Elige el formato ideal.",
                   zh: "选择理想的格式。" },
  fmtFeedTitle:   { pt: "Feed",                   en: "Feed",                  es: "Feed",                   zh: "信息流" },
  fmtFeedDesc:    { pt: "Instagram, Facebook",    en: "Instagram, Facebook",   es: "Instagram, Facebook",    zh: "Instagram、Facebook" },
  fmtStoriesTitle:{ pt: "Stories",                en: "Stories",               es: "Stories",                zh: "Stories" },
  fmtStoriesDesc: { pt: "Instagram, TikTok",      en: "Instagram, TikTok",     es: "Instagram, TikTok",      zh: "Instagram、TikTok" },
  fmtBannerTitle: { pt: "Banner",                 en: "Banner",                es: "Banner",                 zh: "横幅" },
  fmtBannerDesc:  { pt: "YouTube, Web",           en: "YouTube, Web",          es: "YouTube, Web",           zh: "YouTube、Web" },
  quality:        { pt: "Qualidade",              en: "Quality",               es: "Calidad",                zh: "质量" },
  qualityHint:    { pt: "Defina o nível de qualidade.",
                   en: "Set the quality level.",
                   es: "Define el nivel de calidad.",
                   zh: "设置质量级别。" },
  qDraft:         { pt: "Rascunho",               en: "Draft",                 es: "Borrador",               zh: "草稿" },
  qDraftDesc:     { pt: "Mais rápido",            en: "Faster",                es: "Más rápido",             zh: "更快" },
  qMedium:        { pt: "Médio",                  en: "Medium",                es: "Medio",                  zh: "中等" },
  qMediumDesc:    { pt: "Recomendado",            en: "Recommended",           es: "Recomendado",            zh: "推荐" },
  qHigh:          { pt: "Alta",                   en: "High",                  es: "Alta",                   zh: "高" },
  qHighDesc:      { pt: "Mais detalhes",          en: "More detail",           es: "Más detalles",           zh: "更多细节" },
  // A/B specific
  variantsTitle:  { pt: "Variantes",              en: "Variants",              es: "Variantes",              zh: "变体数量" },
  variantsHint:   { pt: "Quantas versões diferentes gerar em paralelo.",
                   en: "How many different versions to generate in parallel.",
                   es: "Cuántas versiones diferentes generar en paralelo.",
                   zh: "并行生成多少个不同版本。" },
  dimTitle:       { pt: "Variar por",             en: "Vary by",               es: "Variar por",             zh: "变化维度" },
  dimHint:        { pt: "Qual dimensão deve ser diferente entre variantes.",
                   en: "Which dimension should differ between variants.",
                   es: "Qué dimensión debe diferir entre variantes.",
                   zh: "哪个维度在变体之间不同。" },
  dimMood:        { pt: "Tom",                    en: "Mood",                  es: "Tono",                   zh: "氛围" },
  dimMoodDesc:    { pt: "Urgência, celebração…",  en: "Urgency, celebration…", es: "Urgencia, celebración…", zh: "紧迫、庆祝…" },
  dimComp:        { pt: "Composição",             en: "Composition",           es: "Composición",            zh: "构图" },
  dimCompDesc:    { pt: "Close-up, médio, amplo", en: "Close-up, medium, wide",es: "Close-up, medio, amplio",zh: "特写、中景、广角" },
  dimHook:        { pt: "Hook visual",            en: "Visual hook",           es: "Hook visual",            zh: "视觉钩子" },
  dimHookDesc:    { pt: "Pessoa, objeto, ação",   en: "Person, object, action",es: "Persona, objeto, acción",zh: "人、物、动作" },
  dimRandom:      { pt: "Aleatório",              en: "Random",                es: "Aleatorio",              zh: "随机" },
  dimRandomDesc:  { pt: "Mesmo prompt, seeds diferentes", en: "Same prompt, different seeds", es: "Mismo prompt, seeds distintos", zh: "相同提示，不同种子" },
  // CTA
  generate:       { pt: "Gerar variações",        en: "Generate variations",   es: "Generar variaciones",    zh: "生成变体" },
  generating:     { pt: "Gerando…",               en: "Generating…",           es: "Generando…",             zh: "生成中…" },
  // Right
  results:        { pt: "Variantes geradas",      en: "Generated variants",    es: "Variantes generadas",    zh: "生成的变体" },
  resultsHint:    { pt: "Compare e marque a vencedora.",
                   en: "Compare and mark the winner.",
                   es: "Compara y marca la ganadora.",
                   zh: "比较并标记优胜者。" },
  emptyTitle:     { pt: "Suas variações aparecerão aqui",
                   en: "Your variations will appear here",
                   es: "Tus variaciones aparecerán aquí",
                   zh: "您的变体将在此处显示" },
  emptyDesc:      { pt: "Configure o brief e clique em Gerar variações.",
                   en: "Configure the brief and click Generate variations.",
                   es: "Configura el brief y haz clic en Generar variaciones.",
                   zh: "配置简报并点击生成变体。" },
  download:       { pt: "Baixar",                 en: "Download",              es: "Descargar",              zh: "下载" },
  markWinner:     { pt: "Marcar vencedora",       en: "Mark winner",           es: "Marcar ganadora",        zh: "标记优胜者" },
  unmarkWinner:   { pt: "Desmarcar vencedora",    en: "Unmark winner",         es: "Desmarcar ganadora",     zh: "取消标记优胜者" },
  winner:         { pt: "Vencedora",              en: "Winner",                es: "Ganadora",               zh: "优胜者" },
  variantOf:      { pt: "Variante",               en: "Variant",               es: "Variante",               zh: "变体" },
  retry:          { pt: "Tentar de novo",         en: "Retry",                 es: "Reintentar",             zh: "重试" },
  // Misc
  sessionExpired: { pt: "Sessão expirada — recarrega.",
                   en: "Session expired — reload.",
                   es: "Sesión expirada — recarga.",
                   zh: "会话已过期 — 请刷新。" },
  failed:         { pt: "Falhou",                 en: "Failed",                es: "Falló",                  zh: "失败" },
  autoSaved:      { pt: "Variações salvas automaticamente na Biblioteca.",
                   en: "Variations auto-saved to the Library.",
                   es: "Variaciones guardadas automáticamente en la Biblioteca.",
                   zh: "变体自动保存到资源库。" },
  // License
  licTitle:       { pt: "Disclaimer regulatório", en: "Regulatory disclaimer", es: "Disclaimer regulatorio", zh: "监管免责声明" },
  licInclude:     { pt: "Incluir no criativo",    en: "Include in creative",   es: "Incluir en el creativo", zh: "包含在创意中" },
};

const FORMATS = [
  { id: "1:1",  titleKey: "fmtFeedTitle",    descKey: "fmtFeedDesc"    },
  { id: "9:16", titleKey: "fmtStoriesTitle", descKey: "fmtStoriesDesc" },
  { id: "16:9", titleKey: "fmtBannerTitle",  descKey: "fmtBannerDesc"  },
] as const;

type VariationDim = "mood" | "composition" | "hook" | "random";

// Augmento de prompt por dimensão. Cada dimensão tem N variações
// específicas — escolhemos N delas em ordem (primeiras 2/3/4/5).
const VARIANT_AUGMENTS: Record<VariationDim, string[]> = {
  mood: [
    "Mood: urgent and time-sensitive — energetic pacing, bold contrast, sense of 'don't miss out'.",
    "Mood: celebratory and victorious — triumph, excitement, peak emotion of winning.",
    "Mood: suspenseful and mysterious — tension, anticipation, intriguing atmosphere.",
    "Mood: confident and aspirational — calm power, premium feel, success vibes.",
    "Mood: bold and aggressive — high stakes, dramatic, attention-grabbing.",
  ],
  composition: [
    "Composition: close-up shot — tight framing on the main subject, shallow depth of field.",
    "Composition: medium shot — subject from waist up with balanced environmental context.",
    "Composition: wide shot — full scene visible, subject with rich background.",
    "Composition: detail shot — emphasis on textures, materials, small but iconic details.",
    "Composition: dynamic angle — low or high angle, dramatic perspective.",
  ],
  hook: [
    "Visual hook: lead with a person/character — face or expression dominates the frame.",
    "Visual hook: lead with a key object/product — the prize or winning symbol takes center stage.",
    "Visual hook: lead with action/movement — captured in mid-action, energy and motion.",
    "Visual hook: lead with bold text overlay as primary visual element.",
    "Visual hook: lead with environment/scene — establishing shot, world-building.",
  ],
  random: [
    "Take creative liberty with composition and atmosphere — variant 1.",
    "Take creative liberty with composition and atmosphere — variant 2.",
    "Take creative liberty with composition and atmosphere — variant 3.",
    "Take creative liberty with composition and atmosphere — variant 4.",
    "Take creative liberty with composition and atmosphere — variant 5.",
  ],
};

// Label curto da variante (UI badge) — i18n
function variantLabel(dim: VariationDim, idx: number, lang: Lang): string {
  if (dim === "mood") {
    const labels: Record<Lang, string[]> = {
      pt: ["Urgência", "Celebração", "Suspense", "Confiança", "Drama"],
      en: ["Urgency", "Celebration", "Suspense", "Confidence", "Drama"],
      es: ["Urgencia", "Celebración", "Suspenso", "Confianza", "Drama"],
      zh: ["紧迫", "庆祝", "悬念", "自信", "戏剧"],
    };
    return labels[lang][idx] || `V${idx + 1}`;
  }
  if (dim === "composition") {
    const labels: Record<Lang, string[]> = {
      pt: ["Close-up", "Médio", "Amplo", "Detalhe", "Ângulo"],
      en: ["Close-up", "Medium", "Wide", "Detail", "Angle"],
      es: ["Close-up", "Medio", "Amplio", "Detalle", "Ángulo"],
      zh: ["特写", "中景", "广角", "细节", "角度"],
    };
    return labels[lang][idx] || `V${idx + 1}`;
  }
  if (dim === "hook") {
    const labels: Record<Lang, string[]> = {
      pt: ["Pessoa", "Objeto", "Ação", "Texto", "Cena"],
      en: ["Person", "Object", "Action", "Text", "Scene"],
      es: ["Persona", "Objeto", "Acción", "Texto", "Escena"],
      zh: ["人物", "物体", "动作", "文字", "场景"],
    };
    return labels[lang][idx] || `V${idx + 1}`;
  }
  return `V${idx + 1}`;
}

const PROMPT_MAX = 600;

interface VariantState {
  idx: number;
  label: string;
  augment: string;
  status: "pending" | "loading" | "done" | "error";
  imageUrl?: string;
  rawImageUrl?: string;
  revisedPrompt?: string;
  error?: string;
  saveId?: string;
  isWinner?: boolean;
}

export default function HubABVariations() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;

  // ── Form state ────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [marketCode, setMarketCode] = useState<MarketCode | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [variantCount, setVariantCount] = useState<2 | 3 | 4 | 5>(3);
  const [variationDim, setVariationDim] = useState<VariationDim>("mood");
  const [includeLicense, setIncludeLicense] = useState(true);
  const [licenseText, setLicenseText] = useState<string>("");

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  const [variants, setVariants] = useState<VariantState[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);
  const defaultLicense = useMemo(() => {
    if (!brand?.license || !marketCode) return "";
    return brand.license[marketCode] || "";
  }, [brand, marketCode]);
  const hasLicense = !!defaultLicense;
  const effectiveLogoUrl = brand?.logoImage && brand.id !== "none" ? brand.logoImage : null;
  const includeLogo = !!effectiveLogoUrl;

  // Brand changes: pick first market
  useEffect(() => {
    if (!brand || brand.markets.length === 0) {
      setMarketCode(null);
    } else {
      setMarketCode(prev => (prev && brand.markets.includes(prev) ? prev : brand.markets[0]));
    }
  }, [brandId]);

  // Reset license text when brand+market changes
  useEffect(() => {
    if (defaultLicense) {
      setLicenseText(defaultLicense);
      setIncludeLicense(true);
    } else {
      setLicenseText("");
      setIncludeLicense(false);
    }
  }, [defaultLicense]);

  const promptValid = prompt.trim().length >= 5;

  // ── Generate N variants in parallel ─────────────────────────
  const generate = async () => {
    if (globalLoading || !promptValid) return;
    setError(null);
    setGlobalLoading(true);

    const newGroupId = `ab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setGroupId(newGroupId);

    // Initialize N variant states
    const augments = VARIANT_AUGMENTS[variationDim].slice(0, variantCount);
    const initialVariants: VariantState[] = augments.map((aug, idx) => ({
      idx,
      label: variantLabel(variationDim, idx, lang),
      augment: aug,
      status: "loading",
    }));
    setVariants(initialVariants);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data: { user } } = await supabase.auth.getUser();
      if (!token || !user) {
        setError(t("sessionExpired"));
        setGlobalLoading(false);
        setVariants(initialVariants.map(v => ({ ...v, status: "error", error: t("sessionExpired") })));
        return;
      }

      // Build base brand_hint
      let baseBrandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        baseBrandHint = `${baseBrandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }
      if (effectiveLogoUrl && includeLogo) {
        const brandLabel = brand && brand.id !== "none" ? brand.name : "any logo";
        baseBrandHint = `${baseBrandHint}\n\nIMPORTANT: Do NOT render ${brandLabel} or any logo as text or visual element inside the image. The official logo will be added as overlay in post-production. Keep the upper-right corner clean (about 20% area).`;
      }

      // Spawn N parallel calls
      const promises = initialVariants.map(async (variant) => {
        try {
          const variantBrandHint = `${baseBrandHint}\n\nVARIATION DIRECTION: ${variant.augment}`.trim();
          const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-hub`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "apikey": ANON_KEY,
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              aspect_ratio: aspectRatio,
              quality,
              brand_id: brandId === "none" ? null : brandId,
              brand_hint: variantBrandHint,
              market: marketCode,
              include_license: hasLicense && includeLicense,
              license_text: hasLicense && includeLicense ? licenseText.trim() : "",
            }),
          });
          const text = await r.text();
          let payload: { ok?: boolean; error?: string; message?: string; openai_message?: string; image_url?: string; revised_prompt?: string } | null = null;
          try { payload = JSON.parse(text); } catch { /* not json */ }

          if (!r.ok || !payload?.ok) {
            const detail = payload?.openai_message || payload?.message || payload?.error || `HTTP ${r.status}`;
            return { idx: variant.idx, ok: false, error: String(detail).slice(0, 300) };
          }

          // Compose with logo + license
          let finalImageUrl = payload.image_url!;
          const willCompose = (hasLicense && includeLicense && licenseText.trim()) || (effectiveLogoUrl && includeLogo);
          if (willCompose) {
            try {
              finalImageUrl = await composeImage(payload.image_url!, {
                licenseText: hasLicense && includeLicense ? licenseText.trim() : null,
                logoUrl: effectiveLogoUrl && includeLogo ? effectiveLogoUrl : null,
                logoPosition: "top-right",
              });
            } catch (e) {
              console.warn("[ab-variants] compose failed:", e);
            }
          }

          // Save to hub_assets
          let saveId: string | undefined;
          try {
            const saveResult = await saveHubAsset({
              userId: user.id,
              type: "hub_image",
              content: {
                prompt: prompt.trim(),
                revised_prompt: payload.revised_prompt || prompt.trim(),
                image_url: finalImageUrl,
                aspect_ratio: aspectRatio,
                quality,
                model: "gpt-image-2",
                brand_id: brandId === "none" ? null : brandId,
                market: marketCode || null,
                license_included: hasLicense && includeLicense,
                license_text: hasLicense && includeLicense ? licenseText.trim() : null,
                logo_overlaid: !!(effectiveLogoUrl && includeLogo),
                // A/B specific metadata
                ab_variant_group_id: newGroupId,
                ab_variant_label: variant.label,
                ab_variant_dim: variationDim,
                ab_variant_idx: variant.idx,
                ab_is_winner: false,
              },
            });
            saveId = saveResult.id;
          } catch (e) { console.warn("[ab-variants] save failed:", e); }

          return {
            idx: variant.idx, ok: true,
            imageUrl: finalImageUrl, rawImageUrl: payload.image_url,
            revisedPrompt: payload.revised_prompt, saveId,
          };
        } catch (e) {
          return { idx: variant.idx, ok: false, error: String(e).slice(0, 300) };
        }
      });

      // Update each variant as it resolves (progressive UI)
      for (const promise of promises) {
        promise.then(res => {
          setVariants(prev => prev.map(v => {
            if (v.idx !== res.idx) return v;
            if (!res.ok) return { ...v, status: "error", error: ('error' in res ? res.error : undefined) || "Failed" };
            return {
              ...v, status: "done",
              imageUrl: 'imageUrl' in res ? res.imageUrl : undefined,
              rawImageUrl: 'rawImageUrl' in res ? res.rawImageUrl : undefined,
              revisedPrompt: 'revisedPrompt' in res ? res.revisedPrompt : undefined,
              saveId: 'saveId' in res ? res.saveId : undefined,
            };
          }));
        });
      }

      await Promise.all(promises);

      // Notification
      try {
        const titleByLang: Record<Lang, string> = {
          pt: `${variantCount} variações geradas`,
          en: `${variantCount} variations ready`,
          es: `${variantCount} variaciones listas`,
          zh: `${variantCount} 个变体已生成`,
        };
        addHubNotification(user.id, {
          kind: "image_generated",
          title: titleByLang[lang],
          description: prompt.trim().slice(0, 80),
          href: "/dashboard/hub/ab",
        });
      } catch { /* silent */ }
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setGlobalLoading(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) { console.error("Download failed:", e); }
  };

  const toggleWinner = async (idx: number) => {
    const target = variants[idx];
    if (!target?.saveId || !target.imageUrl) return;
    const newIsWinner = !target.isWinner;
    // optimistic UI: marca esse, desmarca todos os outros
    setVariants(prev => prev.map(v => ({
      ...v,
      isWinner: v.idx === idx ? newIsWinner : false,
    })));
    // Persist: re-save todas as rows do grupo com flag is_winner correta.
    // Update direto via supabase.from(...).update().eq() — RLS permite
    // user atualizar próprias rows.
    try {
      // Reset todas as outras pra is_winner=false
      for (const v of variants) {
        if (v.idx === idx || !v.saveId) continue;
        await supabase
          .from("hub_assets" as never)
          .update({
            content: buildContentForUpdate(
              v, prompt, aspectRatio, quality, brandId, marketCode,
              hasLicense, includeLicense, licenseText,
              !!effectiveLogoUrl && includeLogo,
              groupId, variationDim, false,
            ),
          } as never)
          .eq("id" as never, v.saveId as never);
      }
      // Set this as winner (or unset if newIsWinner=false)
      await supabase
        .from("hub_assets" as never)
        .update({
          content: buildContentForUpdate(
            target, prompt, aspectRatio, quality, brandId, marketCode,
            hasLicense, includeLicense, licenseText,
            !!effectiveLogoUrl && includeLogo,
            groupId, variationDim, newIsWinner,
          ),
        } as never)
        .eq("id" as never, target.saveId as never);
    } catch (e) {
      console.warn("[ab-variants] winner toggle failed:", e);
    }
  };

  return (
    <>
      <Helmet><title>{t("title")}</title></Helmet>

      <div style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 28px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 22, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          <button onClick={() => navigate("/dashboard/hub")} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#D1D5DB", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            fontFamily: "inherit", flexShrink: 0,
          }}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>

        {/* Workspace */}
        <div className="hub-ab-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT — Form */}
          <div style={CARD_STYLE}>
            {/* Brand */}
            <Section title={t("brand")} subtitle={t("brandSubtitle")}>
              <BrandTrigger
                brand={brand} marketCode={marketCode} lang={lang}
                onClick={() => setBrandModalOpen(true)}
                disabled={globalLoading}
                placeholder={t("selectBrand")}
              />
              {brand && brand.markets.length > 1 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {brand.markets.map(code => {
                    const m = HUB_MARKETS[code];
                    const active = marketCode === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setMarketCode(code)}
                        disabled={globalLoading}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 8,
                          background: active ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.50)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: globalLoading ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                        }}>
                        <span style={{ fontSize: 14 }}>{m.flag}</span>
                        <span>{getMarketLabel(code, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {hasLicense && marketCode && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 10,
                  background: "rgba(34,211,153,0.04)",
                  border: "1px solid rgba(34,211,153,0.20)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "#22d399",
                    }}>
                      {t("licTitle")} · {getMarketLabel(marketCode, lang)}
                    </span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11.5 }}>
                      <input type="checkbox" checked={includeLicense}
                        onChange={e => setIncludeLicense(e.target.checked)}
                        disabled={globalLoading}
                        style={{ accentColor: "#22d399", width: 12, height: 12 }} />
                      <span style={{ color: "#fff", fontWeight: 600 }}>{t("licInclude")}</span>
                    </label>
                  </div>
                  <textarea value={licenseText} onChange={e => setLicenseText(e.target.value)}
                    disabled={globalLoading || !includeLicense} rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", borderRadius: 8,
                      background: "rgba(0,0,0,0.30)",
                      border: "1px solid rgba(34,211,153,0.18)",
                      color: includeLicense ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)",
                      fontSize: 11, lineHeight: 1.5,
                      fontFamily: "inherit", resize: "vertical", outline: "none",
                    }} />
                </div>
              )}
            </Section>

            {/* Prompt */}
            <Section title={t("describe")} subtitle={t("describeHint")} style={{ marginTop: 22 }}>
              <div style={{ position: "relative" }}>
                <textarea value={prompt}
                  onChange={e => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                  placeholder={t("describePlaceholder")} rows={4}
                  disabled={globalLoading}
                  style={{
                    width: "100%", background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 11, padding: "12px 14px",
                    color: "#F1F5F9", fontSize: 13.5, lineHeight: 1.55,
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                    fontFamily: "inherit",
                  }} />
                <div style={{
                  position: "absolute", right: 10, bottom: 8,
                  fontSize: 10.5, color: "#6B7280", fontWeight: 600, pointerEvents: "none",
                }}>
                  {prompt.length} / {PROMPT_MAX}
                </div>
              </div>
            </Section>

            {/* Variants count + Variation dimension */}
            <div className="hub-ab-vrow" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 18 }}>
              <Section title={t("variantsTitle")} subtitle={t("variantsHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                  {([2, 3, 4, 5] as const).map(n => {
                    const active = variantCount === n;
                    return (
                      <button key={n} onClick={() => setVariantCount(n)} disabled={globalLoading}
                        style={{
                          padding: "11px 6px", borderRadius: 10,
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: globalLoading ? "not-allowed" : "pointer",
                          fontSize: 14, fontWeight: 800, fontFamily: "inherit",
                          textAlign: "center",
                        }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title={t("dimTitle")} subtitle={t("dimHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  {([
                    { v: "mood",        titleKey: "dimMood",   descKey: "dimMoodDesc"   },
                    { v: "composition", titleKey: "dimComp",   descKey: "dimCompDesc"   },
                    { v: "hook",        titleKey: "dimHook",   descKey: "dimHookDesc"   },
                    { v: "random",      titleKey: "dimRandom", descKey: "dimRandomDesc" },
                  ] as const).map(d => {
                    const active = variationDim === d.v;
                    return (
                      <button key={d.v} onClick={() => setVariationDim(d.v)} disabled={globalLoading}
                        style={{
                          padding: "9px 10px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: globalLoading ? "not-allowed" : "pointer",
                          textAlign: "left", fontFamily: "inherit",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(d.titleKey as keyof typeof STR)}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(d.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Format + Quality */}
            <div className="hub-ab-fmt" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
              <Section title={t("format")} subtitle={t("formatHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {FORMATS.map(f => {
                    const active = aspectRatio === f.id;
                    return (
                      <button key={f.id} onClick={() => setAspectRatio(f.id)} disabled={globalLoading}
                        style={{
                          padding: "9px 6px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: globalLoading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(f.titleKey as keyof typeof STR)} <span style={{ fontSize: 9.5, color: "#9CA3AF", fontWeight: 600 }}>{f.id}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(f.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title={t("quality")} subtitle={t("qualityHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                  {([
                    { v: "low",    titleKey: "qDraft",  descKey: "qDraftDesc"  },
                    { v: "medium", titleKey: "qMedium", descKey: "qMediumDesc" },
                    { v: "high",   titleKey: "qHigh",   descKey: "qHighDesc"   },
                  ] as const).map(q => {
                    const active = quality === q.v;
                    return (
                      <button key={q.v} onClick={() => setQuality(q.v)} disabled={globalLoading}
                        style={{
                          padding: "9px 6px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: globalLoading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                        }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(q.titleKey as keyof typeof STR)}
                        </div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t(q.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* CTA */}
            <button onClick={generate} disabled={globalLoading || !promptValid}
              className="hub-cta"
              style={{
                marginTop: 22, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: globalLoading || !promptValid ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: globalLoading || !promptValid ? "rgba(255,255,255,0.50)" : "#fff",
                border: "none", cursor: globalLoading || !promptValid ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", letterSpacing: "0.02em",
                transition: "background 0.15s, transform 0.08s",
              }}>
              {globalLoading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><GitBranch size={16} />{t("generate")} ({variantCount})</>
              )}
            </button>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "10px 0 0", textAlign: "center" }}>
              {t("autoSaved")}
            </p>
          </div>

          {/* RIGHT — Variants grid */}
          <div style={CARD_STYLE}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                {t("results")}
              </h3>
              <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{t("resultsHint")}</p>
            </div>

            {error && (
              <div style={{
                marginBottom: 12,
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 9,
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
              }}>
                <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 11.5, color: "#fee2e2", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</p>
              </div>
            )}

            {variants.length === 0 ? (
              <div style={{
                border: "1px dashed rgba(255,255,255,0.10)",
                borderRadius: 12, minHeight: 360,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: 32, textAlign: "center", gap: 14,
                background: "rgba(0,0,0,0.20)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 13,
                  background: "rgba(59,130,246,0.10)",
                  border: "1px solid rgba(59,130,246,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <GitBranch size={22} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: "5px 0 0", lineHeight: 1.5, maxWidth: 320 }}>
                    {t("emptyDesc")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="hub-ab-grid" style={{
                display: "grid",
                gridTemplateColumns: variants.length <= 2
                  ? "repeat(2, minmax(0, 1fr))"
                  : variants.length === 3
                  ? "repeat(3, minmax(0, 1fr))"
                  : "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}>
                {[...variants].sort((a, b) => {
                  // Winner first, then by idx
                  if (a.isWinner && !b.isWinner) return -1;
                  if (!a.isWinner && b.isWinner) return 1;
                  return a.idx - b.idx;
                }).map(v => (
                  <VariantCard
                    key={v.idx}
                    variant={v}
                    aspectRatio={aspectRatio}
                    onDownload={() => v.imageUrl && downloadImage(v.imageUrl, `ab-${v.label.toLowerCase()}-${Date.now()}.png`)}
                    onToggleWinner={() => toggleWinner(v.idx)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Brand Modal */}
        {brandModalOpen && (
          <BrandModal
            brands={HUB_BRANDS}
            selected={brandId}
            search={brandSearch}
            onSearch={setBrandSearch}
            onSelect={(id) => { setBrandId(id); setBrandModalOpen(false); setBrandSearch(""); }}
            onClose={() => { setBrandModalOpen(false); setBrandSearch(""); }}
            lang={lang} t={t}
          />
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .hub-cta:hover:not(:disabled) { background: #2563EB !important; }
          .hub-cta:active:not(:disabled) { background: #1D4ED8 !important; transform: scale(0.97); }
          @media (max-width: 1100px) {
            .hub-ab-workspace { grid-template-columns: 1fr !important; }
            .hub-ab-vrow, .hub-ab-fmt { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px) {
            .hub-ab-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

// Helper pra preservar o content shape no update
function buildContentForUpdate(
  v: VariantState,
  prompt: string, aspectRatio: string, quality: string,
  brandId: string, marketCode: MarketCode | null,
  hasLicense: boolean, includeLicense: boolean, licenseText: string,
  logoOverlaid: boolean,
  groupId: string, variationDim: VariationDim, isWinner: boolean,
): Record<string, unknown> {
  return {
    prompt: prompt.trim(),
    revised_prompt: v.revisedPrompt || prompt.trim(),
    image_url: v.imageUrl,
    aspect_ratio: aspectRatio,
    quality,
    model: "gpt-image-2",
    brand_id: brandId === "none" ? null : brandId,
    market: marketCode || null,
    license_included: hasLicense && includeLicense,
    license_text: hasLicense && includeLicense ? licenseText.trim() : null,
    logo_overlaid: logoOverlaid,
    ab_variant_group_id: groupId,
    ab_variant_label: v.label,
    ab_variant_dim: variationDim,
    ab_variant_idx: v.idx,
    ab_is_winner: isWinner,
  };
}

// ── Sub-components ────────────────────────────────────────────────

function Section({ title, subtitle, children, style }: {
  title: string; subtitle?: string;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        {subtitle && <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function VariantCard({ variant, aspectRatio, onDownload, onToggleWinner, t }: {
  variant: VariantState;
  aspectRatio: string;
  onDownload: () => void;
  onToggleWinner: () => void;
  t: (key: keyof typeof STR) => string;
}) {
  const ar = aspectRatio === "9:16" ? "9/16" : aspectRatio === "16:9" ? "16/9" : "1/1";
  return (
    <div style={{
      borderRadius: 11, overflow: "hidden",
      background: "rgba(0,0,0,0.30)",
      border: variant.isWinner
        ? "1.5px solid #3B82F6"
        : "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        position: "relative",
        aspectRatio: ar,
        background: "rgba(0,0,0,0.40)",
      }}>
        {/* Variant label badge top-left */}
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 2,
          padding: "3px 8px", borderRadius: 6,
          background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
          color: "#fff",
        }}>
          {variant.label}
        </div>
        {/* Winner badge */}
        {variant.isWinner && (
          <div style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            padding: "3px 8px", borderRadius: 6,
            background: "#3B82F6",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "#fff",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Star size={10} fill="#fff" /> {t("winner")}
          </div>
        )}
        {/* Image / loading / error states */}
        {variant.status === "loading" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8,
          }}>
            <RefreshCw size={20} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{t("generating")}</p>
          </div>
        )}
        {variant.status === "error" && (
          <div style={{
            position: "absolute", inset: 0, padding: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 6, textAlign: "center",
          }}>
            <AlertTriangle size={20} style={{ color: "#f87171" }} />
            <p style={{ fontSize: 10.5, color: "#fee2e2", margin: 0, lineHeight: 1.4, wordBreak: "break-word" }}>
              {t("failed")}
            </p>
          </div>
        )}
        {variant.status === "done" && variant.imageUrl && (
          <img src={variant.imageUrl} alt={variant.label}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      {/* Actions */}
      {variant.status === "done" && variant.imageUrl && (
        <div style={{ display: "flex", gap: 4, padding: 8 }}>
          <button onClick={onToggleWinner} title={variant.isWinner ? t("unmarkWinner") : t("markWinner")}
            style={{
              flex: 1, padding: "7px 8px", borderRadius: 7,
              background: variant.isWinner ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${variant.isWinner ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.08)"}`,
              color: variant.isWinner ? "#3B82F6" : "#9CA3AF",
              cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
            <Star size={11} fill={variant.isWinner ? "#3B82F6" : "transparent"} />
            {variant.isWinner ? t("winner") : t("markWinner")}
          </button>
          <button onClick={onDownload} title={t("download")}
            style={{
              padding: "7px 10px", borderRadius: 7,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
            <Download size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

function BrandTrigger({ brand, marketCode, lang, onClick, disabled, placeholder }: {
  brand: HubBrand | null; marketCode: MarketCode | null; lang: Lang;
  onClick: () => void; disabled?: boolean; placeholder: string;
}) {
  const isPicked = brand && brand.id !== "none";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 11,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "#fff", cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "inherit", textAlign: "left",
      }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: isPicked && brand?.logoImage ? "rgba(0,0,0,0.85)" : isPicked ? brand!.gradient : "rgba(59,130,246,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, overflow: "hidden",
        border: isPicked ? "none" : "1px solid rgba(59,130,246,0.30)",
      }}>
        {isPicked && brand?.logoImage ? (
          <img src={brand.logoImage} alt={brand.name} style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        ) : isPicked ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{brand!.logoInitials}</span>
        ) : (
          <Sparkles size={14} style={{ color: "#3B82F6" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isPicked ? getBrandName(brand!, lang) : placeholder}
        </p>
        {isPicked && marketCode && (
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span>{HUB_MARKETS[marketCode].flag}</span>
            <span>{getMarketLabel(marketCode, lang)}</span>
          </p>
        )}
      </div>
      <ChevronDown size={15} style={{ color: "#9CA3AF" }} />
    </button>
  );
}

function BrandModal({ brands, selected, search, onSearch, onSelect, onClose, lang, t }: {
  brands: HubBrand[]; selected: string;
  search: string; onSearch: (s: string) => void;
  onSelect: (id: string) => void; onClose: () => void;
  lang: Lang; t: (key: keyof typeof STR) => string;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(b =>
      b.name.toLowerCase().includes(q) ||
      getBrandName(b, lang).toLowerCase().includes(q),
    );
  }, [brands, search, lang]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0a0a0f",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        maxWidth: 640, width: "100%",
        maxHeight: "85vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>
            {t("selectBrand")}
          </h3>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#9CA3AF", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: "14px 18px 6px" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6B7280" }} />
            <input
              autoFocus
              value={search} onChange={e => onSearch(e.target.value)}
              placeholder={t("searchBrand")}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 14px 10px 36px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit",
              }} />
          </div>
        </div>
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
            {filtered.map(b => {
              const active = selected === b.id;
              const isNone = b.id === "none";
              return (
                <button key={b.id} onClick={() => onSelect(b.id)}
                  style={{
                    padding: "12px", borderRadius: 12,
                    background: active ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.06)"}`,
                    color: "#fff", cursor: "pointer",
                    textAlign: "left", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: b.logoImage ? "rgba(0,0,0,0.85)" : b.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {b.logoImage ? (
                      <img src={b.logoImage} alt={b.name} style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: isNone ? 12 : 12, fontWeight: 800, color: "#fff" }}>
                        {b.logoInitials}
                      </span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>
                      {getBrandName(b, lang)}
                    </p>
                    <p style={{ fontSize: 10.5, color: "#9CA3AF", margin: "2px 0 0" }}>
                      {b.markets.length > 0 ? b.markets.map(m => HUB_MARKETS[m]?.flag).join(" ") : "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 18,
};
