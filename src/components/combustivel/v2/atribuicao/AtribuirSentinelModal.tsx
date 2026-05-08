// AtribuirSentinelModal — F2.B.2.
// Atribui equipamento em batch a saídas sentinel ('desconhecido').
// Aberto via toolbar inline da aba Saídas quando apenasSentinel=true.
//
// UX:
//  - Lista todas as saídas sentinel filtradas (período + obra + outros).
//  - Checkbox por linha + bulk "aplicar mesmo equipamento a N selecionadas".
//  - Combobox de equipamento por linha pra ajuste fino.
//  - Save semantics: salva só linhas com equipamento atribuído (≥1).
//    Save habilitado quando assignments.size > 0.
//  - Confirm dialog antes do save ("registra na auditoria").
//  - Progress overlay durante o batch ("Salvando X de Y").
//  - Continua em erro: linha falha fica vermelha, summary no fim.
//  - Confirm ao fechar com mudanças não salvas.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import type { Deposito, Equipamento, Obra, SaidaCombustivel } from '../../../../types';
import Button from '../../../ui/Button';
import FilterCombobox from '../../../ui/FilterCombobox';
import { fmtBRL, fmtDataHora, fmtL } from '../shared/formatters';
import { useAtualizarSaidasCombustivelBatch } from '../../../../hooks/useSaidasCombustivel';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Saídas sentinel já filtradas (período + obras + outros filtros do usuário). */
  saidasSentinel: SaidaCombustivel[];
  equipamentos: Equipamento[];
  depositos: Deposito[];
  obras: Obra[];
}

export default function AtribuirSentinelModal({
  open,
  onClose,
  saidasSentinel,
  equipamentos,
  depositos,
  obras,
}: Props) {
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.nome])), [depositos]);
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const equipOptions = useMemo(
    () =>
      [...equipamentos]
        .filter((e) => e.ativo !== false)
        .sort((a, b) => (a.codigoPatrimonio || '').localeCompare(b.codigoPatrimonio || '') || a.nome.localeCompare(b.nome))
        .map((e) => ({
          value: e.id,
          label: e.codigoPatrimonio ? `${e.codigoPatrimonio} — ${e.nome}` : e.nome,
        })),
    [equipamentos],
  );

  // saidaId → equipamentoId (só presentes valem; ausência = não atribui)
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEquip, setBulkEquip] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [savedSummary, setSavedSummary] = useState<{ saved: number; failed: number } | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);

  const batchUpdate = useAtualizarSaidasCombustivelBatch();

  // Reset ao reabrir
  useEffect(() => {
    if (open) {
      setAssignments(new Map());
      setSelected(new Set());
      setBulkEquip('');
      setErrors(new Map());
      setSavedSummary(null);
      setConfirmingClose(false);
      setConfirmingSave(false);
      setProgress({ done: 0, total: 0 });
    }
  }, [open]);

  if (!open) return null;

  const qtdAssigned = assignments.size;
  const hasUnsaved = qtdAssigned > 0 && !savedSummary;

  function setAssignment(saidaId: string, equipId: string) {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (equipId) next.set(saidaId, equipId);
      else next.delete(saidaId);
      return next;
    });
  }

  function toggleSelect(saidaId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(saidaId)) next.delete(saidaId);
      else next.add(saidaId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === saidasSentinel.length) setSelected(new Set());
    else setSelected(new Set(saidasSentinel.map((s) => s.id)));
  }

  function applyBulkEquip() {
    if (!bulkEquip || selected.size === 0) return;
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const id of selected) next.set(id, bulkEquip);
      return next;
    });
  }

  function handleClose() {
    if (saving) return;
    if (hasUnsaved) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  }

  async function doSave() {
    setConfirmingSave(false);
    setSaving(true);
    setProgress({ done: 0, total: assignments.size });

    // Monta o array de saídas atualizadas (filtra só as com assignment)
    const saidasParaAtualizar: SaidaCombustivel[] = [];
    for (const saida of saidasSentinel) {
      const novoEquip = assignments.get(saida.id);
      if (!novoEquip) continue;
      saidasParaAtualizar.push({ ...saida, equipamentoId: novoEquip });
    }

    const result = await batchUpdate(saidasParaAtualizar, (done, total) => {
      setProgress({ done, total });
    });

    const failedMap = new Map<string, string>();
    for (const f of result.failed) failedMap.set(f.saidaId, f.error);
    setErrors(failedMap);
    setSaving(false);
    setSavedSummary({ saved: result.saved, failed: result.failed.length });

    // Sucesso total: fecha automaticamente após 1s pra usuário ver o ✓
    if (result.failed.length === 0) {
      setTimeout(() => onClose(), 1200);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-[var(--color-surface-1)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-fg)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Atribuir equipamento retroativamente
              </h2>
              <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                {saidasSentinel.length} saída{saidasSentinel.length !== 1 ? 's' : ''} sem equipamento no escopo atual ·
                {' '}salva apenas as linhas com equipamento atribuído (parcial OK).
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="p-1 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-[var(--color-fg-muted)]" />
            </button>
          </div>

          {/* Bulk action bar */}
          <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === saidasSentinel.length}
                ref={(el) => {
                  if (el) el.indeterminate = selected.size > 0 && selected.size < saidasSentinel.length;
                }}
                onChange={toggleSelectAll}
                disabled={saving}
                className="rounded"
              />
              {selected.size === 0
                ? 'Selecionar todas'
                : `${selected.size} selecionada${selected.size !== 1 ? 's' : ''}`}
            </label>
            <div className="flex-1" />
            <span className="text-xs text-[var(--color-fg-muted)]">Atribuir em lote:</span>
            <div className="w-[280px]">
              <FilterCombobox
                value={bulkEquip}
                onChange={setBulkEquip}
                options={equipOptions}
                placeholder="Selecionar equipamento..."
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={applyBulkEquip}
              disabled={!bulkEquip || selected.size === 0 || saving}
              className="text-xs h-9"
            >
              Aplicar a {selected.size}
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 w-[40px]"></th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Data</th>
                  <th className="text-left px-3 py-2.5">Tanque</th>
                  <th className="text-left px-3 py-2.5">Obra</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Litros</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Valor</th>
                  <th className="text-left px-3 py-2.5 w-[280px]">Equipamento</th>
                  <th className="text-center px-3 py-2.5 w-[40px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {saidasSentinel.map((s) => {
                  const isSelected = selected.has(s.id);
                  const assigned = assignments.get(s.id) ?? '';
                  const error = errors.get(s.id);
                  const wasSaved = !!savedSummary && assigned && !error;
                  return (
                    <tr
                      key={s.id}
                      className={
                        error
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : wasSaved
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/10'
                            : isSelected
                              ? 'bg-[var(--color-accent-soft)]/40'
                              : ''
                      }
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(s.id)}
                          disabled={saving}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                        {fmtDataHora(s.data)}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-fg)]">
                        {s.tanqueId ? (tanquesMap.get(s.tanqueId) ?? '—') : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-fg)]">
                        {s.obraId ? (obrasMap.get(s.obraId) ?? '—') : <span className="italic text-[var(--color-fg-subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-fg)]">
                        {fmtL(s.litros)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-fg)]">
                        {fmtBRL(s.valorTotal)}
                      </td>
                      <td className="px-3 py-2">
                        <FilterCombobox
                          value={assigned}
                          onChange={(v) => setAssignment(s.id, v)}
                          options={equipOptions}
                          placeholder="Atribuir equipamento..."
                        />
                        {error && (
                          <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 truncate" title={error}>
                            {error}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {error ? (
                          <XCircle className="w-4 h-4 text-red-500 inline" />
                        ) : wasSaved ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                        ) : assigned ? (
                          <span className="text-amber-500 text-xs font-bold">●</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[var(--color-border)] flex items-center justify-between gap-3 bg-[var(--color-surface-1)]">
            <div className="text-xs text-[var(--color-fg-muted)]">
              {savedSummary ? (
                savedSummary.failed > 0 ? (
                  <span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{savedSummary.saved} salva{savedSummary.saved !== 1 ? 's' : ''}</span>
                    {' · '}
                    <span className="text-red-600 dark:text-red-400 font-semibold">{savedSummary.failed} falhou</span>
                    {' — corrija e tente novamente'}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {savedSummary.saved} atribuição{savedSummary.saved !== 1 ? 'ões' : ''} salva{savedSummary.saved !== 1 ? 's' : ''} ✓
                  </span>
                )
              ) : (
                <>
                  <span className="font-semibold tabular-nums">{qtdAssigned}</span> de{' '}
                  <span className="tabular-nums">{saidasSentinel.length}</span> com equipamento atribuído
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={saving} className="text-sm">
                {savedSummary ? 'Fechar' : 'Cancelar'}
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmingSave(true)}
                disabled={qtdAssigned === 0 || saving}
                className="text-sm"
              >
                Salvar{qtdAssigned > 0 ? ` (${qtdAssigned})` : ''}
              </Button>
            </div>
          </div>

          {/* Save progress overlay */}
          {saving && (
            <div className="absolute inset-0 bg-[var(--color-surface-1)]/85 flex items-center justify-center z-10 backdrop-blur-sm">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mx-auto mb-3" />
                <div className="text-sm font-semibold text-[var(--color-fg)]">
                  Salvando {progress.done} de {progress.total}…
                </div>
                <div className="mt-3 w-[280px] h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all"
                    style={{
                      width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--color-fg-muted)] mt-3">Não feche o navegador.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog: descartar mudanças */}
      {confirmingClose && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-1)] rounded-xl shadow-2xl border border-[var(--color-border)] p-6 max-w-md">
            <h3 className="text-base font-semibold text-[var(--color-fg)]">Descartar atribuições?</h3>
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              Você tem {qtdAssigned} atribuição{qtdAssigned !== 1 ? 'ões' : ''} pendente{qtdAssigned !== 1 ? 's' : ''}.
              Fechar agora descarta sem salvar.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmingClose(false)} className="text-sm">Voltar</Button>
              <Button onClick={() => { setConfirmingClose(false); onClose(); }} className="text-sm">Descartar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog: aplicar batch */}
      {confirmingSave && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-1)] rounded-xl shadow-2xl border border-[var(--color-border)] p-6 max-w-md">
            <h3 className="text-base font-semibold text-[var(--color-fg)]">Confirmar atribuição</h3>
            <p className="text-sm text-[var(--color-fg-muted)] mt-2">
              {qtdAssigned} saída{qtdAssigned !== 1 ? 's' : ''} receberá{qtdAssigned !== 1 ? 'ão' : ''} equipamento.
              Esta ação registra na auditoria (campo updated_by).
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmingSave(false)} className="text-sm">Cancelar</Button>
              <Button onClick={doSave} className="text-sm">Confirmar e salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
