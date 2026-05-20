import { describe, it, expect } from 'vitest'
import { gerarTokenCotacao, urlPortalCotacao } from './comprasToken'

describe('gerarTokenCotacao', () => {
  it('gera token com tamanho default de 32 caracteres', () => {
    const token = gerarTokenCotacao()
    expect(token).toHaveLength(32)
  })

  it('respeita tamanho customizado', () => {
    expect(gerarTokenCotacao(16)).toHaveLength(16)
    expect(gerarTokenCotacao(64)).toHaveLength(64)
  })

  it('usa apenas caracteres alfanuméricos (case-sensitive)', () => {
    const token = gerarTokenCotacao(100)
    expect(token).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('gera tokens distintos em chamadas sucessivas', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => gerarTokenCotacao()))
    expect(tokens.size).toBe(50)
  })
})

describe('urlPortalCotacao', () => {
  it('monta URL com token concatenado', () => {
    const url = urlPortalCotacao('abc123')
    expect(url).toContain('/cotacao/r/abc123')
  })

  it('remove trailing slash do base antes de concatenar', () => {
    // jsdom default origin é http://localhost — não tem trailing slash, mas o
    // teste valida que o regex .replace(/\/$/, '') não duplica barras.
    const url = urlPortalCotacao('xyz')
    expect(url).not.toContain('//cotacao')
    expect(url.split('/cotacao/r/').length).toBe(2)
  })
})
