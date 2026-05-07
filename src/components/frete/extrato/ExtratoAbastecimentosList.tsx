// Aba "Abastecimentos" do extrato — lista os movimentos de saída de
// combustível que geraram DÉBITO pra transportadora:
//   - debito_abastecimento_transterra (carreta abastece em tanque externo)
//   - debito_abastecimento_emt (carreta abastece em tanque próprio EMT)
// Crédito (Areacre) e EMT entram em outra dinâmica e ficam de fora aqui.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TransportadoraMovimento } from '../../../types';
import { useInsumos } from '../../../hooks/useInsumos';
import { fmtBRL, fmtData, fmtNumDec } from './extratoShared';

interface Props {
  movimentos: TransportadoraMovimento[];
}

type Categoria = 'transterra' | 'emt';

function categoriaDoTipo(tipo: string): Categoria | null {
  if (tipo === 'debito_abastecimento_transterra') return 'transterra';
  if (tipo === 'debito_abastecimento_emt') return 'emt';
  return null;
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  transterra: 'Transterra',
  emt: 'EMT',
};

export default function ExtratoAbastecimentosList({ movimentos }: Props) {
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | ''>('');
  const [busca, setBusca] = useState('');

  const { data: insumos = [] } = useInsumos();

  // saidaTipoCombustivel é FK soft pra insumos.id — resolve pra nome.
  const combustivelNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of insumos) map.set(i.id, i.nome);
    return (id: string | null | undefined) =>
      id ? map.get(id) ?? id : '—';
  }, [insumos]);

  const abastecimentos = useMemo(
    () => movimentos.filter((m) => categoriaDoTipo(m.tipo) !== null),
    [movimentos]
  );

  const dados = useMemo(() => {
    let lista = abastecimentos;
    if (filtroCategoria) lista = lista.filter((m) => categoriaDoTipo(m.tipo) === filtroCategoria);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      lista = lista.filter((m) => {
        const campos = [
          m.descricao,
          m.saidaPlaca,
          m.saidaMotorista,
          combustivelNome(m.saidaTipoCombustivel),
          m.saidaObservacoes,
        ];
        return campos.some((c) => (c ?? '').toLowerCase().includes(q));
      });
    }
    return [...lista].sort((a, b) => b.data.localeCompare(a.data));
  }, [abastecimentos, filtroCategoria, busca, combustivelNome]);

  const total = useMemo(() => dados.reduce((s, m) => s + m.valor, 0), [dados]);
  const litrosTotal = useMemo(
    () => dados.reduce((s, m) => s + (m.saidaLitros ?? 0), 0),
    [dados]
  );

  const filtrosAtivos = !!filtroCategoria || busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar por placa, motorista, combustível..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          {filtrosAtivos && (
            <button
              onClick={() => { setFiltroCategoria(''); setBusca(''); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-red-600 underline"
            >
              Limpar
            </button>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">Categoria</div>
          <div className="flex flex-wrap gap-1.5">
            {(['transterra', 'emt'] as const).map((c) => {
              const ativo = filtroCategoria === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFiltroCategoria(ativo ? '' : c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    ativo
                      ? 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {CATEGORIA_LABEL[c]}
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
          abastecimento{dados.length !== 1 ? 's' : ''}
        </span>
        <span>Litros: <span className="font-mono font-semibold text-[var(--color-fg)]">{fmtNumDec(litrosTotal, 0)} L</span></span>
        <span>Total débito: <span className="font-mono font-semibold text-red-700">{fmtBRL(total)}</span></span>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum abastecimento para os filtros atuais.'
            : 'Sem abastecimentos com débito pra esta transportadora.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                <th className="px-3 py-2 text-left font-semibold">Combustível</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Litros</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Preço/L</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Taxa/L</th>
                <th className="px-3 py-2 text-left font-semibold">Placa · Motorista</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((m) => {
                const cat = categoriaDoTipo(m.tipo);
                // Pra EMT: preço base = preço médio do tanque (snapshot).
                // Pra Transterra: preço base = preco_combustivel (cobrado da transp).
                const precoBase =
                  cat === 'emt'
                    ? m.saidaPrecoMedioTanque ?? m.saidaPrecoCombustivel ?? 0
                    : m.saidaPrecoCombustivel ?? 0;
                const taxa = m.saidaTaxaLitro ?? 0;
                const partes: string[] = [];
                if (m.saidaPlaca) partes.push(m.saidaPlaca);
                if (m.saidaMotorista) partes.push(m.saidaMotorista);
                return (
                  <tr key={m.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtData(m.data)}</td>
                    <td className="px-3 py-2">
                      {cat && (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          cat === 'transterra'
                            ? 'bg-orange-50 border-orange-200 text-orange-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                          {CATEGORIA_LABEL[cat]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{combustivelNome(m.saidaTipoCombustivel)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {m.saidaLitros != null ? `${fmtNumDec(m.saidaLitros, 0)} L` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {precoBase > 0 ? `R$ ${fmtNumDec(precoBase, 4)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                      {taxa > 0 ? `R$ ${fmtNumDec(taxa, 4)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-[12px]">
                      {partes.length > 0 ? partes.join(' · ') : <span className="italic text-gray-400">—</span>}
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
                <td colSpan={6}></td>
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
