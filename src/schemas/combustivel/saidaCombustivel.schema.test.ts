import { describe, it, expect } from 'vitest'
import { saidaCombustivelSchema } from './saidaCombustivel.schema'

const validEquipamentoTanque = {
  data: '2026-05-22T08:00',
  origem: 'tanque' as const,
  tipoConsumidor: 'equipamento_proprio' as const,
  tanqueId: 'dep-1',
  equipamentoId: 'eq-1',
  transportadoraId: '',
  placa: '',
  obraId: 'obra-1',
  etapaId: 'et-1',
  tipoCombustivel: 'ins-diesel',
  litros: 100,
  taxaLitro: 0,
  precoUnitarioManual: 0,
  precoCombustivel: 0,
  precoCombustivelAreacre: 0,
  motorista: '',
  medicaoLeitura: '',
  observacoes: '',
  pago: false,
  pagoEm: '',
}

describe('saidaCombustivelSchema', () => {
  it('aceita saída equipamento_proprio + tanque válida', () => {
    expect(saidaCombustivelSchema.safeParse(validEquipamentoTanque).success).toBe(true)
  })

  it('rejeita litros = 0', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, litros: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita litros negativo', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, litros: -1 })
    expect(r.success).toBe(false)
  })

  it('exige equipamentoId quando tipoConsumidor = equipamento_proprio', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, equipamentoId: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('equipamentoId'))).toBe(true)
    }
  })

  it('rejeita equipamentoId = desconhecido (sentinela) em equipamento_proprio', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, equipamentoId: 'desconhecido' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('equipamentoId'))).toBe(true)
    }
  })

  it('exige etapaId em toda saída', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, etapaId: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('etapaId'))).toBe(true)
    }
  })

  it('exige etapaId também em carreta', () => {
    const r = saidaCombustivelSchema.safeParse({
      ...validEquipamentoTanque,
      tipoConsumidor: 'carreta_transportadora',
      equipamentoId: '',
      transportadoraId: 'transp-1',
      precoCombustivel: 5,
      etapaId: '',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('etapaId'))).toBe(true)
    }
  })

  it('exige transportadoraId quando tipoConsumidor = carreta_transportadora', () => {
    const carreta = {
      ...validEquipamentoTanque,
      tipoConsumidor: 'carreta_transportadora' as const,
      equipamentoId: '',
      transportadoraId: '',
      precoCombustivel: 5.0,
    }
    expect(saidaCombustivelSchema.safeParse(carreta).success).toBe(false)
  })

  it('exige tanqueId quando origem = tanque', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, tanqueId: '' })
    expect(r.success).toBe(false)
  })

  it('aceita origem = dinheiro sem tanque + com precoUnitarioManual', () => {
    const dinheiro = {
      ...validEquipamentoTanque,
      origem: 'dinheiro' as const,
      tanqueId: '',
      precoUnitarioManual: 6.0,
    }
    expect(saidaCombustivelSchema.safeParse(dinheiro).success).toBe(true)
  })

  it('rejeita origem = dinheiro com precoUnitarioManual = 0', () => {
    const dinheiro = {
      ...validEquipamentoTanque,
      origem: 'dinheiro' as const,
      tanqueId: '',
      precoUnitarioManual: 0,
    }
    expect(saidaCombustivelSchema.safeParse(dinheiro).success).toBe(false)
  })

  it('aceita carreta válida com transportadora + preco', () => {
    const carreta = {
      ...validEquipamentoTanque,
      tipoConsumidor: 'carreta_transportadora' as const,
      equipamentoId: '',
      transportadoraId: 'forn-1',
      placa: 'ABC1234',
      precoCombustivel: 6.0,
    }
    expect(saidaCombustivelSchema.safeParse(carreta).success).toBe(true)
  })

  it('exige obraId', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, obraId: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita tipoCombustivel vazio', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, tipoCombustivel: '' })
    expect(r.success).toBe(false)
  })
})
