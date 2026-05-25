# Galeria de fotos do frete — drawer + edit

**Data:** 2026-05-24
**Status:** Aprovado, pronto pra plano

## Contexto

Módulo de Frete (`src/components/frete/`) atualmente tem dois pontos de fricção na UX de fotos:

1. **Drawer de detalhes (`FreteDetalhesDrawer` → `FreteFotoChegadaBlock` variant='card')**
   - Fotos demoram a carregar (URLs full-res ~2MB cada, sem thumbnail)
   - Click abre em nova aba do browser (sai do app)
   - Botão de remover aparece no drawer (mesma UI do edit), permitindo deleção acidental
   - Não há botão de download por foto

2. **Modo edição (`FreteForm`)**
   - Duas áreas distintas de fotos: "Foto da Chegada da Carga" + "Anexos" (que mistura fotos+arquivos)
   - Confunde o usuário sobre onde colocar cada foto
   - Limites separados — total real de fotos > 8

## Requisitos

### Drawer
- Click na foto → abre lightbox in-app (não abre nova aba)
- Cada foto tem botão de download
- Sem botão de delete (deleção só no modo edição)
- Upload continua disponível (botões "Tirar foto" / "Da galeria")
- Thumbnails leves no grid (não baixar full-res)

### Edit mode
- 1 única área de fotos: "Fotos da Chegada da Carga", limite 8
- 1ª foto = principal (vai pra `fotoChegadaUrl`); resto vai pra `fotoUrls`
- Área separada de "Arquivos" (PDF/Excel/Word) permanece — só remove as **fotos** do segundo bloco

### Performance
- Grid usa thumbnails (~30KB cada) gerados via Supabase Storage image transform
- Lightbox usa URL original (full-res)
- Fallback pra URL original se transform falhar (caso projeto não esteja em plano Pro)

## Arquitetura

### Componentes

**Novo: `src/components/frete/FotoFreteGaleria.tsx`**
Componente compartilhado pra renderizar o grid + lightbox de fotos do frete. Props:

```ts
interface Props {
  fotoUrls: string[]
  canDelete: boolean
  canDownload: boolean
  onDelete?: (index: number) => void
  /** Marca a 1ª foto como "Principal" visualmente. Default true. */
  showPrincipalBadge?: boolean
}
```

Comportamento:
- Renderiza grid responsivo (3-4 colunas)
- Cada thumb usa URL transformada via `useFreteThumbnails`
- Click no thumb → abre lightbox interno (state local)
- Hover (desktop) / sempre visível (mobile via touch): botão download por foto
- Se `canDelete=true`: botão delete também (hover/touch)
- Badge "Principal" na primeira foto se `showPrincipalBadge`
- Lightbox: prev/next, contador, download, fechar (Esc/click outside/botão)

**Modificado: `src/components/frete/FreteFotoChegadaBlock.tsx`**

Decisão de implementação: extrair os botões de upload (`Tirar foto` / `Da galeria`) do `AnexosUploader` pra um sub-componente `<UploadFotosButtons>` no próprio arquivo `AnexosUploader.tsx` (export named). Assim:
- `FreteFotoChegadaBlock` renderiza `<UploadFotosButtons>` + `<FotoFreteGaleria>` separadamente, sem precisar do display embutido do AnexosUploader.
- `AnexosUploader` continua funcional como antes (botões + grid próprio com delete) pra ser usado no `FreteForm` modo edição.

Lógica por modo:
- Drawer (`variant='card'`, `canEdit=true`): `<UploadFotosButtons>` + `<FotoFreteGaleria canDelete={false} canDownload={true}>`
- Read-only (`canEdit=false`): só `<FotoFreteGaleria canDelete={false} canDownload={true}>`
- Compact (`variant='compact'`): mesma estrutura, espaçamento menor

**Modificado: `src/components/frete/FreteForm.tsx`**
- Remove o segundo `AnexosUploader` de fotos
- Mantém **1 `AnexosUploader` pra fotos** combinadas (lista `[fotoChegadaUrl, ...fotoUrls]`), limite 8
- Mantém **1 `AnexosUploader` pra arquivos** com `hideFotos`
- onChange handler combinado:
  ```ts
  function handleFotosChange(novas: string[]) {
    const principal = novas[0] ?? null
    const extras = novas.slice(1)
    if (!principal && fotoChegadaUrls[0]) {
      // sem fotos → mantém comportamento atual de zerar
    }
    if (principal && !dataChegada) {
      setDataChegada(new Date().toISOString().slice(0,10))
    }
    setFotoChegadaUrls(principal ? [principal] : [])
    setFotoUrls(extras)
  }
  ```
- Submit já envia `fotoChegadaUrl` + `fotoUrls` separadamente — não muda.

### Novo hook: `src/hooks/useFreteThumbnails.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const BUCKET = 'abastecimento-fotos'
const THUMB_TTL_SECS = 60 * 60
const THUMB_SIZE = 400
const THUMB_QUALITY = 75

function pathFromSignedUrl(url: string): string | null {
  const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function mintThumbnail(url: string): Promise<string> {
  const path = pathFromSignedUrl(url)
  if (!path) return url
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, THUMB_TTL_SECS, {
      transform: { width: THUMB_SIZE, height: THUMB_SIZE, resize: 'cover', quality: THUMB_QUALITY },
    })
  if (error || !data?.signedUrl) return url
  return data.signedUrl
}

export function useFreteThumbnails(urls: string[]) {
  return useQuery({
    queryKey: ['frete-thumbnails', ...urls],
    queryFn: () => Promise.all(urls.map(mintThumbnail)),
    staleTime: 1000 * 60 * 30,
    enabled: urls.length > 0,
  })
}
```

- Cache por 30min (URLs assinadas duram 1h, então 30min é seguro pra re-mintar antes de expirar)
- Query key inclui URLs originais — muda se subir/remover foto
- Fallback pro original se transform falhar (silencioso)

### Lightbox (dentro de FotoFreteGaleria)

Padrão visual idêntico ao `FotosEquipamentoGaleria.tsx`:
- `fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm`
- `role="dialog" aria-modal="true"`
- Click no overlay (não na imagem) fecha
- Botões: fechar (top-right), prev (left center), next (right center), download (top-left ao lado do contador)
- Teclado: Esc fecha, ← anterior, → próximo
- Imagem usa URL **original** (não thumbnail) — clicar é o "ver em alta resolução"

### Download

```ts
async function downloadFoto(url: string, fileName: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objUrl)
  } catch (e) {
    // fallback: abre em nova aba
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
```

`fileName` extraído via helper `fileNameFromUrl` que já existe em `FreteDetalhesDrawer.tsx` (consolidar em utilitário compartilhado: `src/utils/signedUrl.ts`).

## Mudanças menores

- **`src/utils/signedUrl.ts` (novo)**: extrai `pathFromSignedUrl` e `fileNameFromUrl` (duplicados em AnexosUploader e FreteDetalhesDrawer). Refatora chamadores pra importar daqui.
- **Não muda banco**: `fotoChegadaUrl` e `fotoUrls` continuam separados no schema.
- **Não muda hook de mutation**: `useAtualizarFrete` recebe payload com os 2 campos como hoje.

## Testes

- Unit: `freteFotoChegada.test.ts` já cobre a lógica do payload — adicionar caso "1ª foto removida promove 2ª" se ainda não cobrir.
- Manual (drawer):
  - Subir foto pelo drawer → renderiza thumb rápido
  - Click na thumb → abre lightbox in-app
  - Botão download → arquivo baixa
  - Sem botão delete visível
  - Esc/click fora → fecha lightbox
- Manual (edit):
  - Abrir frete existente com `fotoChegadaUrl` + `fotoUrls` → vê tudo combinado em 1 lista
  - Adicionar 8ª foto → input bloqueado
  - Remover 1ª foto → 2ª vira principal automaticamente, salva ok
  - Área de Arquivos continua funcionando

## Out of scope

- Migração de URLs antigas pra outro storage/path
- Compressão client-side pré-upload (AnexosUploader já tem stamp via canvas; comprimir mais perde qualidade)
- Lazy-load no scroll (8 fotos no máximo, não compensa)
- Lightbox compartilhado entre módulos (vai existir 2 implementações similares: equipamento + frete. Consolidar é trabalho separado se virar 3+ usos)

## Riscos

- **Image transform é Pro feature**: se projeto não tiver, todas as fotos caem no fallback e perf não melhora. Verificar antes de implementar. Se não for Pro, a feature de thumbnails fica como degradação graciosa (UI igual, perf igual ao atual).
- **Refatorar 2 áreas em 1**: dados existentes com fotos em `fotoUrls` (não principais) precisam aparecer naturalmente quando edit abrir. Lógica de combinar já existe em `FreteFotoChegadaBlock` — replicar no form.
