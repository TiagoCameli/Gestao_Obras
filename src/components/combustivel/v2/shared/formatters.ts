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

export function fmtData(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtDataHora(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
