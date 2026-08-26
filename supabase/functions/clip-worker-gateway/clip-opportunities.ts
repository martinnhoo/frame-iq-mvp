export type ClipOpportunity = Record<string, unknown> & {
  start_seconds: number;
  end_seconds: number;
  score: number;
};

type ClipAccount = {
  id: string;
  label?: string;
  niche?: string;
  active?: boolean;
  rules?: Record<string, unknown> | null;
};

const TEMPORAL_DEDUPE_PADDING_SECONDS = 5;

export function hasTemporalConflict(
  a: Pick<ClipOpportunity, "start_seconds" | "end_seconds">,
  b: Pick<ClipOpportunity, "start_seconds" | "end_seconds">,
) {
  return a.start_seconds < b.end_seconds + TEMPORAL_DEDUPE_PADDING_SECONDS &&
    a.end_seconds > b.start_seconds - TEMPORAL_DEDUPE_PADDING_SECONDS;
}

export function selectDistinctOpportunities(
  rawCandidates: Record<string, unknown>[],
  duration?: number,
  target = 10,
): ClipOpportunity[] {
  const valid = rawCandidates
    .map((candidate) => ({
      ...candidate,
      start_seconds: Number(candidate.start_seconds),
      end_seconds: Number(candidate.end_seconds),
      score: Number(candidate.score) || 0,
    }))
    .filter((candidate) => Number.isFinite(candidate.start_seconds) && Number.isFinite(candidate.end_seconds))
    .filter((candidate) => candidate.end_seconds - candidate.start_seconds >= 5 && candidate.end_seconds - candidate.start_seconds <= 90)
    .filter((candidate) => candidate.start_seconds >= 0 && candidate.end_seconds <= (duration || Infinity) + 2)
    .sort((a, b) => b.score - a.score);

  const distinct: ClipOpportunity[] = [];
  for (const candidate of valid) {
    if (distinct.some((selected) => hasTemporalConflict(candidate, selected))) continue;
    distinct.push(candidate);
  }

  if (distinct.length <= target) return distinct;

  const effectiveDuration = duration && duration > 0
    ? duration
    : Math.max(...distinct.map((candidate) => candidate.end_seconds));
  const bucketSize = Math.max(1, effectiveDuration / target);
  const bucketWinners = new Map<number, ClipOpportunity>();
  for (const candidate of distinct) {
    const midpoint = (candidate.start_seconds + candidate.end_seconds) / 2;
    const bucket = Math.min(target - 1, Math.floor(midpoint / bucketSize));
    if (!bucketWinners.has(bucket)) bucketWinners.set(bucket, candidate);
  }

  const selected = [...bucketWinners.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, target);
  const selectedSet = new Set(selected);
  for (const candidate of distinct) {
    if (selected.length >= target) break;
    if (!selectedSet.has(candidate)) selected.push(candidate);
  }
  return selected.sort((a, b) => b.score - a.score);
}

export function chooseFallbackAccount<T extends ClipAccount>(accounts: T[]): T {
  const candidates = accounts.filter((account) => account.active !== false);
  if (!candidates.length) throw new Error("Nenhuma conta editorial ativa disponível para fallback");

  const explicit = candidates.find((account) => account.rules?.fallback === true || account.rules?.general === true);
  const general = candidates.find((account) => /\b(geral|general)\b/i.test(`${account.label || ""} ${account.niche || ""}`));
  return explicit || general || candidates[0];
}