import { describe, it, expect } from 'vitest';
import type { SaidaCombustivel } from '../../../../types';
import { filterSaidasByView } from './filterSaidasByView';

function makeSaida(overrides: Partial<SaidaCombustivel>): SaidaCombustivel {
  return {
    id: 'sd-' + Math.random().toString(36).slice(2, 8),
    data: '2026-05-20T10:00',
    origem: 'tanque',
    tipoConsumidor: 'equipamento_proprio',
    tanqueId: 'tk-int-1',
    equipamentoId: 'eq-1',
    transportadoraId: '',
    placa: '',
    obraId: 'obra-1',
    etapaId: '',
    tipoCombustivel: 'ins-diesel',
    litros: 100,
    taxaLitro: 0,
    precoUnitarioManual: 0,
    precoCombustivel: 0,
    precoCombustivelAreacre: 0,
    motorista: '',
    medicaoLeitura: '',
    observacoes: '',
    pago: false,
    pagoEm: '',
    criadoEm: '',
    ...overrides,
  } as SaidaCombustivel;
}

const tanquesExternosSet = new Set(['tk-ext-1']);
const sTanqueInt = makeSaida({ origem: 'tanque', tanqueId: 'tk-int-1' });
const sTanqueExt = makeSaida({ origem: 'tanque', tanqueId: 'tk-ext-1' });
const sDinheiro = makeSaida({ origem: 'dinheiro', tanqueId: '' });
const sRequisicao = makeSaida({ origem: 'requisicao', tanqueId: '' });
const todas = [sTanqueInt, sTanqueExt, sDinheiro, sRequisicao];

describe('filterSaidasByView', () => {
  it('view=todas retorna tudo', () => {
    const out = filterSaidasByView(todas, 'todas', [], tanquesExternosSet);
    expect(out).toEqual(todas);
  });

  it('view=internas só tanque interno', () => {
    const out = filterSaidasByView(todas, 'internas', [], tanquesExternosSet);
    expect(out).toEqual([sTanqueInt]);
  });

  it('view=externas (sem origensExterna) inclui dinheiro+requisicao+tanque externo', () => {
    const out = filterSaidasByView(todas, 'externas', [], tanquesExternosSet);
    expect(out).toEqual([sTanqueExt, sDinheiro, sRequisicao]);
  });

  it('view=externas + origensExterna=[dinheiro] só dinheiro', () => {
    const out = filterSaidasByView(todas, 'externas', ['dinheiro'], tanquesExternosSet);
    expect(out).toEqual([sDinheiro]);
  });

  it('view=externas + origensExterna=[dinheiro,tanque_externo]', () => {
    const out = filterSaidasByView(todas, 'externas', ['dinheiro', 'tanque_externo'], tanquesExternosSet);
    expect(out).toEqual([sTanqueExt, sDinheiro]);
  });

  it('view=externas + origensExterna=[requisicao]', () => {
    const out = filterSaidasByView(todas, 'externas', ['requisicao'], tanquesExternosSet);
    expect(out).toEqual([sRequisicao]);
  });

  it('view=internas ignora saida origem=tanque sem tanqueId', () => {
    const saidaSemTanque = makeSaida({ origem: 'tanque', tanqueId: '' });
    const out = filterSaidasByView([saidaSemTanque], 'internas', [], tanquesExternosSet);
    expect(out).toEqual([]);
  });
});
