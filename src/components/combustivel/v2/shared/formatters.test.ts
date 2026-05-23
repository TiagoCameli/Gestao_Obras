import { describe, it, expect } from 'vitest'
import { fmtData, fmtDataHora, nowAsLocalInputBRT, inputLocalBRTtoISOUTC } from './formatters'

describe('fmtData', () => {
  it('formata ISO UTC em DD/MM/YY BRT', () => {
    expect(fmtData('2026-05-21T14:43:00+00:00')).toBe('21/05/26')
  })
  it('formata ISO UTC tarde-noite respeitando virada de dia em BRT', () => {
    expect(fmtData('2026-05-22T02:00:00+00:00')).toBe('21/05/26')
  })
  it('retorna — pra string vazia', () => {
    expect(fmtData('')).toBe('—')
  })
  it('retorna fallback pra ISO inválido', () => {
    expect(fmtData('lixo')).toBe('lixo'.slice(0, 10))
  })
})

describe('fmtDataHora', () => {
  it('formata ISO UTC com hora em BRT', () => {
    expect(fmtDataHora('2026-05-21T14:43:00+00:00')).toBe('21/05/26 11:43')
  })
  it('formata virada de dia em BRT', () => {
    expect(fmtDataHora('2026-05-22T02:30:00+00:00')).toBe('21/05/26 23:30')
  })
  it('retorna — pra string vazia', () => {
    expect(fmtDataHora('')).toBe('—')
  })
})

describe('nowAsLocalInputBRT', () => {
  it('retorna formato YYYY-MM-DDTHH:MM', () => {
    expect(nowAsLocalInputBRT()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('inputLocalBRTtoISOUTC', () => {
  it('converte 11:43 BRT em 14:43 UTC (+3h)', () => {
    expect(inputLocalBRTtoISOUTC('2026-05-21T11:43')).toBe('2026-05-21T14:43:00.000Z')
  })
  it('vazio retorna vazio', () => {
    expect(inputLocalBRTtoISOUTC('')).toBe('')
  })
})
