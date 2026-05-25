import { useMemo } from 'react'
import { PackageCheck } from 'lucide-react'
import type { Frete } from '../../types'
import { UploadFotosButtons } from '../combustivel/AnexosUploader'
import FotoFreteGaleria from './FotoFreteGaleria'
import { useAtualizarFrete } from '../../hooks/useFretes'
import { useToast } from '../ui/Toast'
import { calcularUpdateFotoChegada } from '../../utils/freteFotoChegada'

interface Props {
  frete: Frete
  canEdit: boolean
  /** Variante visual: 'card' (drawer) ou 'compact' (expand-row). */
  variant?: 'card' | 'compact'
}

function fmtData(iso: string): string {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

/**
 * Bloco de exibição + upload das fotos de chegada do frete no drawer/row-expanded.
 * Display sempre usa FotoFreteGaleria (lightbox + download, sem delete).
 * Upload disponível quando canEdit=true.
 * Delete só no modo edição do FreteForm.
 */
export default function FreteFotoChegadaBlock({ frete, canEdit, variant = 'card' }: Props) {
  const atualizarMutation = useAtualizarFrete()
  const { showToast } = useToast()

  const fotosAtuais = useMemo<string[]>(() => {
    const all: string[] = []
    if (frete.fotoChegadaUrl) all.push(frete.fotoChegadaUrl)
    if (frete.fotoUrls) all.push(...frete.fotoUrls)
    return all
  }, [frete])

  const handleFotoChange = (novas: string[]) => {
    const novaUrl = novas[0] ?? null
    const extras = novas.slice(1)
    const hoje = new Date().toISOString().slice(0, 10)
    const payload = calcularUpdateFotoChegada({
      novaUrl,
      dataChegadaAtual: frete.dataChegada,
      hoje,
    })
    atualizarMutation.mutate(
      { ...frete, ...payload, fotoUrls: extras },
      {
        onSuccess: () => showToast({ kind: 'success', message: 'Fotos atualizadas.' }),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          showToast({ kind: 'error', message: `Falha ao salvar fotos: ${msg}` })
        },
      },
    )
  }

  const isCompact = variant === 'compact'
  const containerClass = isCompact
    ? 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3'
    : 'rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4'

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 mb-3">
        <PackageCheck className={isCompact ? 'w-4 h-4 text-[var(--color-accent)]' : 'w-5 h-5 text-[var(--color-accent)]'} />
        <div className="flex-1">
          <h3 className={isCompact ? 'text-xs font-semibold text-[var(--color-fg)]' : 'text-sm font-semibold text-[var(--color-fg)]'}>
            Fotos da Chegada da Carga
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {fotosAtuais.length === 0
              ? 'Pendente — carga ainda não foi confirmada na chegada.'
              : `${fotosAtuais.length} foto(s)${frete.dataChegada ? ` · registrada em ${fmtData(frete.dataChegada)}` : ''}`}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="mb-3">
          <UploadFotosButtons
            fotoUrls={fotosAtuais}
            onChange={handleFotoChange}
            pastaId={`frete-chegada/${frete.id}`}
          />
        </div>
      )}

      <FotoFreteGaleria
        fotoUrls={fotosAtuais}
        canDelete={false}
        canDownload
        size={isCompact ? 'compact' : 'normal'}
      />
    </div>
  )
}
