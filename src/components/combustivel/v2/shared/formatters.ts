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

// =============================================================================
// Wall-clock semantics (user-entered timestamps).
// NÃO converte timezone. O horário digitado pelo operador é o horário
// armazenado e exibido para todos os viewers, independente da TZ do device.
// Vale para qualquer coluna user-entered (data, data_hora, etc).
// =============================================================================

const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

/**
 * Formata como DD/MM/YY. Não aplica timezone — extrai a data wall-clock da string.
 * Aceita "YYYY-MM-DD", "YYYY-MM-DDTHH:MM[:SS][offset]", "YYYY-MM-DD HH:MM:SS[offset]".
 */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = iso.match(WALL_CLOCK_RE)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]!.slice(2)}`
}

/**
 * Formata como DD/MM/YY HH:MM. Não aplica timezone — extrai wall-clock direto.
 */
export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = iso.match(WALL_CLOCK_RE)
  if (!m) return iso
  if (!m[4]) return `${m[3]}/${m[2]}/${m[1]!.slice(2)}` // só data
  return `${m[3]}/${m[2]}/${m[1]!.slice(2)} ${m[4]}:${m[5]}`
}

/**
 * Default pra <input type="datetime-local">: clock do device do operador.
 * Retorna "YYYY-MM-DDTHH:MM".
 */
export function nowAsLocalInput(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * Pass-through pra string vinda de <input type="datetime-local"> antes de mandar pro DB.
 * Apenas garante seconds resolution (DB espera HH:MM:SS).
 */
export function inputLocalToWallClock(input: string): string {
  if (!input) return ''
  return input.length === 16 ? input + ':00' : input
}

// =============================================================================
// Auto-set timestamptz (created_at/updated_at — metadata do sistema).
// ÚNICO caso intencional de conversão de TZ: server timestamps precisam ser
// exibidos numa TZ consistente (BR) já que servidor não sabe a TZ do operador.
// Use APENAS para created_at/updated_at, NUNCA para campos user-entered.
// =============================================================================

const FMT_SISTEMA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
  timeZone: 'America/Sao_Paulo',
});

/**
 * Formata timestamptz auto-set como DD/MM/YY HH:MM em horário de Brasília.
 * Para created_at, updated_at, e outros campos gerados server-side.
 * NÃO use para campos user-entered (use fmtDataHora).
 */
export function fmtDataHoraSistema(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  return FMT_SISTEMA.format(d).replace(', ', ' ')
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
