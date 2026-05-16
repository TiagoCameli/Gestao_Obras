/**
 * Card de depósito (premium SaaS) — usado na grade da página /depositos.
 *
 * Tipo "material" mostra: nº insumos, valor total estoque, obras vinculadas
 * (chips), responsável.
 * Tipo "combustivel" mostra: nível atual / capacidade (com barra), tipo de
 * combustível atual, "externo" se for terceiro.
 *
 * Click em qualquer um dispara `onAbrir` — caller decide o que fazer
 * (modal de detalhe pra material, redirect pra /combustivel pra tanque).
 */
import { MapPin, User, ExternalLink, AlertTriangle } from 'lucide-react';
import type { DepositoMaterial, Deposito, Obra } from '../../types';
import BadgeTipoDeposito from './BadgeTipoDeposito';

type Props =
  | { tipo: 'material'; deposito: DepositoMaterial; obras: Obra[]; resumo?: { qtdInsumos: number; valorTotal: number }; onAbrir: () => void }
  | { tipo: 'combustivel'; tanque: Deposito; insumoNome?: string; onAbrir: () => void };

function fmtMoeda(v: number, compacto = true): string {
  if (compacto && v >= 1000) {
    if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    return 'R$ ' + (v / 1000).toFixed(0) + 'k';
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DepositoCard(props: Props) {
  if (props.tipo === 'material') {
    return <CardMaterial {...props} />;
  }
  return <CardCombustivel {...props} />;
}

function CardMaterial({
  deposito, obras, resumo, onAbrir,
}: { deposito: DepositoMaterial; obras: Obra[]; resumo?: { qtdInsumos: number; valorTotal: number }; onAbrir: () => void }) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const obrasVinculadas = (deposito.obrasIds ?? []).map((id) => obrasMap.get(id)).filter(Boolean) as string[];
  const ehAvulso = obrasVinculadas.length === 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 shadow-[var(--shadow-xs)] hover:shadow-md hover:border-[var(--color-border-strong)] transition-all group"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--color-fg)] tracking-tight truncate">
            {deposito.nome}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <BadgeTipoDeposito tipo="material" size="xs" />
            {deposito.ehAlmoxarifadoPecas && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                🔧 almoxarifado
              </span>
            )}
            {!deposito.ativo && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                inativo
              </span>
            )}
            {ehAvulso && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                central
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">Insumos</div>
          <div className="text-lg font-bold text-[var(--color-fg)] tabular-nums">
            {resumo?.qtdInsumos ?? 0}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">Valor estoque</div>
          <div className="text-lg font-bold text-[var(--color-fg)] tabular-nums">
            {fmtMoeda(resumo?.valorTotal ?? 0)}
          </div>
        </div>
      </div>

      {/* Obras vinculadas */}
      {obrasVinculadas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {obrasVinculadas.slice(0, 3).map((nome) => (
            <span key={nome} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border border-[var(--color-border)] truncate max-w-[120px]">
              {nome}
            </span>
          ))}
          {obrasVinculadas.length > 3 && (
            <span className="text-[10px] text-[var(--color-fg-subtle)] px-1">
              +{obrasVinculadas.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)] pt-2 border-t border-[var(--color-border)]">
        {deposito.responsavel ? (
          <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" /> {deposito.responsavel}</span>
        ) : deposito.endereco ? (
          <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {deposito.endereco}</span>
        ) : (
          <span className="italic">sem responsável</span>
        )}
      </footer>
    </button>
  );
}

function CardCombustivel({ tanque, insumoNome, onAbrir }: { tanque: Deposito; insumoNome?: string; onAbrir: () => void }) {
  const cap = Number(tanque.capacidadeLitros) || 0;
  const nivel = Number(tanque.nivelAtualLitros) || 0;
  const pct = cap > 0 ? Math.min(100, (nivel / cap) * 100) : 0;
  const baixo = pct < 20 && cap > 0;
  const cheio = pct > 90;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 shadow-[var(--shadow-xs)] hover:shadow-md hover:border-[var(--color-border-strong)] transition-all"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--color-fg)] tracking-tight truncate">
            {tanque.apelido || tanque.nome}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <BadgeTipoDeposito tipo="combustivel" size="xs" />
            {tanque.ehExterno && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                externo
              </span>
            )}
            {!tanque.ativo && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                inativo
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-[var(--color-fg-subtle)] shrink-0 mt-0.5" />
      </header>

      {/* Nível / Capacidade */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-lg font-bold text-[var(--color-fg)] tabular-nums">
            {nivel.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            <span className="text-xs font-normal text-[var(--color-fg-muted)] ml-1">/ {cap.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
          </span>
          <span className={`text-xs font-medium tabular-nums ${baixo ? 'text-rose-600' : cheio ? 'text-emerald-600' : 'text-[var(--color-fg-muted)]'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className={'h-full transition-all ' + (baixo ? 'bg-rose-500' : 'bg-orange-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <footer className="flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)] pt-2 border-t border-[var(--color-border)]">
        {insumoNome ? (
          <span className="truncate">{insumoNome}</span>
        ) : (
          <span className="italic">sem combustível atual</span>
        )}
        {baixo && (
          <span className="ml-auto inline-flex items-center gap-1 text-rose-600">
            <AlertTriangle className="w-3 h-3" /> baixo
          </span>
        )}
      </footer>
    </button>
  );
}
