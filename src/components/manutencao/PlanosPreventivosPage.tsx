// Marco 3 / PR14 — Lista de planos preventivos.
//
// Cada card mostra nome, tipo de equipamento, fabricante/modelo, qtd atividades.
// Click → futuro detalhe (PR15). Nesta PR, listagem read-only.

import { ClipboardCheck, Settings2 } from 'lucide-react';
import { usePlanosPreventivos } from '../../hooks/usePlanosPreventivos';

export default function PlanosPreventivosPage() {
  const { data: planos = [], isLoading } = usePlanosPreventivos();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
          Planos Preventivos
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
          Catálogo de planos por tipo de equipamento. Aplique a um equipamento
          pelo detalhe da Frota para começar a programar preventivas.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando planos…</p>
      ) : planos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
          <ClipboardCheck aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum plano cadastrado</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
            Crie um plano por tipo de equipamento (Escavadeira, Caminhão, etc.).
            Adicione atividades com periodicidade por horímetro/km/dias e aplique
            o plano aos equipamentos correspondentes. O sistema avisa quando
            estiver próximo do vencimento.
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-2">
            UI de cadastro vem no próximo PR. Por enquanto crie via SQL ou seed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {planos.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">
                    {p.nome}
                  </h3>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    {p.tipoEquipamento}
                    {p.fabricante && ` · ${p.fabricante}`}
                    {p.modeloReferencia && ` ${p.modeloReferencia}`}
                  </p>
                  {!p.ativo && (
                    <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]">
                      Inativo
                    </span>
                  )}
                </div>
              </div>
              {p.observacoes && (
                <p className="text-xs text-[var(--color-fg-muted)] mt-2 line-clamp-2">
                  {p.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
