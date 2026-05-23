import { describe, it, expect } from 'vitest'
import { calcularPrecoFIFO } from './fifoCombustivel'
import type { EntradaCombustivel, TransferenciaCombustivel, SaidaCombustivel } from '../types'

// Helpers de criação (campos extras só pra satisfazer o type — não afetam o algoritmo)
const ent = (id: string, depositoId: string, dataHora: string, litros: number, valor: number): EntradaCombustivel => ({
  id,
  dataHora,
  depositoId,
  tipoCombustivel: 'd',
  quantidadeLitros: litros,
  valorTotal: valor,
  fornecedor: 'f',
  notaFiscal: '',
  observacoes: '',
  criadoPor: '',
})

const trans = (id: string, destinoId: string, dataHora: string, litros: number, valor: number): TransferenciaCombustivel => ({
  id,
  dataHora,
  depositoOrigemId: 'outro_tanque',
  depositoDestinoId: destinoId,
  quantidadeLitros: litros,
  valorTotal: valor,
  observacoes: '',
  criadoPor: '',
})

const sai = (id: string, tanqueId: string, data: string, litros: number): SaidaCombustivel => ({
  id,
  data,
  origem: 'tanque',
  tipoConsumidor: 'equipamento_proprio',
  tanqueId,
  equipamentoId: 'e',
  transportadoraId: null,
  placa: null,
  motorista: '',
  obraId: 'o',
  etapaId: null,
  alocacoes: null,
  tipoCombustivel: 'd',
  litros,
  precoMedioTanqueSnapshot: 0,
  taxaLitro: 0,
  precoCombustivel: 0,
  precoCombustivelAreacre: null,
  precoUnitario: 0,
  valorTotal: 0,
  fotoUrls: [],
  arquivoUrls: [],
  observacoes: '',
  pago: false,
  pagoEm: null,
  movimentoId: null,
  medicaoNoAbastecimento: null,
  tipoMedicaoSnapshot: null,
  createdAt: '',
  updatedAt: '',
  createdBy: null,
  updatedBy: null,
})

describe('calcularPrecoFIFO', () => {
  it('1 lote único — toda saída consome dele', () => {
    const entradas = [ent('e1', 't1', '2026-01-01T08:00:00', 10000, 55000)] // R$ 5,50/L
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferencias: [], saidasAnteriores: [],
    })
    expect(r.precoMedio).toBe(5.5)
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'e1', litros: 100, preco: 5.5 },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('2 lotes — exemplo do usuário: 70 do lote A + 30 do lote B', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 10000, 55000), // R$ 5,50/L
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000),  // R$ 6,00/L
    ]
    const saidasAnteriores = [
      sai('s1', 't1', '2026-01-05T08:00:00', 9930), // consome 9930L do A → restam 70L
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas, transferencias: [], saidasAnteriores,
    })
    // 70 do A (R$ 5,50) + 30 do B (R$ 6,00) = R$ 565 / 100 = R$ 5,65
    expect(r.precoMedio).toBeCloseTo(5.65, 4)
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'A', litros: 70, preco: 5.5 },
      { fonteTipo: 'entrada', fonteId: 'B', litros: 30, preco: 6.0 },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('saída sem lote anterior — retorna litrosSemSuprimento total', () => {
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-01T08:00:00', litros: 100,
      entradas: [], transferencias: [], saidasAnteriores: [],
    })
    expect(r.precoMedio).toBe(0)
    expect(r.detalhamento).toEqual([])
    expect(r.litrosSemSuprimento).toBe(100)
  })

  it('saída parcialmente suprida', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 50, 275)] // só 50L
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferencias: [], saidasAnteriores: [],
    })
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'A', litros: 50, preco: 5.5 },
    ])
    expect(r.litrosSemSuprimento).toBe(50)
    expect(r.precoMedio).toBe(5.5) // média dos 50 supridos
  })

  it('ignora entradas/transferências futuras (após data da saída)', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550), // antes — OK
      ent('B', 't1', '2026-02-01T08:00:00', 100, 800), // depois — IGNORA
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 50,
      entradas, transferencias: [], saidasAnteriores: [],
    })
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'A', litros: 50, preco: 5.5 },
    ])
  })

  it('inclui transferências recebidas como lote', () => {
    const transferencias = [trans('T1', 't1', '2026-01-01T08:00:00', 200, 1200)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas: [], transferencias, saidasAnteriores: [],
    })
    expect(r.precoMedio).toBe(6.0)
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'transferencia', fonteId: 'T1', litros: 100, preco: 6.0 },
    ])
  })

  it('ordena lotes por data ASC, independente da ordem do array input', () => {
    const entradas = [
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000), // R$ 6,00 (mais novo)
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),    // R$ 5,50 (mais antigo)
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 150,
      entradas, transferencias: [], saidasAnteriores: [],
    })
    // FIFO consome A (100L) primeiro, depois 50L de B
    expect(r.detalhamento[0].fonteId).toBe('A')
    expect(r.detalhamento[1].fonteId).toBe('B')
  })

  it('saídas anteriores consomem em ordem cronológica', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),
      ent('B', 't1', '2026-01-10T08:00:00', 100, 700),
    ]
    const saidasAnteriores = [
      sai('s1', 't1', '2026-01-05T08:00:00', 80), // consome 80 do A → restam 20A + 100B
      sai('s2', 't1', '2026-01-12T08:00:00', 40), // consome 20A + 20B → restam 80B
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-20T08:00:00', litros: 80,
      entradas, transferencias: [], saidasAnteriores,
    })
    expect(r.precoMedio).toBe(7.0) // restantes 80L são de B (R$ 7/L)
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'B', litros: 80, preco: 7.0 },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })
})
