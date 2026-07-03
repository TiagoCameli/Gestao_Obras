import { describe, it, expect } from 'vitest';
import { depositosComSaldo, acharSaldoDeposito, validarQtdContraSaldo } from './estoqueServico';
import type { SaldoEstoquePorDeposito } from '../types';

function saldo(depositoId: string, s: number, custoMedio: number | null = 10): SaldoEstoquePorDeposito {
  return {
    insumoId: 'i1', insumoNome: 'Peça X', unidade: 'un', codigoSku: null, fabricante: null,
    estoqueMinimo: null, depositoId, depositoNome: `Dep ${depositoId}`, saldo: s,
    custoMedio, totalEntradas: 0, valorTotalEntradas: 0,
  };
}

describe('depositosComSaldo', () => {
  it('filtra só saldo > 0', () => {
    const r = depositosComSaldo([saldo('a', 5), saldo('b', 0), saldo('c', -2), saldo('d', 0.5)]);
    expect(r.map((x) => x.depositoId)).toEqual(['a', 'd']);
  });
});

describe('acharSaldoDeposito', () => {
  it('acha o depósito', () => {
    const r = acharSaldoDeposito([saldo('a', 5), saldo('b', 3)], 'b');
    expect(r?.saldo).toBe(3);
  });
  it('retorna null se não achar', () => {
    expect(acharSaldoDeposito([saldo('a', 5)], 'z')).toBeNull();
  });
});

describe('validarQtdContraSaldo', () => {
  it('ok quando qtd <= saldo', () => {
    expect(validarQtdContraSaldo(3, 5)).toBeNull();
    expect(validarQtdContraSaldo(5, 5)).toBeNull();
  });
  it('erro quando qtd <= 0', () => {
    expect(validarQtdContraSaldo(0, 5)).toMatch(/maior que zero/i);
    expect(validarQtdContraSaldo(-1, 5)).toMatch(/maior que zero/i);
  });
  it('erro quando qtd > saldo', () => {
    expect(validarQtdContraSaldo(6, 5)).toMatch(/saldo dispon/i);
  });
});
