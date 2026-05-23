// Helpers de formatação locais ao módulo Combustível v2.
// Mantidos aqui pra evitar acoplamento com outros módulos — quando
// uniformizar com extratoShared eu consolido.

export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtBRLCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
  return fmtBRL(n);
}

export function fmtL(n: number, dec = 0): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })} L`;
}

export function fmtLCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M L`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k L`;
  return fmtL(n);
}

export function fmtNumDec(n: number, dec: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export function fmtPct(n: number, dec = 1): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
}

const FMT_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Sao_Paulo',
});

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return FMT_DATA.format(d);
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16);
  // pt-BR formato "21/05/26, 11:43" — remover a vírgula
  return FMT_DATA_HORA.format(d).replace(', ', ' ');
}

export function nowAsLocalInputBRT(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function inputLocalBRTtoISOUTC(brtIso: string): string {
  if (!brtIso) return '';
  const completed = brtIso.length === 16 ? brtIso + ':00' : brtIso;
  return new Date(completed + '-03:00').toISOString();
}

export function fmtMesAno(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

/** Range "02/05/2026 – 08/05/2026" — mesmo formato da tabela.
 *  Mantém consistência visual em toda a UI; caso especial: from===to
 *  mostra só uma data. */
export function fmtPeriodo(from: string, to: string): string {
  if (from === to) return fmtData(from);
  return `${fmtData(from)} – ${fmtData(to)}`;
}

/** Iniciais (até 2) — pra avatar circular do operador. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}
