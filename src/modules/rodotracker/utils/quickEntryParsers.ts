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
