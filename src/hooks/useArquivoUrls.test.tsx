import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

import { useArquivoUrls } from './useArquivoUrls'
import { supabase } from '@/lib/supabase'

const mockStorageFrom = supabase.storage.from as Mock

function mockCreateSignedUrl(fresh: string) {
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: fresh }, error: null })
  mockStorageFrom.mockReturnValue({ createSignedUrl })
  return createSignedUrl
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

const STORED =
  'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/entrada/mqu0nu9dl46hk/1782420000-nota.pdf?token=EXPIRADO'

describe('useArquivoUrls', () => {
  it('re-assina a URL a partir do path guardado (não reusa a URL crua expirada)', async () => {
    const fresh =
      'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/entrada/mqu0nu9dl46hk/1782420000-nota.pdf?token=NOVO'
    const createSignedUrl = mockCreateSignedUrl(fresh)

    const { result } = renderHook(() => useArquivoUrls([STORED]), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(createSignedUrl).toHaveBeenCalledWith(
      'entrada/mqu0nu9dl46hk/1782420000-nota.pdf',
      60 * 60,
    )
    expect(result.current.data).toEqual([fresh])
    expect(result.current.data?.[0]).not.toBe(STORED)
  })

  it('mantém a URL original quando não é uma signed URL (path irreconhecível)', async () => {
    const createSignedUrl = mockCreateSignedUrl('irrelevante')
    const plain = 'https://example.com/arquivo.pdf'

    const { result } = renderHook(() => useArquivoUrls([plain]), { wrapper })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([plain])
  })
})
