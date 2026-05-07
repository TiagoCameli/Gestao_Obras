// Aba "Pagamentos" do extrato — débitos por pagamento de frete.
// Tipo único: debito_pagamento_frete. Detalhes vêm de pagamentos_frete
// via view transportadora_movimentos_detalhe.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TransportadoraMovimento, MetodoPagamentoFrete } from '../../../types';
import { fmtBRL, fmtData, fmtNumDec, fmtMesRef, getMesesDisponiveis } from './extratoShared';

interface Props {
  movimentos: TransportadoraMovimento[];
}

const METODO_LABEL: Record<MetodoPagamentoFrete, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

const METODOS: MetodoPagamentoFrete[] = ['pix', 'boleto', 'cheque', 'dinheiro', 'transferencia', 'combustivel'];

export default function ExtratoPagamentosList({ movimentos }: Props) {
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState<MetodoPagamentoFrete | ''>('');
  const [busca, setBusca] = useState('');

  const pagamentos = useMemo(
    () => movimentos.filter((m) => m.tipo === 'debito_pagamento_frete'),
    [movimentos]
  );

  const meses = useMemo(() => getMesesDisponiveis(pagamentos), [pagamentos]);

  const dados = useMemo(() => {
    let lista = pagamentos;
    if (filtroMes) lista = lista.filter((m) => m.mesReferencia === filtroMes);
    if (filtroMetodo) lista = lista.filter((m) => m.pagamentoMetodo === filtroMetodo);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      lista = lista.filter((m) => {
        const campos = [
          m.descricao,
          m.pagamentoNotaFiscal,
          m.pagamentoResponsavel,
          m.pagamentoPagoPor,
          m.pagamentoObservacoes,
        ];
        return campos.some((c) => (c ?? '').toLowerCase().includes(q));
      });
    }
    return [...lista].sort((a, b) => b.data.localeCompare(a.data));
  }, [pagamentos, filtroMes, filtroMetodo, busca]);

  const total = useMemo(() => dados.reduce((s, m) => s + m.valor, 0), [dados]);
  const litrosCombustivel = useMemo(
    () => dados.reduce((s, m) => s + (m.pagamentoQuantidadeCombustivel ?? 0), 0),
    [dados]
  );

  const filtrosAtivos = !!filtroMes || !!filtroMetodo || busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Mês ref</span>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="h-9 px-2.5 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Todos</option>
              {meses.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar por NF, responsável, observações..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          {filtrosAtivos && (
            <button
              onClick={() => { setFiltroMes(''); setFiltroMetodo(''); setBusca(''); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-red-600 underline"
            >
              Limpar
            </button>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">Método</div>
          <div className="flex flex-wrap gap-1.5">
            {METODOS.map((mt) => {
              const ativo = filtroMetodo === mt;
              return (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setFiltroMetodo(ativo ? '' : mt)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    ativo
                      ? 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {METODO_LABEL[mt]}
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
          pagamento{dados.length !== 1 ? 's' : ''}
        </span>
        {litrosCombustivel > 0 && (
          <span>Combustível: <span className="font-mono font-semibold text-[var(--color-fg)]">{fmtNumDec(litrosCombustivel, 0)} L</span></span>
        )}
        <span>Total: <span className="font-mono font-semibold text-red-700">{fmtBRL(total)}</span></span>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum pagamento para os filtros atuais.'
            : 'Sem pagamentos registrados pra esta transportadora.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Mês ref</th>
                <th className="px-3 py-2 text-left font-semibold">Método</th>
                <th className="px-3 py-2 text-left font-semibold">NF</th>
                <th className="px-3 py-2 text-left font-semibold">Responsável / Pago por</th>
                <th className="px-3 py-2 text-left font-semibold">Observações</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((m) => {
                const metodo = m.pagamentoMetodo as MetodoPagamentoFrete | null | undefined;
                const responsaveis = [m.pagamentoResponsavel, m.pagamentoPagoPor]
                  .filter((r): r is string => !!r && r.trim().length > 0);
                return (
                  <tr key={m.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtData(m.data)}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtMesRef(m.mesReferencia)}</td>
                    <td className="px-3 py-2">
                      {metodo ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-purple-50 border-purple-200 text-purple-800">
                          {METODO_LABEL[metodo] ?? metodo}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{m.pagamentoNotaFiscal || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 text-[12px]">
                      {responsaveis.length > 0
                        ? responsaveis.join(' · ')
                        : <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-[12px] max-w-[280px]">
                      {m.pagamentoObservacoes || m.descricao || <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-red-700 whitespace-nowrap">
                      {fmtBRL(m.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 text-xs">
              <tr>
                <td colSpan={5}></td>
                <td className="px-3 py-2 text-right font-semibold text-gray-600">Total</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-red-700">{fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
