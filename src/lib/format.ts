/**
 * Format money value in centavos to Brazilian Real string
 * - Dot separator for thousands
 * - No decimals for amounts >= R$100
 * - 2 decimals for amounts < R$100
 */
export function formatMoney(centavos: number): string {
  const reais = centavos / 100;
  const isNegative = reais < 0;
  const absoluteValue = Math.abs(reais);

  let formatted: string;

  if (absoluteValue >= 100) {
    // No decimals for >= R$100
    formatted = Math.round(absoluteValue).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } else {
    // 2 decimals for < R$100
    formatted = absoluteValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const prefix = isNegative ? '-' : '';
  return `${prefix}R$${formatted}`;
}

/**
 * Format percentage value
 * e.g., 6.7 -> "6.7%"
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format change value with sign
 * e.g., 133 -> "+133%", -56 -> "-56%"
 */
export function formatChange(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

/**
 * Format ROAS (Return on Ad Spend) with "x" suffix
 * e.g., 4.2 -> "4.2x"
 */
export function formatROAS(value: number): string {
  return `${value.toFixed(1)}x`;
}

/**
 * Format date string to "há X min/h/dia" format
 * Portuguese relative time format
 */
export function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'há alguns segundos';
  } else if (diffMins < 60) {
    return `há ${diffMins} ${diffMins === 1 ? 'min' : 'min'}`;
  } else if (diffHours < 24) {
    return `há ${diffHours}${diffHours === 1 ? 'h' : 'h'}`;
  } else if (diffDays < 7) {
    return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
  }
}
