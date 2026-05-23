import { describe, it, expect } from 'vitest'
import {
  fmtData,
  fmtDataHora,
  nowAsLocalInput,
  inputLocalToWallClock,
  fmtDataHoraSistema,
} from './formatters'

describe('fmtData (wall-clock — NÃO converte TZ)', () => {
  it('extrai data do ISO sem aplicar TZ', () => {
    // 2026-05-22 02:00 (qualquer TZ no string) → mostra 22, não 21
    expect(fmtData('2026-05-22T02:00:00+00:00')).toBe('22/05/26')
    expect(fmtData('2026-05-22T02:00:00')).toBe('22/05/26')
    expect(fmtData('2026-05-22 02:00:00')).toBe('22/05/26')
  })
  it('aceita date-only', () => {
    expect(fmtData('2026-05-21')).toBe('21/05/26')
  })
  it('retorna — pra vazio', () => {
    expect(fmtData('')).toBe('—')
    expect(fmtData(null)).toBe('—')
    expect(fmtData(undefined)).toBe('—')
  })
  it('fallback pra lixo', () => {
    expect(fmtData('lixo')).toBe('lixo')
  })
})

describe('fmtDataHora (wall-clock — NÃO converte TZ)', () => {
  it('extrai data+hora do ISO sem aplicar TZ', () => {
    // 15:00 in → 15:00 out, qualquer TZ
    expect(fmtDataHora('2026-05-21T15:00:00+00:00')).toBe('21/05/26 15:00')
    expect(fmtDataHora('2026-05-21T15:00:00')).toBe('21/05/26 15:00')
    expect(fmtDataHora('2026-05-21 15:00:00-03')).toBe('21/05/26 15:00')
  })
  it('retorna — pra vazio', () => {
    expect(fmtDataHora('')).toBe('—')
  })
})

describe('nowAsLocalInput', () => {
  it('retorna formato YYYY-MM-DDTHH:MM (device clock)', () => {
    expect(nowAsLocalInput()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('inputLocalToWallClock', () => {
  it('append :00 se size 16', () => {
    expect(inputLocalToWallClock('2026-05-21T15:00')).toBe('2026-05-21T15:00:00')
  })
  it('preserva se já tem seconds', () => {
    expect(inputLocalToWallClock('2026-05-21T15:00:00')).toBe('2026-05-21T15:00:00')
  })
  it('vazio retorna vazio', () => {
    expect(inputLocalToWallClock('')).toBe('')
  })
})

describe('fmtDataHoraSistema (auto-set timestamptz — converte pra BR)', () => {
  it('converte UTC pra BRT (único caso intencional de TZ)', () => {
    // 2026-05-21 14:43 UTC = 11:43 BRT
    expect(fmtDataHoraSistema('2026-05-21T14:43:00+00:00')).toBe('21/05/26 11:43')
  })
  it('virada de dia BRT', () => {
    expect(fmtDataHoraSistema('2026-05-22T02:30:00+00:00')).toBe('21/05/26 23:30')
  })
  it('vazio', () => {
    expect(fmtDataHoraSistema('')).toBe('—')
  })
})
