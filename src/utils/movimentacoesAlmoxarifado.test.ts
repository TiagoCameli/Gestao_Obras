import { describe, it, expect } from 'vitest';
import {
  montarMovimentacoes,
  saldoAposExcluirEntrada,
  saldoAposEditarEntrada,
  mensagemSaldoNegativo,
} from './movimentacoesAlmoxarifado';
import type { EntradaMaterial, OSPeca, OSOleo } from '../types';

function entrada(over: Partial<EntradaMaterial> = {}): EntradaMaterial {
  return {
    id: 'e1',
    dataHora: '2026-07-09T22:40:00.000Z',
    depositoMaterialId: 'dep1',
    insumoId: 'ins1',
    obraId: '',
    quantidade: 1,
    valorUnitario: 30,
    valorTotal: 30,
    fornecedorId: 'f1',
    notaFiscal: '3246854',
    observacoes: '',
    criadoPor: 'tiago',
    ...over,
  };
}

function peca(over: Partial<OSPeca> = {}): OSPeca {
  return {
    id: 'p1',
    osId: 'os1',
    insumoId: 'ins2',
    depositoId: 'dep1',
    quantidade: 2,
    unidadeMedidaId: null,
    custoUnitario: 9,
    custoTotal: 18,
    status: 'reservada',
    saidaMaterialId: null,
    observacoes: '',
    createdAt: '2026-07-08T14:10:00.000Z',
    createdBy: 'tiago',
    ...over,
  };
}

function oleo(over: Partial<OSOleo> = {}): OSOleo {
  return {
    id: 'o1',
    osId: 'os1',
    tipoOleoId: 'to1',
    insumoId: 'ins3',
    depositoId: 'dep1',
    quantidade: 5,
    unidade: 'L',
    valorUnitario: 10,
    valorTotal: 50,
    createdAt: '2026-07-07T09:00:00.000Z',
    createdBy: 'tiago',
    ...over,
  };
}

const nomes = new Map([
  ['ins1', 'Bomba combustível alta'],
  ['ins2', 'Filtro de óleo'],
  ['ins3', 'Óleo 15W40'],
]);
const tiposOleo = new Map([['to1', 'Motor 15W40']]);
const osNumeros = new Map([['os1', '000123']]);

describe('montarMovimentacoes', () => {
  it('junta entrada, peça e óleo numa lista ordenada da mais recente pra mais antiga', () => {
    const movs = montarMovimentacoes({
      entradas: [entrada()],
      pecas: [peca()],
      oleos: [oleo()],
      insumoNomePorId: nomes,
      tipoOleoNomePorId: tiposOleo,
      osNumeroPorId: osNumeros,
    });
    expect(movs.map((m) => m.id)).toEqual(['e1', 'p1', 'o1']);
    expect(movs.map((m) => m.tipo)).toEqual(['entrada', 'saida', 'saida']);
  });

  it('entrada carrega NF na origem e peça/óleo carregam número da OS', () => {
    const movs = montarMovimentacoes({
      entradas: [entrada()],
      pecas: [peca()],
      oleos: [oleo()],
      insumoNomePorId: nomes,
      tipoOleoNomePorId: tiposOleo,
      osNumeroPorId: osNumeros,
    });
    const ent = movs.find((m) => m.id === 'e1')!;
    const pec = movs.find((m) => m.id === 'p1')!;
    expect(ent.origem).toEqual({ kind: 'nf', notaFiscal: '3246854' });
    expect(ent.insumoNome).toBe('Bomba combustível alta');
    expect(ent.valorTotal).toBe(30);
    expect(pec.origem).toEqual({ kind: 'os', osId: 'os1', osNumero: '000123' });
    expect(pec.insumoNome).toBe('Filtro de óleo');
    expect(pec.valorTotal).toBe(18);
  });

  it('ignora baixa de OS excluída (sem número na OS)', () => {
    const movs = montarMovimentacoes({
      entradas: [],
      pecas: [peca({ osId: 'os-morta' })],
      oleos: [oleo({ osId: 'os-morta' })],
      insumoNomePorId: nomes,
      tipoOleoNomePorId: tiposOleo,
      osNumeroPorId: osNumeros,
    });
    expect(movs).toEqual([]);
  });

  it('não conta peça devolvida como saída', () => {
    const movs = montarMovimentacoes({
      entradas: [],
      pecas: [peca({ status: 'devolvida' })],
      oleos: [],
      insumoNomePorId: nomes,
      tipoOleoNomePorId: tiposOleo,
      osNumeroPorId: osNumeros,
    });
    expect(movs).toEqual([]);
  });

  it('óleo sem insumo (legado) cai no nome do tipo de óleo', () => {
    const movs = montarMovimentacoes({
      entradas: [],
      pecas: [],
      oleos: [oleo({ insumoId: null })],
      insumoNomePorId: nomes,
      tipoOleoNomePorId: tiposOleo,
      osNumeroPorId: osNumeros,
    });
    expect(movs[0].insumoNome).toBe('Motor 15W40');
  });
});

describe('guarda de saldo', () => {
  it('saldo após excluir entrada subtrai a quantidade da entrada', () => {
    expect(saldoAposExcluirEntrada(5, 2)).toBe(3);
    expect(saldoAposExcluirEntrada(2, 5)).toBe(-3);
  });

  it('saldo após editar entrada aplica a variação de quantidade', () => {
    // saldo atual 5, entrada era 2, vira 1 → saldo cai pra 4
    expect(saldoAposEditarEntrada(5, 2, 1)).toBe(4);
    // saldo atual 5, entrada era 2, vira 4 → saldo sobe pra 7
    expect(saldoAposEditarEntrada(5, 2, 4)).toBe(7);
  });

  it('mensagem de bloqueio só aparece quando o saldo resultante fica negativo', () => {
    expect(mensagemSaldoNegativo(-3)).toMatch(/consumid/i);
    expect(mensagemSaldoNegativo(0)).toBeNull();
    expect(mensagemSaldoNegativo(2)).toBeNull();
  });
});
