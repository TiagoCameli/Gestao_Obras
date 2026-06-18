import { describe, it, expect } from 'vitest';
import { placaMovimento } from './extratoExport';
import type { TransportadoraMovimento } from '../types';

function mov(over: Partial<TransportadoraMovimento>): TransportadoraMovimento {
  return {
    id: 'm1',
    transportadoraId: 't1',
    data: '2026-05-01T10:00:00Z',
    tipo: 'credito_frete',
    valor: 100,
    origemTabela: 'fretes',
    origemId: 'o1',
    descricao: null,
    obraId: null,
    mesReferencia: '2026-05-01',
    abatidoEmPagamentoId: null,
    createdAt: '2026-05-01T10:00:00Z',
    createdBy: null,
    ...over,
  };
}

describe('placaMovimento', () => {
  it('frete usa a placa da carreta do frete', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: 'ABC1D23' }))).toBe('ABC1D23');
  });

  it('abastecimentos (transterra/emt/crédito tanque) usam a placa da saída', () => {
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_transterra', saidaPlaca: 'DEF4G56' }))).toBe('DEF4G56');
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_emt', saidaPlaca: 'GHI7J89' }))).toBe('GHI7J89');
    expect(placaMovimento(mov({ tipo: 'credito_abastecimento_transterra', saidaPlaca: 'JKL0M12' }))).toBe('JKL0M12');
  });

  it('pagamentos e ajustes manuais não têm carreta → null', () => {
    expect(placaMovimento(mov({ tipo: 'debito_pagamento_frete' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'ajuste_manual_credito' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'ajuste_manual_debito' }))).toBeNull();
  });

  it('placa ausente, vazia ou só espaços vira null', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: null }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: '' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_emt', saidaPlaca: '   ' }))).toBeNull();
  });

  it('faz trim da placa', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: '  ABC1D23 ' }))).toBe('ABC1D23');
  });
});
