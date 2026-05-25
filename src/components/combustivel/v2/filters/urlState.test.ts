import { describe, it, expect } from 'vitest';
import {
  defaultFilterState,
  fromSearchParams,
  hasActiveFilters,
  toSearchParams,
} from './urlState';

describe('urlState — saidasView + origensExterna', () => {
  it('default state tem saidasView=todas e origensExterna=[]', () => {
    const s = defaultFilterState();
    expect(s.saidasView).toBe('todas');
    expect(s.origensExterna).toEqual([]);
  });

  it('parse de ?sview=externas&sextorigens=dinheiro,requisicao', () => {
    const p = new URLSearchParams('sview=externas&sextorigens=dinheiro,requisicao');
    const s = fromSearchParams(p);
    expect(s.saidasView).toBe('externas');
    expect(s.origensExterna).toEqual(['dinheiro', 'requisicao']);
  });

  it('parse de valor inválido em sview cai no default todas', () => {
    const p = new URLSearchParams('sview=xyz');
    const s = fromSearchParams(p);
    expect(s.saidasView).toBe('todas');
  });

  it('parse de origens externas filtra valores inválidos', () => {
    const p = new URLSearchParams('sview=externas&sextorigens=dinheiro,foo,tanque_externo');
    const s = fromSearchParams(p);
    expect(s.origensExterna).toEqual(['dinheiro', 'tanque_externo']);
  });

  it('serializa state com saidasView=externas e origensExterna=[dinheiro]', () => {
    const s = { ...defaultFilterState(), saidasView: 'externas' as const, origensExterna: ['dinheiro' as const] };
    const p = toSearchParams(s);
    expect(p.get('sview')).toBe('externas');
    expect(p.get('sextorigens')).toBe('dinheiro');
  });

  it('NÃO serializa saidasView=todas (default)', () => {
    const s = defaultFilterState();
    const p = toSearchParams(s);
    expect(p.get('sview')).toBeNull();
    expect(p.get('sextorigens')).toBeNull();
  });

  it('round-trip preserva saidasView e origensExterna', () => {
    const original = {
      ...defaultFilterState(),
      saidasView: 'externas' as const,
      origensExterna: ['dinheiro' as const, 'tanque_externo' as const],
    };
    const serialized = toSearchParams(original);
    const parsed = fromSearchParams(serialized);
    expect(parsed.saidasView).toBe('externas');
    expect(parsed.origensExterna).toEqual(['dinheiro', 'tanque_externo']);
  });

  it('hasActiveFilters true quando saidasView !== todas mesmo sem outros filtros', () => {
    const s = { ...defaultFilterState(), saidasView: 'externas' as const };
    expect(hasActiveFilters(s)).toBe(true);
  });

  it('hasActiveFilters true quando origensExterna tem itens', () => {
    const s = { ...defaultFilterState(), origensExterna: ['dinheiro' as const] };
    expect(hasActiveFilters(s)).toBe(true);
  });
});
