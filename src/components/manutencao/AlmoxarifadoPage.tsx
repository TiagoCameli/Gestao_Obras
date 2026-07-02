// Marco 4 / PR18 — Almoxarifado de peças de manutenção.
//
// Lista peças (insumos.usado_em_manutencao = true) com saldo, custo médio,
// status de estoque. Filtros por status, categoria, fabricante. Click no
// card abre modal/painel de detalhe (incluindo saldo por depósito).

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Package, Plus, AlertTriangle, Search, Settings2, Factory, FileInput,
  Warehouse, MapPin, User, ArrowRight, Upload,
} from 'lucide-react';
import Button from '../ui/Button';
import SmartSelect from '../ui/SmartSelect';
import { useSaldoEstoqueTotal } from '../../hooks/useSaldoEstoque';
import { useInsumos } from '../../hooks/useInsumos';
import {
  useDepositosMaterialV2, useResumoSaldosTodos,
} from '../../hooks/useDepositosObras';
import { useObras } from '../../hooks/useObras';
import { useAuth } from '../../contexts/AuthContext';
import type { SaldoEstoque, Insumo, StatusEstoque } from '../../types';
import PecaFormModal from './almoxarifado/PecaFormModal';
import PecaDetalheModal from './almoxarifado/PecaDetalheModal';
import NovaEntradaModal from './almoxarifado/NovaEntradaModal';
import ImportPecasModal from './almoxarifado/ImportPecasModal';

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
  const navigate = useNavigate();
  const canCreate = temAcao('criar_peca_almoxarifado') || temAcao('criar_entrada_almoxarifado');

  const { data: saldos = [], isLoading } = useSaldoEstoqueTotal({ apenasManutencao: true });
  const { data: insumos = [] } = useInsumos();
  // Depósitos marcados como almoxarifado de peças (ativos)
  const { data: todosDepositos = [] } = useDepositosMaterialV2();
  const { data: obras = [] } = useObras();
  const { data: resumoSaldos } = useResumoSaldosTodos();

  const almoxarifados = useMemo(
    () => todosDepositos.filter((d) => d.ehAlmoxarifadoPecas && d.ativo),
    [todosDepositos]
  );
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [filtroFabricante, setFiltroFabricante] = useState('');

  // Filtro de status é derivado do query param para suportar deep links
  // (ex: /manutencao/almoxarifado?status=criticos) e back/forward do navegador.
  const filtroStatus: StatusEstoque | 'todos' | 'criticos' = (() => {
    const s = searchParams.get('status');
    if (s === 'criticos' || s === 'zerada' || s === 'abaixo_minimo' || s === 'atencao' || s === 'ok') {
      return s as StatusEstoque | 'criticos';
    }
    return 'todos';
  })();

  const setFiltroStatus = (s: StatusEstoque | 'todos' | 'criticos') => {
    const next = new URLSearchParams(searchParams);
    if (s === 'todos') next.delete('status'); else next.set('status', s);
    setSearchParams(next, { replace: true });
  };

  const [novoOpen, setNovoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editarInsumo, setEditarInsumo] = useState<Insumo | null>(null);
  const [detalheInsumoId, setDetalheInsumoId] = useState<string | null>(null);
  const [entradaOpen, setEntradaOpen] = useState<{ open: boolean; insumoId?: string }>({ open: false });
  const canImportar = temAcao('criar_peca_almoxarifado');

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
            {canImportar && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" /> Importar Excel
              </Button>
            )}
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

      {/* Depósitos marcados como almoxarifado de peças */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[var(--color-fg-muted)]" />
              Almoxarifados de peças
              <span className="text-xs font-normal text-[var(--color-fg-muted)]">({almoxarifados.length})</span>
            </h2>
            <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">
              Depósitos onde as peças ficam armazenadas. Marque a flag "Almoxarifado de peças" em <strong>Depósitos</strong> pra adicionar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/depositos')}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            Gerenciar em Depósitos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {almoxarifados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-fg-muted)]">
            <Warehouse className="w-7 h-7 mx-auto text-[var(--color-fg-subtle)] mb-2 opacity-60" />
            <p>Nenhum almoxarifado cadastrado ainda.</p>
            <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
              Vá em <strong>Depósitos</strong> → crie ou edite um depósito → marque a opção "Almoxarifado de peças".
            </p>
            <button
              type="button"
              onClick={() => navigate('/depositos')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Ir para Depósitos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {almoxarifados.map((d) => {
              const resumo = resumoSaldos?.get(d.id);
              const obrasVinc = (d.obrasIds ?? []).map((id) => obrasMap.get(id)).filter(Boolean) as string[];
              const ehAvulso = obrasVinc.length === 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate('/depositos')}
                  className="text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-xs)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-[var(--color-fg)] tracking-tight truncate flex-1">
                      🔧 {d.nome}
                    </h3>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--color-fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">Insumos</div>
                      <div className="text-base font-bold text-[var(--color-fg)] tabular-nums">{resumo?.qtdInsumos ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">Estoque</div>
                      <div className="text-base font-bold text-[var(--color-fg)] tabular-nums">
                        {resumo?.valorTotal != null
                          ? resumo.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                          : 'R$ 0'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2 min-h-[18px]">
                    {ehAvulso ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
                        central
                      </span>
                    ) : (
                      <>
                        {obrasVinc.slice(0, 2).map((nome) => (
                          <span key={nome} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border border-[var(--color-border)] truncate max-w-[100px]">
                            {nome}
                          </span>
                        ))}
                        {obrasVinc.length > 2 && (
                          <span className="text-[10px] text-[var(--color-fg-subtle)] px-1">+{obrasVinc.length - 2}</span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-[11px] text-[var(--color-fg-subtle)] truncate flex items-center gap-1 pt-1.5 border-t border-[var(--color-border)]">
                    {d.responsavel
                      ? <><User className="w-3 h-3 shrink-0" /> {d.responsavel}</>
                      : d.endereco
                        ? <><MapPin className="w-3 h-3 shrink-0" /> {d.endereco}</>
                        : <span className="italic">sem responsável</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

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
        <SmartSelect
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusEstoque | 'todos' | 'criticos')}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] flex items-center min-w-[140px] text-left"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </SmartSelect>
        <SmartSelect
          value={filtroFabricante}
          onChange={(e) => setFiltroFabricante(e.target.value)}
          wrapperClassName="relative"
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[200px] flex items-center min-w-[160px] text-left"
        >
          <option value="">Todos fabricantes</option>
          {fabricantes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </SmartSelect>
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
      <ImportPecasModal open={importOpen} onClose={() => setImportOpen(false)} insumos={insumos} />
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
