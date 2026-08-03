import { describe, it, expect } from 'vitest'
import { extOf, kindOfAnexo, temPreviewInApp, labelKind } from './anexos'

const SIGNED = (nome: string) =>
  `https://abc.supabase.co/storage/v1/object/sign/abastecimento-fotos/equipamento/abc/1785000000-${nome}?token=xyz`

describe('extOf', () => {
  it('lê extensão ignorando query string da signed URL', () => {
    expect(extOf(SIGNED('manual.PDF'))).toBe('pdf')
    expect(extOf('nota.xlsx')).toBe('xlsx')
  })

  it('retorna vazio quando não há extensão', () => {
    expect(extOf('arquivo-sem-extensao')).toBe('')
    expect(extOf('')).toBe('')
  })
})

describe('kindOfAnexo', () => {
  it('classifica imagem, pdf, planilha e documento', () => {
    expect(kindOfAnexo('foto.jpg')).toBe('imagem')
    expect(kindOfAnexo('foto.HEIC')).toBe('imagem')
    expect(kindOfAnexo(SIGNED('manual.pdf'))).toBe('pdf')
    expect(kindOfAnexo('planilha.csv')).toBe('planilha')
    expect(kindOfAnexo('contrato.docx')).toBe('texto')
  })

  it('cai em "outro" pro que não reconhece', () => {
    expect(kindOfAnexo('backup.zip')).toBe('outro')
    expect(kindOfAnexo('sem-extensao')).toBe('outro')
  })
})

describe('temPreviewInApp', () => {
  it('imagem comum e PDF abrem dentro do app', () => {
    expect(temPreviewInApp('imagem', 'foto.jpg')).toBe(true)
    expect(temPreviewInApp('pdf', 'manual.pdf')).toBe(true)
  })

  it('HEIC não renderiza em Chrome/Firefox — vai pro card de download', () => {
    expect(temPreviewInApp('imagem', 'foto.heic')).toBe(false)
    expect(temPreviewInApp('imagem', 'foto.HEIF')).toBe(false)
  })

  it('planilha e documento não têm preview', () => {
    expect(temPreviewInApp('planilha', 'nota.xlsx')).toBe(false)
    expect(temPreviewInApp('texto', 'contrato.docx')).toBe(false)
    expect(temPreviewInApp('outro', 'backup.zip')).toBe(false)
  })
})

describe('labelKind', () => {
  it('tem rótulo pra todo kind', () => {
    expect(labelKind('imagem')).toBe('Imagem')
    expect(labelKind('pdf')).toBe('PDF')
    expect(labelKind('outro')).toBe('Arquivo')
  })
})
