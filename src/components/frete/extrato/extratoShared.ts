// Helpers compartilhados pelas abas especializadas do extrato.
// fmtBRL/fmtData/etc — fonte única evita drift entre abas.

import type { TransportadoraMovimento } from '../../../types';

export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtData(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtNumDec(n: number, dec: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export function fmtMesRef(mesRef: string | null | undefined): string {
  if (!mesRef) return '—';
  const [yy, mm] = mesRef.split('-');
  if (!yy || !mm) return mesRef;
  return `${mm}/${yy}`;
}

/** Lista única de meses disponíveis (YYYY-MM-DD do dia 1) ordenada DESC. */
export function getMesesDisponiveis(movimentos: TransportadoraMovimento[]): string[] {
  const set = new Set<string>();
  for (const m of movimentos) {
    if (m.mesReferencia) set.add(m.mesReferencia);
  }
  return Array.from(set).sort().reverse();
}
