import { describe, it, expect } from 'vitest'
import { extractEquipamentoId } from './parseFreteQrUrl'

describe('extractEquipamentoId', () => {
  it('extrai ID de URL com host localhost (etiquetas físicas existentes)', () => {
    expect(extractEquipamentoId('http://localhost:5175/m/eq/eh-001')).toBe('eh-001')
    expect(extractEquipamentoId('http://localhost:5175/m/eq/moul02cymgzg1')).toBe('moul02cymgzg1')
  })

  it('extrai ID de URL com host de produção', () => {
    expect(extractEquipamentoId('https://emtconstrutora.com/m/eq/eh-001')).toBe('eh-001')
  })

  it('extrai ID de path relativo', () => {
    expect(extractEquipamentoId('/m/eq/eh-001')).toBe('eh-001')
  })

  it('extrai ID quando o texto é apenas o ID puro (fallback)', () => {
    expect(extractEquipamentoId('eh-001')).toBe('eh-001')
    expect(extractEquipamentoId('moul02cymgzg1')).toBe('moul02cymgzg1')
  })

  it('extrai ID de URL com query string', () => {
    expect(extractEquipamentoId('https://emtconstrutora.com/m/eq/eh-001?ref=qr')).toBe('eh-001')
  })

  it('rejeita strings que não casam (vCard, URL externa, lixo, ID curto)', () => {
    expect(extractEquipamentoId('BEGIN:VCARD\nN:Tiago\nEND:VCARD')).toBe(null)
    expect(extractEquipamentoId('https://google.com')).toBe(null)
    expect(extractEquipamentoId('00020126...pix...')).toBe(null)
    expect(extractEquipamentoId('/m/eq/ab')).toBe(null) // ID < 4 chars
    expect(extractEquipamentoId('')).toBe(null)
    expect(extractEquipamentoId('x'.repeat(600))).toBe(null) // sanity cap
  })
})
