/* Pure display helpers. Ported verbatim in behaviour from Web/dist/data.js so
   the Next.js build formats numbers identically to the static site. */

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 1234567 -> "1.23M". Small values keep 4 decimals. */
export function compact(value: unknown): string {
  const number = Number(value) || 0;
  if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(1)}K`;
  return number.toFixed(number >= 1 ? 2 : 4);
}

/** Price text that keeps ~4 significant digits for sub-cent meme prices. */
export function priceText(raw: unknown): string {
  const number = Number(raw);
  if (!Number.isFinite(number)) return '—';
  if (number >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (number >= 1) return number.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (number === 0) return '0';
  const digits = Math.max(2, Math.ceil(-Math.log10(number)) + 3);
  return number.toFixed(Math.min(digits, 12)).replace(/0+$/, '').replace(/\.$/, '');
}

export function ageMinutes(pairCreatedAt: number | undefined, now = Date.now()): number | null {
  if (!pairCreatedAt) return null;
  return Math.max(1, Math.round((now - pairCreatedAt) / 60000));
}

export function ageText(minutes: number | null): string {
  if (minutes == null) return 'Established';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

/** Stable pastel colour derived from a symbol, so avatars never flicker. */
export function colorFor(text: unknown): string {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 64%)`;
}

export const shortAddress = (address: string): string =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
