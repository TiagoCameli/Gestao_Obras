// Marco 1 / PR5 — Galeria de fotos do equipamento.
//
// Renderiza no detalhe do equipamento. Quando vazia, mostra placeholder
// com call-to-action de Editar. Quando tem fotos, lista horizontalmente
// scrollável; clicar amplia em lightbox (modal sem chrome).

import { useState } from 'react';
import { ImageOff, Camera } from 'lucide-react';

interface Props {
  fotoUrls: string[];
  nomeEquipamento: string;
}

export default function FotosEquipamentoGaleria({ fotoUrls, nomeEquipamento }: Props) {
  const [indiceAmpliada, setIndiceAmpliada] = useState<number | null>(null);

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
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {fotoUrls.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setIndiceAmpliada(i)}
            className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] snap-start hover:ring-2 hover:ring-[var(--color-accent)] transition-shadow"
            aria-label={`Foto ${i + 1} de ${fotoUrls.length}`}
          >
            <img
              src={url}
              alt={`${nomeEquipamento} — foto ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {indiceAmpliada !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIndiceAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndiceAmpliada(null);
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          {fotoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndiceAmpliada(((indiceAmpliada ?? 0) - 1 + fotoUrls.length) % fotoUrls.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Foto anterior"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndiceAmpliada(((indiceAmpliada ?? 0) + 1) % fotoUrls.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/70 flex items-center justify-center"
                aria-label="Próxima foto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}
          <img
            src={fotoUrls[indiceAmpliada]}
            alt={`${nomeEquipamento} — foto ${indiceAmpliada + 1} ampliada`}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {fotoUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/40 text-white text-xs">
              <Camera className="w-3 h-3" />
              {indiceAmpliada + 1} de {fotoUrls.length}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
