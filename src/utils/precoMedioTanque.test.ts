import { describe, it, expect } from 'vitest'
import { calcularPrecoMedioTanque } from './precoMedioTanque'
import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

const e = (depositoId: string, qtd: number, valor: number): EntradaCombustivel => ({
  id: 'e-' + Math.random(),
  dataHora: '2026-01-01T00:00:00Z',
  depositoId,
  tipoCombustivel: 'diesel',
  quantidadeLitros: qtd,
  valorTotal: valor,
  fornecedor: '',
  notaFiscal: '',
  observacoes: '',
  criadoPor: '',
})

const t = (origemId: string, destinoId: string, qtd: number, valor: number): TransferenciaCombustivel => ({
  id: 't-' + Math.random(),
  dataHora: '2026-01-01T00:00:00Z',
  depositoOrigemId: origemId,
  depositoDestinoId: destinoId,
  quantidadeLitros: qtd,
  valorTotal: valor,
  observacoes: '',
  criadoPor: '',
})

describe('calcularPrecoMedioTanque', () => {
  it('retorna 0 se não houver entradas nem transferências recebidas', () => {
    expect(calcularPrecoMedioTanque('t1', [], [])).toBe(0)
  })

  it('média ponderada apenas com entradas', () => {
    const entradas = [e('t1', 1000, 5000), e('t1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBeCloseTo(8000 / 1500, 4)
  })

  it('ignora entradas de outros depósitos', () => {
    const entradas = [e('t1', 1000, 5000), e('OUTRO', 500, 9999)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBe(5)
  })

  it('inclui transferências recebidas (depositoDestinoId === tanqueId)', () => {
    const entradas = [e('t1', 1000, 5000)]
    const transferencias = [t('OUTRO', 't1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', entradas, transferencias)).toBeCloseTo(8000 / 1500, 4)
  })

  it('ignora transferências enviadas (depositoOrigemId === tanqueId)', () => {
    const entradas = [e('t1', 1000, 5000)]
    const transferencias = [t('t1', 'OUTRO', 500, 9999)]
    expect(calcularPrecoMedioTanque('t1', entradas, transferencias)).toBe(5)
  })

  it('tanque que só recebe via transferência (sem entradas)', () => {
    const transferencias = [t('OUTRO', 't1', 500, 3000)]
    expect(calcularPrecoMedioTanque('t1', [], transferencias)).toBe(6)
  })

  it('respeita litros zero (divisão evitada)', () => {
    const entradas = [e('t1', 0, 0)]
    expect(calcularPrecoMedioTanque('t1', entradas, [])).toBe(0)
  })
})
