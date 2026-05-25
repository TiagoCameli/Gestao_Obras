import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pathFromSignedUrl, fileNameFromUrl, downloadSignedUrl } from './signedUrl'

describe('pathFromSignedUrl', () => {
  it('extrai path de URL assinada padrão Supabase', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/frete-chegada/123/1700000000-foto.jpg?token=xyz'
    expect(pathFromSignedUrl(url)).toBe('frete-chegada/123/1700000000-foto.jpg')
  })

  it('decoda %20 e outros caracteres', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/foto%20com%20espa%C3%A7o.jpg?token=xyz'
    expect(pathFromSignedUrl(url)).toBe('pasta/foto com espaço.jpg')
  })

  it('retorna null pra URL não-assinada', () => {
    expect(pathFromSignedUrl('https://example.com/foo.jpg')).toBeNull()
    expect(pathFromSignedUrl('')).toBeNull()
  })
})

describe('fileNameFromUrl', () => {
  it('retorna último segmento sem prefixo timestamp', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/1700000000-foto.jpg?token=xyz'
    expect(fileNameFromUrl(url)).toBe('foto.jpg')
  })

  it('mantém URL completa quando não é assinada', () => {
    expect(fileNameFromUrl('https://example.com/foo.jpg')).toBe('https://example.com/foo.jpg')
  })

  it('lida com path sem prefixo timestamp', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/bucket/pasta/foto.jpg?token=xyz'
    expect(fileNameFromUrl(url)).toBe('foto.jpg')
  })
})

describe('downloadSignedUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
    } as unknown as Response)))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('faz fetch, cria blob URL e aciona click no anchor', async () => {
    const clickSpy = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      ;(node as HTMLAnchorElement).click = clickSpy
      return node
    })
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

    await downloadSignedUrl('https://x.com/foto.jpg', 'minha.jpg')

    expect(fetch).toHaveBeenCalledWith('https://x.com/foto.jpg')
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })

  it('fallback abre nova aba quando fetch falha', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('net'))))
    const openSpy = vi.fn()
    vi.stubGlobal('window', { open: openSpy } as unknown as Window)

    await downloadSignedUrl('https://x.com/foto.jpg', 'minha.jpg')

    expect(openSpy).toHaveBeenCalledWith('https://x.com/foto.jpg', '_blank', 'noopener,noreferrer')
  })
})
