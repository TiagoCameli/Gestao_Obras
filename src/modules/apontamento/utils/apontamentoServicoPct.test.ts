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
