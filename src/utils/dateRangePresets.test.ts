import { describe, it, expect } from 'vitest'
import { presetEstaSemana, presetMesPassado, presetSemChegada } from './dateRangePresets'

describe('presetEstaSemana', () => {
  it('retorna [segunda, hoje] dado uma quarta-feira', () => {
    // Quarta-feira 2026-05-20
    const result = presetEstaSemana(new Date('2026-05-20T12:00:00'))
    expect(result.dataInicio).toBe('2026-05-18') // segunda
    expect(result.dataFim).toBe('2026-05-20')
  })

  it('retorna [segunda, hoje] dado um domingo (trata domingo como dia 7)', () => {
    // Domingo 2026-05-24
    const result = presetEstaSemana(new Date('2026-05-24T08:00:00'))
    expect(result.dataInicio).toBe('2026-05-18') // segunda anterior
    expect(result.dataFim).toBe('2026-05-24')
  })

  it('retorna [hoje, hoje] dado uma segunda-feira', () => {
    const result = presetEstaSemana(new Date('2026-05-18T08:00:00'))
    expect(result.dataInicio).toBe('2026-05-18')
    expect(result.dataFim).toBe('2026-05-18')
  })
})

describe('presetMesPassado', () => {
  it('retorna primeiro e último dia do mês anterior — meio de maio', () => {
    const result = presetMesPassado(new Date('2026-05-15'))
    expect(result.dataInicio).toBe('2026-04-01')
    expect(result.dataFim).toBe('2026-04-30')
  })

  it('janeiro → dezembro do ano anterior', () => {
    const result = presetMesPassado(new Date('2026-01-10'))
    expect(result.dataInicio).toBe('2025-12-01')
    expect(result.dataFim).toBe('2025-12-31')
  })

  it('março → fevereiro (28 ou 29 dias)', () => {
    const result = presetMesPassado(new Date('2024-03-10')) // 2024 é bissexto
    expect(result.dataInicio).toBe('2024-02-01')
    expect(result.dataFim).toBe('2024-02-29')
  })
})

describe('presetSemChegada', () => {
  it('retorna nada (preset sem range de datas — é filtro de coluna)', () => {
    expect(presetSemChegada()).toEqual({})
  })
})
