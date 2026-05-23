// Marco 5/7 — Lista de equipamentos. PR32 mudou pra navegar direto pro
// hub /m/eq/:id quando toca, em vez de expandir o card.

import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ClipboardCheck, ChevronRight, Wrench, QrCode, ArrowLeft } from 'lucide-react';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { getCategoriaFrota } from '../../lib/frotaConstants';

// Mapeia path da origem (propagado por MobileScanShortcut/MScanPage via ?from=)
// pra rótulo amigável do botão "Voltar".
function rotuloOrigem(path: string): string {
  if (path.startsWith('/manutencao')) return 'Manutenção';
  if (path === '/combustivel') return 'Combustível';
  if (path === '/frota') return 'Frota';
  return 'Voltar';
}

export default function MEquipamentosPage() {
  const { data: equipamentos = [], isLoading } = useEquipamentos();
  const [busca, setBusca] = useState('');
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');

  const ativos = useMemo(() => {
    return equipamentos
      .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
      .filter((e) => {
        if (!busca) return true;
        const q = busca.toLowerCase();
        return (
          e.nome.toLowerCase().includes(q) ||
          (e.codigoPatrimonio ?? '').toLowerCase().includes(q) ||
          (e.tipo ?? '').toLowerCase().includes(q) ||
          (e.modelo ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.codigoPatrimonio ?? '').localeCompare(b.codigoPatrimonio ?? ''));
  }, [equipamentos, busca]);

  return (
    <div className="space-y-3">
      {from && (
        <Link
          to={from}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] -ml-1 px-1 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {rotuloOrigem(from)}
        </Link>
      )}
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-fg)]">Pré-uso</h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
          Toque no equipamento para fazer o checklist diário, apontar horímetro/km ou abrir OS.
        </p>
      </div>

      <Link
        to="/m/scan"
        className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] font-semibold text-base shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
      >
        <QrCode className="w-5 h-5" />
        Escanear QR do equipamento
      </Link>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
        <input
          type="text"
          inputMode="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, nome, tipo…"
          className="w-full h-11 rounded-xl pl-10 pr-3 py-2 text-base bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando equipamentos…</p>
      ) : ativos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
          <Wrench aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum equipamento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ativos.map((eq) => {
            const cat = getCategoriaFrota(eq.tipo);
            return (
              <Link
                key={eq.id}
                to={`/m/eq/${eq.id}`}
                className="block p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] active:bg-[var(--color-surface-2)]"
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl ${cat.corBg}`}>
                    <span className={`text-xs font-bold ${cat.corTexto}`}>{cat.codigo}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    {eq.codigoPatrimonio && (
                      <div className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
                        {eq.codigoPatrimonio}
                      </div>
                    )}
                    <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
                      {eq.nome}
                    </div>
                    <div className="text-xs text-[var(--color-fg-muted)] truncate">
                      {eq.tipo}{eq.modelo && ` · ${eq.modelo}`}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--color-fg-subtle)] shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info-fg)] p-3 text-xs">
        <p className="flex items-start gap-2">
          <ClipboardCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Faça o checklist diário antes de iniciar a operação. Se algum item
            estiver com problema, marque "Não" e tire uma foto — sua resposta
            ajuda a abrir manutenção rápido.
          </span>
        </p>
      </div>
    </div>
  );
}
