/**
 * HubImageGenerator — Image Studio (SaaS-style refactor).
 *
 * Layout: 2-coluna (LEFT controles, RIGHT preview + galeria).
 * Paleta: dark + azul #3B82F6, sem gradientes, sem glow.
 *
 * Fluxo:
 *   1. Selecionar marca → abre modal com search + grid de cards
 *      (carregadas de user_brands) + opção "Sem marca".
 *   2. Marca selecionada vira chip no painel; mercado e license aparecem
 *      como sub-controles inline quando aplicável.
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
import * as D from "@/lib/design";
import GenerationStage, { type StageKey } from "@/components/hub/GenerationStage";
import PlatformFrame from "@/components/hub/PlatformFrame";
import {
  Image as ImageIcon, Download, RefreshCw, Sparkles, AlertTriangle,
  Copy, RotateCcw, Check, ChevronDown, Search, Plus, Upload, X,
  Pencil, ChevronRight, Layers, Trash2,
  ScanFace, Video, Captions,
  Package, Flame, MessageSquare, ArrowLeftRight, Smartphone,
  type LucideIcon,
} from "lucide-react";
import {
  HUB_MARKETS, getBrand, getBrandName, getMarketLabel,
  type HubBrand, type MarketCode, type Lang,
} from "@/data/hubBrands";
import { useUserBrands } from "@/hooks/useUserBrands";
import { useHubCredits } from "@/hooks/useHubCredits";
import { useLanguage } from "@/i18n/LanguageContext";
import { composeImage } from "@/lib/composeImageWithLicense";
import { compositeElements, ASPECT_DIMS } from "@/lib/compositeElements";
import { addHubNotification } from "@/lib/hubNotifications";
import { startGenProgress, type GenProgressController } from "@/lib/genProgress";
import { saveHubAsset } from "@/lib/saveHubAsset";
import { uploadAssetToStorage } from "@/lib/uploadAssetToStorage";
import {
  type HubElement,
  listElements,
  uploadElement,
  renameElement as renameElementDb,
  deleteElement as deleteElementDb,
  migrateLocalElementsIfNeeded,
  loadSelectedIds,
  saveSelectedIds,
  urlToBase64,
} from "@/lib/hubElements";

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
  // Elementos (opcional)
  elementsTitle:       { pt: "Elementos (opcional)",   en: "Elements (optional)",   es: "Elementos (opcional)",   zh: "元素（可选）" },
  elementsSubtitle:    { pt: "Adicione elementos como personagens, ícones ou objetos para incluir no criativo.",
                         en: "Add elements like characters, icons or objects to include in the creative.",
                         es: "Añade elementos como personajes, íconos u objetos para incluir en el creativo.",
                         zh: "添加角色、图标或物体等元素以包含在创意中。" },
  elementsAdd:         { pt: "Adicionar elementos",     en: "Add elements",          es: "Añadir elementos",       zh: "添加元素" },
  elementsModalTitle:  { pt: "Adicionar elementos",     en: "Add elements",          es: "Añadir elementos",       zh: "添加元素" },
  elementsUploadCta:   { pt: "Clique para enviar ou arraste arquivos",
                         en: "Click to upload or drag files",
                         es: "Haz clic para subir o arrastra archivos",
                         zh: "点击上传或拖动文件" },
  elementsAcceptHint:  { pt: "Apenas PNG com fundo transparente",
                         en: "PNG with transparent background only",
                         es: "Solo PNG con fondo transparente",
                         zh: "仅限透明背景的 PNG" },
  elementsUploadingN:  { pt: "Enviando {done} de {total}…",
                         en: "Uploading {done} of {total}…",
                         es: "Subiendo {done} de {total}…",
                         zh: "上传 {done} / {total}..." },
  elementsInvalidErr:  { pt: "Use PNG com fundo transparente. Utilize o Gerador de PNG para converter.",
                         en: "Use PNG with transparent background. Use the PNG Generator to convert.",
                         es: "Usa PNG con fondo transparente. Usa el Generador de PNG para convertir.",
                         zh: "请使用透明背景的 PNG。使用 PNG 生成器转换。" },
  elementsTooBig:      { pt: "Arquivo muito grande (max 2MB).",
                         en: "File too large (max 2MB).",
                         es: "Archivo demasiado grande (máx 2MB).",
                         zh: "文件过大（最大 2MB）。" },
  elementsOpenPng:     { pt: "Abrir Gerador de PNG",    en: "Open PNG Generator",    es: "Abrir Generador de PNG", zh: "打开 PNG 生成器" },
  elementsEmpty:       { pt: "Adicione elementos como personagens, logos ou ícones para reutilizar nos criativos.",
                         en: "Add elements like characters, logos or icons to reuse across creatives.",
                         es: "Añade elementos como personajes, logos o íconos para reutilizar en los creativos.",
                         zh: "添加角色、logo 或图标等元素以在创意中重复使用。" },
  elementsLibrary:     { pt: "Sua biblioteca",          en: "Your library",          es: "Tu biblioteca",          zh: "您的库" },
  elementsRename:      { pt: "Renomear",                en: "Rename",                es: "Renombrar",              zh: "重命名" },
  elementsDelete:      { pt: "Excluir",                 en: "Delete",                es: "Eliminar",               zh: "删除" },
  elementsSelected:    { pt: "selecionados",            en: "selected",              es: "seleccionados",          zh: "已选择" },
  // Nome do arquivo
  fileName:            { pt: "Nome do arquivo (opcional)", en: "File name (optional)",  es: "Nombre del archivo (opcional)", zh: "文件名（可选）" },
  fileNameHint:        { pt: "Dê um nome para identificar este criativo na biblioteca.",
                         en: "Give it a name to identify this creative in the library.",
                         es: "Dale un nombre para identificar este creativo en la biblioteca.",
                         zh: "为这个创意命名以便在资源库中识别。" },
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

/**
 * Pontos de partida por objetivo do anunciante.
 *
 * A tela começava em branco e pedia 11 decisões antes da primeira geração —
 * formato, qualidade, marca, mercado, licença, logo, elementos, nome, prompt.
 * Era onde a maior parte das pessoas desistia.
 *
 * Cada objetivo aqui preenche prompt, formato e qualidade de uma vez. Nada
 * fica travado: é um ponto de partida, não um trilho.
 */
const CREATIVE_GOALS: Array<{
  id: string; Icon: LucideIcon; label: string; hint: string;
  prompt: string; aspect: string; quality: "low" | "medium" | "high";
}> = [
  {
    id: "produto", Icon: Package, label: "Anúncio de produto",
    hint: "O produto em destaque, fundo limpo",
    aspect: "1:1", quality: "medium",
    prompt: "Foto publicitária do produto em destaque, fundo limpo e iluminação de estúdio, cores da marca, composição centralizada com espaço para texto no topo.",
  },
  {
    id: "oferta", Icon: Flame, label: "Oferta / desconto",
    hint: "Urgência e preço em evidência",
    aspect: "1:1", quality: "medium",
    prompt: "Criativo de oferta com senso de urgência, cores vibrantes da marca, área livre e contrastada na parte inferior para o preço e o botão.",
  },
  {
    id: "prova", Icon: MessageSquare, label: "Prova social",
    hint: "Depoimento de cliente real",
    aspect: "4:5", quality: "medium",
    prompt: "Cena autêntica de cliente satisfeito usando o produto, luz natural, aparência real e não posada, espaço lateral para o depoimento em texto.",
  },
  {
    id: "antes", Icon: ArrowLeftRight, label: "Antes e depois",
    hint: "Transformação lado a lado",
    aspect: "1:1", quality: "high",
    prompt: "Composição dividida ao meio mostrando a transformação antes e depois, mesma iluminação e enquadramento nos dois lados para a diferença ficar evidente.",
  },
  {
    id: "stories", Icon: Smartphone, label: "Stories / Reels",
    hint: "Vertical, para tela cheia",
    aspect: "9:16", quality: "medium",
    prompt: "Criativo vertical para Stories, elemento principal centralizado e afastado das bordas, fundo com profundidade, espaço no terço superior para a headline.",
  },
  {
    id: "rascunho", Icon: Pencil, label: "Só testar uma ideia",
    hint: "Rápido e barato, 1 crédito",
    aspect: "1:1", quality: "low",
    prompt: "",
  },
];

const PROMPT_MAX = 600;
const FILE_NAME_MAX = 60;
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const CUSTOM_LOGO_KEY = "hub_custom_logo_v1";

// Stopwords pt/en/es pra filtrar do auto-nome do arquivo. Mantém só
// palavras-chave significativas (ex: "Banner de aposta esportiva" →
// "banner_aposta").
const FILE_NAME_STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "com", "para", "por", "sem", "sobre",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for",
  "el", "la", "los", "las", "un", "una", "y", "o", "con", "por", "para",
  "em", "no", "na", "nos", "nas", "ao", "à", "às", "aos",
]);

const MONTH_ABBREV: Record<Lang, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  zh: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
};

function slugWord(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove accents
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
}

function buildAutoFileName(opts: {
  brandId: string; market: MarketCode | null; prompt: string; lang: Lang;
}): string {
  const { brandId, market, prompt, lang } = opts;
  const parts: string[] = [];
  if (brandId && brandId !== "none") parts.push(brandId);
  // Pega 2 primeiras palavras significativas do prompt
  const words = prompt.toLowerCase().split(/\s+/)
    .map(slugWord)
    .filter(w => w.length >= 3 && !FILE_NAME_STOPWORDS.has(w))
    .slice(0, 2);
  parts.push(...words);
  if (market) parts.push(market.toLowerCase());
  // Date: DDMMM (lang-aware) — ex: 05mai pra pt
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const monthIdx = d.getMonth();
  const monthLabel = MONTH_ABBREV[lang][monthIdx] || MONTH_ABBREV.en[monthIdx];
  parts.push(`${day}${monthLabel}`);
  return parts.filter(Boolean).join("_").slice(0, FILE_NAME_MAX);
}

// Elementos: biblioteca de PNGs reutilizáveis. Agora persistido no
// Supabase Storage + tabela hub_elements (antes era localStorage,
// estourava quota com poucos arquivos). Lib em @/lib/hubElements.
// HubElement type vem de lá.
const ELEMENT_MAX_BYTES = 5 * 1024 * 1024; // 5MB — Storage suporta, sem mais limite de quota

export default function HubImageGenerator() {
  // Plano gratuito recebe marca d'água nos criativos.
  const { plan: hubPlan, balance: hubBalance, costOf: hubCostOf } = useHubCredits();

  // Estágio da geração corrente. Os textos já existiam e já eram traduzidos —
  // só iam pro sino da topbar em vez de irem pra tela.
  const [genStage, setGenStage] = useState<StageKey>("prep");

  /** Qualidade pedida quando o servidor entregou menos. */
  const [downgraded, setDowngraded] = useState<string | null>(null);

  // Os mesmos textos que o sino usa. Ficavam dentro de generate(), fora do
  // alcance do render.
  const stageLabels = (key: StageKey): string => ({
    prep:    { pt: "Preparando",                     en: "Preparing",                   es: "Preparando",                  zh: "正在准备" },
    ai:      { pt: "Gerando a imagem",               en: "Generating the image",        es: "Generando la imagen",         zh: "生成图像" },
    compose: { pt: "Aplicando marca e texto legal",  en: "Applying brand + disclaimer", es: "Aplicando marca + aviso",     zh: "应用品牌 + 免责声明" },
    save:    { pt: "Salvando na sua biblioteca",     en: "Saving to your library",      es: "Guardando en tu biblioteca",  zh: "保存到资源库" },
  }[key][lang]);
  // Marcas do usuário (substituem as antigas marcas fixas do Hub).
  const { brands: userBrands } = useUserBrands();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || key;

  // ── Form state ────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
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

  // ── Elementos (asset library leve) ───────────────────────────
  const [elements, setElements] = useState<HubElement[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [elementsModalOpen, setElementsModalOpen] = useState(false);

  // ── File name (auto-fill, mas user pode editar) ─────────────
  const [fileName, setFileName] = useState<string>("");
  const [fileNameTouched, setFileNameTouched] = useState(false);

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

  // Load elements do DB (Storage-backed) + selection do localStorage (só IDs).
  // Roda one-shot migration de localStorage → Storage se necessário (uma vez por user).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Migra elementos legados do localStorage pro Storage (idempotente).
      // A migração também limpa SELECTED_KEY se rodar com sucesso (IDs antigos
      // viram UUIDs novos), por isso loadSelectedIds() vem DEPOIS.
      try {
        const m = await migrateLocalElementsIfNeeded();
        if (m.migrated > 0) {
          console.log(`[hub-elements] migrated ${m.migrated} legacy elements to Storage (${m.failed} failed)`);
        }
      } catch (e) {
        console.warn("[hub-elements] migration failed:", e);
      }
      if (cancelled) return;
      // Carrega lista atualizada do DB + seleção persistida (após eventual limpeza pela migração)
      const list = await listElements();
      if (cancelled) return;
      setElements(list);
      setSelectedElementIds(loadSelectedIds());
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist selection — só strings de ID, nunca estoura quota
  useEffect(() => {
    saveSelectedIds(selectedElementIds);
  }, [selectedElementIds]);

  // Auto-fill file name baseado em brand + prompt + market + data.
  // Só sobrescreve se user ainda não editou manualmente (fileNameTouched=false).
  useEffect(() => {
    if (fileNameTouched) return;
    setFileName(buildAutoFileName({ brandId, market: marketCode, prompt, lang }));
  }, [brandId, marketCode, prompt, lang, fileNameTouched]);

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

  // ── Element handlers ──────────────────────────────────────
  // Upload vai pro Supabase Storage + tabela hub_elements. Retorna { ok, error }
  // pra UI poder mostrar mensagem clara se falhar.
  const addElement = async (file: File): Promise<{ ok: boolean; error?: string }> => {
    if (file.type !== "image/png") {
      return { ok: false, error: t("elementsInvalidErr") };
    }
    if (file.size > ELEMENT_MAX_BYTES) {
      return { ok: false, error: t("elementsTooBig") };
    }
    try {
      const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "elemento";
      const newEl = await uploadElement({ blob: file, name: baseName });
      setElements(prev => [newEl, ...prev]);
      // Auto-select recém-adicionado
      setSelectedElementIds(prev => [...prev, newEl.id]);
      return { ok: true };
    } catch (e) {
      console.error("[hub-elements] upload failed:", e);
      return { ok: false, error: (e as Error).message || t("elementsInvalidErr") };
    }
  };

  // Rename: atualiza local + DB. Se DB falhar, reverte local.
  const renameElement = async (id: string, newName: string) => {
    const trimmed = newName.trim().slice(0, 60);
    if (!trimmed) return;
    const prev = elements;
    setElements(curr => curr.map(el => el.id === id ? { ...el, name: trimmed } : el));
    try {
      await renameElementDb(id, trimmed);
    } catch (e) {
      console.error("[hub-elements] rename failed:", e);
      setElements(prev); // rollback
    }
  };

  // Delete: remove local + DB + Storage. Otimista — se falhar, recarrega lista.
  const deleteElement = async (id: string) => {
    const target = elements.find(el => el.id === id);
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedElementIds(prev => prev.filter(x => x !== id));
    try {
      await deleteElementDb(id, target?.storagePath);
    } catch (e) {
      console.error("[hub-elements] delete failed, reloading list:", e);
      const fresh = await listElements();
      setElements(fresh);
    }
  };

  const toggleElementSelection = (id: string) => {
    setSelectedElementIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const selectedElements = useMemo(
    () => selectedElementIds.map(id => elements.find(e => e.id === id)).filter(Boolean) as HubElement[],
    [selectedElementIds, elements],
  );

  const generate = async () => {
    if (loading || !prompt.trim() || prompt.trim().length < 5) return;
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    setResult(null);

    // Notificação live com barra de progresso. ~30s estimado pra gpt-image-2.
    let progressCtrl: GenProgressController | null = null;
    const titleByLang: Record<Lang, string> = {
      pt: "Gerando imagem...",
      en: "Generating image...",
      es: "Generando imagen...",
      zh: "正在生成图像…",
    };
    const stageByLang = (key: "prep" | "ai" | "compose" | "save"): string => {
      const map: Record<typeof key, Record<Lang, string>> = {
        prep: { pt: "Preparando", en: "Preparing", es: "Preparando", zh: "正在准备" },
        ai: { pt: "Chamando IA (gpt-image-2)", en: "Calling AI (gpt-image-2)", es: "Llamando IA (gpt-image-2)", zh: "调用 AI (gpt-image-2)" },
        compose: { pt: "Aplicando marca + disclaimer", en: "Applying brand + disclaimer", es: "Aplicando marca + disclaimer", zh: "应用品牌 + 免责声明" },
        save: { pt: "Salvando na Biblioteca", en: "Saving to Library", es: "Guardando en Biblioteca", zh: "保存到资源库" },
      };
      return map[key][lang];
    };

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError(t("sessionExpired")); return; }

      // Inicia notif com progresso (depois do session check pra ter user_id)
      const userId = sessionData?.session?.user?.id;
      progressCtrl = startGenProgress(userId, {
        title: titleByLang[lang],
        estimateMs: 32_000, // gpt-image-2 leva 25-45s
        stage: stageByLang("prep"),
      });
      setGenStage("prep");

      let brandHint = brand?.promptHint || "";
      if (marketCode && HUB_MARKETS[marketCode]?.promptContext) {
        brandHint = `${brandHint}\n\n${HUB_MARKETS[marketCode].promptContext}`.trim();
      }
      if (effectiveLogoUrl && includeLogo) {
        const brandLabel = brand && brand.id !== "none" ? brand.name : "any logo";
        brandHint = `${brandHint}\n\nIMPORTANT: Do NOT render ${brandLabel} or any logo as text or visual element inside the image. The official logo will be added as overlay in post-production. Keep the upper-right corner of the image visually clean (about 20% area) so the overlay logo will be legible against any background.`;
      }
      // Regra anti-invenção (vale pra todos os paths). Modelos generativos
      // tendem a inventar marcas/textos quando a cena envolve "promo" /
      // "esportes" / "campanha". Bloquear explicitamente mantém o criativo
      // limpo pra brand officialmente compositar tudo no pós.
      brandHint = `${brandHint}

ABSOLUTE RULE — NO INVENTED BRAND ELEMENTS:
Do NOT generate, render, or invent ANY of the following inside the image:
- Fake brand logos, brand marks, or made-up brand text (no fake team logos on jerseys, no invented sponsor logos on caps/banners, no AI-fabricated brand stamps anywhere).
- Promotional headlines or copy text that the user did NOT explicitly request in their prompt (no auto-added "BIG WINS", "SPECIAL OFFER", etc).
- Random text, random characters, fake URLs, fake handles, or any written content not in the user's prompt.

If text or branding is needed, the user will request it explicitly in their prompt. Otherwise: pure visual composition only — clean, no fabricated marks.

ABSOLUTE RULE — NO CROPPING / NO CLIPPING:
Every visual element in the final image MUST be FULLY visible within the canvas.
- Nothing can be cut off at the top, bottom, left, or right edges.
- Maintain at least 8% safe padding from all 4 edges for any character, text, headline, logo, or important detail.
- Characters must show their full body (or at minimum head + shoulders + torso clearly visible, not chopped at the chin/forehead).
- If text/headline is part of the composition, it MUST be entirely within the frame — never extending past the canvas borders.
- Compose the scene so the camera framing fits everything comfortably with breathing room.`;
      // ── Engine única: gpt-image-2 via generate-image-hub ──
      // Quando selectedElements > 0, manda os PNGs como base64 (data URL).
      // PRECISA ser base64 — a versão v18b deployada do edge function
      // não suporta URLs do Storage ainda (v20 sim, mas Lovable não
      // redeployou). Converter URL → base64 client-side é compat shim que
      // funciona em ambas as versões do backend.
      let inputImagesBase64: string[] = [];
      if (selectedElements.length > 0) {
        try {
          inputImagesBase64 = await Promise.all(
            selectedElements.map(e => urlToBase64(e.url))
          );
        } catch (convErr) {
          console.error("[image-gen] failed converting elements to base64:", convErr);
          setError(`Falha ao processar elementos: ${(convErr as Error).message}`);
          setLoading(false);
          return;
        }
      }
      progressCtrl?.setStage(stageByLang("ai")); setGenStage("ai");
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
          ...(inputImagesBase64.length > 0
            ? { input_images_base64: inputImagesBase64 }
            : {}),
        }),
      });

      const text = await r.text();
      let payload: {
        ok?: boolean; _v?: string; openai_message?: string; message?: string;
        error?: string; image_url?: string; revised_prompt?: string;
        // O servidor rebaixa a qualidade do plano Free para rascunho e diz
        // isso aqui. Estes três campos existiam na resposta desde sempre e
        // não estavam nem declarados.
        quality?: string; quality_requested?: string; downgraded?: boolean;
      } | null = null;
      try { payload = JSON.parse(text); } catch { /* not json */ }

      if (!r.ok || !payload?.ok) {
        if (payload?.error === "needs_org_verification") {
          setNeedsVerify(true);
          progressCtrl?.fail("OpenAI org verification required");
          return;
        }
        const detail = payload?.openai_message || payload?.message || payload?.error || text || `HTTP ${r.status}`;
        const versionTag = payload?._v ? ` [fn=${payload._v}]` : " [fn=desconhecida]";
        setError((detail + versionTag).slice(0, 500));
        progressCtrl?.fail(detail);
        return;
      }

      // Avisa quando a entrega veio abaixo do pedido. Sem isso o ticket que
      // chega é "a qualidade alta está péssima".
      if (payload.downgraded) {
        setDowngraded(payload.quality_requested || quality);
      } else {
        setDowngraded(null);
      }

      let finalImageUrl = payload.image_url!;
      // A marca d'água do plano Free vive dentro do composeImage, e o
      // composeImage só rodava quando havia licença OU logo. Um Free
      // recém-cadastrado não tem nem um nem outro — então baixava imagem
      // limpa, apesar de HUB_PLANS.free.watermark ser true e de a função
      // devolver watermark: true. Ninguém lia.
      const willCompose =
        (hasLicense && includeLicense && licenseText.trim()) ||
        (effectiveLogoUrl && includeLogo) ||
        hubPlan.watermark;
      if (willCompose) {
        progressCtrl?.setStage(stageByLang("compose")); setGenStage("compose");
        try {
          const composedDataUrl = await composeImage(payload.image_url!, {
            licenseText: hasLicense && includeLicense ? licenseText.trim() : null,
            logoUrl: effectiveLogoUrl && includeLogo ? effectiveLogoUrl : null,
            logoPosition: "top-right",
            watermark: hubPlan.watermark,
          });
          finalImageUrl = composedDataUrl;
        } catch (composeErr) {
          console.warn("[hub-image] compose failed, using raw:", composeErr);
        }
      }

      progressCtrl?.setStage(stageByLang("save")); setGenStage("save");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Sobe pro Storage se ainda for data URL (acontece quando rolou
          // composeImage com license/logo). Se já é URL pública (Storage
          // do edge function), passa direto. Reduz row do hub_assets de
          // ~2MB pra ~200 bytes.
          const storedImageUrl = await uploadAssetToStorage(finalImageUrl, "generated");
          await saveHubAsset({
            userId: user.id,
            type: "hub_image",
            content: {
              prompt: prompt.trim(),
              revised_prompt: payload.revised_prompt || prompt.trim(),
              image_url: storedImageUrl,
              aspect_ratio: aspectRatio,
              quality,
              model: "gpt-image-2",
              brand_id: brandId === "none" ? null : brandId,
              market: marketCode || null,
              license_included: hasLicense && includeLicense,
              license_text: hasLicense && includeLicense ? licenseText.trim() : null,
              logo_overlaid: !!(effectiveLogoUrl && includeLogo),
              file_name: fileName.trim() || null,
              elements_used: selectedElements.map(e => ({ id: e.id, name: e.name })),
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
        const brandLabel = brand && brand.id !== "none" && marketCode
          ? `${brand.name} · ${HUB_MARKETS[marketCode].flag} ${getMarketLabel(marketCode, lang)}`
          : null;
        const doneTitleByLang: Record<Lang, string> = {
          pt: "Imagem pronta",
          en: "Image ready",
          es: "Imagen lista",
          zh: "图像已生成",
        };
        const promptPreview = prompt.trim().slice(0, 80) + (prompt.trim().length > 80 ? "…" : "");
        const desc = brandLabel ? `${brandLabel} · ${promptPreview}` : promptPreview;
        progressCtrl?.complete({
          title: doneTitleByLang[lang],
          description: desc,
          href: "/dashboard/hub/library",
          kind: "image_generated",
        });
      } catch { /* silent */ }
    } catch (e) {
      const msg = String(e).slice(0, 300);
      setError(msg);
      progressCtrl?.fail(msg);
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

  // Custo da geração, com a qualidade escolhida. Aparece no botão e no aviso
  // de saldo. A checagem aqui é otimista — quem decide é o servidor.
  const creditCost = hubCostOf(
    quality === "high" ? "image_high" : quality === "low" ? "image_draft" : "image_standard",
  );
  const notEnough = hubBalance < creditCost;

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>{t("title")}</title></Helmet>

      <div className="hub-image-page" style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 28px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Header — title left, back button right */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 22, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{
                fontSize: 26, fontWeight: 800, color: "#fff", margin: 0,
                letterSpacing: "-0.02em", lineHeight: 1.1,
              }}>{t("title")}</h1>
              <span
                title={lang === "pt"
                  ? "Powered by GPT Image 2: imagens 4K com renderização de texto quase perfeita."
                  : lang === "es"
                  ? "Powered by GPT Image 2: imágenes 4K con renderizado de texto casi perfecto."
                  : lang === "zh"
                  ? "由 GPT Image 2 提供支持：4K 图像，近乎完美的文本渲染。"
                  : "Powered by GPT Image 2: 4K images with near-perfect text rendering."}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(59,130,246,0.18))",
                  border: "1px solid rgba(139,92,246,0.30)",
                  color: "#A78BFA",
                  fontSize: 10.5, fontWeight: 800,
                  letterSpacing: "0.02em",
                  cursor: "help",
                }}
              >
                <Sparkles size={10} /> GPT Image 2
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          {/* Havia um "Voltar ao Hub" aqui. Esta É a tela inicial, e o
              destino nem aparece no menu — o botão convidava a sair de onde
              a pessoa deveria estar. */}
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
            <Section title={t("brand")} subtitle={t("brandSubtitle")}>
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
            <Section title={t("logoOptional")} subtitle={t("logoSubtitle")} style={{ marginTop: 22 }}>
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

            {/* Elementos (opcional) — biblioteca leve de PNGs reutilizáveis */}
            <Section
              title={t("elementsTitle")}
              subtitle={t("elementsSubtitle")}
              style={{ marginTop: 22 }}
              headerRight={
                <button
                  onClick={() => setElementsModalOpen(true)}
                  disabled={loading}
                  className="hub-elements-link"
                  style={{
                    background: "transparent", border: "none",
                    color: "#3B82F6", cursor: loading ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                    padding: "2px 4px", letterSpacing: "0.01em",
                  }}
                >
                  <Plus size={13} /> {t("elementsAdd")}
                </button>
              }
            >
              {/* Selected element chips — só aparecem quando há seleção */}
              {selectedElements.length > 0 && (
                <div className="hub-elements-chips" style={{
                  display: "flex", gap: 8, overflowX: "auto",
                  paddingBottom: 4, scrollbarWidth: "thin",
                }}>
                  {selectedElements.map(el => (
                    <SelectedElementChip
                      key={el.id} element={el}
                      onRemove={() => toggleElementSelection(el.id)}
                      disabled={loading}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Objetivos — o atalho de 11 decisões para 1.
                Cada cartão preenche prompt, formato e qualidade de uma vez.
                O usuário ainda pode editar tudo depois; a diferença é que a
                tela deixa de começar em branco, que era onde a maioria travava. */}
            <Section
              title="O que você precisa hoje?"
              subtitle="Escolha um ponto de partida — você edita tudo depois"
              style={{ marginTop: 4 }}
            >
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
                gap: 8,
              }}>
                {CREATIVE_GOALS.map(g => {
                  const active = activeGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      disabled={loading}
                      onClick={() => {
                        setActiveGoal(g.id);
                        setPrompt(g.prompt);
                        setAspectRatio(g.aspect);
                        setQuality(g.quality);
                      }}
                      style={{
                        textAlign: "left", padding: "11px 12px", borderRadius: 10,
                        cursor: loading ? "not-allowed" : "pointer",
                        background: active ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.025)",
                        border: `1px solid ${active ? "rgba(14,165,233,0.42)" : "rgba(255,255,255,0.07)"}`,
                        borderLeft: `2px solid ${active ? "#0ea5e9" : "transparent"}`,
                        transition: "transform .12s, border-color .12s",
                      }}
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                    >
                      <g.Icon size={16} color={active ? D.color.accent : D.color.text3} style={{ marginBottom: 6 }} />
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F1F5F9", marginBottom: 2 }}>
                        {g.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#94A3B8", lineHeight: 1.4 }}>
                        {g.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Section 3 — Prompt */}
            <Section title={t("describe")} subtitle={t("describeHint")} style={{ marginTop: 22 }}>
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

            {/* Nome do arquivo (opcional) — auto-fill que user pode editar */}
            <Section title={t("fileName")} subtitle={t("fileNameHint")} style={{ marginTop: 22 }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={fileName}
                  onChange={e => {
                    setFileNameTouched(true);
                    setFileName(e.target.value.slice(0, FILE_NAME_MAX));
                  }}
                  disabled={loading}
                  spellCheck={false}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "11px 60px 11px 14px",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 11,
                    color: "#F1F5F9", fontSize: 13.5,
                    outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.18s, box-shadow 0.18s",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.10)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  fontSize: 10.5, color: "#6B7280", pointerEvents: "none", fontWeight: 600,
                }}>
                  {fileName.length} / {FILE_NAME_MAX}
                </div>
              </div>
            </Section>

            {/* Section 4/5 — Format + Quality (side-by-side) */}
            <div className="hub-fmt-row" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
              <Section title={t("format")} subtitle={t("formatHint")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {FORMATS.map(f => {
                    const active = aspectRatio === f.id;
                    return (
                      <button key={f.id} onClick={() => setAspectRatio(f.id)} disabled={loading}
                        style={{
                          padding: "10px 8px", borderRadius: 10,
                          minWidth: 0,
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "left", fontFamily: "inherit",
                          overflow: "hidden",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, minWidth: 0 }}>
                          <FormatIcon id={f.id} active={active} />
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
                          }}>{t(f.titleKey as keyof typeof STR)}</span>
                          <span style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.02em", flexShrink: 0 }}>
                            ({f.id})
                          </span>
                        </div>
                        <div style={{
                          fontSize: 10.5, color: "#9CA3AF",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
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
                      <button key={q.v} onClick={() => setQuality(q.v)} disabled={loading}
                        style={{
                          padding: "9px 6px", borderRadius: 10,
                          minWidth: 0, overflow: "hidden",
                          background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#fff" : "#D1D5DB",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "center", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, marginBottom: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{t(q.titleKey as keyof typeof STR)}</div>
                        <div style={{
                          fontSize: 10, color: "#9CA3AF", letterSpacing: "0.02em",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{t(q.descKey as keyof typeof STR)}</div>
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
                <>
                  <Sparkles size={16} />{t("generate")}
                  {/* O preço no botão. Sem ele a pessoa clica sem saber que
                      "alta qualidade" custa 4,5x o padrão, e descobre no
                      extrato. */}
                  <span style={{
                    fontWeight: D.font.weight.medium,
                    opacity: 0.75,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    · {creditCost} crédito{creditCost === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </button>
            <p style={{
              fontSize: D.font.size.label,
              color: notEnough ? D.color.warning : D.color.text3,
              margin: "10px 0 0", textAlign: "center",
            }}>
              {notEnough
                ? `Você tem ${hubBalance}. Faltam ${creditCost - hubBalance}.`
                : t("autoSaved")}
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
                  {downgraded && (
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: D.space[2],
                      padding: `${D.space[2]}px ${D.space[3]}px`,
                      marginBottom: D.space[3],
                      borderRadius: D.radius.sm,
                      background: D.color.warningSoft,
                      border: `1px solid ${D.color.warningBorder}`,
                    }}>
                      <AlertTriangle size={14} color={D.color.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ fontSize: D.font.size.caption, color: D.color.text2, margin: 0, lineHeight: 1.5 }}>
                        O plano Free gera sempre em rascunho, mesmo quando você
                        escolhe qualidade {downgraded === "high" ? "alta" : "média"}.{" "}
                        <a href="/dashboard/plans" style={{ color: D.color.accent, fontWeight: 600 }}>
                          Ver planos
                        </a>
                      </p>
                    </div>
                  )}

                  {/* O criativo dentro do lugar onde ele vai aparecer. Era
                      uma <img> solta: um PNG. A landing promete "sai pronto
                      pra subir" e a tela entregava um arquivo. */}
                  <div style={{ marginBottom: 14, animation: "hubReveal 260ms cubic-bezier(0.16,1,0.3,1)" }}>
                    <PlatformFrame
                      src={result.image_url}
                      aspectRatio={aspectRatio}
                      brandName={brand && brand.id !== "none" ? brand.name : null}
                      brandLogoUrl={effectiveLogoUrl || null}
                      caption={result.prompt}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => downloadImage(result.image_url, `${(fileName.trim() || `hub-${Date.now()}`).replace(/[^a-z0-9_-]/gi, "_")}.png`)} style={ACTION_BTN}>
                      <Download size={13} /> {t("download")}
                    </button>
                    <button onClick={generate} disabled={loading} style={ACTION_BTN}>
                      <RefreshCw size={13} /> {t("variation")}
                    </button>
                    {/* Continuações. Antes eram telas separadas no menu (PNG,
                        Face Swap, Legendas, Locução) e o usuário tinha que
                        adivinhar que uma servia à outra. Como ação sobre o
                        criativo que ele acabou de ver, a relação é óbvia. */}
                    <button
                      onClick={() => navigate("/dashboard/hub/png", { state: { sourceImage: result.image_url } })}
                      style={ACTION_BTN}
                      title="Recortar o produto e deixar o fundo transparente"
                    >
                      <Layers size={13} /> Tirar fundo
                    </button>
                    <button
                      onClick={() => navigate("/dashboard/hub/faceswap", { state: { sourceImage: result.image_url } })}
                      style={ACTION_BTN}
                      title="Trocar o rosto desta imagem"
                    >
                      <ScanFace size={13} /> Trocar rosto
                    </button>
                    <button
                      onClick={() => navigate("/dashboard/hub/video", { state: { sourceImage: result.image_url } })}
                      style={ACTION_BTN}
                      title="Animar esta imagem"
                    >
                      <Video size={13} /> Virar vídeo
                    </button>
                    <button
                      onClick={() => navigate("/dashboard/hub/captions", { state: { sourceImage: result.image_url } })}
                      style={ACTION_BTN}
                      title="Escrever a legenda deste criativo"
                    >
                      <Captions size={13} /> Escrever legenda
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
                /* O estado vazio ocupa o espaço mais nobre da tela e não
                   vendia nada: um retângulo tracejado com um ícone genérico.
                   Num produto que gera imagem, este é o único showroom que
                   existe antes da primeira geração — e ele resolve, de quebra,
                   o "não sei o que pedir", que é onde a maioria trava. */
                <div style={{
                  border: `1px solid ${D.color.border}`,
                  borderRadius: D.radius.lg,
                  minHeight: 360,
                  padding: D.space[5],
                  background: D.color.inset,
                  display: "flex", flexDirection: "column", gap: D.space[4],
                }}>
                  <div>
                    <p style={{
                      fontSize: D.font.size.title, fontWeight: D.font.weight.bold,
                      color: D.color.text, margin: 0, letterSpacing: "-0.02em",
                    }}>
                      Comece por um objetivo
                    </p>
                    <p style={{
                      fontSize: D.font.size.body, color: D.color.text2,
                      margin: "6px 0 0", lineHeight: D.font.leading.normal,
                    }}>
                      Cada um já preenche o texto, o formato e a qualidade.
                      Você ajusta depois se quiser.
                    </p>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: D.space[2],
                  }}>
                    {CREATIVE_GOALS.filter(g => g.prompt).map(g => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setActiveGoal(g.id);
                          setPrompt(g.prompt);
                          setAspectRatio(g.aspect);
                          setQuality(g.quality);
                        }}
                        style={{
                          textAlign: "left",
                          padding: D.space[3],
                          borderRadius: D.radius.sm,
                          background: D.color.surface,
                          border: `1px solid ${D.color.border}`,
                          color: D.color.text,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          display: "flex", flexDirection: "column", gap: 6,
                          transition: `border-color ${D.motion.fast}, transform ${D.motion.fast}`,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = D.color.accentBorder;
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = D.color.border;
                          e.currentTarget.style.transform = "none";
                        }}
                      >
                        {/* Proporção real do formato que o objetivo escolhe:
                            a pessoa vê a forma do que vai sair antes de gerar. */}
                        <span style={{
                          width: "100%",
                          aspectRatio: g.aspect.replace(":", " / "),
                          maxHeight: 78,
                          borderRadius: D.radius.xs,
                          background: `linear-gradient(145deg, ${D.color.raised}, ${D.color.inset})`,
                          border: `1px solid ${D.color.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <g.Icon size={15} color={D.color.text3} />
                        </span>
                        <span style={{
                          fontSize: D.font.size.caption,
                          fontWeight: D.font.weight.medium,
                        }}>
                          {g.label}
                        </span>
                        <span style={{
                          fontSize: D.font.size.label,
                          color: D.color.text3,
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {g.aspect} · {hubCostOf(
                            g.quality === "high" ? "image_high"
                            : g.quality === "low" ? "image_draft"
                            : "image_standard",
                          )} créditos
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <GenerationStage
                  stage={genStage}
                  aspectRatio={aspectRatio}
                  labels={{
                    prep:    stageLabels("prep"),
                    ai:      stageLabels("ai"),
                    compose: stageLabels("compose"),
                    save:    stageLabels("save"),
                  }}
                />
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
                <div className="hub-image-recent" style={{
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
                            loading="lazy" decoding="async"
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

        {/* A faixa "Rápido · Organizado · Consistente · Escalável" saiu:
            era copy de landing page dentro de um app pago. Quem está logado já
            comprou; aquilo ocupava 100px reafirmando uma decisão já tomada,
            com quatro glifos unicode fazendo de ícone. */}
      </div>

      {/* ── Brand modal ──────────────────────────────────────── */}
      {brandModalOpen && (
        <BrandModal
          brands={userBrands}
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

      {/* ── Elements modal ───────────────────────────────────── */}
      {elementsModalOpen && (
        <ElementsModal
          elements={elements}
          selectedIds={selectedElementIds}
          onClose={() => setElementsModalOpen(false)}
          onAdd={addElement}
          onRename={renameElement}
          onDelete={deleteElement}
          onToggle={toggleElementSelection}
          onOpenPngGenerator={() => navigate("/dashboard/hub/png")}
          t={t}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hub-cta:hover:not(:disabled) { background: #2563EB !important; }
        .hub-cta:active:not(:disabled) { background: #1D4ED8 !important; transform: scale(0.97); }
        .hub-elements-link:hover:not(:disabled) { color: #60A5FA !important; }
        .hub-elements-chips::-webkit-scrollbar { height: 6px; }
        .hub-elements-chips::-webkit-scrollbar-track { background: transparent; }
        .hub-elements-chips::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 3px; }
        /* Workspace: 2-col → 1-col abaixo de 1100px (preview vai pra baixo) */
        @media (max-width: 1100px) {
          .hub-image-workspace { grid-template-columns: 1fr !important; }
        }
        /* Format+Quality lado-a-lado quebra abaixo de 1380px porque a form
           column do workspace fica muito estreita pros 6 botões. Stack
           vertical resolve sem quebrar conteúdo. Acima desse breakpoint
           continua side-by-side como no mockup. */
        @media (max-width: 1380px) and (min-width: 1101px) {
          .hub-fmt-row { grid-template-columns: 1fr !important; }
        }
        /* Em mobile (< 1100px workspace já é 1-col) também stack format/quality */
        @media (max-width: 640px) {
          .hub-fmt-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .hub-image-benefits { grid-template-columns: repeat(2, 1fr) !important; }
          /* 4 colunas em 375px dá ~80px por miniatura: a imagem some e o nome
             da marca quebra letra a letra. */
          .hub-image-recent { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Section({ title, subtitle, children, headerRight, style }: {
  title: string; subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 12, marginBottom: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: 14, fontWeight: 800, color: "#fff", margin: 0,
            letterSpacing: "-0.01em",
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "3px 0 0" }}>{subtitle}</p>
          )}
        </div>
        {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
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

// ── SelectedElementChip ─────────────────────────────────────────
// Chip neutro mostrando elemento selecionado: thumbnail + nome + X.
// X remove a seleção (NÃO deleta da biblioteca). Rename só no modal.
function SelectedElementChip({ element, onRemove, disabled }: {
  element: HubElement;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "8px 12px 8px 8px", borderRadius: 10,
      background: "rgba(17,24,39,0.70)",
      border: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: "rgba(0,0,0,0.30)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0,
      }}>
        <img src={element.url} alt={element.name}
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: 600, color: "#fff",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        maxWidth: 140,
      }}>{element.name}</span>
      <button onClick={onRemove} disabled={disabled}
        style={{
          width: 20, height: 20, borderRadius: 5,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#9CA3AF", cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontFamily: "inherit",
        }} title="Remove">
        <X size={11} />
      </button>
    </div>
  );
}

function iconBtnStyle(): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 5,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#9CA3AF", cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
  };
}

// ── ElementsModal ──────────────────────────────────────────────
// Modal floating com upload area + lista de elementos. PNG-only,
// max 2MB. Click pra toggle select. Pencil renomeia inline. Trash
// deleta da biblioteca.
function ElementsModal({
  elements, selectedIds, onClose, onAdd, onRename, onDelete, onToggle,
  onOpenPngGenerator, t,
}: {
  elements: HubElement[];
  selectedIds: string[];
  onClose: () => void;
  onAdd: (file: File) => Promise<{ ok: boolean; error?: string }>;
  onRename: (id: string, newName: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onToggle: (id: string) => void;
  onOpenPngGenerator: () => void;
  t: (key: keyof typeof STR) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  // Estado de upload em andamento — mostra "Subindo X de Y..." durante batch.
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const onFiles = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading({ done: 0, total: list.length });
    let doneCount = 0;
    // Paraleliza uploads — antes era sequencial (cada upload esperava o
    // anterior). Pra 5 PNGs de 2MB isso saiu de ~10-15s pra ~3-5s.
    // Promise.allSettled pra um erro não parar o resto.
    const results = await Promise.allSettled(list.map(async f => {
      const res = await onAdd(f);
      doneCount++;
      setUploading({ done: doneCount, total: list.length });
      if (!res.ok) throw new Error(res.error || t("elementsInvalidErr"));
      return res;
    }));
    setUploading(null);
    // Reporta o primeiro erro (se houver)
    const failed = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) {
      setError((failed.reason as Error)?.message || t("elementsInvalidErr"));
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0a0a0f",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        maxWidth: 580, width: "100%",
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
            {t("elementsModalTitle")}
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

        {/* Body */}
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            style={{
              border: `1.5px dashed ${dragOver ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.12)"}`,
              background: dragOver ? "rgba(59,130,246,0.06)" : "rgba(0,0,0,0.20)",
              borderRadius: 11, padding: "26px 16px",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center", gap: 10,
              cursor: "pointer", transition: "all 0.15s",
            }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(59,130,246,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload size={18} style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{t("elementsUploadCta")}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>{t("elementsAcceptHint")}</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png" multiple
            onChange={e => { if (e.target.files) onFiles(e.target.files); }}
            style={{ display: "none" }} />

          {/* Upload progress — aparece durante batch de uploads */}
          {uploading && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 10,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.25)",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 6,
              }}>
                <span style={{ fontWeight: 600 }}>
                  {t("elementsUploadingN")
                    .replace("{done}", String(uploading.done))
                    .replace("{total}", String(uploading.total))}
                </span>
                <span style={{ fontWeight: 700, color: "#3B82F6" }}>
                  {Math.round((uploading.done / Math.max(1, uploading.total)) * 100)}%
                </span>
              </div>
              <div style={{
                height: 6, borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${(uploading.done / Math.max(1, uploading.total)) * 100}%`,
                  background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
                  borderRadius: 3,
                  transition: "width 0.25s ease",
                }} />
              </div>
            </div>
          )}

          {/* PNG-only error with shortcut to PNG generator */}
          {error && (
            <div style={{
              marginTop: 12, padding: "10px 12px", borderRadius: 10,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)",
              display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
            }}>
              <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: "#fee2e2", margin: 0, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                {error}
              </p>
              <button
                onClick={onOpenPngGenerator}
                style={{
                  padding: "7px 12px", borderRadius: 8,
                  background: "#3B82F6", color: "#fff", border: "none",
                  fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                <Layers size={11} /> {t("elementsOpenPng")}
              </button>
            </div>
          )}

          {/* Library list */}
          {elements.length === 0 ? (
            <div style={{
              marginTop: 18, padding: "20px 16px",
              borderRadius: 11,
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.08)",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, lineHeight: 1.5 }}>
                {t("elementsEmpty")}
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <p style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: "0.10em",
                color: "#9CA3AF", margin: "0 0 8px",
                textTransform: "uppercase",
              }}>
                {t("elementsLibrary")} · {elements.length}
                {selectedIds.length > 0 && (
                  <span style={{ marginLeft: 8, color: "#3B82F6" }}>· {selectedIds.length} {t("elementsSelected")}</span>
                )}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {elements.map(el => {
                  const selected = selectedIds.includes(el.id);
                  const isEditing = editingId === el.id;
                  return (
                    <div key={el.id}
                      onClick={() => { if (!isEditing) onToggle(el.id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 10,
                        background: selected ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.025)",
                        border: `1px solid ${selected ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.06)"}`,
                        cursor: isEditing ? "default" : "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { if (!selected && !isEditing) (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.25)"; }}
                      onMouseLeave={e => { if (!selected && !isEditing) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 8,
                        background: "rgba(0,0,0,0.30)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden", flexShrink: 0,
                      }}>
                        <img src={el.url} alt={el.name}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingDraft}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingDraft(e.target.value.slice(0, 60))}
                            onBlur={() => {
                              const trimmed = editingDraft.trim();
                              if (trimmed && trimmed !== el.name) onRename(el.id, trimmed);
                              setEditingId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                              else if (e.key === "Escape") { setEditingId(null); }
                            }}
                            style={{
                              width: "100%", padding: "4px 8px", borderRadius: 6,
                              background: "rgba(0,0,0,0.40)",
                              border: "1px solid rgba(59,130,246,0.50)",
                              color: "#fff", fontSize: 13, fontWeight: 700,
                              fontFamily: "inherit", outline: "none",
                            }} />
                        ) : (
                          <p style={{
                            fontSize: 13, fontWeight: 700, color: "#fff", margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{el.name}</p>
                        )}
                      </div>
                      {!isEditing && (
                        <>
                          {selected && (
                            <span style={{
                              fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                              color: "#3B82F6",
                              padding: "2px 6px", borderRadius: 5,
                              background: "rgba(59,130,246,0.10)",
                              border: "1px solid rgba(59,130,246,0.25)",
                              flexShrink: 0,
                            }}>✓</span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setEditingDraft(el.name); setEditingId(el.id); }}
                            style={iconBtnStyle()} title={t("elementsRename")}>
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(el.id); }}
                            style={iconBtnStyle()} title={t("elementsDelete")}>
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
