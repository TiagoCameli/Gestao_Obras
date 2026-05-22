import { describe, it, expect } from 'vitest'
import { entradaCombustivelSchema } from './entradaCombustivel.schema'

const validBase = {
  dataHora: '2026-05-22T08:00',
  depositoId: 'dep-1',
  tipoCombustivel: 'ins-diesel',
  quantidadeLitros: 1000,
  valorUnitario: 5.5,
  fornecedor: 'forn-1',
  notaFiscal: 'NF-12345',
  observacoes: '',
}

describe('entradaCombustivelSchema', () => {
  it('aceita objeto válido', () => {
    expect(entradaCombustivelSchema.safeParse(validBase).success).toBe(true)
  })

  it('rejeita quantidadeLitros = 0', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, quantidadeLitros: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('quantidadeLitros'))).toBe(true)
    }
  })

  it('rejeita quantidadeLitros negativo', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, quantidadeLitros: -10 })
    expect(r.success).toBe(false)
  })

  it('rejeita valorUnitario = 0', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, valorUnitario: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('valorUnitario'))).toBe(true)
    }
  })

  it('rejeita depositoId vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, depositoId: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita tipoCombustivel vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, tipoCombustivel: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita fornecedor vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, fornecedor: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita dataHora vazia', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, dataHora: '' })
    expect(r.success).toBe(false)
  })

  it('aceita notaFiscal vazia (opcional)', () => {
    expect(entradaCombustivelSchema.safeParse({ ...validBase, notaFiscal: '' }).success).toBe(true)
  })

  it('aceita observacoes vazia (opcional)', () => {
    expect(entradaCombustivelSchema.safeParse({ ...validBase, observacoes: '' }).success).toBe(true)
  })
})
