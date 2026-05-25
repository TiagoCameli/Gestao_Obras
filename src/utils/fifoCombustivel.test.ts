import { describe, it, expect } from 'vitest'
import { calcularPrecoFIFO, type ConsumoAnterior } from './fifoCombustivel'
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

const ent = (id: string, depositoId: string, dataHora: string, litros: number, valor: number): EntradaCombustivel => ({
  id, dataHora, depositoId,
  tipoCombustivel: 'd',
  quantidadeLitros: litros,
  valorTotal: valor,
  fornecedor: 'f', notaFiscal: '', observacoes: '', criadoPor: '',
}) as EntradaCombustivel

const trans = (id: string, destinoId: string, dataHora: string, litros: number, valor: number): TransferenciaCombustivel => ({
  id, dataHora,
  depositoOrigemId: 'outro',
  depositoDestinoId: destinoId,
  quantidadeLitros: litros,
  valorTotal: valor,
  observacoes: '', criadoPor: '',
}) as TransferenciaCombustivel

const consumo = (tipo: 'saida' | 'transferencia_out' | 'esvaziamento', tanqueId: string, data: string, litros: number): ConsumoAnterior => ({
  tipo, tanqueId, data, litros,
})

describe('calcularPrecoFIFO', () => {
  it('1 lote único — porção tem saldoAntesDoConsumo correto', () => {
    const entradas = [ent('e1', 't1', '2026-01-01T08:00:00', 10000, 55000)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.precoMedio).toBe(5.5)
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'e1',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 10000,
        litros: 100,
        preco: 5.5,
      },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('2 lotes — exemplo 70/30 reflete saldoAntesDoConsumo correto', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 10000, 55000),
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000),
    ]
    const consumosAnteriores = [consumo('saida', 't1', '2026-01-05T08:00:00', 9930)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.precoMedio).toBeCloseTo(5.65, 4)
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'A',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 70,
        litros: 70,
        preco: 5.5,
      },
      {
        fonteTipo: 'entrada',
        fonteId: 'B',
        fonteDataHora: '2026-01-10T08:00:00',
        saldoAntesDoConsumo: 2000,
        litros: 30,
        preco: 6.0,
      },
    ])
  })

  it('consumo anterior tipo transferencia_out reduz saldo', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5500)]
    const consumosAnteriores = [consumo('transferencia_out', 't1', '2026-01-05T08:00:00', 800)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(200)
    expect(r.precoMedio).toBe(5.5)
  })

  it('consumo anterior tipo esvaziamento reduz saldo', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 6000)]
    const consumosAnteriores = [consumo('esvaziamento', 't1', '2026-01-05T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 200,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(500)
    expect(r.detalhamento[0].litros).toBe(200)
    expect(r.precoMedio).toBe(6.0)
  })

  it('ordem cronológica mistura saídas + transf_out + esvaziamentos', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [
      consumo('saida', 't1', '2026-01-05T08:00:00', 200),
      consumo('transferencia_out', 't1', '2026-01-03T08:00:00', 100),
      consumo('esvaziamento', 't1', '2026-01-07T08:00:00', 50),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(650)
    expect(r.detalhamento[0].litros).toBe(100)
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('saída sem lote anterior — litrosSemSuprimento total', () => {
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-01T08:00:00', litros: 100,
      entradas: [], transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.precoMedio).toBe(0)
    expect(r.detalhamento).toEqual([])
    expect(r.litrosSemSuprimento).toBe(100)
  })

  it('saída parcialmente suprida', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 50, 275)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-02T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento[0].litros).toBe(50)
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(50)
    expect(r.litrosSemSuprimento).toBe(50)
  })

  it('ignora entradas futuras (após data da operação)', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),
      ent('B', 't1', '2026-02-01T08:00:00', 100, 800),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 50,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento).toEqual([
      {
        fonteTipo: 'entrada',
        fonteId: 'A',
        fonteDataHora: '2026-01-01T08:00:00',
        saldoAntesDoConsumo: 100,
        litros: 50,
        preco: 5.5,
      },
    ])
  })

  it('transferências IN tratadas como lote', () => {
    const transferenciasIn = [trans('T1', 't1', '2026-01-01T08:00:00', 200, 1200)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 100,
      entradas: [], transferenciasIn, consumosAnteriores: [],
    })
    expect(r.detalhamento[0].fonteTipo).toBe('transferencia')
    expect(r.detalhamento[0].fonteId).toBe('T1')
    expect(r.precoMedio).toBe(6.0)
  })

  it('ordena lotes por data ASC, independente da ordem input', () => {
    const entradas = [
      ent('B', 't1', '2026-01-10T08:00:00', 2000, 12000),
      ent('A', 't1', '2026-01-01T08:00:00', 100, 550),
    ]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-15T08:00:00', litros: 150,
      entradas, transferenciasIn: [], consumosAnteriores: [],
    })
    expect(r.detalhamento[0].fonteId).toBe('A')
    expect(r.detalhamento[1].fonteId).toBe('B')
  })

  it('consumos de OUTROS tanques são ignorados', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [consumo('saida', 't2', '2026-01-05T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(1000)
  })

  it('consumos futuros (data > esta operação) são ignorados', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00', 1000, 5000)]
    const consumosAnteriores = [consumo('saida', 't1', '2026-02-01T08:00:00', 500)]
    const r = calcularPrecoFIFO({
      tanqueId: 't1', dataHora: '2026-01-10T08:00:00', litros: 100,
      entradas, transferenciasIn: [], consumosAnteriores,
    })
    expect(r.detalhamento[0].saldoAntesDoConsumo).toBe(1000)
  })
})
