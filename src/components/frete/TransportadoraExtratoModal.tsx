// Wrapper sobre Modal pra abrir o extrato de uma transportadora específica.
// Carrega os movimentos via useTransportadoraMovimentos quando abre.
//
// Layout: header (saldo + ações) + tabs (Todos | Fretes | Abastecimentos |
// Pagamentos | Ajustes). Cada aba tem filtros próprios e colunas
// detalhadas relevantes pro tipo de movimentação.

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TransportadoraExtratoList from './TransportadoraExtratoList';
import AjusteManualTransportadoraForm from './AjusteManualTransportadoraForm';
import ExtratoFretesList from './extrato/ExtratoFretesList';
import ExtratoAbastecimentosList from './extrato/ExtratoAbastecimentosList';
import ExtratoPagamentosList from './extrato/ExtratoPagamentosList';
import ExtratoAjustesList from './extrato/ExtratoAjustesList';
import { useTransportadoraMovimentos } from '../../hooks/useTransportadoraMovimentos';
import { useTransportadoraSaldo } from '../../hooks/useTransportadoraSaldo';
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
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('todos');

  const counts = useMemo(() => {
    let fretes = 0;
    let abast = 0;
    let pagtos = 0;
    let ajustes = 0;
    for (const m of movimentos) {
      if (m.tipo === 'credito_frete') fretes++;
      else if (m.tipo === 'debito_abastecimento_transterra' || m.tipo === 'debito_abastecimento_emt') abast++;
      else if (m.tipo === 'debito_pagamento_frete') pagtos++;
      else if (m.tipo === 'ajuste_manual_credito' || m.tipo === 'ajuste_manual_debito') ajustes++;
    }
    return {
      todos: movimentos.length,
      fretes,
      abastecimentos: abast,
      pagamentos: pagtos,
      ajustes,
    };
  }, [movimentos]);

  const saldoAtual = saldo?.saldo ?? 0;

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
                <div className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">Saldo Atual</div>
                <div className={`text-2xl font-bold ${saldoAtual >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmtBRL(saldoAtual)}
                </div>
                <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                  {movimentos.length} movimento{movimentos.length !== 1 ? 's' : ''} no total
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={() => setAjusteOpen(true)} className="text-sm">
                  + Novo Ajuste Manual
                </Button>
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

            {/* Conteúdo da aba */}
            {tab === 'todos' && (
              <TransportadoraExtratoList
                transportadoraNome={transportadoraNome ?? '?'}
                movimentos={movimentos}
                saldoAtual={saldoAtual}
                canExport={canExport}
              />
            )}
            {tab === 'fretes' && <ExtratoFretesList movimentos={movimentos} />}
            {tab === 'abastecimentos' && <ExtratoAbastecimentosList movimentos={movimentos} />}
            {tab === 'pagamentos' && <ExtratoPagamentosList movimentos={movimentos} />}
            {tab === 'ajustes' && <ExtratoAjustesList movimentos={movimentos} />}
          </div>
        )}
      </Modal>

      <Modal
        open={ajusteOpen && !!transportadoraId}
        onClose={() => setAjusteOpen(false)}
        title={`Ajuste Manual — ${transportadoraNome ?? '?'}`}
        size="lg"
      >
        {transportadoraId && (
          <AjusteManualTransportadoraForm
            transportadoraId={transportadoraId}
            transportadoraNome={transportadoraNome ?? '?'}
            onSuccess={() => setAjusteOpen(false)}
            onCancel={() => setAjusteOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
