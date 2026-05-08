// Estatística simples — média, desvio-padrão, série de sparkline.
// Sem dependência externa, performance OK pra <10k pontos.

export function media(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

export function desvioPadrao(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = media(arr);
  let acc = 0;
  for (const x of arr) acc += (x - m) ** 2;
  return Math.sqrt(acc / (arr.length - 1));
}

/** Retorna trend: ((atual - anterior) / anterior) * 100. */
export function pctChange(atual: number, anterior: number): number {
  if (anterior === 0) return atual === 0 ? 0 : 100;
  return ((atual - anterior) / anterior) * 100;
}

/** Bucketização por dia em ISO YYYY-MM-DD — preserva 0 para dias sem dado.
 *  Útil pra sparkline contínua e pra G1 evolução. */
export function bucketByDia<T>(
  items: T[],
  pickDate: (x: T) => string,
  pickValue: (x: T) => number,
  from: string,
  to: string,
): { data: string; valor: number }[] {
  const acc = new Map<string, number>();
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const it of items) {
    const raw = pickDate(it);
    // pickDate pode retornar 'YYYY-MM-DD' (10 chars) — usa direto.
    // Caso contrário (timestamptz ISO), parseia e extrai data LOCAL —
    // slice(0,10) do UTC desloca o dia em fusos UTC-3/UTC-5.
    let d: string;
    if (raw.length === 10) {
      d = raw;
    } else {
      const dt = new Date(raw);
      d = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
    if (d < from || d > to) continue;
    acc.set(d, (acc.get(d) ?? 0) + pickValue(it));
  }
  // Preenche dias zerados pra série ficar contínua. Extração local —
  // toISOString() retorna UTC e em fuso UTC-3/UTC-5 desloca o bucket
  // do dia errado (ex: 2026-05-07 23:00 BRT vira 2026-05-08 02:00 UTC).
  const out: { data: string; valor: number }[] = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end) {
    const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    out.push({ data: iso, valor: acc.get(iso) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Dia da semana 0=Dom..6=Sáb da string ISO. */
export function diaSemana(iso: string): number {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.getDay();
}

/** Hora 0-23 da string ISO timestamptz. */
export function horaDoDia(iso: string): number {
  const d = new Date(iso);
  return d.getHours();
}

/** Calcula um upper bound "redondo" de eixo a partir de um max real.
 *  Garante folga visual (~10–25%) e número de fim agradável (50, 100,
 *  500, 1000, etc). Inspirado em d3.scaleLinear.nice() simplificado.
 *  niceMax(200) → 250; niceMax(8470) → 10_000; niceMax(0) → 1. */
export function niceMax(value: number): number {
  if (!isFinite(value) || value <= 0) return 1;
  const padded = value * 1.1;
  const exp = Math.floor(Math.log10(padded));
  const base = 10 ** exp;
  const rel = padded / base;
  // Steps "redondos" 1, 2, 2.5, 5, 10
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) {
    if (rel <= s) return s * base;
  }
  return 10 * base;
}
