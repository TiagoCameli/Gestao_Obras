// Wrapper sobre Modal pra abrir o extrato de uma transportadora específica.
// Carrega os movimentos via useTransportadoraMovimentos quando abre.
//
// filtroMes vive aqui (lifted) — afeta saldo do header, contadores das
// abas, conteúdo de cada aba e exports Excel/PDF. Demais filtros (busca,
// tipo, sinal, etc.) ficam locais a cada aba.

import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TransportadoraExtratoList from './TransportadoraExtratoList';
import AjusteManualTransportadoraForm from './AjusteManualTransportadoraForm';
import ExtratoFretesList from './extrato/ExtratoFretesList';
import ExtratoAbastecimentosList from './extrato/ExtratoAbastecimentosList';
import ExtratoPagamentosList from './extrato/ExtratoPagamentosList';
import ExtratoAjustesList from './extrato/ExtratoAjustesList';
import {
  useTransportadoraMovimentos,
  useExcluirAjusteManualTransportadora,
} from '../../hooks/useTransportadoraMovimentos';
import { useTransportadoraSaldo } from '../../hooks/useTransportadoraSaldo';
import type { TransportadoraMovimento } from '../../types';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useInsumos } from '../../hooks/useInsumos';
import { useObras } from '../../hooks/useObras';
import { exportarExtratoExcel, exportarExtratoPDF, TIPOS_CREDITO } from '../../utils/extratoExport';
import { fmtBRL } from './extrato/extratoShared';

interface Props {
  open: boolean;
  onClose: () => void;
  transportadoraId: string | null;
  transportadoraNome: string | null;
  canExport?: boolean;
}

type TabId = 'todos' | 'fretes' | 'abastecimentos' | 'pagamentos' | 'ajustes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'fretes', label: 'Fretes' },
  { id: 'abastecimentos', label: 'Abastecimentos' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'ajustes', label: 'Ajustes' },
];

function formatMesLabel(mes: string): string {
  const [yy, mm] = mes.split('-');
  if (!yy || !mm) return mes;
  const dt = new Date(Number(yy), Number(mm) - 1, 1);
  const nome = dt.toLocaleString('pt-BR', { month: 'long' });
  return `${nome.charAt(0).toUpperCase() + nome.slice(1)}/${yy}`;
}

export default function TransportadoraExtratoModal({
  open,
  onClose,
  transportadoraId,
  transportadoraNome,
  canExport = true,
}: Props) {
  const { data: movimentos = [], isLoading: loadingMovs } = useTransportadoraMovimentos({
    transportadoraId: transportadoraId ?? undefined,
  });
  const { data: saldo, isLoading: loadingSaldo } = useTransportadoraSaldo(transportadoraId);
  const { data: insumos = [] } = useInsumos();
  const { data: obras = [] } = useObras();
  const [ajusteOpen, setAjusteOpen] = useState(false);
  // Edição de ajuste manual: quando setado, o modal AjusteManualTransportadoraForm
  // abre em modo edit com initial preenchido.
  const [ajusteEditando, setAjusteEditando] = useState<TransportadoraMovimento | null>(null);
  const [ajusteExcluindo, setAjusteExcluindo] = useState<TransportadoraMovimento | null>(null);
  const excluirAjusteMut = useExcluirAjusteManualTransportadora();
  const [tab, setTab] = useState<TabId>('todos');
  const [filtroMes, setFiltroMes] = useState('');

  // Lookups id→nome pra resolver FKs soft no export.
  const insumosMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of insumos) map.set(i.id, i.nome);
    return map;
  }, [insumos]);
  const obrasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obras) map.set(o.id, o.nome);
    return map;
  }, [obras]);

  // Lista de meses únicos pra dropdown (DESC)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const m of movimentos) if (m.mesReferencia) set.add(m.mesReferencia);
    return Array.from(set).sort().reverse();
  }, [movimentos]);

  // Movimentos restritos ao mês — base do que cada aba vê e do saldo do mês.
  const movimentosDoMes = useMemo(() => {
    if (!filtroMes) return movimentos;
    return movimentos.filter((m) => m.mesReferencia === filtroMes);
  }, [movimentos, filtroMes]);

  const counts = useMemo(() => {
    let fretes = 0;
    let abast = 0;
    let pagtos = 0;
    let ajustes = 0;
    for (const m of movimentosDoMes) {
      if (m.tipo === 'credito_frete') fretes++;
      else if (m.tipo === 'debito_abastecimento_transterra' || m.tipo === 'debito_abastecimento_emt') abast++;
      else if (m.tipo === 'debito_pagamento_frete') pagtos++;
      else if (m.tipo === 'ajuste_manual_credito' || m.tipo === 'ajuste_manual_debito') ajustes++;
    }
    return {
      todos: movimentosDoMes.length,
      fretes,
      abastecimentos: abast,
      pagamentos: pagtos,
      ajustes,
    };
  }, [movimentosDoMes]);

  // Saldo: total da conta-corrente quando sem filtro; saldo do mês
  // (créditos − débitos do recorte) quando filtroMes ativo.
  const saldoDisplay = useMemo(() => {
    if (!filtroMes) {
      return {
        valor: saldo?.saldo ?? 0,
        titulo: 'Saldo Atual',
        sub: `${movimentos.length} movimento${movimentos.length !== 1 ? 's' : ''} no total`,
      };
    }
    let creditos = 0;
    let debitos = 0;
    for (const m of movimentosDoMes) {
      if (TIPOS_CREDITO.has(m.tipo)) creditos += m.valor;
      else debitos += m.valor;
    }
    return {
      valor: creditos - debitos,
      titulo: `Saldo de ${formatMesLabel(filtroMes)}`,
      sub: `${movimentosDoMes.length} movimento${movimentosDoMes.length !== 1 ? 's' : ''} no mês`,
    };
  }, [filtroMes, saldo, movimentos, movimentosDoMes]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={transportadoraNome ? `Extrato — ${transportadoraNome}` : 'Extrato'}
        size="xl"
      >
        {!transportadoraId ? (
          <div className="text-center text-sm text-gray-500 py-8">
            Selecione uma transportadora pra ver o extrato.
          </div>
        ) : loadingMovs || loadingSaldo ? (
          <div className="text-center text-sm text-gray-500 py-8">
            Carregando extrato...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header: saldo + ações globais */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">{saldoDisplay.titulo}</div>
                <div className={`text-2xl font-bold ${saldoDisplay.valor >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmtBRL(saldoDisplay.valor)}
                </div>
                <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">{saldoDisplay.sub}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
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
                <Button onClick={() => setAjusteOpen(true)} className="text-sm">
                  + Novo Ajuste Manual
                </Button>
                {canExport && movimentos.length > 0 && (
                  <>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        exportarExtratoExcel(
                          transportadoraNome ?? '?',
                          movimentos,
                          { mesReferencia: filtroMes, tipos: [], busca: '' },
                          { insumosMap, obrasMap },
                        )
                      }
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        exportarExtratoPDF(transportadoraNome ?? '?', movimentos, {
                          mesReferencia: filtroMes,
                          tipos: [],
                          busca: '',
                        })
                      }
                    >
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--color-border)] -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
              <nav className="flex gap-1 min-w-max">
                {TABS.map((t) => {
                  const ativo = tab === t.id;
                  const count = counts[t.id];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        ativo
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                          : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      {t.label}
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        ativo
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Conteúdo da aba — recebe movimentos já filtrados pelo mês */}
            {tab === 'todos' && (
              <TransportadoraExtratoList movimentos={movimentosDoMes} />
            )}
            {tab === 'fretes' && <ExtratoFretesList movimentos={movimentosDoMes} />}
            {tab === 'abastecimentos' && <ExtratoAbastecimentosList movimentos={movimentosDoMes} />}
            {tab === 'pagamentos' && <ExtratoPagamentosList movimentos={movimentosDoMes} />}
            {tab === 'ajustes' && (
              <ExtratoAjustesList
                movimentos={movimentosDoMes}
                onEdit={(m) => {
                  setAjusteEditando(m);
                  setAjusteOpen(true);
                }}
                onDelete={(m) => setAjusteExcluindo(m)}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={ajusteOpen && !!transportadoraId}
        onClose={() => { setAjusteOpen(false); setAjusteEditando(null); }}
        title={`${ajusteEditando ? 'Editar' : 'Novo'} Ajuste Manual — ${transportadoraNome ?? '?'}`}
        size="lg"
      >
        {transportadoraId && (
          <AjusteManualTransportadoraForm
            transportadoraId={transportadoraId}
            transportadoraNome={transportadoraNome ?? '?'}
            initial={ajusteEditando}
            onSuccess={() => { setAjusteOpen(false); setAjusteEditando(null); }}
            onCancel={() => { setAjusteOpen(false); setAjusteEditando(null); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={ajusteExcluindo !== null}
        onClose={() => setAjusteExcluindo(null)}
        onConfirm={async () => {
          if (!ajusteExcluindo) return;
          try {
            await excluirAjusteMut.mutateAsync(ajusteExcluindo.id);
          } catch (err) {
            console.error('Falha ao excluir ajuste manual', err);
            alert('Falha ao excluir ajuste manual. Veja o console.');
          } finally {
            setAjusteExcluindo(null);
          }
        }}
        title="Excluir Ajuste Manual"
        message={`Tem certeza que deseja excluir este ajuste${ajusteExcluindo?.descricao ? ` ("${ajusteExcluindo.descricao.slice(0, 80)}${ajusteExcluindo.descricao.length > 80 ? '...' : ''}")` : ''}? Esta ação não pode ser desfeita e o saldo será recalculado.`}
      />
    </>
  );
}
