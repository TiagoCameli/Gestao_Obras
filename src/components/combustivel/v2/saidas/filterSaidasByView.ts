import type { SaidaCombustivel } from '../../../../types';
import type { OrigemExterna, SaidasView } from '../filters/types';

function ehTanqueExterno(s: SaidaCombustivel, tanquesExternosSet: Set<string>): boolean {
  return s.origem === 'tanque' && !!s.tanqueId && tanquesExternosSet.has(s.tanqueId);
}

function origemExternaDe(s: SaidaCombustivel, tanquesExternosSet: Set<string>): OrigemExterna | null {
  if (s.origem === 'dinheiro') return 'dinheiro';
  if (s.origem === 'requisicao') return 'requisicao';
  if (ehTanqueExterno(s, tanquesExternosSet)) return 'tanque_externo';
  return null;
}

export function filterSaidasByView(
  saidas: SaidaCombustivel[],
  view: SaidasView,
  origensExterna: OrigemExterna[],
  tanquesExternosSet: Set<string>,
): SaidaCombustivel[] {
  if (view === 'todas') return saidas;
  if (view === 'internas') {
    return saidas.filter(
      (s) => s.origem === 'tanque' && !!s.tanqueId && !tanquesExternosSet.has(s.tanqueId),
    );
  }
  // view === 'externas'
  return saidas.filter((s) => {
    const o = origemExternaDe(s, tanquesExternosSet);
    if (!o) return false;
    if (origensExterna.length === 0) return true;
    return origensExterna.includes(o);
  });
}
