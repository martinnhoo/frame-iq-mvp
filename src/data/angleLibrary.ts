/**
 * angleLibrary — biblioteca de angles estratégicos pro Angle Distribution Engine.
 *
 * Cada angle tem:
 *   - id: chave estável (vai pro DB como _angle_id)
 *   - label: nome amigável pro UI
 *   - category: agrupamento (rational, emotional, social, etc.)
 *   - prompt_prefix: bloco de instruções injetado no prompt da imagem
 *     ANTES do user prompt. Deve ser autossuficiente — não inventa números,
 *     produtos ou ofertas, só direção criativa.
 *   - intent: por que esse angle existe (1 linha pra UI/Library)
 *   - safety: "safe" (escalável), "moderate", "experimental"
 *
 * IMPORTANTE: angles NÃO inventam conteúdo do anúncio. Eles direcionam
 * COMO o conteúdo é apresentado (composição, emoção, hierarquia, hook).
 * O prompt do usuário continua sendo a fonte da verdade da OFERTA.
 *
 * Distribuição padrão (70/20/10) sugerida pelo spec:
 *   - 70% safe (rational, social_proof, authority, direct)
 *   - 20% moderate (emotional, curiosity, urgency, beginner)
 *   - 10% experimental (meme, chaotic, ui_overlay, asymmetric)
 *
 * Uso:
 *   import { ANGLE_LIBRARY, pickAngles } from "@/data/angleLibrary";
 *   const angles = pickAngles(10, "balanced"); // 7 safe + 2 mod + 1 exp
 */

export type AngleSafety = "safe" | "moderate" | "experimental";
export type AngleCategory =
  | "rational"        // direct response, claro, focado em proof
  | "emotional"       // emoção, reação humana, vibe
  | "social"          // social proof, depoimento, ratings
  | "authority"       // expert, premium, authoritative tone
  | "curiosity"       // gera dúvida, força clique
  | "urgency"         // FOMO, scarcity, deadline
  | "educational"     // teach, explain, beginner-friendly
  | "experimental";   // meme, chaotic, UI-native, unexpected

export interface CreativeAngle {
  id: string;
  label: string;
  category: AngleCategory;
  safety: AngleSafety;
  intent: string;            // 1 linha pra UI / Library
  prompt_prefix: string;     // injetado ANTES do user prompt
}

export const ANGLE_LIBRARY: CreativeAngle[] = [
  // ── SAFE / SCALABLE (rational, direct, proof) ──────────────────────
  {
    id: "direct_offer",
    label: "Oferta Direta",
    category: "rational",
    safety: "safe",
    intent: "CTA gigante + proof simples — escala bem em todos os públicos",
    prompt_prefix: "CREATIVE ANGLE: Direct response. Center the offer + CTA as the dominant visual element. Clear hierarchy: hook on top, offer in the middle (largest typography), CTA at the bottom. Minimal distractions. High contrast. Safe scalable layout.",
  },
  {
    id: "before_after",
    label: "Antes / Depois",
    category: "rational",
    safety: "safe",
    intent: "Split visual mostrando estado A vs estado B — clássico de conversão",
    prompt_prefix: "CREATIVE ANGLE: Before/After split. Vertical or horizontal split frame. Left/top = problem state (muted, gray, low-energy). Right/bottom = solution state (vibrant, confident, energized). Same subject in both halves when applicable. Minimal text overlay.",
  },
  {
    id: "social_proof",
    label: "Social Proof",
    category: "social",
    safety: "safe",
    intent: "Stars + número de usuários + depoimento — reduz fricção de risco",
    prompt_prefix: "CREATIVE ANGLE: Social proof first. Foreground = stars rating + customer count badge + quote-style testimonial. Visual must feel like screenshots of real reviews. Avoid stock-photo aesthetic.",
  },
  {
    id: "authority_premium",
    label: "Autoridade Premium",
    category: "authority",
    safety: "safe",
    intent: "Visual luxury, dark mode, gold accents — alvo high-ticket",
    prompt_prefix: "CREATIVE ANGLE: Premium authority. Dark background. Gold or platinum accents. Centered hierarchy. Generous whitespace. Serif or geometric sans typography. Cinematic lighting on subject. Conveys exclusivity without saying 'exclusive'.",
  },
  {
    id: "comparison_us_vs",
    label: "Comparação",
    category: "rational",
    safety: "safe",
    intent: "Tabela visual brand vs concorrente — racional, alta conversão B2B",
    prompt_prefix: "CREATIVE ANGLE: Direct comparison layout. Two-column visual: left = competitor (muted, X marks), right = brand (highlighted, check marks). Honest framing — only compare on dimensions where the brand actually wins.",
  },
  {
    id: "feature_zoom",
    label: "Feature Zoom",
    category: "rational",
    safety: "safe",
    intent: "Macro close-up de UI/produto + label apontando — perfeito pra app",
    prompt_prefix: "CREATIVE ANGLE: Feature highlight. Extreme close-up or macro shot of the product/UI. Annotation labels with thin lines pointing to key elements. iPhone screenshot aesthetic when applicable. Crisp, technical, confident.",
  },

  // ── MODERATE (emotional, curiosity, urgency, beginner) ─────────────
  {
    id: "emotional_reaction",
    label: "Reação Emocional",
    category: "emotional",
    safety: "moderate",
    intent: "Close-up facial de surpresa/alegria — para scroll com emoção",
    prompt_prefix: "CREATIVE ANGLE: Emotional reaction. Close-up of a person's face showing genuine surprise, joy, or relief. Slight imperfect framing (smartphone camera feel). Natural skin tones. Eyes engage the viewer. Minimal copy — let the face do the talking.",
  },
  {
    id: "curiosity_gap",
    label: "Curiosity Gap",
    category: "curiosity",
    safety: "moderate",
    intent: "Pergunta provocativa + visual incompleto — força clique",
    prompt_prefix: "CREATIVE ANGLE: Curiosity gap. Provocative question or incomplete statement as the hook. Visual partially obscured (cropped, blurred edges, thumbnail-style mystery). Forces the viewer to click to resolve the gap. No spoilers.",
  },
  {
    id: "urgency_scarcity",
    label: "Urgência / Escassez",
    category: "urgency",
    safety: "moderate",
    intent: "Countdown, 'últimas 24h', 'só hoje' — pressão temporal",
    prompt_prefix: "CREATIVE ANGLE: Urgency/scarcity. Visible time pressure element (countdown, calendar, expiring badge). Aggressive typography for time markers. Red/orange accents for urgency. Subject framed as taking action NOW.",
  },
  {
    id: "beginner_friendly",
    label: "Beginner-Friendly",
    category: "educational",
    safety: "moderate",
    intent: "'Pra quem nunca fez X' — alvo top-funnel cold",
    prompt_prefix: "CREATIVE ANGLE: Beginner-friendly. Reassuring tone. Simple shapes, friendly colors (light pastels OR confident primary colors). Subject = approachable, smiling, ordinary. Hook addresses the beginner directly: 'Pra quem nunca...', 'Sem experiência'.",
  },
  {
    id: "fomo_aspirational",
    label: "FOMO Aspiracional",
    category: "emotional",
    safety: "moderate",
    intent: "Lifestyle inveja — 'enquanto você...' subtexto",
    prompt_prefix: "CREATIVE ANGLE: Aspirational FOMO. Lifestyle shot of someone living the upgraded outcome (better car, better lifestyle, freedom). Slight envy-inducing framing. Hook implies viewer is missing out without saying it directly.",
  },

  // ── EXPERIMENTAL (meme, chaotic, UI-native, unexpected) ────────────
  {
    id: "meme_native",
    label: "Meme Native",
    category: "experimental",
    safety: "experimental",
    intent: "Format de meme — alta CTR, short LTV, queima rápido",
    prompt_prefix: "CREATIVE ANGLE: Meme-native. Low-polish aesthetic. Impact font with white-and-black outline OR subtitled meme template. Slightly oversaturated. Visual hierarchy ignores 'rules' — caption and visual fight for attention. Short shelf life.",
  },
  {
    id: "fake_screenshot",
    label: "Fake Screenshot",
    category: "experimental",
    safety: "experimental",
    intent: "Mock de notificação, DM, push — parece UGC",
    prompt_prefix: "CREATIVE ANGLE: Native UI mock. Looks like an iOS/Android push notification, DM thread, or in-app screen capture. Authentic platform fonts (SF Pro, Roboto). Slight overlay shadows. Avoid making it look like an ad — make it look like a screenshot somebody shared.",
  },
  {
    id: "chaotic_typography",
    label: "Tipografia Caótica",
    category: "experimental",
    safety: "experimental",
    intent: "Texto enorme, assimétrico, números gigantes — interrupt pattern",
    prompt_prefix: "CREATIVE ANGLE: Typography chaos. Numbers/keywords sized enormously (50%+ of frame). Asymmetric placement. Mixed weights (bold + thin). Negative space used intentionally. Visual energy must interrupt feed scroll. Not 'pretty' — disruptive.",
  },
  {
    id: "creator_pov",
    label: "Creator POV",
    category: "experimental",
    safety: "experimental",
    intent: "Selfie style, talking head, baixa polish — engaja Gen Z",
    prompt_prefix: "CREATIVE ANGLE: Creator POV. First-person selfie or talking-head shot. Vertical 9:16 framing. Natural ring-light or window light. Subject talks directly to camera. Caption overlay = subtitle style (TikTok-native). Imperfect. Authentic.",
  },
  {
    id: "split_chaos",
    label: "Split Chaos",
    category: "experimental",
    safety: "experimental",
    intent: "Multi-painel sobreposto — força olho a buscar foco",
    prompt_prefix: "CREATIVE ANGLE: Multi-panel chaos. 3-6 visual elements overlapping or in irregular grid. Each panel = different angle of the offer. Eye must work to find the focal point. Color-coded panels for hierarchy. Inspired by collage / zine aesthetic.",
  },
];

// Categoria → angles
export function anglesByCategory(category: AngleCategory): CreativeAngle[] {
  return ANGLE_LIBRARY.filter(a => a.category === category);
}

// Safety → angles
export function anglesBySafety(safety: AngleSafety): CreativeAngle[] {
  return ANGLE_LIBRARY.filter(a => a.safety === safety);
}

// Pick by id
export function getAngle(id: string): CreativeAngle | null {
  return ANGLE_LIBRARY.find(a => a.id === id) || null;
}

// Distribuição balanceada — 70% safe, 20% moderate, 10% experimental.
// Exemplo: pickAngles(10) → 7 safe + 2 moderate + 1 experimental.
//
// Modo "all": ignora distribuição, devolve N angles spread por categoria.
//
// Random shuffle para evitar repetir os mesmos angles em runs sequenciais.
export function pickAngles(
  n: number,
  mode: "balanced" | "all" | "safe-only" | "experimental-only" = "balanced",
): CreativeAngle[] {
  const safe = shuffle(anglesBySafety("safe"));
  const moderate = shuffle(anglesBySafety("moderate"));
  const experimental = shuffle(anglesBySafety("experimental"));

  if (mode === "safe-only") return safe.slice(0, n);
  if (mode === "experimental-only") return experimental.slice(0, n);
  if (mode === "all") {
    return shuffle([...safe, ...moderate, ...experimental]).slice(0, n);
  }

  // Balanced 70/20/10
  const safeCount = Math.max(1, Math.round(n * 0.7));
  const modCount = Math.max(0, Math.round(n * 0.2));
  const expCount = Math.max(0, n - safeCount - modCount);
  return [
    ...safe.slice(0, safeCount),
    ...moderate.slice(0, modCount),
    ...experimental.slice(0, expCount),
  ].slice(0, n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
