// Aba "Movimentações" do Almoxarifado de Manutenção.
//
// Lista, do mais recente pro mais antigo, as ENTRADAS de peças (compra via NF,
// editáveis/excluíveis aqui) e as SAÍDAS (peças e óleos baixados em OS, com
// ação de abrir a OS de origem). Só peças de manutenção
// (insumos.usado_em_manutencao). Merge/ordenção em movimentacoesAlmoxarifado.ts.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ExternalLink, Search, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { Skeleton } from '../../shadcn/skeleton';
import type { EntradaMaterial } from '../../../types';
import { useEntradasMaterial } from '../../../hooks/useEntradasMaterial';
import { useTodasPecasOS } from '../../../hooks/useOrdensServico';
import { useTodosOleosOS } from '../../../hooks/useOSOleos';
import { useInsumos } from '../../../hooks/useInsumos';
import { useTiposOleo } from '../../../hooks/useTiposOleo';
import { useOrdensServico } from '../../../hooks/useOrdensServico';
import { useAuth } from '../../../contexts/AuthContext';
import { montarMovimentacoes, type TipoMovimentacao } from '../../../utils/movimentacoesAlmoxarifado';
import EditarEntradaModal from './EditarEntradaModal';
import ExcluirEntradaDialog from './ExcluirEntradaDialog';

type FiltroTipo = 'todos' | TipoMovimentacao;

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function fmtData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function MovimentacoesAlmoxarifado() {
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const canManage = temAcao('criar_entrada_almoxarifado');

  const { data: entradas = [], isLoading: loadingEnt } = useEntradasMaterial();
  const { data: pecas = [], isLoading: loadingPec } = useTodasPecasOS();
  const { data: oleos = [], isLoading: loadingOle } = useTodosOleosOS();
  const { data: insumos = [] } = useInsumos();
  const { data: tiposOleo = [] } = useTiposOleo();
  const { data: ordens = [] } = useOrdensServico();

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<EntradaMaterial | null>(null);
  const [excluindo, setExcluindo] = useState<EntradaMaterial | null>(null);

  const insumosManut = useMemo(
    () => new Set(insumos.filter((i) => i.usadoEmManutencao).map((i) => i.id)),
    [insumos],
  );
  const insumoNomePorId = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const tipoOleoNomePorId = useMemo(() => new Map(tiposOleo.map((t) => [t.id, t.nome])), [tiposOleo]);
  const osNumeroPorId = useMemo(() => new Map(ordens.map((o) => [o.id, o.numero])), [ordens]);

  // Só entradas de peças de manutenção e não excluídas.
  const entradasManut = useMemo(
    () => entradas.filter((e) => !e.deletadoEm && insumosManut.has(e.insumoId)),
    [entradas, insumosManut],
  );
  const entradaPorId = useMemo(() => new Map(entradasManut.map((e) => [e.id, e])), [entradasManut]);

  const movimentacoes = useMemo(
    () => montarMovimentacoes({ entradas: entradasManut, pecas, oleos, insumoNomePorId, tipoOleoNomePorId, osNumeroPorId }),
    [entradasManut, pecas, oleos, insumoNomePorId, tipoOleoNomePorId, osNumeroPorId],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return movimentacoes.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (!q) return true;
      const origemTxt = m.origem.kind === 'nf' ? m.origem.notaFiscal : m.origem.osNumero;
      return m.insumoNome.toLowerCase().includes(q) || origemTxt.toLowerCase().includes(q);
    });
  }, [movimentacoes, filtroTipo, busca]);

  const loading = loadingEnt || loadingPec || loadingOle;

  const FILTROS: { key: FiltroTipo; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'entrada', label: 'Entradas' },
    { key: 'saida', label: 'Saídas' },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-2)]">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltroTipo(f.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filtroTipo === f.key
                  ? 'bg-[var(--color-surface-1)] text-[var(--color-fg)] shadow-sm'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar peça, NF ou nº da OS…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabela — overflow-x-auto (não hidden): em tela estreita a coluna de
          ações fica alcançável rolando na horizontal, em vez de cortada. */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-[var(--color-fg-muted)] text-xs uppercase bg-[var(--color-surface-2)]">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Peça</th>
              <th className="text-right px-3 py-2">Qtd</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="px-3 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td colSpan={7} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-fg-muted)]">
                  Nenhuma movimentação{busca || filtroTipo !== 'todos' ? ' com esse filtro' : ' registrada ainda'}.
                </td>
              </tr>
            ) : (
              filtradas.map((m) => {
                const ent = m.tipo === 'entrada' ? entradaPorId.get(m.id) : null;
                return (
                  <tr key={`${m.tipo}-${m.id}`} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/40">
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">{fmtData(m.data)}</td>
                    <td className="px-3 py-2">
                      {m.tipo === 'entrada' ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-success-fg,#16a34a)]">
                          <ArrowDownToLine className="w-3.5 h-3.5" /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--color-warning-fg,#d97706)]">
                          <ArrowUpFromLine className="w-3.5 h-3.5" /> Saída
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">{m.insumoNome}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtQty(m.quantidade)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(m.valorTotal)}</td>
                    <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                      {m.origem.kind === 'nf' ? `NF ${m.origem.notaFiscal}` : `OS ${m.origem.osNumero}`}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {m.tipo === 'entrada' ? (
                          canManage && ent ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditando(ent)}
                                className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                                aria-label="Editar entrada"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setExcluindo(ent)}
                                className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-soft)]"
                                aria-label="Excluir entrada"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : null
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/manutencao/os/${m.origem.kind === 'os' ? m.origem.osNumero : ''}`)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir OS
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarEntradaModal open onClose={() => setEditando(null)} entrada={editando} />
      )}
      {excluindo && (
        <ExcluirEntradaDialog entrada={excluindo} onClose={() => setExcluindo(null)} />
      )}
    </div>
  );
}
