// Marco 3 / PR15 — Seção "Plano preventivo" no detalhe do equipamento.
//
// Mostra:
// - Planos aplicados a este equipamento (com botão remover)
// - Próximas atividades (via view v_proximas_preventivas)
// - Botão "Aplicar plano" → abre AplicarPlanoModal

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Plus, Trash2, AlertTriangle, Clock, Gauge, Calendar,
  Settings2,
} from 'lucide-react';
import type { Equipamento } from '../../../types';
import { CATEGORIA_ATIVIDADE_LABEL } from '../../../types';
import {
  usePlanosDeEquipamento,
  usePlanosPreventivos,
  useProximasPreventivas,
  useRemoverPlanoEquipamento,
} from '../../../hooks/usePlanosPreventivos';
import Button from '../../ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import AplicarPlanoModal from '../../manutencao/planos/AplicarPlanoModal';

interface Props {
  equipamento: Equipamento;
}

export default function PlanoPreventivoEquipamentoSection({ equipamento }: Props) {
  const { temAcao } = useAuth();
  const { showToast } = useToast();
  const podeEditar = temAcao('criar_cadastros') || temAcao('editar_cadastros');

  const { data: equipamentoPlanos = [], isLoading: loadingAplicados } =
    usePlanosDeEquipamento(equipamento.id);
  const { data: todosPlanos = [] } = usePlanosPreventivos();
  const { data: proximas = [], isLoading: loadingProximas } =
    useProximasPreventivas(equipamento.id);
  const remover = useRemoverPlanoEquipamento();

  const [aplicarOpen, setAplicarOpen] = useState(false);

  const planosAplicados = useMemo(() => {
    return equipamentoPlanos.map((ep) => {
      const plano = todosPlanos.find((p) => p.id === ep.planoId);
      return { ep, plano };
    });
  }, [equipamentoPlanos, todosPlanos]);

  const proximasOrdenadas = useMemo(() => {
    return [...proximas].sort((a, b) => {
      // Ordenar por prioridade: unidades restantes < 0 (vencidas), depois por
      // proximidade (menor unidadesRestantes ou diasRestantes primeiro)
      const ar = a.unidadesRestantes ?? Number.POSITIVE_INFINITY;
      const br = b.unidadesRestantes ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      const ad = a.diasRestantes ?? Number.POSITIVE_INFINITY;
      const bd = b.diasRestantes ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }, [proximas]);

  async function handleRemover(epId: string, planoNome: string) {
    if (!confirm(`Remover o plano "${planoNome}" deste equipamento? O histórico de execuções é preservado.`)) return;
    try {
      await remover.mutateAsync({ id: epId, equipamentoId: equipamento.id });
      showToast({ message: 'Plano removido do equipamento', kind: 'success' });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Erro ao remover plano',
        kind: 'error',
      });
    }
  }

  function statusVencimento(unidadesRestantes: number | null, diasRestantes: number | null, tolerancia: number) {
    // "Vencida" = restantes < 0
    // "Próxima" = restantes ≤ tolerância% (assumimos unidades; usamos margem absoluta = 0 por enquanto)
    void tolerancia;
    if (unidadesRestantes != null && unidadesRestantes < 0) return 'vencida';
    if (diasRestantes != null && diasRestantes < 0) return 'vencida';
    if (unidadesRestantes != null && unidadesRestantes <= 0) return 'vencida';
    if (diasRestantes != null && diasRestantes <= 7) return 'proxima';
    if (unidadesRestantes != null && unidadesRestantes <= 50) return 'proxima';
    return 'ok';
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Plano preventivo
        </h3>
        {podeEditar && (
          <Button size="sm" variant="secondary" onClick={() => setAplicarOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Aplicar plano
          </Button>
        )}
      </div>

      {/* Planos aplicados */}
      {loadingAplicados ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-4 text-center">Carregando…</p>
      ) : planosAplicados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center">
          <ClipboardCheck aria-hidden className="w-7 h-7 text-[var(--color-fg-subtle)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Nenhum plano aplicado a este equipamento
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
            Aplique um plano preventivo para que o sistema avise quando trocas
            de óleo, filtros, inspeções e outras atividades estiverem próximas
            do vencimento.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {planosAplicados.map(({ ep, plano }) => (
            <div
              key={ep.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {plano ? (
                    <Link
                      to={`/manutencao/planos/${plano.id}`}
                      className="text-sm font-semibold text-[var(--color-fg)] hover:underline"
                    >
                      {plano.nome}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-[var(--color-fg-muted)]">Plano removido</p>
                  )}
                  <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    Aplicado desde {new Date(ep.dataInicio).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => handleRemover(ep.id, plano?.nome ?? 'plano')}
                  className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-soft)] shrink-0"
                  aria-label="Remover plano"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Próximas atividades */}
      {planosAplicados.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Próximas atividades
          </h4>
          {loadingProximas ? (
            <p className="text-sm text-[var(--color-fg-muted)] py-4 text-center">Calculando…</p>
          ) : proximasOrdenadas.length === 0 ? (
            <p className="text-xs text-[var(--color-fg-muted)] py-3 text-center">
              Sem atividades programadas — verifique se o plano tem atividades cadastradas.
            </p>
          ) : (
            <div className="space-y-2">
              {proximasOrdenadas.map((pp) => {
                const status = statusVencimento(
                  pp.unidadesRestantes,
                  pp.diasRestantes,
                  pp.toleranciaPercentual,
                );
                return (
                  <div
                    key={pp.atividadeId}
                    className={
                      'rounded-xl border p-3 ' +
                      (status === 'vencida'
                        ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
                        : status === 'proxima'
                        ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-1)]')
                    }
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-semibold text-[var(--color-fg)]">{pp.atividadeNome}</h5>
                          {pp.categoria && (
                            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                              {CATEGORIA_ATIVIDADE_LABEL[pp.categoria]}
                            </span>
                          )}
                          {status === 'vencida' && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger)] text-white">
                              <AlertTriangle className="w-3 h-3" /> Vencida
                            </span>
                          )}
                          {status === 'proxima' && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-warning)] text-white">
                              <Clock className="w-3 h-3" /> Próxima
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-[var(--color-fg-muted)]">
                          {pp.unidadesRestantes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="w-3.5 h-3.5" />
                              {pp.unidadesRestantes < 0
                                ? `${Math.abs(pp.unidadesRestantes).toLocaleString('pt-BR')} ${pp.tipoMedicao === 'horimetro' ? 'h' : 'km'} atrás`
                                : `${pp.unidadesRestantes.toLocaleString('pt-BR')} ${pp.tipoMedicao === 'horimetro' ? 'h' : 'km'} restantes`}
                            </span>
                          )}
                          {pp.diasRestantes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {pp.diasRestantes < 0
                                ? `${Math.abs(pp.diasRestantes)} dias atrás`
                                : `${pp.diasRestantes} dias restantes`}
                            </span>
                          )}
                          {pp.ultimaExecucaoData && (
                            <span className="inline-flex items-center gap-1 text-[var(--color-fg-subtle)]">
                              Última: {new Date(pp.ultimaExecucaoData).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {aplicarOpen && (
        <AplicarPlanoModal
          open={aplicarOpen}
          onClose={() => setAplicarOpen(false)}
          equipamento={equipamento}
          planosJaAplicadosIds={equipamentoPlanos.map((ep) => ep.planoId)}
        />
      )}
    </section>
  );
}
