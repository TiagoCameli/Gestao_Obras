// Task 3.1 — Painel de Óleos Vencendo.
//
// Lê useOleosVencendo() e exibe tabela: Máquina, Tipo de Óleo, Última Troca,
// Vencimento, Status. Padrão: só vencido + a_vencer. Toggle pra mostrar todos.

import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { useOleosVencendo } from '../../hooks/useOSOleos';
import type { OleoVencendo } from '../../types';

function fmtData(s: string): string {
  if (!s) return '—';
  // '2026-01-15' → '15/01/2026'
  const [a, m, d] = s.split('-');
  if (!a || !m || !d) return s;
  return `${d}/${m}/${a}`;
}

type Situacao = OleoVencendo['situacao'];

const CHIP: Record<Situacao, { label: string; cls: string }> = {
  vencido:  { label: 'Vencido',   cls: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]' },
  a_vencer: { label: 'A vencer',  cls: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]' },
  ok:       { label: 'OK',        cls: 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]' },
};

interface Props {
  /** Quando true mostra apenas as colunas principais (sem Última Troca).
   *  Útil para embedar num dashboard com espaço limitado. */
  compacto?: boolean;
}

export default function OleosVencendoPanel({ compacto = false }: Props) {
  const { data: todos = [], isLoading, error } = useOleosVencendo();
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const linhas = mostrarTodos
    ? todos
    : todos.filter((r) => r.situacao === 'vencido' || r.situacao === 'a_vencer');

  // Ordena: vencido primeiro, depois a_vencer, depois ok; dentro do grupo por dias crescente
  const ordenados = [...linhas].sort((a, b) => {
    const ordem: Record<Situacao, number> = { vencido: 0, a_vencer: 1, ok: 2 };
    const diff = ordem[a.situacao] - ordem[b.situacao];
    return diff !== 0 ? diff : a.diasParaVencer - b.diasParaVencer;
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-[var(--color-fg-muted)]">Carregando…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-fg)]">
        Erro ao carregar alertas de óleo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho do painel */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] flex items-center gap-1.5">
          <Droplets aria-hidden className="w-3.5 h-3.5" />
          Óleos vencendo
          {todos.length > 0 && (
            <span className="ml-1 text-[var(--color-fg-subtle)]">
              ({todos.filter((r) => r.situacao !== 'ok').length} alertas)
            </span>
          )}
        </h3>
        {todos.some((r) => r.situacao === 'ok') && (
          <button
            type="button"
            onClick={() => setMostrarTodos((v) => !v)}
            className="text-xs text-[var(--color-accent)] hover:underline focus:outline-none"
          >
            {mostrarTodos ? 'Ocultar OK' : 'Mostrar todos'}
          </button>
        )}
      </div>

      {/* Tabela */}
      {ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center">
          <Droplets className="w-7 h-7 mx-auto mb-2 text-[var(--color-fg-subtle)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            {todos.length === 0 ? 'Nenhum óleo registrado ainda' : 'Todos os óleos em dia'}
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            {todos.length === 0
              ? 'Lance trocas de óleo nos serviços para ativar os alertas.'
              : 'Nenhum óleo vencido ou a vencer nos próximos 30 dias.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                    Máquina
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                    Tipo de Óleo
                  </th>
                  {!compacto && (
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                      Última Troca
                    </th>
                  )}
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                    Vencimento
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {ordenados.map((row) => {
                  const chip = CHIP[row.situacao];
                  const diasLabel =
                    row.situacao === 'vencido'
                      ? `${Math.abs(row.diasParaVencer)} dia(s) atrás`
                      : row.situacao === 'a_vencer'
                      ? `em ${row.diasParaVencer} dia(s)`
                      : '';
                  return (
                    <tr
                      key={`${row.equipamentoId}-${row.tipoOleoId}`}
                      className="hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-fg)] truncate max-w-[180px]">
                        {row.equipamentoNome}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                        <div>{row.tipoOleoNome}</div>
                        <div className="text-xs text-[var(--color-fg-subtle)] capitalize">{row.aplicacao}</div>
                      </td>
                      {!compacto && (
                        <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                          {fmtData(row.ultimaTroca)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                        <div>{fmtData(row.dataVencimento)}</div>
                        {diasLabel && (
                          <div className="text-xs text-[var(--color-fg-subtle)]">{diasLabel}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' +
                            chip.cls
                          }
                        >
                          {chip.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
