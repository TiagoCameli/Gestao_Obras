import { describe, it, expect } from 'vitest'
import { transferenciaCombustivelSchema } from './transferenciaCombustivel.schema'

const valid = {
  dataHora: '2026-05-22T08:00',
  depositoOrigemId: 'dep-1',
  depositoDestinoId: 'dep-2',
  quantidadeLitros: 500,
  valorTotal: 2500,
  observacoes: '',
}

describe('transferenciaCombustivelSchema', () => {
  it('aceita transferência válida', () => {
    expect(transferenciaCombustivelSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita quantidadeLitros = 0', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, quantidadeLitros: 0 }).success).toBe(false)
  })

  it('rejeita quantidadeLitros negativo', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, quantidadeLitros: -1 }).success).toBe(false)
  })

  it('rejeita depositoOrigemId vazio', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, depositoOrigemId: '' }).success).toBe(false)
  })

  it('rejeita depositoDestinoId vazio', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, depositoDestinoId: '' }).success).toBe(false)
  })

  it('rejeita mesmo tanque origem e destino', () => {
    const r = transferenciaCombustivelSchema.safeParse({ ...valid, depositoDestinoId: 'dep-1' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.toLowerCase().includes('diferente'))).toBe(true)
    }
  })

  it('aceita valorTotal = 0 (opcional)', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, valorTotal: 0 }).success).toBe(true)
  })

  it('rejeita valorTotal negativo', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, valorTotal: -100 }).success).toBe(false)
  })

  it('aceita observacoes vazia', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, observacoes: '' }).success).toBe(true)
  })

  it('rejeita dataHora vazia', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, dataHora: '' }).success).toBe(false)
  })
})
