// PagamentoAbatimentoCard — card âmbar inline pra PagamentoFreteForm
// (Fase 4, Item 4 / decisão D8 — checkbox por débito).
//
// Mostra lista de débitos de combustível pendentes pra transportadora
// selecionada, ordenados por data ASC (FIFO sugerido). Usuário marca
// quais abater. O total dos marcados será passado pro consumer via
// onChange + lista de IDs marcados.

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTransportadoraMovimentos } from '../../hooks/useTransportadoraMovimentos';

interface Props {
  /** ID da transportadora selecionada no form. Card só renderiza se preenchido. */
  transportadoraId: string | null;
  /** Valor bruto do pagamento (ainda em digitação no form). */
  valorBrutoPagamento: number;
  /**
   * Callback quando seleção muda. Passa:
   *   - valorAbatido: soma dos valores marcados
   *   - movimentoIds: lista dos IDs marcados (pra UPDATE de
   *     abatido_em_pagamento_id no submit)
   */
  onChange: (valorAbatido: number, movimentoIds: string[]) => void;
}

const TIPOS_DEBITO_COMBUSTIVEL = new Set([
  'debito_abastecimento_transterra',
  'debito_abastecimento_emt',
] as const);

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

export default function PagamentoAbatimentoCard({
  transportadoraId,
  valorBrutoPagamento,
  onChange,
}: Props) {
  const { data: movimentos = [], isLoading } = useTransportadoraMovimentos({
    transportadoraId: transportadoraId ?? undefined,
  });

  // Filtra só débitos de combustível ainda não abatidos, ordem ASC (FIFO).
  const debitosPendentes = useMemo(() => {
    return movimentos
      .filter((m) =>
        (TIPOS_DEBITO_COMBUSTIVEL as Set<string>).has(m.tipo) &&
        !m.abatidoEmPagamentoId
      )
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [movimentos]);

  const totalPendente = useMemo(
    () => debitosPendentes.reduce((s, d) => s + d.valor, 0),
    [debitosPendentes]
  );

  // Estado: set dos IDs marcados.
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // Reseta seleção quando muda transportadora ou quando carrega lista nova.
  useEffect(() => {
    setMarcados(new Set());
  }, [transportadoraId]);

  // Calcula total marcado e propaga pro pai.
  const valorAbatido = useMemo(() => {
    return debitosPendentes
      .filter((d) => marcados.has(d.id))
      .reduce((s, d) => s + d.valor, 0);
  }, [debitosPendentes, marcados]);

  useEffect(() => {
    onChange(valorAbatido, Array.from(marcados));
  }, [valorAbatido, marcados, onChange]);

  function toggle(id: string) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (marcados.size === debitosPendentes.length) {
      setMarcados(new Set());
    } else {
      setMarcados(new Set(debitosPendentes.map((d) => d.id)));
    }
  }

  // Não renderiza nada quando:
  //   - transportadora não selecionada
  //   - ainda carregando
  //   - sem débitos pendentes
  if (!transportadoraId || isLoading || debitosPendentes.length === 0) {
    return null;
  }

  const pagamentoLiquido = Math.max(0, valorBrutoPagamento - valorAbatido);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-amber-900 text-sm">
            Saldo de combustível pendente: {fmtBRL(totalPendente)}
            <span className="text-amber-700 font-normal"> em {debitosPendentes.length} débito{debitosPendentes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-xs text-amber-800 mt-0.5">
            Marque os débitos que quer abater deste pagamento. Sugestão FIFO (mais antigos primeiro).
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-amber-900 underline hover:text-amber-700 shrink-0"
        >
          {marcados.size === debitosPendentes.length ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>

      <div className="rounded-lg bg-white border border-amber-200 divide-y divide-amber-100 max-h-64 overflow-y-auto">
        {debitosPendentes.map((d) => {
          const checked = marcados.has(d.id);
          return (
            <label
              key={d.id}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-amber-50 transition-colors ${
                checked ? 'bg-amber-50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(d.id)}
                className="w-4 h-4 accent-amber-600"
              />
              <div className="text-xs text-gray-500 w-20 shrink-0 font-mono">
                {fmtData(d.data)}
              </div>
              <div className="flex-1 min-w-0 text-sm text-gray-700 truncate">
                {d.descricao ?? <span className="italic text-gray-400">(sem descrição)</span>}
              </div>
              <div className="text-sm font-mono font-semibold text-red-700 shrink-0">
                {fmtBRL(d.valor)}
              </div>
            </label>
          );
        })}
      </div>

      {/* Resumo do impacto no pagamento */}
      <div className="rounded-lg bg-white border border-amber-200 p-3 space-y-1 text-sm font-mono">
        <div className="flex justify-between text-gray-700">
          <span>Valor bruto:</span>
          <span>{fmtBRL(valorBrutoPagamento)}</span>
        </div>
        <div className="flex justify-between text-amber-800">
          <span>Combustível abatido ({marcados.size}):</span>
          <span>−{fmtBRL(valorAbatido)}</span>
        </div>
        <div className="flex justify-between font-bold text-emt-verde-escuro pt-1 border-t border-amber-200">
          <span>Pagamento líquido:</span>
          <span>{fmtBRL(pagamentoLiquido)}</span>
        </div>
      </div>

      {valorAbatido > valorBrutoPagamento && valorBrutoPagamento > 0 && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          ⚠ Valor abatido (R$ {valorAbatido.toFixed(2)}) é maior que o valor bruto do pagamento. Reveja a seleção.
        </div>
      )}
    </div>
  );
}
