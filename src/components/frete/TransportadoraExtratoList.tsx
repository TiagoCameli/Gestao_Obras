// TransportadoraExtratoList — extrato cronológico de movimentos de uma
// transportadora (aba "Todos"). Saldo acumulado calculado client-side
// via reduce (decisão Q8 Fase 0).
//
// O filtro de mês vive no modal pai e já chega aqui aplicado em
// `movimentos`. Filtros locais cuidam de busca livre + tipos.

import { useMemo, useState } from 'react';
import { Search, Truck } from 'lucide-react';
import type { TransportadoraMovimento, TipoMovimentoTransportadora } from '../../types';
import { formatBreakdown, placaMovimento, TIPO_LABEL, TIPOS_CREDITO } from '../../utils/extratoExport';
import { fmtBRL, fmtData } from './extrato/extratoShared';

interface Props {
  movimentos: TransportadoraMovimento[];
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

export default function TransportadoraExtratoList({ movimentos }: Props) {
  const [filtroTipos, setFiltroTipos] = useState<TipoMovimentoTransportadora[]>([]);
  const [busca, setBusca] = useState('');

  // Aplica filtros + calcula saldo acumulado em ASC, exibe em DESC
  const dados: MovimentoComSaldo[] = useMemo(() => {
    let filtrados = movimentos;
    if (filtroTipos.length > 0) {
      const setT = new Set(filtroTipos);
      filtrados = filtrados.filter((m) => setT.has(m.tipo));
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      filtrados = filtrados.filter((m) =>
        (m.descricao ?? '').toLowerCase().includes(q) ||
        (placaMovimento(m) ?? '').toLowerCase().includes(q)
      );
    }
    const asc = [...filtrados].sort((a, b) => a.data.localeCompare(b.data));
    let acc = 0;
    return asc
      .map((m) => {
        acc += TIPOS_CREDITO.has(m.tipo) ? m.valor : -m.valor;
        return { ...m, saldoAcumulado: acc };
      })
      .reverse();
  }, [movimentos, filtroTipos, busca]);

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
    setFiltroTipos([]);
    setBusca('');
  }

  const filtrosAtivos = filtroTipos.length > 0 || busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
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

      {/* Resumo */}
      <div className="text-sm text-[var(--color-fg-muted)] px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="font-semibold text-[var(--color-fg)]">{dados.length}</span>{' '}
          movimento{dados.length !== 1 ? 's' : ''}
        </span>
        <span>
          Créditos: <span className="font-mono font-semibold text-green-700">{fmtBRL(totais.creditos)}</span>
        </span>
        <span>
          Débitos: <span className="font-mono font-semibold text-red-700">{fmtBRL(totais.debitos)}</span>
        </span>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum movimento para os filtros atuais.'
            : 'Sem movimentos registrados.'}
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
                const placa = placaMovimento(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap align-top">{fmtData(m.data)}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-gray-800 text-sm">{m.descricao ?? <span className="italic text-gray-400">(sem descrição)</span>}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-gray-400">{TIPO_LABEL[m.tipo]}</span>
                        {placa && (
                          <span
                            title="Placa da carreta"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-600 text-[10px] font-mono font-semibold"
                          >
                            <Truck aria-hidden className="w-3 h-3" />
                            {placa}
                          </span>
                        )}
                      </div>
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
