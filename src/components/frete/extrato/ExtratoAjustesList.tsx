// Aba "Ajustes" do extrato — ajustes manuais (crédito ou débito).
// Lançados via ajuste_manual_credito / ajuste_manual_debito sem origem
// em outra tabela.

import { useMemo, useState } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import type { TransportadoraMovimento } from '../../../types';
import { useObras } from '../../../hooks/useObras';
import { fmtBRL, fmtData } from './extratoShared';

interface Props {
  movimentos: TransportadoraMovimento[];
  /** Quando passado, mostra coluna Ações com Editar/Excluir nos ajustes manuais. */
  onEdit?: (mov: TransportadoraMovimento) => void;
  onDelete?: (mov: TransportadoraMovimento) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type Sinal = 'credito' | 'debito';

function sinalDoTipo(tipo: string): Sinal | null {
  if (tipo === 'ajuste_manual_credito') return 'credito';
  if (tipo === 'ajuste_manual_debito') return 'debito';
  return null;
}

export default function ExtratoAjustesList({
  movimentos,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  const showAcoes = !!(onEdit || onDelete);
  const [filtroSinal, setFiltroSinal] = useState<Sinal | ''>('');
  const [busca, setBusca] = useState('');

  const { data: obras = [] } = useObras();

  const ajustes = useMemo(
    () => movimentos.filter((m) => sinalDoTipo(m.tipo) !== null),
    [movimentos]
  );

  const obraNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obras) map.set(o.id, o.nome);
    return (id: string | null | undefined) =>
      id ? map.get(id) ?? id : '—';
  }, [obras]);

  const dados = useMemo(() => {
    let lista = ajustes;
    if (filtroSinal) lista = lista.filter((m) => sinalDoTipo(m.tipo) === filtroSinal);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      lista = lista.filter((m) => {
        const campos = [m.descricao, m.createdBy, obraNome(m.obraId)];
        return campos.some((c) => (c ?? '').toLowerCase().includes(q));
      });
    }
    return [...lista].sort((a, b) => b.data.localeCompare(a.data));
  }, [ajustes, filtroSinal, busca, obraNome]);

  const totais = useMemo(() => {
    let creditos = 0;
    let debitos = 0;
    for (const m of dados) {
      if (sinalDoTipo(m.tipo) === 'credito') creditos += m.valor;
      else debitos += m.valor;
    }
    return { creditos, debitos, liquido: creditos - debitos };
  }, [dados]);

  const filtrosAtivos = !!filtroSinal || busca.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search aria-hidden className="w-4 h-4 text-[var(--color-fg-subtle)]" />
            <input
              type="text"
              placeholder="Buscar por descrição, obra, autor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg bg-white border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          {filtrosAtivos && (
            <button
              onClick={() => { setFiltroSinal(''); setBusca(''); }}
              className="text-xs text-[var(--color-fg-muted)] hover:text-red-600 underline"
            >
              Limpar
            </button>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">Sinal</div>
          <div className="flex flex-wrap gap-1.5">
            {(['credito', 'debito'] as const).map((s) => {
              const ativo = filtroSinal === s;
              const isCredito = s === 'credito';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFiltroSinal(ativo ? '' : s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    ativo
                      ? isCredito
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {isCredito ? 'Crédito' : 'Débito'}
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
          ajuste{dados.length !== 1 ? 's' : ''}
        </span>
        <span>Créditos: <span className="font-mono font-semibold text-green-700">{fmtBRL(totais.creditos)}</span></span>
        <span>Débitos: <span className="font-mono font-semibold text-red-700">{fmtBRL(totais.debitos)}</span></span>
        <span>
          Líquido:{' '}
          <span className={`font-mono font-semibold ${totais.liquido >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmtBRL(totais.liquido)}
          </span>
        </span>
      </div>

      {/* Tabela */}
      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-12 text-center text-[var(--color-fg-muted)] text-sm">
          {filtrosAtivos
            ? 'Nenhum ajuste para os filtros atuais.'
            : 'Sem ajustes manuais registrados pra esta transportadora.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Sinal</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-left font-semibold">Obra</th>
                <th className="px-3 py-2 text-left font-semibold">Criado por</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Crédito</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Débito</th>
                {showAcoes && (
                  <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((m) => {
                const sinal = sinalDoTipo(m.tipo);
                const isCredito = sinal === 'credito';
                return (
                  <tr key={m.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtData(m.data)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        isCredito
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        {isCredito ? 'Crédito' : 'Débito'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-800 max-w-[360px]">
                      {m.descricao || <span className="italic text-gray-400">(sem descrição)</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {m.obraId ? obraNome(m.obraId) : <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-[12px]">
                      {m.createdBy || <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-700 whitespace-nowrap">
                      {isCredito ? fmtBRL(m.valor) : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 whitespace-nowrap">
                      {isCredito ? '' : fmtBRL(m.valor)}
                    </td>
                    {showAcoes && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-700"
                              title="Editar ajuste"
                            >
                              <Pencil className="w-3 h-3" />
                              Editar
                            </button>
                          )}
                          {canDelete && onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600"
                              title="Excluir ajuste"
                            >
                              <Trash2 className="w-3 h-3" />
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 text-xs">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-600">Totais</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-green-700">{fmtBRL(totais.creditos)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-red-700">{fmtBRL(totais.debitos)}</td>
                {showAcoes && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
