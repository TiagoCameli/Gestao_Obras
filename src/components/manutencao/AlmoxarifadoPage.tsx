// Marco 4 / PR18 — Almoxarifado de peças de manutenção.
//
// Lista peças (insumos.usado_em_manutencao = true) com saldo, custo médio,
// status de estoque. Filtros por status, categoria, fabricante. Click no
// card abre modal/painel de detalhe (incluindo saldo por depósito).

import { useState, useMemo } from 'react';
import {
  Package, Plus, AlertTriangle, Search, Settings2, Factory, FileInput,
} from 'lucide-react';
import Button from '../ui/Button';
import { useSaldoEstoqueTotal } from '../../hooks/useSaldoEstoque';
import { useInsumos } from '../../hooks/useInsumos';
import { useAuth } from '../../contexts/AuthContext';
import type { SaldoEstoque, Insumo, StatusEstoque } from '../../types';
import PecaFormModal from './almoxarifado/PecaFormModal';
import PecaDetalheModal from './almoxarifado/PecaDetalheModal';
import NovaEntradaModal from './almoxarifado/NovaEntradaModal';

const STATUS_LABEL: Record<StatusEstoque, string> = {
  zerada: 'Zerada',
  abaixo_minimo: 'Abaixo do mínimo',
  atencao: 'Atenção',
  ok: 'OK',
};

const STATUS_OPTS: { value: StatusEstoque | 'todos' | 'criticos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'criticos', label: 'Críticos (zeradas + abaixo)' },
  { value: 'zerada', label: 'Zeradas' },
  { value: 'abaixo_minimo', label: 'Abaixo do mínimo' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'ok', label: 'OK' },
];

function fmtBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(n: number, unidade: string): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
}

export default function AlmoxarifadoPage() {
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_cadastros') || temAcao('editar_cadastros');

  const { data: saldos = [], isLoading } = useSaldoEstoqueTotal({ apenasManutencao: true });
  const { data: insumos = [] } = useInsumos();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusEstoque | 'todos' | 'criticos'>('todos');
  const [filtroFabricante, setFiltroFabricante] = useState('');

  const [novoOpen, setNovoOpen] = useState(false);
  const [editarInsumo, setEditarInsumo] = useState<Insumo | null>(null);
  const [detalheInsumoId, setDetalheInsumoId] = useState<string | null>(null);
  const [entradaOpen, setEntradaOpen] = useState<{ open: boolean; insumoId?: string }>({ open: false });

  // Mapa insumoId → Insumo completo (para abrir edição com dados)
  const insumosById = useMemo(() => {
    const m = new Map<string, Insumo>();
    for (const i of insumos) m.set(i.id, i);
    return m;
  }, [insumos]);

  const fabricantes = useMemo(() => {
    const set = new Set<string>();
    for (const s of saldos) {
      if (s.fabricante) set.add(s.fabricante);
    }
    return Array.from(set).sort();
  }, [saldos]);

  const kpis = useMemo(() => {
    const total = saldos.length;
    let zeradas = 0, abaixoMin = 0, valorTotal = 0;
    for (const s of saldos) {
      if (s.statusEstoque === 'zerada') zeradas++;
      else if (s.statusEstoque === 'abaixo_minimo') abaixoMin++;
      if (s.custoMedio != null && s.saldoTotal > 0) {
        valorTotal += s.custoMedio * s.saldoTotal;
      }
    }
    return { total, zeradas, abaixoMin, valorTotal };
  }, [saldos]);

  const filtrados = useMemo(() => {
    return saldos.filter((s) => {
      if (filtroStatus === 'criticos' && !['zerada', 'abaixo_minimo'].includes(s.statusEstoque)) return false;
      if (filtroStatus !== 'todos' && filtroStatus !== 'criticos' && s.statusEstoque !== filtroStatus) return false;
      if (filtroFabricante && s.fabricante !== filtroFabricante) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const all = `${s.insumoNome} ${s.codigoSku ?? ''} ${s.codigoEan ?? ''} ${s.codigoFabricante ?? ''} ${s.fabricante ?? ''}`.toLowerCase();
        if (!all.includes(q)) return false;
      }
      return true;
    });
  }, [saldos, filtroStatus, filtroFabricante, busca]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
            Almoxarifado de Peças
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
            Estoque de peças, óleos, filtros e materiais consumíveis usados em
            manutenção. Saldo e custo médio atualizam automaticamente conforme
            entradas e saídas.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEntradaOpen({ open: true })}>
              <FileInput className="w-4 h-4" /> Nova entrada
            </Button>
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="w-4 h-4" /> Nova peça
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Itens cadastrados" valor={kpis.total} icon={Package}
          cor="bg-[var(--color-info-soft)] text-[var(--color-info-fg)]" />
        <KPI label="Zeradas" valor={kpis.zeradas} icon={AlertTriangle}
          cor={kpis.zeradas > 0
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]'
            : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]'}
          onClick={() => setFiltroStatus('zerada')} />
        <KPI label="Abaixo do mínimo" valor={kpis.abaixoMin} icon={AlertTriangle}
          cor={kpis.abaixoMin > 0
            ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]'
            : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]'}
          onClick={() => setFiltroStatus('abaixo_minimo')} />
        <KPI label="Valor em estoque" valor={fmtBRL(kpis.valorTotal)} icon={Factory}
          cor="bg-[var(--color-surface-2)] text-[var(--color-fg)]" />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, SKU, EAN ou part number…"
            className="w-full h-[36px] rounded-lg pl-9 pr-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusEstoque | 'todos' | 'criticos')}
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filtroFabricante}
          onChange={(e) => setFiltroFabricante(e.target.value)}
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[200px]"
        >
          <option value="">Todos fabricantes</option>
          {fabricantes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando peças…</p>
      ) : saldos.length === 0 ? (
        <EmptyState canCreate={canCreate} onCriar={() => setNovoOpen(true)} />
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">
          Nenhuma peça bate com os filtros aplicados.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-fg-muted)]">
            {filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}
          </p>
          {filtrados.map((s) => (
            <PecaRow
              key={s.insumoId}
              saldo={s}
              onClick={() => setDetalheInsumoId(s.insumoId)}
              onEdit={() => {
                const i = insumosById.get(s.insumoId);
                if (i) setEditarInsumo(i);
              }}
              canEdit={canCreate}
            />
          ))}
        </div>
      )}

      {novoOpen && (
        <PecaFormModal open={novoOpen} onClose={() => setNovoOpen(false)} />
      )}
      {editarInsumo && (
        <PecaFormModal
          open={!!editarInsumo}
          onClose={() => setEditarInsumo(null)}
          insumoExistente={editarInsumo}
        />
      )}
      {detalheInsumoId && (
        <PecaDetalheModal
          open={!!detalheInsumoId}
          onClose={() => setDetalheInsumoId(null)}
          insumoId={detalheInsumoId}
          onEditar={() => {
            const i = insumosById.get(detalheInsumoId);
            setDetalheInsumoId(null);
            if (i) setEditarInsumo(i);
          }}
          onRegistrarEntrada={() => {
            const id = detalheInsumoId;
            setDetalheInsumoId(null);
            setEntradaOpen({ open: true, insumoId: id });
          }}
        />
      )}
      {entradaOpen.open && (
        <NovaEntradaModal
          open={entradaOpen.open}
          onClose={() => setEntradaOpen({ open: false })}
          insumoIdInicial={entradaOpen.insumoId}
        />
      )}
    </div>
  );
}

function EmptyState({ canCreate, onCriar }: { canCreate: boolean; onCriar: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
      <Package aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mx-auto mb-3" />
      <p className="text-sm font-medium text-[var(--color-fg)]">Nenhuma peça cadastrada</p>
      <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
        Cadastre as peças, óleos, filtros e consumíveis usados na manutenção
        da frota. Quando registrar entradas, o sistema calcula custo médio e
        controla saldo automaticamente.
      </p>
      {canCreate && (
        <div className="mt-4">
          <Button onClick={onCriar}>
            <Plus className="w-4 h-4" /> Cadastrar primeira peça
          </Button>
        </div>
      )}
    </div>
  );
}

function PecaRow({
  saldo, onClick, onEdit, canEdit,
}: {
  saldo: SaldoEstoque;
  onClick: () => void;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const corStatus =
    saldo.statusEstoque === 'zerada' ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
      : saldo.statusEstoque === 'abaixo_minimo' ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]'
      : saldo.statusEstoque === 'atencao' ? 'border-[var(--color-warning)]/20 bg-[var(--color-surface-1)]'
      : 'border-[var(--color-border)] bg-[var(--color-surface-1)]';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={
        'rounded-xl border p-3 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors ' + corStatus
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg)] flex items-center justify-center shrink-0">
          {saldo.fotoUrl ? (
            <img src={saldo.fotoUrl} alt={saldo.insumoNome} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <Package className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-[var(--color-fg)] truncate">{saldo.insumoNome}</h4>
            {saldo.codigoSku && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                SKU {saldo.codigoSku}
              </span>
            )}
            <span className={
              'inline-block text-[11px] px-2 py-0.5 rounded-full ' +
              (saldo.statusEstoque === 'zerada' ? 'bg-[var(--color-danger)] text-white'
                : saldo.statusEstoque === 'abaixo_minimo' ? 'bg-[var(--color-warning)] text-white'
                : saldo.statusEstoque === 'atencao' ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]'
                : 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]')
            }>
              {STATUS_LABEL[saldo.statusEstoque]}
            </span>
          </div>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5 truncate">
            {saldo.fabricante && <>{saldo.fabricante}{saldo.codigoFabricante && ` · ${saldo.codigoFabricante}`}{' · '}</>}
            {saldo.categoria ?? saldo.tipo ?? '—'}
          </p>
          <div className="flex items-center gap-4 flex-wrap mt-1.5 text-xs">
            <span className="text-[var(--color-fg-muted)]">
              Saldo: <span className="font-semibold text-[var(--color-fg)]">{fmtQty(saldo.saldoTotal, saldo.unidade)}</span>
              {saldo.estoqueMinimo != null && (
                <span className="text-[var(--color-fg-subtle)]"> / min {fmtQty(saldo.estoqueMinimo, saldo.unidade)}</span>
              )}
            </span>
            <span className="text-[var(--color-fg-muted)]">
              Custo médio: <span className="font-mono text-[var(--color-fg)]">{fmtBRL(saldo.custoMedio)}</span>
            </span>
            {saldo.custoMedio != null && saldo.saldoTotal > 0 && (
              <span className="text-[var(--color-fg-subtle)]">
                Total: {fmtBRL(saldo.custoMedio * saldo.saldoTotal)}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] shrink-0"
            aria-label="Editar peça"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function KPI({
  label, valor, icon: Icon, cor, onClick,
}: {
  label: string;
  valor: string | number;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  cor: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-center gap-3 ' +
        (onClick ? 'hover:bg-[var(--color-surface-2)] transition-colors text-left' : '')
      }
    >
      <div className={'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ' + cor}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] truncate">{label}</div>
        <div className="text-lg font-semibold text-[var(--color-fg)] truncate">{valor}</div>
      </div>
    </Tag>
  );
}
