// Regressão do InvalidJWT: a foto tem que aparecer com URL RE-ASSINADA, nunca
// com a signed URL guardada no banco (que expira em 1h).

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

import FotoGaleria from './FotoGaleria'
import { supabase } from '@/lib/supabase'

const mockStorageFrom = supabase.storage.from as Mock

/** URL como está gravada no banco: assinada na hora do upload, já expirada. */
const GUARDADA =
  'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/equipamento/mr2misv08056r/1785000000-frente.jpg?token=EXPIRADO'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStorageFrom.mockReturnValue({
    createSignedUrl: vi.fn((path: string) =>
      Promise.resolve({ data: { signedUrl: `https://abc.supabase.co/fresca/${path}?token=NOVO` }, error: null }),
    ),
  })
})

describe('FotoGaleria', () => {
  it('mostra a thumb com URL fresca, não a URL expirada do banco', async () => {
    render(<FotoGaleria fotoUrls={[GUARDADA]} canDelete={false} canDownload />, { wrapper: Wrapper })

    await waitFor(() => {
      const img = screen.getByAltText('Foto 1')
      expect(img).toHaveAttribute(
        'src',
        'https://abc.supabase.co/fresca/equipamento/mr2misv08056r/1785000000-frente.jpg.thumb.jpg?token=NOVO',
      )
    })
    expect(screen.getByAltText('Foto 1').getAttribute('src')).not.toContain('EXPIRADO')
  })

  it('ao ampliar, o visualizador usa a preview fresca e "abrir em nova aba" o original fresco', async () => {
    render(<FotoGaleria fotoUrls={[GUARDADA]} canDelete={false} canDownload />, { wrapper: Wrapper })

    await waitFor(() => expect(screen.getByAltText('Foto 1')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /ampliar/i }))

    const ampliada = await screen.findByRole('dialog')
    expect(ampliada).toBeInTheDocument()

    const img = screen.getByAltText('frente.jpg')
    expect(img.getAttribute('src')).toBe(
      'https://abc.supabase.co/fresca/equipamento/mr2misv08056r/1785000000-frente.jpg.preview.jpg?token=NOVO',
    )

    const link = screen.getByRole('link', { name: /abrir em nova aba/i })
    expect(link).toHaveAttribute(
      'href',
      'https://abc.supabase.co/fresca/equipamento/mr2misv08056r/1785000000-frente.jpg?token=NOVO',
    )
    expect(link.getAttribute('href')).not.toContain('EXPIRADO')
  })

  it('não oferece excluir quando canDelete é false', async () => {
    render(<FotoGaleria fotoUrls={[GUARDADA]} canDelete={false} canDownload />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByAltText('Foto 1')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /remover foto/i })).not.toBeInTheDocument()
  })

  it('chama onDelete com o índice da foto no modo edição', async () => {
    const onDelete = vi.fn()
    render(
      <FotoGaleria fotoUrls={[GUARDADA]} canDelete canDownload onDelete={onDelete} />,
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(screen.getByAltText('Foto 1')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /remover foto 1/i }))
    expect(onDelete).toHaveBeenCalledWith(0)
  })
})
