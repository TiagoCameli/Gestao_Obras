/** Parseia km no formato "620", "620.5", "620,5" ou "620+500" (estaca+fração). Retorna null se inválido. */
export function parseKm(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const plusMatch = s.match(/^(\d+)\+(\d{1,3})$/);
  if (plusMatch) {
    const estaca = parseInt(plusMatch[1], 10);
    const fracao = parseInt(plusMatch[2], 10);
    if (!Number.isFinite(estaca) || !Number.isFinite(fracao)) return null;
    return estaca + fracao / 1000;
  }
  const cleaned = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parseia "620-635", "620–635", "620,1-635,5", "KM 620 a 635". Erro se kmFinal ≤ kmInicial. */
export function parseTrecho(input: string): { kmInicial: number; kmFinal: number } | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const matches = s.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const kmInicial = parseFloat(matches[0].replace(",", "."));
  const kmFinal = parseFloat(matches[1].replace(",", "."));
  if (!Number.isFinite(kmInicial) || !Number.isFinite(kmFinal)) return null;
  if (kmFinal <= kmInicial) return null;
  return { kmInicial, kmFinal };
}

/**
 * Parseia data em "dd/mm/aaaa", "dd-mm-aaaa" ou "aaaa-mm-dd". Retorna ISO
 * "yyyy-mm-dd" (wall-clock, sem TZ). Null se inválido.
 */
export function parseData(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let day: number, month: number, year: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    year = parseInt(iso[1], 10);
    month = parseInt(iso[2], 10);
    day = parseInt(iso[3], 10);
  } else {
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!br) return null;
    day = parseInt(br[1], 10);
    month = parseInt(br[2], 10);
    year = parseInt(br[3], 10);
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCDate() !== day || dt.getUTCMonth() !== month - 1) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

