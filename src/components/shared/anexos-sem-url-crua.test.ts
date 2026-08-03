// Trava de regressão do InvalidJWT.
//
// O banco guarda a signed URL COMPLETA em foto_urls/arquivo_urls, e o JWT dela
// expira em 1h. Quem renderiza a string do banco direto num <img src> ou
// <a href> quebra com:
//   {"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp
//    check failed"}
//
// Esse bug já foi corrigido três vezes em telas diferentes (8b9dfb0 nas fotos
// dos drawers, 93802d5 nos arquivos dos drawers, e depois nos 9 pontos que
// tinham ficado de fora). Este teste existe pra não ter uma quarta.
//
// Regra: em components/ e pages/, anexo se exibe pelos componentes
// compartilhados (FotoGaleria, ArquivosLista, AnexosAbrirButton), que
// re-assinam a URL a partir do path. Se precisar de um caso novo, use a URL
// vinda de useFotoThumbnails/useArquivoUrls e dê a ela um nome que diga isso
// (urlFresca, fresca, item.src) — nunca `url` cru do banco.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
// src/modules/ tem arquitetura própria e correta: guarda o PATH no banco e
// assina na leitura (createSignedUrls), então lá `url` já é fresca.
const PASTAS = ['components', 'pages']

const PADROES: { re: RegExp; oque: string }[] = [
  { re: /\bsrc=\{url\}/, oque: 'src={url}' },
  { re: /\bhref=\{url\}/, oque: 'href={url}' },
  { re: /\b(?:src|href)=\{[\w.]*\b(?:foto|arquivo)Urls\[/i, oque: 'src/href={...fotoUrls[i]} ou {...arquivoUrls[i]}' },
]

function arquivosTsx(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      out.push(...arquivosTsx(caminho))
    } else if (nome.endsWith('.tsx') && !nome.includes('.test.')) {
      out.push(caminho)
    }
  }
  return out
}

describe('anexos nunca renderizam a signed URL crua do banco', () => {
  it('nenhum src/href aponta pra URL guardada (expira em 1h -> InvalidJWT)', () => {
    const infracoes: string[] = []

    for (const pasta of PASTAS) {
      for (const arquivo of arquivosTsx(join(RAIZ, pasta))) {
        const linhas = readFileSync(arquivo, 'utf8').split('\n')
        linhas.forEach((linha, i) => {
          for (const { re, oque } of PADROES) {
            if (re.test(linha)) {
              infracoes.push(`${relative(RAIZ, arquivo)}:${i + 1} — ${oque}`)
            }
          }
        })
      }
    }

    expect(infracoes, [
      'Anexo exibido com a signed URL crua do banco (quebra em 1h com InvalidJWT).',
      'Use FotoGaleria / ArquivosLista / AnexosAbrirButton, ou uma URL re-assinada',
      'por useFotoThumbnails / useArquivoUrls.',
      '',
      ...infracoes,
    ].join('\n')).toEqual([])
  })
})
