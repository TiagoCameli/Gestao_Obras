import { describe, it, expect } from 'vitest';
import { montarRelatorioPorMaquina } from './manutencaoRelatorio';
import type { OrdemServico } from '../types';

// Fixture factory — só os campos usados pela função
function makeOS(overrides: Partial<OrdemServico>): OrdemServico {
  return {
    id: 'os1',
    numero: 'OS-001',
    equipamentoId: 'eq1',
    tipo: 'corretiva',
    prioridade: 'media',
    status: 'concluida',
    origem: null,
    origemId: null,
    atividadeId: null,
    obraId: null,
    solicitanteId: 'u1',
    responsavelId: 'u1',
    fornecedorServicoId: null,
    dataAbertura: '2026-06-01T00:00:00Z',
    dataPrevistaInicio: null,
    dataInicioExecucao: null,
    dataConclusao: '2026-06-10T00:00:00Z',
    prazoAtendimento: null,
    medicaoAbertura: null,
    medicaoConclusao: null,
    paradaInicio: null,
    paradaFim: null,
    defeitoReportado: '',
    sintomas: [],
    sistemasAfetados: [],
    causaRaiz: '',
    solucaoAplicada: '',
    recomendacoes: '',
    custoPecas: 0,
    custoServicoTerceiro: 0,
    custoMaoObraPropria: 0,
    custoTerceiros: 0,
    custoOleos: 0,
    custoTotal: 0,
    aprovadoPor: '',
    aprovadoEm: null,
    garantiaAcionada: false,
    fotoUrls: [],
    ...overrides,
  } as OrdemServico;
}

const os1 = makeOS({
  numero: 'OS-001',
  custoPecas: 500,
  custoTerceiros: 200,
  custoOleos: 100,
  custoTotal: 800,
});

const os2 = makeOS({
  id: 'os2',
  numero: 'OS-002',
  tipo: 'troca_oleo',
  custoPecas: 0,
  custoTerceiros: 0,
  custoOleos: 350,
  custoTotal: 350,
  dataConclusao: '2026-06-15T00:00:00Z',
});

const os3Aberta = makeOS({
  id: 'os3',
  numero: 'OS-003',
  status: 'aberta',
  custoPecas: 9999,
  custoTerceiros: 9999,
  custoOleos: 9999,
  custoTotal: 9999,
});

describe('montarRelatorioPorMaquina', () => {
  it('subtotais somam corretamente com múltiplas OS', () => {
    const { subtotais } = montarRelatorioPorMaquina([os1, os2]);
    expect(subtotais.pecas).toBe(500);
    expect(subtotais.terceiros).toBe(200);
    expect(subtotais.oleos).toBe(450);
    expect(subtotais.total).toBe(1150);
  });

  it('subtotal.total = pecas + terceiros + oleos', () => {
    const { subtotais } = montarRelatorioPorMaquina([os1, os2]);
    expect(subtotais.total).toBe(subtotais.pecas + subtotais.terceiros + subtotais.oleos);
  });

  it('filtra defensivamente OS não concluídas', () => {
    const { linhas } = montarRelatorioPorMaquina([os1, os3Aberta]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].numero).toBe('OS-001');
  });

  it('linhas vazia e subtotais zero quando não há concluídas', () => {
    const { linhas, subtotais } = montarRelatorioPorMaquina([os3Aberta]);
    expect(linhas).toHaveLength(0);
    expect(subtotais.total).toBe(0);
  });

  it('data usa dataConclusao quando disponível', () => {
    const { linhas } = montarRelatorioPorMaquina([os1]);
    expect(linhas[0].data).toBe('2026-06-10');
  });

  it('tipo usa TIPO_OS_LABEL', () => {
    const { linhas } = montarRelatorioPorMaquina([os2]);
    expect(linhas[0].tipo).toBe('Troca de óleo');
  });
});
