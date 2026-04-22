// ─────────────────────────────────────────────────────────────────────────────
// account_knowledge — typed ontology shared across edge functions
// ─────────────────────────────────────────────────────────────────────────────
// This file is the single source of truth for what goes in the knowledge base.
// Every producer (extract-chat-memory, onboarding, derived crons) and every
// consumer (adbrief-ai-chat context loader, intelligence UI) imports from here.
//
// Rules of the road:
//   - Each type has a STRICT shape. Unknown fields are dropped on write.
//   - Every record has a `slug` for upsert. Singletons always use 'main'.
//   - Every record has a `display_summary` field — one-line human-readable
//     summary of the record. This is what surfaces in the UI and what the AI
//     sees in compact contexts. It's what makes the knowledge "accessible."
//   - Fields use snake_case to match DB conventions.
//   - Locale-agnostic: store values in the user's language, the AI handles
//     translation on display.
// ─────────────────────────────────────────────────────────────────────────────

export type KnowledgeType =
  | "product"
  | "audience"
  | "brand"
  | "playbook"
  | "constraints";

export type KnowledgeSource = "chat" | "onboarding" | "derived" | "manual";

export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  "product",
  "audience",
  "brand",
  "playbook",
  "constraints",
];

// Singleton types only ever have one row per persona (slug = 'main').
export const SINGLETON_TYPES: KnowledgeType[] = ["brand", "playbook", "constraints"];
export const isSingleton = (t: KnowledgeType) => SINGLETON_TYPES.includes(t);

// ─────────────────────────────────────────────────────────────────────────────
// SHAPES — one per knowledge_type
// Every shape has:
//   slug: stable id inside the type
//   display_summary: one-line human-readable summary (UI + compact AI context)
//   Everything else: type-specific structured fields
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductKnowledge {
  slug: string;                          // e.g. "fiesta-2020"
  display_summary: string;               // "Ford Fiesta 2020 a R$38k — usado, baixa quilometragem"
  name: string;
  category?: string;                     // "automotivo/semi-novo", "fitness/infoproduto"
  price?: number;                        // ticket médio em moeda da conta
  price_range?: [number, number];        // [min, max]
  currency?: string;                     // "BRL" | "USD" | ...
  margin_pct?: number;                   // 12 = 12%
  usp?: string;                          // unique selling point
  objections?: string[];                 // known customer objections
  key_benefits?: string[];
  last_mentioned?: string;               // ISO date of last mention in chat
  notes?: string;                        // catch-all for anything unstructured
}

export interface AudienceKnowledge {
  slug: string;                          // e.g. "comprador-cpf-sp"
  display_summary: string;
  name: string;
  demographics?: {
    age_range?: [number, number];
    gender?: string;
    income_range?: string;               // "R$5-15k/mês"
    location?: string;
    education?: string;
  };
  psychographics?: string[];             // values, traits
  pain_points?: string[];
  buying_triggers?: string[];
  funnel_stage?: "cold" | "awareness" | "consideration" | "decision" | "retention";
  notes?: string;
}

export interface BrandKnowledge {
  slug: "main";                          // always main — brand is per-persona singleton
  display_summary: string;
  tone?: string;                         // "confiante e acessível, sem gíria"
  voice?: string;                        // "consultivo, direto"
  forbidden_words?: string[];
  forbidden_angles?: string[];
  compliance_flags?: string[];           // e.g. ["health_niche_language", "ymyl"]
  key_messages?: string[];
  brand_colors?: string[];
  visual_style?: string;
  notes?: string;
}

export interface PlaybookRule {
  trigger: string;                       // "CPA > 2x meta por 3 dias"
  action: string;                        // "pause" | "scale +30%" | ...
  rationale?: string;                    // why this rule exists, in user's words
  confidence?: number;                   // 0-1
}

export interface PlaybookKnowledge {
  slug: "main";
  display_summary: string;
  rules: PlaybookRule[];
  preferred_formats?: string[];          // ["reels","carrossel"]
  preferred_placements?: string[];       // ["feed","stories","reels"]
  winning_angles?: string[];             // learned high-level angles
  losing_angles?: string[];
  notes?: string;
}

export interface ConstraintsKnowledge {
  slug: "main";
  display_summary: string;
  monthly_budget_cap?: number;           // currency = account currency
  daily_floor?: number;
  daily_ceiling?: number;
  target_cpa?: number;
  target_roas?: number;
  max_cpa?: number;                      // hard ceiling — kill above this
  min_roas?: number;                     // hard floor — kill below this
  blocked_platforms?: string[];          // ["google"] to exclude
  working_hours?: string;                // "business hours" | "24/7"
  notes?: string;
}

export type KnowledgeData =
  | ProductKnowledge
  | AudienceKnowledge
  | BrandKnowledge
  | PlaybookKnowledge
  | ConstraintsKnowledge;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — runs before every insert/upsert, drops unknown fields,
// rejects records that don't meet the minimum bar for the type.
// Principle: reject garbage loudly, never write half-broken rows.
// ─────────────────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "main";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function trimStr(v: unknown, max = 500): string | undefined {
  if (!isNonEmptyString(v)) return undefined;
  return v.trim().slice(0, max);
}

function asStringArray(v: unknown, max = 10, itemMax = 200): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === "string" ? x.trim().slice(0, itemMax) : null))
    .filter((x): x is string => !!x && x.length > 0)
    .slice(0, max);
  return out.length ? out : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.,-]/g, "").replace(",", "."));
    if (isFinite(n)) return n;
  }
  return undefined;
}

function asRange(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const a = asNumber(v[0]);
  const b = asNumber(v[1]);
  if (a === undefined || b === undefined) return undefined;
  return a <= b ? [a, b] : [b, a];
}

export interface NormalizedKnowledge {
  knowledge_type: KnowledgeType;
  slug: string;
  data: Record<string, unknown>;
  valid: boolean;
  reason?: string;
}

/**
 * Normalize + validate a raw knowledge payload. Returns {valid:false, reason}
 * if the record is too weak to persist. On success, returns a sanitized copy
 * that is safe to pass to the DB.
 */
export function normalizeKnowledge(
  knowledge_type: KnowledgeType,
  raw: Record<string, unknown>,
): NormalizedKnowledge {
  if (!KNOWLEDGE_TYPES.includes(knowledge_type)) {
    return { knowledge_type, slug: "main", data: {}, valid: false, reason: "unknown_type" };
  }

  // Force slug for singletons, sanitize for multi.
  let slug: string;
  if (isSingleton(knowledge_type)) {
    slug = "main";
  } else {
    const rawSlug = typeof raw.slug === "string" ? raw.slug : "";
    slug = rawSlug && SLUG_RE.test(rawSlug)
      ? rawSlug
      : slugify(rawSlug || String(raw.name || "item"));
    if (!SLUG_RE.test(slug)) slug = slugify(String(raw.name || "item"));
  }

  switch (knowledge_type) {
    case "product": {
      const name = trimStr(raw.name, 200);
      const display_summary = trimStr(raw.display_summary, 280);
      if (!name && !display_summary) {
        return { knowledge_type, slug, data: {}, valid: false, reason: "product_needs_name_or_summary" };
      }
      const data: ProductKnowledge = {
        slug,
        display_summary: display_summary || name || "Produto",
        name: name || "Produto",
        category: trimStr(raw.category, 80),
        price: asNumber(raw.price),
        price_range: asRange(raw.price_range),
        currency: trimStr(raw.currency, 10)?.toUpperCase(),
        margin_pct: asNumber(raw.margin_pct),
        usp: trimStr(raw.usp, 300),
        objections: asStringArray(raw.objections, 8, 200),
        key_benefits: asStringArray(raw.key_benefits, 8, 200),
        last_mentioned: trimStr(raw.last_mentioned, 20),
        notes: trimStr(raw.notes, 500),
      };
      return { knowledge_type, slug, data: stripUndefined(data), valid: true };
    }

    case "audience": {
      const name = trimStr(raw.name, 200);
      const display_summary = trimStr(raw.display_summary, 280);
      if (!name && !display_summary) {
        return { knowledge_type, slug, data: {}, valid: false, reason: "audience_needs_name_or_summary" };
      }
      const rawDemo = (raw.demographics || {}) as Record<string, unknown>;
      const demographics = {
        age_range: asRange(rawDemo.age_range),
        gender: trimStr(rawDemo.gender, 40),
        income_range: trimStr(rawDemo.income_range, 60),
        location: trimStr(rawDemo.location, 120),
        education: trimStr(rawDemo.education, 80),
      };
      const cleanedDemo = stripUndefined(demographics);
      const funnel = trimStr(raw.funnel_stage, 20);
      const funnel_stage = (["cold","awareness","consideration","decision","retention"].includes(funnel || "")
        ? (funnel as AudienceKnowledge["funnel_stage"])
        : undefined);
      const data: AudienceKnowledge = {
        slug,
        display_summary: display_summary || name || "Público",
        name: name || "Público",
        demographics: Object.keys(cleanedDemo).length ? cleanedDemo : undefined,
        psychographics: asStringArray(raw.psychographics, 10, 200),
        pain_points: asStringArray(raw.pain_points, 10, 300),
        buying_triggers: asStringArray(raw.buying_triggers, 8, 200),
        funnel_stage,
        notes: trimStr(raw.notes, 500),
      };
      return { knowledge_type, slug: "main" === slug && !isSingleton(knowledge_type) ? slug : slug, data: stripUndefined(data), valid: true };
    }

    case "brand": {
      const display_summary = trimStr(raw.display_summary, 280);
      const hasAnyField =
        display_summary ||
        trimStr(raw.tone) ||
        trimStr(raw.voice) ||
        asStringArray(raw.forbidden_words) ||
        asStringArray(raw.forbidden_angles) ||
        asStringArray(raw.key_messages);
      if (!hasAnyField) {
        return { knowledge_type, slug: "main", data: {}, valid: false, reason: "brand_needs_any_field" };
      }
      const data: BrandKnowledge = {
        slug: "main",
        display_summary: display_summary || "Diretrizes de marca",
        tone: trimStr(raw.tone, 200),
        voice: trimStr(raw.voice, 200),
        forbidden_words: asStringArray(raw.forbidden_words, 20, 60),
        forbidden_angles: asStringArray(raw.forbidden_angles, 10, 200),
        compliance_flags: asStringArray(raw.compliance_flags, 10, 60),
        key_messages: asStringArray(raw.key_messages, 8, 200),
        brand_colors: asStringArray(raw.brand_colors, 10, 30),
        visual_style: trimStr(raw.visual_style, 200),
        notes: trimStr(raw.notes, 500),
      };
      return { knowledge_type, slug: "main", data: stripUndefined(data), valid: true };
    }

    case "playbook": {
      const display_summary = trimStr(raw.display_summary, 280);
      const rawRules = Array.isArray(raw.rules) ? raw.rules : [];
      const rules: PlaybookRule[] = rawRules
        .map((r: any) => {
          const trigger = trimStr(r?.trigger, 250);
          const action = trimStr(r?.action, 150);
          if (!trigger || !action) return null;
          return {
            trigger,
            action,
            rationale: trimStr(r?.rationale, 300),
            confidence: (() => {
              const c = asNumber(r?.confidence);
              return c !== undefined ? Math.max(0, Math.min(1, c)) : undefined;
            })(),
          };
        })
        .filter((x): x is PlaybookRule => !!x)
        .slice(0, 20);

      const hasContent =
        rules.length ||
        asStringArray(raw.preferred_formats) ||
        asStringArray(raw.winning_angles) ||
        asStringArray(raw.losing_angles) ||
        display_summary;
      if (!hasContent) {
        return { knowledge_type, slug: "main", data: {}, valid: false, reason: "playbook_empty" };
      }

      const data: PlaybookKnowledge = {
        slug: "main",
        display_summary: display_summary || `Playbook (${rules.length} ${rules.length === 1 ? "regra" : "regras"})`,
        rules,
        preferred_formats: asStringArray(raw.preferred_formats, 8, 40),
        preferred_placements: asStringArray(raw.preferred_placements, 8, 40),
        winning_angles: asStringArray(raw.winning_angles, 10, 200),
        losing_angles: asStringArray(raw.losing_angles, 10, 200),
        notes: trimStr(raw.notes, 500),
      };
      return { knowledge_type, slug: "main", data: stripUndefined(data), valid: true };
    }

    case "constraints": {
      const display_summary = trimStr(raw.display_summary, 280);
      const fields = {
        monthly_budget_cap: asNumber(raw.monthly_budget_cap),
        daily_floor: asNumber(raw.daily_floor),
        daily_ceiling: asNumber(raw.daily_ceiling),
        target_cpa: asNumber(raw.target_cpa),
        target_roas: asNumber(raw.target_roas),
        max_cpa: asNumber(raw.max_cpa),
        min_roas: asNumber(raw.min_roas),
        blocked_platforms: asStringArray(raw.blocked_platforms, 5, 40),
        working_hours: trimStr(raw.working_hours, 60),
        notes: trimStr(raw.notes, 500),
      };
      const anyField = Object.values(fields).some((v) => v !== undefined);
      if (!anyField && !display_summary) {
        return { knowledge_type, slug: "main", data: {}, valid: false, reason: "constraints_empty" };
      }
      const data: ConstraintsKnowledge = {
        slug: "main",
        display_summary: display_summary || buildConstraintsSummary(fields),
        ...fields,
      };
      return { knowledge_type, slug: "main", data: stripUndefined(data), valid: true };
    }
  }
}

function buildConstraintsSummary(f: {
  monthly_budget_cap?: number;
  target_cpa?: number;
  target_roas?: number;
}): string {
  const parts: string[] = [];
  if (f.monthly_budget_cap !== undefined) parts.push(`budget R$${Math.round(f.monthly_budget_cap)}/mês`);
  if (f.target_cpa !== undefined) parts.push(`CPA meta R$${Math.round(f.target_cpa)}`);
  if (f.target_roas !== undefined) parts.push(`ROAS meta ${f.target_roas.toFixed(1)}x`);
  return parts.length ? parts.join(" · ") : "Limites operacionais";
}

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MERGE — patch an existing record with new fields. Used when the extractor
// wants to ADD info without overwriting existing fields. Arrays are unioned
// (dedup), scalars replaced only when non-undefined. display_summary is always
// re-derived from the final merged state if the caller didn't provide one.
// ─────────────────────────────────────────────────────────────────────────────

export function mergeKnowledge(
  knowledge_type: KnowledgeType,
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };

  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      const prev = Array.isArray(merged[k]) ? (merged[k] as unknown[]) : [];
      const union = [...prev, ...v];
      // Dedup strings case-insensitively; keep first occurrence order.
      const seen = new Set<string>();
      const deduped = union.filter((x) => {
        if (typeof x !== "string") return true;
        const key = x.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      merged[k] = deduped;
    } else if (typeof v === "object") {
      merged[k] = { ...((merged[k] as object) || {}), ...(v as object) };
    } else {
      merged[k] = v;
    }
  }

  return merged;
}
