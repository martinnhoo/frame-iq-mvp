/**
 * HubImageGenerator — Image Studio (SaaS-style refactor).
 *
 * Layout: 2-coluna (LEFT controles, RIGHT preview + galeria).
 * Paleta: dark + azul #3B82F6, sem gradientes, sem glow.
 *
 * Fluxo:
 *   1. Selecionar marca → abre modal com search + grid de cards
 *      (BETBUS, ELUCK, COME.COM, FUNILIVE) + opção "Sem marca".
 *   2. Marca selecionada vira chip no painel; mercado e license aparecem
 *      como sub-controles inline quando aplicável (BETBUS-MX).
 *   3. Logo (opcional) — caixa de drag-drop pra logo customizado.
 *   4. Descreva o criativo (textarea com counter 0/600).
 *   5. Formato (Feed 1:1, Stories 9:16, Banner 16:9) — cards.
 *   6. Qualidade (Rascunho / Médio / Alta) — pills compactas.
 *   7. Gerar imagem (CTA azul sólido).
 *
 * RIGHT:
 *   - Empty state ou imagem gerada (com download/variação)
 *   - "Últimas gerações" com últimos 4 thumbnails
 *
 * Tudo i18n nas 4 línguas (pt/en/es/zh) + verify-org card pra
 * gpt-image-2 quando OpenAI exige verification organizacional.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Image as ImageIcon, Download, RefreshCw, ArrowLeft, Sparkles, AlertTriangle,
  Copy, RotateCcw, Check, ChevronDown, Search, Plus, Upload, X,
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
  back:                { pt: "Voltar ao Hub",        en: "Back to Hub",          es: "Volver al Hub",          zh: "返回中心" },
  title:               { pt: "Image Studio",          en: "Image Studio",          es: "Image Studio",            zh: "图像工作室" },
  subtitle:            { pt: "Crie imagens profissionais com IA de forma rápida, consistente e escalável.",
                         en: "Create professional images with AI — fast, consistent, scalable.",
                         es: "Crea imágenes profesionales con IA de forma rápida, consistente y escalable.",
                         zh: "用 AI 快速、一致、可扩展地创建专业图像。" },
  // Section 1: Marca
  brand:               { pt: "Marca",                  en: "Brand",                 es: "Marca",                  zh: "品牌" },
  brandSubtitle:       { pt: "Selecione a marca para o seu criativo.",
                         en: "Pick the brand for your creative.",
                         es: "Selecciona la marca para tu creativo.",
                         zh: "选择创意的品牌。" },
  selectBrand:         { pt: "Selecionar marca",       en: "Select brand",          es: "Seleccionar marca",      zh: "选择品牌" },
  searchBrand:         { pt: "Buscar marca…",          en: "Search brand…",         es: "Buscar marca…",          zh: "搜索品牌…" },
  noBrand:             { pt: "Sem marca",              en: "No brand",              es: "Sin marca",              zh: "无品牌" },
  addBrand:            { pt: "Usar logo personalizado",en: "Use custom logo",       es: "Usar logo personalizado",zh: "使用自定义 logo" },
  market:              { pt: "Mercado",                en: "Market",                es: "Mercado",                zh: "市场" },
  // Section 2: Logo
  logoOptional:        { pt: "Logo (opcional)",        en: "Logo (optional)",       es: "Logo (opcional)",        zh: "Logo（可选）" },
  logoSubtitle:        { pt: "Envie um logo customizado pra usar no criativo.",
                         en: "Upload a custom logo to use on the creative.",
                         es: "Sube un logo personalizado para usar en el creativo.",
                         zh: "上传自定义 logo 用于创意。" },
  logoUploadCta:       { pt: "Clique pra enviar",      en: "Click to upload",       es: "Haz clic para subir",    zh: "点击上传" },
  logoHint:            { pt: "PNG ou JPG até 5MB",     en: "PNG or JPG up to 5MB",  es: "PNG o JPG hasta 5MB",    zh: "PNG 或 JPG 最大 5MB" },
  logoTooBig:          { pt: "Arquivo muito grande (max 5MB).",
                         en: "File too large (max 5MB).",
                         es: "Archivo demasiado grande (máx 5MB).",
                         zh: "文件过大（最大 5MB）。" },
  logoInvalidType:     { pt: "Use PNG ou JPG.",        en: "Use PNG or JPG.",       es: "Usa PNG o JPG.",         zh: "请使用 PNG 或 JPG。" },
  logoIncluded:        { pt: "Logo incluído",          en: "Logo included",         es: "Logo incluido",          zh: "已包含 logo" },
  logoRemove:          { pt: "Remover",                en: "Remove",                es: "Eliminar",               zh: "移除" },
  // Section 3: Prompt
  describe:            { pt: "Descreva o criativo",    en: "Describe the creative", es: "Describe el creativo",   zh: "描述创意" },
  describeHint:        { pt: "Digite o que você deseja criar.",
                         en: "Type what you want to create.",
                         es: "Escribe lo que deseas crear.",
                         zh: "输入您想创建的内容。" },
  describePlaceholder: { pt: "Ex: Banner de aposta esportiva com Neymar, odds altas, clima de urgência…",
                         en: "Ex: Sports betting banner with Neymar, high odds, sense of urgency…",
                         es: "Ej: Banner de apuesta deportiva con Neymar, cuotas altas, sensación de urgencia…",
                         zh: "例：体育博彩横幅，内马尔，高赔率，紧迫氛围…" },
  // Section 4: Format
  format:              { pt: "Formato",                en: "Format",                es: "Formato",                zh: "格式" },
  formatHint:          { pt: "Escolha o formato ideal.",
                         en: "Pick the ideal format.",
                         es: "Elige el formato ideal.",
                         zh: "选择理想的格式。" },
  fmtFeedTitle:        { pt: "Feed",                   en: "Feed",                  es: "Feed",                   zh: "信息流" },
  fmtFeedDesc:         { pt: "Instagram, Facebook",    en: "Instagram, Facebook",   es: "Instagram, Facebook",    zh: "Instagram、Facebook" },
  fmtStoriesTitle:     { pt: "Stories",                en: "Stories",               es: "Stories",                zh: "Stories" },
  fmtStoriesDesc:      { pt: "Instagram, TikTok",      en: "Instagram, TikTok",     es: "Instagram, TikTok",      zh: "Instagram、TikTok" },
  fmtBannerTitle:      { pt: "Banner",                 en: "Banner",                es: "Banner",                 zh: "横幅" },
  fmtBannerDesc:       { pt: "YouTube, Web",           en: "YouTube, Web",          es: "YouTube, Web",           zh: "YouTube、Web" },
  // Section 5: Quality
  quality:             { pt: "Qualidade",              en: "Quality",               es: "Calidad",                zh: "质量" },
  qualityHint:         { pt: "Defina o nível de qualidade.",
                         en: "Set the quality level.",
                         es: "Define el nivel de calidad.",
                         zh: "设置质量级别。" },
  qDraft:              { pt: "Rascunho",               en: "Draft",                 es: "Borrador",               zh: "草稿" },
  qDraftDesc:          { pt: "Mais rápido",            en: "Faster",                es: "Más rápido",             zh: "更快" },
  qMedium:             { pt: "Médio",                  en: "Medium",                es: "Medio",                  zh: "中等" },
  qMediumDesc:         { pt: "Recomendado",            en: "Recommended",           es: "Recomendado",            zh: "推荐" },
  qHigh:               { pt: "Alta",                   en: "High",                  es: "Alta",                   zh: "高" },
  qHighDesc:           { pt: "Mais detalhes",          en: "More detail",           es: "Más detalles",           zh: "更多细节" },
  // Generate
  generate:            { pt: "Gerar imagem",           en: "Generate image",        es: "Generar imagen",         zh: "生成图像" },
  generating:          { pt: "Gerando…",               en: "Generating…",           es: "Generando…",             zh: "生成中…" },
  autoSaved:           { pt: "Sua criação será salva automaticamente na Biblioteca.",
                         en: "Your creation will be auto-saved to the Library.",
                         es: "Tu creación se guardará automáticamente en la Biblioteca.",
                         zh: "您的作品将自动保存到资源库。" },
  // Right column
  preview:             { pt: "Prévia",                 en: "Preview",               es: "Vista previa",           zh: "预览" },
  previewHint:         { pt: "Sua imagem gerada aparecerá aqui.",
                         en: "Your generated image will appear here.",
                         es: "Tu imagen generada aparecerá aquí.",
                         zh: "您生成的图像将显示在此处。" },
  emptyTitle:          { pt: "Sua criação aparecerá aqui",
                         en: "Your creation will appear here",
                         es: "Tu creación aparecerá aquí",
                         zh: "您的作品将在此处显示" },
  emptyDesc:           { pt: "Configure os controles ao lado e clique em Gerar imagem para começar.",
                         en: "Configure the controls on the side and click Generate image to start.",
                         es: "Configura los controles al lado y haz clic en Generar imagen para empezar.",
                         zh: "在侧边配置控件并点击「生成图像」开始。" },
  download:            { pt: "Baixar",                 en: "Download",              es: "Descargar",              zh: "下载" },
  variation:           { pt: "Gerar variação",         en: "Generate variation",    es: "Generar variación",      zh: "生成变体" },
  recent:              { pt: "Últimas gerações",       en: "Latest generations",    es: "Últimas generaciones",   zh: "最近生成" },
  recentHint:          { pt: "Seus últimos criativos gerados.",
                         en: "Your last generated creatives.",
                         es: "Tus últimos creativos generados.",
                         zh: "您最近生成的创意。" },
  seeAll:              { pt: "Ver todos",              en: "See all",               es: "Ver todos",              zh: "查看全部" },
  promptRefined:       { pt: "Prompt refinado pela IA",en: "Prompt refined by AI",  es: "Prompt refinado por IA", zh: "AI 优化后的提示词" },
  // License panel
  licTitle:            { pt: "Disclaimer regulatório", en: "Regulatory disclaimer", es: "Disclaimer regulatorio", zh: "监管免责声明" },
  licInclude:          { pt: "Incluir no criativo",    en: "Include in creative",   es: "Incluir en el creativo", zh: "包含在创意中" },
  licCopy:             { pt: "Copiar",                 en: "Copy",                  es: "Copiar",                 zh: "复制" },
  licCopied:           { pt: "Copiado",                en: "Copied",                es: "Copiado",                zh: "已复制" },
  licReset:            { pt: "Resetar",                en: "Reset",                 es: "Restablecer",            zh: "重置" },
  // Verify org card
  verifyTitle:         { pt: "Verifique sua organização OpenAI",
                         en: "Verify your OpenAI organization",
                         es: "Verifica tu organización OpenAI",
                         zh: "验证您的 OpenAI 组织" },
  verifyDesc:          { pt: "Pra usar o gpt-image-2 (qualidade fotorrealista pra ad creatives), a OpenAI exige verification organizacional.",
                         en: "To use gpt-image-2 (photorealistic quality for ad creatives), OpenAI requires organization verification.",
                         es: "Para usar gpt-image-2 (calidad fotorrealista para anuncios), OpenAI requiere verificación organizacional.",
                         zh: "要使用 gpt-image-2（广告创意的照片级质量），OpenAI 需要组织验证。" },
  verifyTime:          { pt: "Aprovado em ~5min via verification individual.",
                         en: "Approved in ~5min via Individual verification.",
                         es: "Aprobado en ~5min vía verificación Individual.",
                         zh: "通过个人验证约 5 分钟内批准。" },
  verifyBtn:           { pt: "Verificar agora →",      en: "Verify now →",          es: "Verificar ahora →",      zh: "立即验证 →" },
  verifyClose:         { pt: "Fechar",                 en: "Close",                 es: "Cerrar",                 zh: "关闭" },
  // Errors
  sessionExpired:      { pt: "Sessão expirada — recarrega.",
                         en: "Session expired — reload.",
                         es: "Sesión expirada — recarga.",
                         zh: "会话已过期 — 请刷新。" },
  // Bottom benefits strip
  bFastTitle:          { pt: "Mais rápido",            en: "Faster",                es: "Más rápido",             zh: "更快" },
  bFastDesc:           { pt: "Menos cliques, mais foco",en: "Fewer clicks, more focus", es: "Menos clics, más foco", zh: "点击更少，更专注" },
  bOrgTitle:           { pt: "Mais organizado",        en: "More organized",        es: "Más organizado",         zh: "更有条理" },
  bOrgDesc:            { pt: "Tudo em um só lugar",    en: "All in one place",      es: "Todo en un solo lugar",  zh: "一切尽在一处" },
  bConsTitle:          { pt: "Mais consistente",       en: "More consistent",       es: "Más consistente",        zh: "更一致" },
  bConsDesc:           { pt: "Padrão de qualidade garantido",
                         en: "Guaranteed quality standard",
                         es: "Estándar de calidad garantizado",
                         zh: "保证质量标准" },
  bScaleTitle:         { pt: "Mais escalável",         en: "More scalable",         es: "Más escalable",          zh: "更可扩展" },
  bScaleDesc:          { pt: "Crie em volume sem perder qualidade",
                         en: "Create at volume without losing quality",
                         es: "Crea en volumen sin perder calidad",
                         zh: "大量创建而不损失质量" },
};

// Apenas 3 formatos no spec (Feed/Stories/Banner) — 1:1, 9:16, 16:9.
const FORMATS = [
  { id: "1:1",  titleKey: "fmtFeedTitle",    descKey: "fmtFeedDesc"    },
  { id: "9:16", titleKey: "fmtStoriesTitle", descKey: "fmtStoriesDesc" },
  { id: "16:9", titleKey: "fmtBannerTitle",  descKey: "fmtBannerDesc"  },
] as const;

type GenResult = {
  image_url: string;
  prompt: string;
  revised_prompt: string;
  aspect_ratio: string;
};

type GalleryItem = {
  id: string;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  brand_id?: string;
  market?: MarketCode;
  created_at: string;
};

const PROMPT_MAX = 600;
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const CUSTOM_LOGO_KEY = "hub_custom_logo_v1";

export default function HubImageGenerator() {
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
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [includeLicense, setIncludeLicense] = useState(true);
  const [licenseText, setLicenseText] = useState<string>("");

  // ── UI state ──────────────────────────────────────────────────
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [logoDragOver, setLogoDragOver] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [licenseCopied, setLicenseCopied] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Async state ───────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const brand: HubBrand | null = useMemo(() => getBrand(brandId), [brandId]);
  const defaultLicense = useMemo(() => {
    if (!brand?.license || !marketCode) return "";
    return brand.license[marketCode] || "";
  }, [brand, marketCode]);
  const hasLicense = !!defaultLicense;
  const effectiveLogoUrl: string | null =
    customLogo || (brand?.logoImage && brand.id !== "none" ? brand.logoImage : null);

  // Load custom logo from localStorage on mount (24h cache)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_LOGO_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { url: string; ts: number };
      if (Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
        setCustomLogo(parsed.url);
      } else {
        localStorage.removeItem(CUSTOM_LOGO_KEY);
      }
    } catch { /* silent */ }
  }, []);

  // Persist custom logo in localStorage
  useEffect(() => {
    if (customLogo) {
      try {
        localStorage.setItem(CUSTOM_LOGO_KEY, JSON.stringify({ url: customLogo, ts: Date.now() }));
      } catch { /* silent */ }
    }
  }, [customLogo]);

  // Brand changes: auto-pick first market + reset logo toggle
  useEffect(() => {
    if (!brand || brand.markets.length === 0) {
      setMarketCode(null);
    } else {
      setMarketCode(prev => (prev && brand.markets.includes(prev) ? prev : brand.markets[0]));
    }
    setIncludeLogo(!!brand?.logoImage || !!customLogo);
  }, [brandId]);

  // Custom logo upload: auto-toggle ON
  useEffect(() => {
    if (customLogo) setIncludeLogo(true);
  }, [customLogo]);

  // Brand+market changes: reset license text + toggle ON when applicable
  useEffect(() => {
    if (defaultLicense) {
      setLicenseText(defaultLicense);
      setIncludeLicense(true);
    } else {
      setLicenseText("");
      setIncludeLicense(false);
    }
  }, [defaultLicense]);

  // Load gallery (last 12)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("hub_assets" as never)
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("kind", "hub_image")
          .order("created_at", { ascending: false })
          .limit(12);
        if (!mounted || !data) return;
        const items: GalleryItem[] = (data as Array<{
          id: string;
          content?: { image_url?: string; prompt?: string; aspect_ratio?: string; brand_id?: string; market?: MarketCode };
          created_at: string;
        }>)
          .filter(r => r?.content?.image_url)
          .map(r => ({
            id: r.id,
            image_url: r.content!.image_url!,
            prompt: r.content!.prompt || "",
            aspect_ratio: r.content!.aspect_ratio || "1:1",
            brand_id: r.content!.brand_id,
            market: r.content!.market,
            created_at: r.created_at,
          }));
        setGallery(items);
      } catch { /* silent */ }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────
  const onLogoFile = (f: File) => {
    setLogoError(null);
    if (f.size > LOGO_MAX_BYTES) { setLogoError(t("logoTooBig")); return; }
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) { setLogoError(t("logoInvalidType")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setCustomLogo(url);
    };
    reader.readAsDataURL(f);
  };

  const onLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onLogoFile(f);
  };

  const removeCustomLogo = () => {
    setCustomLogo(null);
    try { localStorage.removeItem(CUSTOM_LOGO_KEY); } catch { /* silent */ }
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const generate = async () => {
    if (loading || !prompt.trim() || prompt.trim().length < 5) return;
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      let brandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        brandHint = `${brandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }
      if (effectiveLogoUrl && includeLogo) {
        const brandLabel = brand && brand.id !== "none" ? brand.name : "any logo";
        brandHint = `${brandHint}\n\nIMPORTANT: Do NOT render ${brandLabel} or any logo as text or visual element inside the image. The official logo will be added as overlay in post-production. Keep the upper-right corner of the image visually clean (about 20% area) so the overlay logo will be legible against any background.`;
      }

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
          brand_hint: brandHint,
          market: marketCode,
          include_license: hasLicense && includeLicense,
          license_text: hasLicense && includeLicense ? licenseText.trim() : "",
        }),
      });

      const text = await r.text();
      let payload: {
        ok?: boolean; _v?: string; openai_message?: string; message?: string;
        error?: string; image_url?: string; revised_prompt?: string;
      } | null = null;
      try { payload = JSON.parse(text); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") {
          setNeedsVerify(true);
          return;
        }
        const detail = payload?.openai_message || payload?.message || payload?.error || text || `HTTP ${r.status}`;
        const versionTag = payload?._v ? ` [fn=${payload._v}]` : " [fn=desconhecida]";
        setError((detail + versionTag).slice(0, 500));
        return;
      }

      let finalImageUrl = payload.image_url!;
      const willCompose =
        (hasLicense && includeLicense && licenseText.trim()) ||
        (effectiveLogoUrl && includeLogo);
      if (willCompose) {
        try {
          const composedDataUrl = await composeImage(payload.image_url!, {
            licenseText: hasLicense && includeLicense ? licenseText.trim() : null,
            logoUrl: effectiveLogoUrl && includeLogo ? effectiveLogoUrl : null,
            logoPosition: "top-right",
          });
          finalImageUrl = composedDataUrl;
        } catch (composeErr) {
          console.warn("[hub-image] compose failed, using raw:", composeErr);
        }
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveHubAsset({
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
            },
          });
        }
      } catch (e) { console.warn("[hub-image] FE save failed:", e); }

      setResult({
        image_url: finalImageUrl,
        prompt: prompt.trim(),
        revised_prompt: payload.revised_prompt || prompt.trim(),
        aspect_ratio: aspectRatio,
      });
      setGallery(prev => [{
        id: `tmp-${Date.now()}`,
        image_url: finalImageUrl,
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        brand_id: brandId === "none" ? undefined : brandId,
        market: marketCode || undefined,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 12));

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const brandLabel = brand && brand.id !== "none" && marketCode
          ? `${brand.name} · ${HUB_MARKETS[marketCode].flag} ${getMarketLabel(marketCode, lang)}`
          : null;
        const titleByLang: Record<Lang, string> = {
          pt: "Nova imagem pronta",
          en: "New image ready",
          es: "Nueva imagen lista",
          zh: "新图像已生成",
        };
        const promptPreview = prompt.trim().slice(0, 80) + (prompt.trim().length > 80 ? "…" : "");
        const desc = brandLabel ? `${brandLabel} · ${promptPreview}` : promptPreview;
        addHubNotification(user?.id, {
          kind: "image_generated",
          title: titleByLang[lang],
          description: desc,
          href: "/dashboard/hub/library",
        });
      } catch { /* silent */ }
    } catch (e) {
      setError(String(e).slice(0, 300));
    } finally {
      setLoading(false);
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

  const copyLicense = async () => {
    try {
      await navigator.clipboard.writeText(licenseText);
      setLicenseCopied(true);
      setTimeout(() => setLicenseCopied(false), 1800);
    } catch { /* silent */ }
  };

  const resetLicense = () => { if (defaultLicense) setLicenseText(defaultLicense); };

  const promptValid = prompt.trim().length >= 5;

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>{t("title")}</title></Helmet>

      <div className="hub-image-page" style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 28px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Breadcrumb / back */}
        <button onClick={() => navigate("/dashboard/hub")} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", color: "#9CA3AF",
          cursor: "pointer", fontSize: 12.5, padding: "4px 6px", marginBottom: 12,
          fontFamily: "inherit",
        }}>
          <ArrowLeft size={13} /> {t("back")}
        </button>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: "#fff", margin: 0,
            letterSpacing: "-0.02em", lineHeight: 1.1,
          }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
            {t("subtitle")}
          </p>
        </div>

        {/* ── 2-col workspace ──────────────────────────────────── */}
        <div className="hub-image-workspace" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18, alignItems: "start", marginBottom: 22,
        }}>
          {/* ╔════════ LEFT: Form ════════╗ */}
          <div style={CARD_STYLE}>
            {/* Section 1 — Brand */}
            <Section index={1} title={t("brand")} subtitle={t("brandSubtitle")}>
              <BrandTrigger
                brand={brand} marketCode={marketCode} lang={lang}
                customLogo={customLogo}
                onClick={() => setBrandModalOpen(true)}
                disabled={loading}
                placeholder={t("selectBrand")}
              />
              {/* Market chips (when brand has 2+ markets) */}
              {brand && brand.markets.length > 1 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {brand.markets.map(code => {
                    const m = HUB_MARKETS[code];
                    const active = marketCode === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setMarketCode(code)}
                        disabled={loading}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 8,
                          background: active ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.50)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{m.flag}</span>
                        <span>{getMarketLabel(code, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* License panel — só quando brand+market tem license */}
              {hasLicense && marketCode && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 10,
                  background: "rgba(34,211,153,0.04)",
                  border: "1px solid rgba(34,211,153,0.20)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "#22d399",
                    }}>
                      {t("licTitle")} · {getMarketLabel(marketCode, lang)}
                    </span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11.5 }}>
                      <input type="checkbox" checked={includeLicense}
                        onChange={e => setIncludeLicense(e.target.checked)}
                        disabled={loading}
                        style={{ accentColor: "#22d399", width: 12, height: 12, cursor: "pointer" }} />
                      <span style={{ color: "#fff", fontWeight: 600 }}>{t("licInclude")}</span>
                    </label>
                  </div>
                  <textarea value={licenseText} onChange={e => setLicenseText(e.target.value)}
                    disabled={loading || !includeLicense} rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", borderRadius: 8,
                      background: "rgba(0,0,0,0.30)",
                      border: "1px solid rgba(34,211,153,0.18)",
                      color: includeLicense ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.30)",
                      fontSize: 11, lineHeight: 1.5,
                      fontFamily: "inherit", resize: "vertical", outline: "none",
                    }} />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button onClick={copyLicense} disabled={loading} style={SUBTLE_BTN}>
                      {licenseCopied ? <Check size={11} /> : <Copy size={11} />}
                      {licenseCopied ? t("licCopied") : t("licCopy")}
                    </button>
                    <button onClick={resetLicense} disabled={loading || licenseText === defaultLicense}
                      style={{ ...SUBTLE_BTN, opacity: licenseText === defaultLicense ? 0.4 : 1 }}>
                      <RotateCcw size={11} /> {t("licReset")}
                    </button>
                  </div>
                </div>
              )}
            </Section>

            {/* Section 2 — Logo upload */}
            <Section index={2} title={t("logoOptional")} subtitle={t("logoSubtitle")} style={{ marginTop: 22 }}>
              {!customLogo ? (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setLogoDragOver(true); }}
                  onDragLeave={() => setLogoDragOver(false)}
                  onDrop={onLogoDrop}
                  style={{
                    border: `1.5px dashed ${logoDragOver ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.12)"}`,
                    background: logoDragOver ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.20)",
                    borderRadius: 11, padding: "22px 16px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center", gap: 8,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "rgba(59,130,246,0.10)",
                    border: "1px solid rgba(59,130,246,0.20)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Upload size={18} style={{ color: "#3B82F6" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{t("logoUploadCta")}</p>
                    <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{t("logoHint")}</p>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, borderRadius: 11,
                  background: "rgba(59,130,246,0.06)",
                  border: "1px solid rgba(59,130,246,0.25)",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 9,
                    background: "rgba(0,0,0,0.85)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", flexShrink: 0,
                  }}>
                    <img src={customLogo} alt="logo"
                      style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {t("logoIncluded")}
                    </p>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11.5, marginTop: 4 }}>
                      <input type="checkbox" checked={includeLogo}
                        onChange={e => setIncludeLogo(e.target.checked)}
                        disabled={loading}
                        style={{ accentColor: "#3B82F6", width: 12, height: 12, cursor: "pointer" }} />
                      <span style={{ color: "#fff", fontWeight: 600 }}>{lang === "pt" ? "Aplicar no criativo" : lang === "en" ? "Apply to creative" : lang === "es" ? "Aplicar al creativo" : "应用到创意"}</span>
                    </label>
                  </div>
                  <button onClick={removeCustomLogo} disabled={loading}
                    style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "#9CA3AF", cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }} title={t("logoRemove")}>
                    <X size={13} />
                  </button>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f); }}
                style={{ display: "none" }} />
              {logoError && (
                <p style={{ fontSize: 11, color: "#f87171", margin: "8px 0 0" }}>{logoError}</p>
              )}
            </Section>

            {/* Section 3 — Prompt */}
            <Section index={3} title={t("describe")} subtitle={t("describeHint")} style={{ marginTop: 22 }}>
              <div style={{ position: "relative" }}>
                <textarea value={prompt}
                  onChange={e => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                  placeholder={t("describePlaceholder")} rows={4}
                  disabled={loading}
                  style={{
                    width: "100%", background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 11, padding: "12px 14px",
                    color: "#F1F5F9", fontSize: 13.5, lineHeight: 1.55,
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                    fontFamily: "inherit",
                    transition: "border-color 0.18s, box-shadow 0.18s",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.10)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }} />
                <div style={{
                  position: "absolute", right: 10, bottom: 8,
                  fontSize: 10.5, color: "#6B7280", pointerEvents: "none", fontWeight: 600,
                }}>
                  {prompt.length} / {PROMPT_MAX}
                </div>
              </div>
            </Section>

            {/* Section 4/5 — Format + Quality (side-by-side) */}
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 18 }}>
              <Section index={4} title={t("format")} subtitle={t("formatHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {FORMATS.map(f => {
                    const active = aspectRatio === f.id;
                    return (
                      <button key={f.id} onClick={() => setAspectRatio(f.id)} disabled={loading}
                        style={{
                          padding: "11px 10px", borderRadius: 10,
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "left", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <FormatIcon id={f.id} active={active} />
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t(f.titleKey as keyof typeof STR)}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "#9CA3AF", letterSpacing: "0.02em" }}>
                          ({f.id})
                        </div>
                        <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 1 }}>
                          {t(f.descKey as keyof typeof STR)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section index={5} title={t("quality")} subtitle={t("qualityHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {([
                    { v: "low",    titleKey: "qDraft",  descKey: "qDraftDesc"  },
                    { v: "medium", titleKey: "qMedium", descKey: "qMediumDesc" },
                    { v: "high",   titleKey: "qHigh",   descKey: "qHighDesc"   },
                  ] as const).map(q => {
                    const active = quality === q.v;
                    return (
                      <button key={q.v} onClick={() => setQuality(q.v)} disabled={loading}
                        style={{
                          padding: "10px 8px", borderRadius: 10,
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 1 }}>{t(q.titleKey as keyof typeof STR)}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.02em" }}>{t(q.descKey as keyof typeof STR)}</div>
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={loading || !promptValid}
              className="hub-cta"
              style={{
                marginTop: 22, width: "100%", padding: "14px 20px",
                borderRadius: 11, fontSize: 14, fontWeight: 800,
                background: loading || !promptValid ? "rgba(59,130,246,0.30)" : "#3B82F6",
                color: loading || !promptValid ? "rgba(255,255,255,0.50)" : "#fff",
                border: "none", cursor: loading || !promptValid ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s, transform 0.08s",
                letterSpacing: "0.02em", fontFamily: "inherit",
              }}>
              {loading ? (
                <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />{t("generating")}</>
              ) : (
                <><Sparkles size={16} />{t("generate")}</>
              )}
            </button>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "10px 0 0", textAlign: "center" }}>
              {t("autoSaved")}
            </p>
          </div>

          {/* ╔════════ RIGHT: Preview + Recent ════════╗ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Preview card */}
            <div style={CARD_STYLE}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                  {t("preview")}
                </h3>
                <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{t("previewHint")}</p>
              </div>

              {needsVerify && (
                <div style={{
                  padding: "16px 18px", borderRadius: 12,
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.30)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "rgba(251,191,36,0.15)",
                      border: "1px solid rgba(251,191,36,0.40)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <AlertTriangle size={18} style={{ color: "#fbbf24" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{t("verifyTitle")}</h4>
                      <p style={{ fontSize: 12.5, color: "#D1D5DB", margin: "0 0 4px", lineHeight: 1.5 }}>{t("verifyDesc")}</p>
                      <p style={{ fontSize: 12, color: "#fbbf24", margin: "0 0 12px", fontWeight: 600 }}>{t("verifyTime")}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <a href="https://platform.openai.com/settings/organization/general"
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: 9,
                            background: "#fbbf24", color: "#1a1a2e",
                            fontSize: 12.5, fontWeight: 800, textDecoration: "none",
                          }}>
                          <Sparkles size={12} /> {t("verifyBtn")}
                        </a>
                        <button onClick={() => setNeedsVerify(false)}
                          style={{
                            padding: "8px 12px", borderRadius: 9,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#9CA3AF", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}>
                          {t("verifyClose")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && !needsVerify && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "10px 12px", borderRadius: 9,
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                }}>
                  <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 11.5, color: "#fee2e2", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{error}</p>
                </div>
              )}

              {result && (
                <div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <img src={result.image_url} alt={result.prompt}
                      style={{ maxWidth: "100%", maxHeight: "62vh", borderRadius: 11, display: "block" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => downloadImage(result.image_url, `hub-${Date.now()}.png`)} style={ACTION_BTN}>
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                  </div>
                  {result.revised_prompt && result.revised_prompt !== result.prompt && (
                    <p style={{
                      fontSize: 11, color: "#9CA3AF",
                      marginTop: 10, padding: "8px 11px",
                      background: "rgba(255,255,255,0.02)", borderRadius: 8,
                      fontStyle: "italic", lineHeight: 1.5,
                    }}>
                      {t("promptRefined")}: "{result.revised_prompt}"
                    </p>
                  )}
                </div>
              )}

              {!result && !needsVerify && !error && !loading && (
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
                    <ImageIcon size={22} style={{ color: "#3B82F6" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", margin: 0 }}>{t("emptyTitle")}</p>
                    <p style={{ fontSize: 12, color: "#D1D5DB", margin: "5px 0 0", lineHeight: 1.5, maxWidth: 320 }}>
                      {t("emptyDesc")}
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{
                  border: "1px solid rgba(59,130,246,0.20)",
                  borderRadius: 12, minHeight: 360,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 32, gap: 12,
                  background: "rgba(0,0,0,0.20)",
                }}>
                  <RefreshCw size={28} style={{ color: "#3B82F6", animation: "spin 1.2s linear infinite" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB", margin: 0 }}>{t("generating")}</p>
                </div>
              )}
            </div>

            {/* Recent gallery */}
            {gallery.length > 0 && (
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>{t("recent")}</h3>
                    <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0" }}>{t("recentHint")}</p>
                  </div>
                  <button onClick={() => navigate("/dashboard/hub/library")}
                    style={{
                      background: "transparent", border: "none", color: "#3B82F6",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      letterSpacing: "0.01em",
                    }}>
                    {t("seeAll")} →
                  </button>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                }}>
                  {gallery.slice(0, 4).map(item => {
                    const itemBrand = item.brand_id ? getBrand(item.brand_id) : null;
                    return (
                      <button key={item.id} onClick={() => downloadImage(item.image_url, `hub-${item.id}.png`)}
                        style={{
                          textAlign: "left", padding: 0,
                          background: "transparent", border: "none",
                          cursor: "pointer", fontFamily: "inherit",
                          transition: "transform 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <div style={{
                          aspectRatio: "1/1", borderRadius: 10, overflow: "hidden",
                          background: "rgba(0,0,0,0.30)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          marginBottom: 6,
                        }}>
                          <img src={item.image_url} alt={item.prompt}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                        <div style={{
                          fontSize: 11, color: "#fff", fontWeight: 700,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {itemBrand && itemBrand.id !== "none" ? itemBrand.name : "—"}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 1 }}>
                          {relativeTime(item.created_at, lang)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom benefits strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12, marginTop: 4,
        }} className="hub-image-benefits">
          {[
            { icon: "⚡", titleKey: "bFastTitle",  descKey: "bFastDesc"  },
            { icon: "▣",  titleKey: "bOrgTitle",   descKey: "bOrgDesc"   },
            { icon: "✓",  titleKey: "bConsTitle",  descKey: "bConsDesc"  },
            { icon: "↗",  titleKey: "bScaleTitle", descKey: "bScaleDesc" },
          ].map((b, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 11,
              background: "rgba(17,24,39,0.50)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(59,130,246,0.10)",
                border: "1px solid rgba(59,130,246,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "#3B82F6", fontWeight: 800, flexShrink: 0,
              }}>
                {b.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", margin: 0 }}>{t(b.titleKey as keyof typeof STR)}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>{t(b.descKey as keyof typeof STR)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Brand modal ──────────────────────────────────────── */}
      {brandModalOpen && (
        <BrandModal
          brands={HUB_BRANDS}
          selected={brandId}
          search={brandSearch}
          onSearch={setBrandSearch}
          onSelect={(id) => { setBrandId(id); setBrandModalOpen(false); setBrandSearch(""); }}
          onClose={() => { setBrandModalOpen(false); setBrandSearch(""); }}
          onUploadCustom={() => {
            setBrandModalOpen(false); setBrandSearch("");
            setBrandId("none");
            setTimeout(() => logoInputRef.current?.click(), 80);
          }}
          lang={lang} t={t}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hub-cta:hover:not(:disabled) { background: #2563EB !important; }
        .hub-cta:active:not(:disabled) { background: #1D4ED8 !important; transform: scale(0.97); }
        @media (max-width: 1100px) {
          .hub-image-workspace { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .hub-image-benefits { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Section({ index, title, subtitle, children, style }: {
  index: number; title: string; subtitle?: string;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{
          fontSize: 14, fontWeight: 800, color: "#fff", margin: 0,
          letterSpacing: "-0.01em",
          display: "flex", alignItems: "baseline", gap: 8,
        }}>
          <span style={{ color: "#3B82F6", fontWeight: 700 }}>{index}.</span>
          <span>{title}</span>
        </h3>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function BrandTrigger({ brand, marketCode, lang, customLogo, onClick, disabled, placeholder }: {
  brand: HubBrand | null; marketCode: MarketCode | null; lang: Lang;
  customLogo: string | null;
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
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.40)"; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.10)"; }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: isPicked && brand?.logoImage
          ? "rgba(0,0,0,0.85)"
          : isPicked ? brand!.gradient : "rgba(59,130,246,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, overflow: "hidden",
        border: isPicked ? "none" : "1px solid rgba(59,130,246,0.30)",
      }}>
        {isPicked && brand?.logoImage ? (
          <img src={brand.logoImage} alt={brand.name}
            style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        ) : isPicked ? (
          <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>{brand!.logoInitials}</span>
        ) : customLogo ? (
          <img src={customLogo} alt="custom" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
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

function BrandModal({ brands, selected, search, onSearch, onSelect, onClose, onUploadCustom, lang, t }: {
  brands: HubBrand[]; selected: string;
  search: string; onSearch: (s: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  onUploadCustom: () => void;
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
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
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

        {/* Search */}
        <div style={{ padding: "14px 18px 6px" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "#6B7280",
            }} />
            <input
              autoFocus
              value={search} onChange={e => onSearch(e.target.value)}
              placeholder={t("searchBrand")}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 14px 10px 36px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 13, outline: "none",
                fontFamily: "inherit",
              }} />
          </div>
        </div>

        {/* Brand grid */}
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 10,
          }}>
            {filtered.map(b => {
              const active = selected === b.id;
              const isNone = b.id === "none";
              return (
                <button key={b.id} onClick={() => onSelect(b.id)}
                  style={{
                    padding: "12px 12px", borderRadius: 12,
                    background: active ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.06)"}`,
                    color: "#fff", cursor: "pointer",
                    textAlign: "left", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", gap: 8,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.30)";
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    background: b.logoImage ? "rgba(0,0,0,0.85)" : b.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {b.logoImage ? (
                      <img src={b.logoImage} alt={b.name}
                        style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: isNone ? 12 : 12, fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>
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

        {/* Footer: Adicionar marca (custom logo) */}
        <div style={{
          padding: "12px 18px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <button onClick={onUploadCustom}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10,
              background: "rgba(59,130,246,0.06)",
              border: "1px dashed rgba(59,130,246,0.40)",
              color: "#3B82F6", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
            }}>
            <Plus size={14} /> {t("addBrand")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mini-icon visual pra cada formato (1:1, 9:16, 16:9)
function FormatIcon({ id, active }: { id: string; active: boolean }) {
  const color = active ? "#3B82F6" : "#9CA3AF";
  if (id === "9:16") {
    return <div style={{ width: 9, height: 14, borderRadius: 2, border: `1.5px solid ${color}`, flexShrink: 0 }} />;
  }
  if (id === "16:9") {
    return <div style={{ width: 16, height: 9, borderRadius: 2, border: `1.5px solid ${color}`, flexShrink: 0 }} />;
  }
  return <div style={{ width: 12, height: 12, borderRadius: 2, border: `1.5px solid ${color}`, flexShrink: 0 }} />;
}

// ── Helpers ────────────────────────────────────────────────────
function relativeTime(iso: string, lang: Lang): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    const h = Math.round(min / 60);
    const d = Math.round(h / 24);
    if (lang === "en") {
      if (min < 1) return "now";
      if (min < 60) return `${min} min ago`;
      if (h < 24) return `${h}h ago`;
      return `${d}d ago`;
    }
    if (lang === "es") {
      if (min < 1) return "ahora";
      if (min < 60) return `Hace ${min} min`;
      if (h < 24) return `Hace ${h}h`;
      return `Hace ${d}d`;
    }
    if (lang === "zh") {
      if (min < 1) return "刚刚";
      if (min < 60) return `${min} 分钟前`;
      if (h < 24) return `${h} 小时前`;
      return `${d} 天前`;
    }
    if (min < 1) return "agora";
    if (min < 60) return `Há ${min} min`;
    if (h < 24) return `Há ${h}h`;
    return `Há ${d}d`;
  } catch { return ""; }
}

// ── Shared styles ─────────────────────────────────────────────
const CARD_STYLE: React.CSSProperties = {
  background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 18,
};

const SUBTLE_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 10px", borderRadius: 7,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#D1D5DB",
  cursor: "pointer", fontSize: 11, fontWeight: 600,
  fontFamily: "inherit",
};

const ACTION_BTN: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
  fontFamily: "inherit",
  transition: "all 0.12s",
};
