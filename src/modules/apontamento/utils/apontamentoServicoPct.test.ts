import { describe, expect, it } from 'vitest'
import { ratearHorasPorPct } from './apontamentoServicoPct'

describe('ratearHorasPorPct', () => {
  it('60/40 sobre 8h fecha exatamente 8h', () => {
    const r = ratearHorasPorPct([60, 40], 8)
    expect(r).toEqual([4.8, 3.2])
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(8, 5)
  })

  it('60/40 sobre 6h fecha exatamente 6h', () => {
    const r = ratearHorasPorPct([60, 40], 6)
    expect(r).toEqual([3.6, 2.4])
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(6, 5)
  })

  it('drift de arredondamento: 3 fatias sobre 7h fecha 7h', () => {
    const r = ratearHorasPorPct([33.34, 33.33, 33.33], 7)
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(7, 5)
  })

  it('linha única 100% recebe todas as horas', () => {
    expect(ratearHorasPorPct([100], 8)).toEqual([8])
  })

  it('linhas com pct 0 recebem 0', () => {
    const r = ratearHorasPorPct([60, 40, 0], 8)
    expect(r[2]).toBe(0)
    expect(r.reduce((s, h) => s + h, 0)).toBeCloseTo(8, 5)
  })

  it('total de horas 0 retorna zeros', () => {
    expect(ratearHorasPorPct([60, 40], 0)).toEqual([0, 0])
  })
})

import { montarRowsApontamentoPorPct } from './apontamentoServicoPct'

describe('montarRowsApontamentoPorPct', () => {
  const linhas = [
    { servicoId: 'A', pct: 60, tipo: 'produtivo' as const, motivoImprodutivo: null, observacao: null },
    { servicoId: 'B', pct: 40, tipo: 'produtivo' as const, motivoImprodutivo: null, observacao: null },
  ]

  it('aplica a % nas horas reais de cada funcionário', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1', 'f2'],
      data: '2026-06-05',
      linhas,
      horasPorFunc: { f1: 8, f2: 6 },
      registradoPorId: 'u1',
    })
    expect(rows).toHaveLength(4)
    const f1 = rows.filter((r) => r.funcionario_id === 'f1')
    expect(f1.map((r) => r.horas)).toEqual([4.8, 3.2])
    const f2 = rows.filter((r) => r.funcionario_id === 'f2')
    expect(f2.map((r) => r.horas)).toEqual([3.6, 2.4])
    expect(rows[0]).toMatchObject({
      funcionario_id: 'f1', data: '2026-06-05', servico_id: 'A',
      tipo: 'produtivo', registrado_por_id: 'u1', motivo_improdutivo: null,
    })
  })

  it('pula funcionário sem horas de ponto', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1', 'fZero'],
      data: '2026-06-05',
      linhas,
      horasPorFunc: { f1: 8, fZero: 0 },
      registradoPorId: null,
    })
    expect(rows.every((r) => r.funcionario_id === 'f1')).toBe(true)
  })

  it('linha improdutiva: servico_id null e motivo preenchido', () => {
    const rows = montarRowsApontamentoPorPct({
      funcionarioIds: ['f1'],
      data: '2026-06-05',
      linhas: [{ servicoId: null, pct: 100, tipo: 'improdutivo', motivoImprodutivo: 'Chuva', observacao: null }],
      horasPorFunc: { f1: 8 },
      registradoPorId: 'u1',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ servico_id: null, tipo: 'improdutivo', motivo_improdutivo: 'Chuva', horas: 8 })
  })
})
