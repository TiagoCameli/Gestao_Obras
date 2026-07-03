import { describe, it, expect } from 'vitest';
import { dataParaInput, montarOSEditada } from './editarOS';
import type { OrdemServico } from '../../../types';

function makeOS(overrides: Partial<OrdemServico> = {}): OrdemServico {
  return {
    id: 'os1',
    numero: 'OS-2026-0007',
    equipamentoId: 'eq-antiga',
    tipo: 'corretiva',
    prioridade: 'media',
    status: 'concluida',
    origem: 'manual',
    origemId: null,
    atividadeId: null,
    obraId: null,
    solicitanteId: '',
    responsavelId: '',
    fornecedorServicoId: null,
    dataAbertura: '2026-07-01T15:00:00.000Z',
    dataPrevistaInicio: null,
    dataInicioExecucao: '2026-07-01T15:00:00.000Z',
    dataConclusao: '2026-07-01T15:00:00.000Z',
    prazoAtendimento: null,
    medicaoAbertura: 1000,
    medicaoConclusao: null,
    paradaInicio: null,
    paradaFim: null,
    defeitoReportado: '',
    sintomas: [],
    sistemasAfetados: [],
    causaRaiz: '',
    solucaoAplicada: 'texto antigo',
    recomendacoes: '',
    custoPecas: 500,
    custoServicoTerceiro: 0,
    custoMaoObraPropria: 0,
    custoTerceiros: 200,
    custoOleos: 130,
    custoTotal: 830,
    aprovadoPor: '',
    aprovadoEm: null,
    garantiaAcionada: true,
    fotoUrls: ['a.jpg'],
    arquivoUrls: [],
    observacoes: '',
    createdAt: '2026-07-01T15:00:00.000Z',
    createdBy: 'Fulano',
    updatedAt: '2026-07-01T15:00:00.000Z',
    updatedBy: 'Fulano',
    ...overrides,
  };
}

describe('dataParaInput', () => {
  // Inverso exato da convenção de gravação (âncora meio-dia LOCAL): grava-se
  // new Date(input+'T12:00:00').toISOString() e lê-se de volta o mesmo dia.
  // O meio-dia dá 12h de folga pra cada lado, então não pula dia em nenhum fuso.
  it('faz round-trip com a data gravada (âncora meio-dia)', () => {
    for (const dia of ['2026-07-03', '2026-01-01', '2026-12-31', '2026-02-28']) {
      const iso = new Date(dia + 'T12:00:00').toISOString();
      expect(dataParaInput(iso)).toBe(dia);
    }
  });

  it('nulo/invalido cai pra hoje no formato yyyy-mm-dd', () => {
    expect(dataParaInput(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataParaInput('')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataParaInput('lixo')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('montarOSEditada', () => {
  const campos = {
    equipamentoId: 'eq-nova',
    dataInput: '2026-07-03',
    tipo: 'preventiva' as const,
    medicaoAbertura: '4523',
    descricao: '  troca de filtro  ',
    usuarioNome: 'Tiago',
  };

  it('sobrescreve os 5 campos editados', () => {
    const out = montarOSEditada(makeOS(), campos);
    expect(out.equipamentoId).toBe('eq-nova');
    expect(out.tipo).toBe('preventiva');
    expect(out.medicaoAbertura).toBe(4523);
    expect(out.solucaoAplicada).toBe('troca de filtro'); // trim
  });

  it('grava a data nos dois campos com âncora meio-dia', () => {
    const out = montarOSEditada(makeOS(), campos);
    const esperado = new Date('2026-07-03T12:00:00').toISOString();
    expect(out.dataInicioExecucao).toBe(esperado);
    expect(out.dataConclusao).toBe(esperado);
  });

  it('preserva todos os campos nao editados', () => {
    const os = makeOS();
    const out = montarOSEditada(os, campos);
    expect(out.id).toBe(os.id);
    expect(out.numero).toBe(os.numero);
    expect(out.custoTotal).toBe(os.custoTotal);
    expect(out.custoPecas).toBe(os.custoPecas);
    expect(out.garantiaAcionada).toBe(os.garantiaAcionada);
    expect(out.status).toBe(os.status);
    expect(out.fotoUrls).toEqual(os.fotoUrls);
    expect(out.dataAbertura).toBe(os.dataAbertura);
    expect(out.createdBy).toBe(os.createdBy);
  });

  it('seta updatedBy e nao mexe em updatedAt (deixa pro banco, igual salvarDescricao)', () => {
    const os = makeOS();
    const out = montarOSEditada(os, campos);
    expect(out.updatedBy).toBe('Tiago');
    expect(out.updatedAt).toBe(os.updatedAt);
  });

  it('parseia horimetro: vazio/invalido -> null, virgula decimal', () => {
    expect(montarOSEditada(makeOS(), { ...campos, medicaoAbertura: '' }).medicaoAbertura).toBeNull();
    expect(montarOSEditada(makeOS(), { ...campos, medicaoAbertura: '   ' }).medicaoAbertura).toBeNull();
    expect(montarOSEditada(makeOS(), { ...campos, medicaoAbertura: 'abc' }).medicaoAbertura).toBeNull();
    expect(montarOSEditada(makeOS(), { ...campos, medicaoAbertura: '12,5' }).medicaoAbertura).toBe(12.5);
  });
});
