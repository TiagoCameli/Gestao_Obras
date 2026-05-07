// TransportadoraExtratoList — extrato cronológico de movimentos de uma
// transportadora (Fase 4). Saldo acumulado calculado client-side via
// reduce (decisão Q8 Fase 0).

import { useMemo, useState } from 'react';
import { ArrowDownToLine, FileText, FileSpreadsheet, Search } from 'lucide-react';
import type { TransportadoraMovimento, TipoMovimentoTransportadora } from '../../types';
import Button from '../ui/Button';
import {
  exportarExtratoExcel,
  exportarExtratoPDF,
  formatBreakdown,
  TIPO_LABEL,
  TIPOS_CREDITO,
} from '../../utils/extratoExport';

interface Props {
  transportadoraNome: string;
  movimentos: TransportadoraMovimento[];
  /** Mantido na assinatura por compat — saldo é exibido pelo modal pai. */
  saldoAtual: number;
  canExport?: boolean;
}

interface MovimentoComSaldo extends TransportadoraMovimento {
  saldoAcumulado: number;
}

const TODOS_TIPOS: TipoMovimentoTransportadora[] = [
  'credito_frete',
  'debito_pagamento_frete',
  'credito_abastecimento_transterra',
  'debito_abastecimento_transterra',
  'debito_abastecimento_emt',
  'ajuste_manual_credito',
  'ajuste_manual_debito',
];

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function TransportadoraExtratoList({
  transportadoraNome,
  movimentos,
  saldoAtual: _saldoAtual,
  canExport = true,
}: Props) {
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroTipos, setFiltroTipos] = useState<TipoMovimentoTransportadora[]>([]);
  const [busca, setBusca] = useState('');

  // Lista de meses únicos pra dropdown
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const m of movimentos) {
      if (m.mesReferencia) set.add(m.mesReferencia);
    }
    return Array.from(set).sort().reverse(); // mais recente primeiro
  }, [movimentos]);

  // Aplica filtros + calcula saldo acumulado em ASC, exibe em DESC
  const dados: MovimentoComSaldo[] = useMemo(() => {
    let filtrados = movimentos;
    if (filtroMes) filtrados = filtrados.filter((m) => m.mesReferencia === filtroMes);
    if (filtroTipos.length > 0) {
      const setT = new Set(filtroTipos);
      filtrados = filtrados.filter((m) => setT.has(m.tipo));
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      filtrados = filtrados.filter((m) => (m.descricao ?? '').toLowerCase().includes(q));
    }
    const asc = [...filtrados].sort((a, b) => a.data.localeCompare(b.data));
    let acc = 0;
    return asc
      .map((m) => {
        acc += TIPOS_CREDITO.has(m.tipo) ? m.valor : -m.valor;
        return { ...m, saldoAcumulado: acc };
      })
      .reverse();
  }, [movimentos, filtroMes, filtroTipos, busca]);

  // Totais sobre o filtrado
  const totais = useMemo(() => {
    let creditos = 0;
    let debitos = 0;
    for (const m of dados) {
      if (TIPOS_CREDITO.has(m.tipo)) creditos += m.valor;
      else debitos += m.valor;
    }
    return { creditos, debitos };
  }, [dados]);

  function toggleTipo(t: TipoMovimentoTransportadora) {
    setFiltroTipos((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function limparFiltros() {
    setFiltroMes('');
    setFiltroTipos([]);
    setBusca('');
  }

  const filtrosAtivos = !!filtroMes || filtroTipos.length > 0 || busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Mês</span>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="h-9 px-2.5 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Todos</option>
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar na descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          {filtrosAtivos && (
            <button
              onClick={limparFiltros}
              className="text-xs text-[var(--color-fg-muted)] hover:text-red-600 underline"
            >
              Limpar
            </button>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Tipos de movimento
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TODOS_TIPOS.map((t) => {
              const ativo = filtroTipos.includes(t);
              const isCredito = TIPOS_CREDITO.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTipo(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    ativo
                      ? isCredito
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {TIPO_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resumo dos filtrados + ações de export filter-aware */}
      <div className="px-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="text-sm text-[var(--color-fg-muted)] flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="font-semibold text-[var(--color-fg)]">{dados.length}</span>{' '}
            movimento{dados.length !== 1 ? 's' : ''} filtrado{dados.length !== 1 ? 's' : ''}
          </span>
          <span>
            Créditos: <span className="font-mono font-semibold text-green-700">{fmtBRL(totais.creditos)}</span>
          </span>
          <span>
            Débitos: <span className="font-mono font-semibold text-red-700">{fmtBRL(totais.debitos)}</span>
          </span>
        </div>
        {canExport && dados.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() =>
                exportarExtratoExcel(transportadoraNome, movimentos, {
                  mesReferencia: filtroMes,
                  tipos: filtroTipos,
                  busca,
                })
              }
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() =>
                exportarExtratoPDF(transportadoraNome, movimentos, {
                  mesReferencia: filtroMes,
                  tipos: filtroTipos,
                  busca,
                })
              }
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum movimento para os filtros atuais.'
            : 'Sem movimentos registrados pra esta transportadora.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold">Crédito</th>
                <th className="px-3 py-2 text-right font-semibold">Débito</th>
                <th className="px-3 py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((m) => {
                const isCredito = TIPOS_CREDITO.has(m.tipo);
                const breakdown = formatBreakdown(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap align-top">{fmtData(m.data)}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-gray-800 text-sm">{m.descricao ?? <span className="italic text-gray-400">(sem descrição)</span>}</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">{TIPO_LABEL[m.tipo]}</div>
                      {breakdown && (
                        <div className="text-[11px] font-mono text-gray-500 mt-1">{breakdown}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-700 align-top">
                      {isCredito ? fmtBRL(m.valor) : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 align-top">
                      {isCredito ? '' : fmtBRL(m.valor)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold align-top ${
                      m.saldoAcumulado >= 0 ? 'text-gray-800' : 'text-red-700'
                    }`}>
                      {fmtBRL(m.saldoAcumulado)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Re-export pro consumer (Modal) decidir mostrar ícone download em algum lugar.
export { ArrowDownToLine };
