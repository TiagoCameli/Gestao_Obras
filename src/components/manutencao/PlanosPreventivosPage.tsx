// Marco 3 / PR14+PR15 — Lista de planos preventivos.
//
// Cards clicáveis levam ao detalhe (/manutencao/planos/:id). Botão "Novo plano"
// abre o modal de criação.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Settings2, Plus } from 'lucide-react';
import { usePlanosPreventivos } from '../../hooks/usePlanosPreventivos';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import NovoPlanoModal from './planos/NovoPlanoModal';

export default function PlanosPreventivosPage() {
  const { data: planos = [], isLoading } = usePlanosPreventivos();
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_plano_preventivo');
  const [novoOpen, setNovoOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
            Planos Preventivos
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
            Catálogo de planos por tipo de equipamento. Aplique a um equipamento
            pelo detalhe da Frota para começar a programar preventivas.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="w-4 h-4" /> Novo plano
          </Button>
        )}
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
          {canCreate && (
            <div className="mt-4">
              <Button onClick={() => setNovoOpen(true)}>
                <Plus className="w-4 h-4" /> Criar primeiro plano
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {planos.map((p) => (
            <Link
              key={p.id}
              to={`/manutencao/planos/${p.id}`}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
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
            </Link>
          ))}
        </div>
      )}

      {novoOpen && (
        <NovoPlanoModal open={novoOpen} onClose={() => setNovoOpen(false)} />
      )}
    </div>
  );
}
