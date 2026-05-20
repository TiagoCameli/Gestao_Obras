import { describe, it, expect } from 'vitest'
import { calcularUpdateFotoChegada } from './freteFotoChegada'

describe('calcularUpdateFotoChegada', () => {
  it('auto-preenche dataChegada quando foto sobe e dataChegada está vazia', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegadaAtual: undefined,
      hoje: '2026-05-20',
    })
    expect(out).toEqual({
      fotoChegadaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegada: '2026-05-20',
    })
  })

  it('respeita dataChegada existente quando foto sobe', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
      dataChegadaAtual: '2026-05-15',
      hoje: '2026-05-20',
    })
    expect(out).toEqual({
      fotoChegadaUrl: 'https://x.supabase.co/storage/v1/object/sign/a/b.jpg',
    })
  })

  it('remove fotoChegadaUrl quando novaUrl é null sem mexer em dataChegada', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: null,
      dataChegadaAtual: '2026-05-15',
      hoje: '2026-05-20',
    })
    expect(out).toEqual({ fotoChegadaUrl: null })
  })

  it('trata string vazia como remoção', () => {
    const out = calcularUpdateFotoChegada({
      novaUrl: '',
      dataChegadaAtual: undefined,
      hoje: '2026-05-20',
    })
    expect(out).toEqual({ fotoChegadaUrl: null })
  })
})
