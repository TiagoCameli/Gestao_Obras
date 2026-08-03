// Marco 1 / PR5 — Galeria de fotos do equipamento.
//
// Renderiza no detalhe do equipamento. Quando vazia, mostra placeholder com
// call-to-action de Editar. Com fotos, delega grid e visualizador ao
// FotoGaleria compartilhado (re-assina URL fresca, zoom, swipe, download) —
// antes desenhava o próprio lightbox com a signed URL crua do banco, que
// expira em 1h e caía em InvalidJWT.

import { ImageOff } from 'lucide-react';
import FotoGaleria from '../shared/FotoGaleria';

interface Props {
  fotoUrls: string[];
  nomeEquipamento: string;
}

export default function FotosEquipamentoGaleria({ fotoUrls }: Props) {
  if (fotoUrls.length === 0) {
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Fotos do equipamento
        </h3>
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center">
          <ImageOff
            aria-hidden
            className="w-7 h-7 text-[var(--color-fg-subtle)] mx-auto mb-2"
          />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhuma foto cadastrada.
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Adicione fotos pelo botão <strong>Editar</strong>: frente, lateral, painel, plaqueta, chassi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Fotos do equipamento
          <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">
            ({fotoUrls.length})
          </span>
        </h3>
      </div>
      <FotoGaleria fotoUrls={fotoUrls} canDelete={false} canDownload />
    </section>
  );
}
