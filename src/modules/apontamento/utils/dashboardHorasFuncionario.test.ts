import { describe, expect, it } from 'vitest'
import { agregarHorasPorFuncionario } from './dashboardHorasFuncionario'
import type { Funcionario, Obra } from '../types/funcionario'
import type { Servico, ApontamentoServico } from './apontamentoServicoApi'

const F: Funcionario = {
  id: 'f1', nome: 'João Silva', cpf: '', rg: null, pis: null, ctps: null,
  dataNascimento: '', fotoPerfil: null, fotosReferenciaFacial: [],
  funcao: 'PEDREIRO' as Funcionario['funcao'], tipoVinculo: 'CLT',
  salarioBase: 1518, valorDiaria: null, valorHora: null,
  obraId: null, equipeId: null, encarregadoId: null,
  dataAdmissao: '2026-01-01', dataDemissao: null, status: 'ativo',
  contatoEmergencia: null, permiteHorasExtras: true, documentos: [],
  createdAt: '', updatedAt: '',
}
const F2: Funcionario = { ...F, id: 'f2', nome: 'Maria Santos' }

const O1: Obra = { id: 'o1', nome: 'BR-364 (Lote 9)' }
const O2: Obra = { id: 'o2', nome: 'MT-208' }

const S1: Servico = { id: 's1', nome: 'CBUQ', codigo: '2.1.05', unidade: 'm³', obraId: 'o1' }
const S2: Servico = { id: 's2', nome: 'Solo', codigo: '3.4.10', unidade: 'm³', obraId: 'o1' }
const S3: Servico = { id: 's3', nome: 'Pintura', codigo: null, unidade: 'm²', obraId: 'o2' }
const S4: Servico = { id: 's4', nome: 'Órfão', codigo: null, unidade: null, obraId: 'inexistente' }

function ap(over: Partial<ApontamentoServico>): ApontamentoServico {
  return {
    id: 'a' + Math.random(), funcionarioId: 'f1', data: '2026-05-01',
    servicoId: 's1', estacaInicial: null, estacaFinal: null, lado: null,
    horas: 1, tipo: 'produtivo', motivoImprodutivo: null, observacao: null,
    registradoPorId: null, createdAt: '', updatedAt: '',
    ...over,
  }
}

const funcsById = new Map([[F.id, F], [F2.id, F2]])
const servicosById = new Map([[S1.id, S1], [S2.id, S2], [S3.id, S3], [S4.id, S4]])
const obrasById = new Map([[O1.id, O1], [O2.id, O2]])

describe('agregarHorasPorFuncionario', () => {
  it('lista vazia retorna []', () => {
    expect(agregarHorasPorFuncionario([], funcsById, servicosById, obrasById)).toEqual([])
  })

  it('1 funcionário, 1 serviço, 1 apontamento', () => {
    const result = agregarHorasPorFuncionario(
      [ap({ servicoId: 's1', horas: 8 })],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(1)
    expect(result[0].funcionarioNome).toBe('João Silva')
    expect(result[0].horasProd).toBe(8)
    expect(result[0].obrasCount).toBe(1)
    expect(result[0].servicosCount).toBe(1)
    expect(result[0].detalhes).toHaveLength(1)
    expect(result[0].detalhes[0]).toMatchObject({
      obraNome: 'BR-364 (Lote 9)',
      servicoCodigo: '2.1.05',
      servicoNome: 'CBUQ',
      horas: 8,
      percentual: 100,
    })
  })

  it('1 funcionário, N serviços em obras diferentes — percentuais somam 100', () => {
    const [linha] = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', horas: 18 }),
        ap({ servicoId: 's2', horas: 12 }),
        ap({ servicoId: 's3', horas: 10 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(linha.horasProd).toBe(40)
    expect(linha.obrasCount).toBe(2)
    expect(linha.servicosCount).toBe(3)
    expect(linha.detalhes.map((d) => d.servicoNome)).toEqual(['CBUQ', 'Solo', 'Pintura'])
    expect(linha.detalhes[0].percentual).toBe(45)
    expect(linha.detalhes[1].percentual).toBe(30)
    expect(linha.detalhes[2].percentual).toBe(25)
    const somaPct = linha.detalhes.reduce((s, d) => s + d.percentual, 0)
    expect(somaPct).toBeCloseTo(100, 1)
  })

  it('apontamentos do mesmo serviço em dias diferentes somam', () => {
    const [linha] = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', data: '2026-05-01', horas: 4 }),
        ap({ servicoId: 's1', data: '2026-05-02', horas: 4 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(linha.horasProd).toBe(8)
    expect(linha.detalhes).toHaveLength(1)
    expect(linha.detalhes[0].horas).toBe(8)
  })

  it('ignora improdutivos', () => {
    const result = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', horas: 6, tipo: 'produtivo' }),
        ap({ servicoId: null, horas: 2, tipo: 'improdutivo' }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(1)
    expect(result[0].horasProd).toBe(6)
  })

  it('servico_id NULL vira "— Sem serviço vinculado —"', () => {
    const [linha] = agregarHorasPorFuncionario(
      [ap({ servicoId: null, horas: 3 })],
      funcsById, servicosById, obrasById,
    )
    expect(linha.detalhes[0]).toMatchObject({
      obraNome: '—',
      servicoCodigo: null,
      servicoNome: '— Sem serviço vinculado —',
      obraId: null,
      servicoId: null,
    })
    expect(linha.obrasCount).toBe(0)
    expect(linha.servicosCount).toBe(0)
  })

  it('servico cujo obra_id não existe na obrasById vira "Obra <id>"', () => {
    const [linha] = agregarHorasPorFuncionario(
      [ap({ servicoId: 's4', horas: 5 })],
      funcsById, servicosById, obrasById,
    )
    expect(linha.detalhes[0].obraNome).toBe('Obra inexistente')
    expect(linha.obrasCount).toBe(1)
  })

  it('funcionário deletado (não está em funcsById) é descartado', () => {
    const result = agregarHorasPorFuncionario(
      [ap({ funcionarioId: 'orfao', horas: 5 })],
      funcsById, servicosById, obrasById,
    )
    expect(result).toEqual([])
  })

  it('múltiplos funcionários retornam linhas separadas', () => {
    const result = agregarHorasPorFuncionario(
      [
        ap({ funcionarioId: 'f1', servicoId: 's1', horas: 4 }),
        ap({ funcionarioId: 'f2', servicoId: 's2', horas: 6 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.funcionarioId === 'f1')!.horasProd).toBe(4)
    expect(result.find((r) => r.funcionarioId === 'f2')!.horasProd).toBe(6)
  })
})
