// Marco 3 / PR15 — Detalhe de um plano preventivo.
//
// Header com nome/tipo/fabricante + botões editar/excluir.
// Lista de atividades com periodicidade exibida em chips + botão "Adicionar".
// Click em atividade abre form de edição. Sem detalhe nesta PR — vai direto
// pro modal (UI simples + plana, sem subnavegação).

import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, Plus, Pencil, Trash2, Clock,
  AlertTriangle, Wrench, Calendar, Gauge,
} from 'lucide-react';
import {
  usePlanosPreventivos, useAtividadesPlano, useExcluirPlano,
  useExcluirAtividade,
} from '../../../hooks/usePlanosPreventivos';
import type { PlanoAtividade } from '../../../types';
import { CATEGORIA_ATIVIDADE_LABEL } from '../../../types';
import Button from '../../ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import NovoPlanoModal from './NovoPlanoModal';
import AtividadeFormModal from './AtividadeFormModal';

export default function PlanoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, temAcao } = useAuth();
  const { showToast } = useToast();

  const { data: planos = [], isLoading: planosLoading } = usePlanosPreventivos();
  const plano = planos.find((p) => p.id === id);
  const { data: atividades = [], isLoading: atvLoading } = useAtividadesPlano(plano?.id);
  const excluirPlano = useExcluirPlano();
  const excluirAtividade = useExcluirAtividade();

  const [editarPlanoOpen, setEditarPlanoOpen] = useState(false);
  const [atividadeModalOpen, setAtividadeModalOpen] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState<PlanoAtividade | null>(null);

  const podeEditar = temAcao('criar_cadastros') || temAcao('editar_cadastros');

  const proximaOrdem = useMemo(() => {
    if (atividades.length === 0) return 10;
    return Math.max(...atividades.map((a) => a.ordem)) + 10;
  }, [atividades]);

  if (planosLoading) {
    return <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando plano…</p>;
  }

  if (!plano) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <AlertTriangle aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" />
        <p className="text-sm font-medium text-[var(--color-fg)]">Plano não encontrado</p>
        <Link
          to="/manutencao/planos"
          className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-accent)] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para planos
        </Link>
      </div>
    );
  }

  async function handleExcluirPlano() {
    if (!plano) return;
    if (!confirm(`Excluir o plano "${plano.nome}"? Equipamentos aplicados perderão a referência.`)) return;
    try {
      await excluirPlano.mutateAsync({ id: plano.id, deletedBy: usuario?.nome ?? '' });
      showToast({ message: 'Plano excluído', kind: 'success' });
      navigate('/manutencao/planos');
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Erro ao excluir plano',
        kind: 'error',
      });
    }
  }

  async function handleExcluirAtividade(a: PlanoAtividade) {
    if (!confirm(`Excluir a atividade "${a.nome}"?`)) return;
    try {
      await excluirAtividade.mutateAsync({ id: a.id, planoId: a.planoId });
      showToast({ message: 'Atividade excluída', kind: 'success' });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Erro ao excluir atividade',
        kind: 'error',
      });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/manutencao/planos"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para planos
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--color-fg)] tracking-tight">
                {plano.nome}
              </h1>
              <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
                {plano.tipoEquipamento}
                {plano.fabricante && ` · ${plano.fabricante}`}
                {plano.modeloReferencia && ` ${plano.modeloReferencia}`}
              </p>
              {!plano.ativo && (
                <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]">
                  Inativo
                </span>
              )}
            </div>
          </div>
          {podeEditar && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditarPlanoOpen(true)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button variant="danger" size="sm" onClick={handleExcluirPlano}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          )}
        </div>
        {plano.observacoes && (
          <p className="text-sm text-[var(--color-fg-muted)] mt-3 whitespace-pre-wrap">
            {plano.observacoes}
          </p>
        )}
      </div>

      {/* Atividades */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-fg)]">Atividades</h2>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {atividades.length} {atividades.length === 1 ? 'atividade cadastrada' : 'atividades cadastradas'}
            </p>
          </div>
          {podeEditar && (
            <Button
              size="sm"
              onClick={() => {
                setAtividadeEditando(null);
                setAtividadeModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Adicionar atividade
            </Button>
          )}
        </div>

        {atvLoading ? (
          <p className="text-sm text-[var(--color-fg-muted)] py-6 text-center">Carregando atividades…</p>
        ) : atividades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
            <Wrench aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" />
            <p className="text-sm font-medium text-[var(--color-fg)]">Nenhuma atividade neste plano ainda</p>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
              Adicione tarefas com periodicidade (horímetro, km ou dias). O
              sistema avisará quando estiverem próximas do vencimento nos
              equipamentos onde o plano for aplicado.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {atividades.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5 hover:border-[var(--color-border-strong)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[var(--color-fg)]">{a.nome}</h3>
                      {a.categoria && (
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                          {CATEGORIA_ATIVIDADE_LABEL[a.categoria]}
                        </span>
                      )}
                      {a.obrigatoria && (
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]">
                          Obrigatória
                        </span>
                      )}
                      {a.exigeOficinaExterna && (
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]">
                          Oficina externa
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-[var(--color-fg-muted)]">
                      {a.periodicidadeHorimetro != null && (
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5" />
                          {a.periodicidadeHorimetro}h
                        </span>
                      )}
                      {a.periodicidadeKm != null && (
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5" />
                          {a.periodicidadeKm.toLocaleString('pt-BR')} km
                        </span>
                      )}
                      {a.periodicidadeDias != null && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {a.periodicidadeDias} dias
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        Tolerância: {a.toleranciaPercentual}%
                      </span>
                      {a.tempoEstimadoH != null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {a.tempoEstimadoH}h
                        </span>
                      )}
                      {a.custoEstimado != null && (
                        <span className="inline-flex items-center gap-1">
                          R$ {a.custoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    {a.procedimento && (
                      <p className="text-xs text-[var(--color-fg-muted)] mt-2 line-clamp-2">
                        {a.procedimento}
                      </p>
                    )}

                    {a.epiNecessario.length > 0 && (
                      <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1.5">
                        EPI: {a.epiNecessario.join(', ')}
                      </p>
                    )}
                  </div>

                  {podeEditar && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAtividadeEditando(a);
                          setAtividadeModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
                        aria-label="Editar atividade"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluirAtividade(a)}
                        className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-soft)]"
                        aria-label="Excluir atividade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editarPlanoOpen && (
        <NovoPlanoModal
          open={editarPlanoOpen}
          onClose={() => setEditarPlanoOpen(false)}
          planoExistente={plano}
        />
      )}

      {atividadeModalOpen && (
        <AtividadeFormModal
          open={atividadeModalOpen}
          onClose={() => {
            setAtividadeModalOpen(false);
            setAtividadeEditando(null);
          }}
          planoId={plano.id}
          atividadeExistente={atividadeEditando ?? undefined}
          proximaOrdem={proximaOrdem}
        />
      )}
    </div>
  );
}
