// Aba "Fretes" do extrato — lista todos os movimentos credito_frete
// com colunas detalhadas (rota, insumo, peso, km, R$/tkm, NF, placa,
// motorista). Origem dos campos extras: view transportadora_movimentos_detalhe.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TransportadoraMovimento } from '../../../types';
import { useInsumos } from '../../../hooks/useInsumos';
import { useObras } from '../../../hooks/useObras';
import { fmtBRL, fmtData, fmtNumDec } from './extratoShared';

interface Props {
  movimentos: TransportadoraMovimento[];
}

export default function ExtratoFretesList({ movimentos }: Props) {
  const [busca, setBusca] = useState('');

  const { data: insumos = [] } = useInsumos();
  const { data: obras = [] } = useObras();

  const fretes = useMemo(
    () => movimentos.filter((m) => m.tipo === 'credito_frete'),
    [movimentos]
  );

  const insumoNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of insumos) map.set(i.id, i.nome);
    return (id: string | null | undefined) =>
      id ? map.get(id) ?? id : '—';
  }, [insumos]);

  const obraNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obras) map.set(o.id, o.nome);
    return (id: string | null | undefined) =>
      id ? map.get(id) ?? id : '—';
  }, [obras]);

  const dados = useMemo(() => {
    let lista = fretes;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      lista = lista.filter((m) => {
        const campos = [
          m.descricao,
          m.freteOrigem,
          m.freteDestino,
          m.freteNotaFiscal,
          m.freteNotaFiscal2,
          m.fretePlacaCarreta,
          m.freteMotorista,
          insumoNome(m.freteInsumoId),
          obraNome(m.obraId),
        ];
        return campos.some((c) => (c ?? '').toLowerCase().includes(q));
      });
    }
    return [...lista].sort((a, b) => b.data.localeCompare(a.data));
  }, [fretes, busca, insumoNome, obraNome]);

  const total = useMemo(() => dados.reduce((s, m) => s + m.valor, 0), [dados]);
  const pesoTotal = useMemo(
    () => dados.reduce((s, m) => s + (m.fretePesoToneladas ?? 0), 0),
    [dados]
  );
  const kmTotal = useMemo(
    () => dados.reduce((s, m) => s + (m.freteKmRodados ?? 0), 0),
    [dados]
  );

  const filtrosAtivos = busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar por rota, NF, placa, motorista, insumo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          {filtrosAtivos && (
            <button
              onClick={() => setBusca('')}
              className="text-xs text-[var(--color-fg-muted)] hover:text-red-600 underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="text-sm text-[var(--color-fg-muted)] px-1 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="font-semibold text-[var(--color-fg)]">{dados.length}</span>{' '}
          frete{dados.length !== 1 ? 's' : ''}
        </span>
        <span>Peso: <span className="font-mono font-semibold text-[var(--color-fg)]">{fmtNumDec(pesoTotal, 2)} t</span></span>
        <span>KM: <span className="font-mono font-semibold text-[var(--color-fg)]">{fmtNumDec(kmTotal, 1)} km</span></span>
        <span>Total: <span className="font-mono font-semibold text-green-700">{fmtBRL(total)}</span></span>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum frete para os filtros atuais.'
            : 'Sem fretes registrados pra esta transportadora.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Rota / Obra</th>
                <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Peso</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">KM</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">R$/tkm</th>
                <th className="px-3 py-2 text-left font-semibold">NF · Placa · Motorista</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((m) => {
                const rota =
                  m.freteOrigem && m.freteDestino
                    ? `${m.freteOrigem} → ${m.freteDestino}`
                    : m.descricao ?? '—';
                const nfs = [m.freteNotaFiscal, m.freteNotaFiscal2].filter((n) => n && n.trim());
                const partes: string[] = [];
                if (nfs.length > 0) partes.push(`NF ${nfs.join('/')}`);
                if (m.fretePlacaCarreta) partes.push(m.fretePlacaCarreta);
                if (m.freteMotorista) partes.push(m.freteMotorista);
                return (
                  <tr key={m.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtData(m.data)}</td>
                    <td className="px-3 py-2 text-gray-800">
                      <div>{rota}</div>
                      {m.obraId && (
                        <div className="text-[11px] text-gray-500 mt-0.5">{obraNome(m.obraId)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{insumoNome(m.freteInsumoId)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {m.fretePesoToneladas != null ? `${fmtNumDec(m.fretePesoToneladas, 2)} t` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {m.freteKmRodados != null ? `${fmtNumDec(m.freteKmRodados, 1)} km` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {m.freteValorTkm != null ? `R$ ${fmtNumDec(m.freteValorTkm, 4)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-[12px]">
                      {partes.length > 0 ? partes.join(' · ') : <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700 whitespace-nowrap">
                      {fmtBRL(m.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 text-xs">
              <tr>
                <td colSpan={6}></td>
                <td className="px-3 py-2 text-right font-semibold text-gray-600">Total</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-green-700">{fmtBRL(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
