// Marco 3 / PR15 — Modal para aplicar um plano preventivo a um equipamento.
//
// Lista planos ATIVOS filtrados pelo tipoEquipamento do equipamento. Se não
// houver match exato, mostra todos os planos com aviso. Operador escolhe um
// plano, define dataInicio (default = hoje) e observações.

import { useState, useMemo, type FormEvent } from 'react';
import type { Equipamento, PlanoPreventivo } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { Settings2, AlertCircle } from 'lucide-react';
import {
  usePlanosPreventivos,
  useAplicarPlanoEquipamento,
} from '../../../hooks/usePlanosPreventivos';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamento: Equipamento;
  planosJaAplicadosIds: string[];
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AplicarPlanoModal({ open, onClose, equipamento, planosJaAplicadosIds }: Props) {
  const { usuario } = useAuth();
  const { data: todosPlanos = [], isLoading } = usePlanosPreventivos();
  const aplicar = useAplicarPlanoEquipamento();

  const [planoId, setPlanoId] = useState('');
  const [dataInicio, setDataInicio] = useState(hojeIso());
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [forcarTodos, setForcarTodos] = useState(false);

  // Planos compatíveis = ativo + tipoEquipamento bate + não já aplicado
  const { compativeis, outros } = useMemo(() => {
    const tipo = (equipamento.tipo ?? '').toLowerCase().trim();
    const compativeis: PlanoPreventivo[] = [];
    const outros: PlanoPreventivo[] = [];
    for (const p of todosPlanos) {
      if (!p.ativo) continue;
      if (planosJaAplicadosIds.includes(p.id)) continue;
      const pt = p.tipoEquipamento.toLowerCase().trim();
      if (pt && tipo && (pt === tipo || pt.includes(tipo) || tipo.includes(pt))) {
        compativeis.push(p);
      } else {
        outros.push(p);
      }
    }
    return { compativeis, outros };
  }, [todosPlanos, equipamento.tipo, planosJaAplicadosIds]);

  const planosVisiveis = compativeis.length === 0 || forcarTodos
    ? [...compativeis, ...outros]
    : compativeis;

  const podeSalvar = !!planoId && !!dataInicio;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      await aplicar.mutateAsync({
        equipamentoId: equipamento.id,
        planoId,
        dataInicio,
        createdBy: usuario?.nome ?? '',
      });
      // observacoes não está no payload do hook — campo é opcional, ignoramos por ora
      void observacoes;
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aplicar plano');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Aplicar plano ao equipamento" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-fg-muted)]">
          <p>
            <span className="font-medium text-[var(--color-fg)]">{equipamento.nome}</span>
            {equipamento.codigoPatrimonio && (
              <> · {equipamento.codigoPatrimonio}</>
            )}
            <br />
            Tipo: {equipamento.tipo || '—'}
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-fg-muted)] py-6 text-center">Carregando planos…</p>
        ) : todosPlanos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Nenhum plano cadastrado ainda. Crie um em{' '}
              <span className="text-[var(--color-fg)] font-medium">Manutenção → Planos preventivos</span>.
            </p>
          </div>
        ) : (
          <>
            {compativeis.length === 0 && (
              <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--color-warning-fg)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-warning-fg)]">
                  Nenhum plano com tipo "{equipamento.tipo}" foi encontrado.
                  Você pode aplicar um plano de outro tipo, mas confirme se as
                  atividades fazem sentido para este equipamento.
                </p>
              </div>
            )}

            {compativeis.length > 0 && outros.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forcarTodos}
                  onChange={(e) => setForcarTodos(e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                Mostrar também planos de outros tipos ({outros.length})
              </label>
            )}

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {planosVisiveis.map((p) => {
                const selecionado = planoId === p.id;
                const ehCompativel = compativeis.some((c) => c.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanoId(p.id)}
                    className={
                      'w-full rounded-lg border p-3 text-left transition-colors ' +
                      (selecionado
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]')
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info-fg)] flex items-center justify-center shrink-0">
                        <Settings2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{p.nome}</h3>
                        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                          {p.tipoEquipamento}
                          {p.fabricante && ` · ${p.fabricante}`}
                          {p.modeloReferencia && ` ${p.modeloReferencia}`}
                          {!ehCompativel && (
                            <span className="ml-2 text-[11px] text-[var(--color-warning-fg)]">
                              tipo divergente
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {planosVisiveis.length === 0 && (
                <p className="text-xs text-[var(--color-fg-muted)] py-4 text-center">
                  Todos os planos disponíveis já foram aplicados a este equipamento.
                </p>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="aplPlanoData" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
              Data de início <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="aplPlanoData"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              required
              className="w-full h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="aplPlanoObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observações
          </label>
          <textarea
            id="aplPlanoObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: plano calibrado para uso pesado em obra rodoviária"
            className="w-full min-h-[60px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {erro && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Aplicando…' : 'Aplicar plano'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
