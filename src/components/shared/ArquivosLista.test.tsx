// Regressão do InvalidJWT nos anexos-documento: clicar num arquivo abre o
// visualizador com URL RE-ASSINADA, e enquanto não re-assina não há ação
// clicável (pra nunca navegar pra URL crua expirada).

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))
// pdf.js não roda em jsdom — o que importa aqui é a URL que chega no viewer.
vi.mock('./PdfPreview', () => ({
  default: ({ url }: { url: string }) => <div data-testid="pdf-preview" data-url={url} />,
}))

import ArquivosLista from './ArquivosLista'
import { supabase } from '@/lib/supabase'

const mockStorageFrom = supabase.storage.from as Mock

const PDF_GUARDADO =
  'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/equipamento/mr2misv08056r/1785000000-manual.pdf?token=EXPIRADO'
const XLSX_GUARDADO =
  'https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/equipamento/mr2misv08056r/1785000001-nota.xlsx?token=EXPIRADO'

const FRESCA = (nome: string) =>
  `https://abc.supabase.co/fresca/equipamento/mr2misv08056r/${nome}?token=NOVO`

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStorageFrom.mockReturnValue({
    createSignedUrl: vi.fn((path: string) =>
      Promise.resolve({ data: { signedUrl: FRESCA(path.split('/').pop()!) }, error: null }),
    ),
  })
})

describe('ArquivosLista', () => {
  it('mostra o nome limpo do arquivo (sem prefixo de timestamp)', async () => {
    render(<ArquivosLista arquivoUrls={[PDF_GUARDADO]} />, { wrapper: Wrapper })
    expect(await screen.findByText('manual.pdf')).toBeInTheDocument()
  })

  it('clicar no PDF abre o visualizador com a URL fresca', async () => {
    render(<ArquivosLista arquivoUrls={[PDF_GUARDADO]} />, { wrapper: Wrapper })

    const botao = await waitFor(() => screen.getByRole('button', { name: 'manual.pdf' }))
    await userEvent.click(botao)

    const preview = await screen.findByTestId('pdf-preview')
    expect(preview).toHaveAttribute('data-url', FRESCA('1785000000-manual.pdf'))
    expect(preview.getAttribute('data-url')).not.toContain('EXPIRADO')
  })

  it('planilha não tem preview: cai no card de download', async () => {
    render(<ArquivosLista arquivoUrls={[XLSX_GUARDADO]} />, { wrapper: Wrapper })

    const botao = await waitFor(() => screen.getByRole('button', { name: 'nota.xlsx' }))
    await userEvent.click(botao)

    expect(await screen.findByText(/não abre direto no navegador/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /baixar arquivo/i })).toBeInTheDocument()
  })

  it('navega entre os anexos com as setas do visualizador', async () => {
    render(<ArquivosLista arquivoUrls={[PDF_GUARDADO, XLSX_GUARDADO]} />, { wrapper: Wrapper })

    const botao = await waitFor(() => screen.getByRole('button', { name: 'manual.pdf' }))
    await userEvent.click(botao)
    expect(await screen.findByTestId('pdf-preview')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /próximo anexo/i }))
    expect(await screen.findByText(/não abre direto no navegador/i)).toBeInTheDocument()
  })

  it('Esc fecha só o visualizador (não vaza a tecla pro drawer atrás)', async () => {
    const onKeyDoDrawer = vi.fn()
    document.addEventListener('keydown', onKeyDoDrawer)
    try {
      render(<ArquivosLista arquivoUrls={[PDF_GUARDADO]} />, { wrapper: Wrapper })
      const botao = await waitFor(() => screen.getByRole('button', { name: 'manual.pdf' }))
      await userEvent.click(botao)
      expect(await screen.findByRole('dialog')).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(onKeyDoDrawer).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', onKeyDoDrawer)
    }
  })

  it('não renderiza nada quando não há arquivo', () => {
    const { container } = render(<ArquivosLista arquivoUrls={[]} />, { wrapper: Wrapper })
    expect(container).toBeEmptyDOMElement()
  })
})
