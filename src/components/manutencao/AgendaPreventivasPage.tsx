// Marco 3 / PR16 — Agenda de próximas preventivas.
//
// Lista consolidada de TODA a frota (sem filtrar por equipamentoId).
// Agrupa por status (vencida / próxima / futura) e permite filtrar por
// equipamento, tipo e categoria. Click em item → vai pro detalhe do equipamento.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, AlertTriangle, Clock, Gauge, Calendar, CheckCircle2,
  Wrench, FilePlus, ExternalLink,
} from 'lucide-react';
import {
  useProximasPreventivas, useGerarOSDeAtividade, useOSAbertasPorAtividade,
} from '../../hooks/usePlanosPreventivos';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import type { ProximaPreventiva, CategoriaAtividade } from '../../types';
import { CATEGORIA_ATIVIDADE_LABEL } from '../../types';

type StatusFiltro = 'todas' | 'vencidas' | 'proximas' | 'futuras';

const STATUS_OPTS: { value: StatusFiltro; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'proximas', label: 'Próximas (≤30 dias / ≤50 unid.)' },
  { value: 'futuras', label: 'Futuras' },
];

function statusDe(pp: ProximaPreventiva): 'vencida' | 'proxima' | 'futura' {
  if (pp.unidadesRestantes != null && pp.unidadesRestantes < 0) return 'vencida';
  if (pp.diasRestantes != null && pp.diasRestantes < 0) return 'vencida';
  if (pp.diasRestantes != null && pp.diasRestantes <= 30) return 'proxima';
  if (pp.unidadesRestantes != null && pp.unidadesRestantes <= 50) return 'proxima';
  return 'futura';
}

function ordemUrgencia(pp: ProximaPreventiva): number {
  // Vencida = -1, Próxima = 0..30, Futura = >30.
  // Menor valor = mais urgente.
  const s = statusDe(pp);
  if (s === 'vencida') {
    return Math.min(
      pp.unidadesRestantes ?? Number.POSITIVE_INFINITY,
      pp.diasRestantes ?? Number.POSITIVE_INFINITY,
    );
  }
  const dias = pp.diasRestantes ?? Number.POSITIVE_INFINITY;
  const unidades = pp.unidadesRestantes ?? Number.POSITIVE_INFINITY;
  return Math.min(dias, unidades);
}

export default function AgendaPreventivasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroStatus = (searchParams.get('status') ?? 'todas') as StatusFiltro;
  const filtroEquipamento = searchParams.get('equipamento') ?? '';
  const filtroCategoria = (searchParams.get('categoria') ?? '') as CategoriaAtividade | '';
  const filtroBusca = searchParams.get('busca') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data: proximas = [], isLoading } = useProximasPreventivas();
  const { data: equipamentos = [] } = useEquipamentos();

  const atividadeIds = useMemo(() => proximas.map((p) => p.atividadeId), [proximas]);
  const { data: osAbertasPorAtividade = new Map() } = useOSAbertasPorAtividade(atividadeIds);

  // Métricas globais (sobre tudo, antes do filtro de visualização)
  const metricas = useMemo(() => {
    const vencidas = proximas.filter((p) => statusDe(p) === 'vencida').length;
    const proximas30 = proximas.filter((p) => statusDe(p) === 'proxima').length;
    const total = proximas.length;
    return { vencidas, proximas30, total };
  }, [proximas]);

  // Filtros aplicados
  const filtradas = useMemo(() => {
    return proximas
      .filter((p) => {
        if (filtroEquipamento && p.equipamentoId !== filtroEquipamento) return false;
        if (filtroCategoria && p.categoria !== filtroCategoria) return false;
        if (filtroStatus !== 'todas') {
          // 'vencidas' → 'vencida', 'proximas' → 'proxima', 'futuras' → 'futura'
          const alvo = filtroStatus.slice(0, -1) as 'vencida' | 'proxima' | 'futura';
          if (statusDe(p) !== alvo) return false;
        }
        if (filtroBusca) {
          const q = filtroBusca.toLowerCase();
          const eqStr = `${p.codigoPatrimonio} ${p.equipamentoNome}`.toLowerCase();
          if (!eqStr.includes(q) && !p.atividadeNome.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => ordemUrgencia(a) - ordemUrgencia(b));
  }, [proximas, filtroStatus, filtroEquipamento, filtroCategoria, filtroBusca]);

  // Agrupa por status p/ visualização
  const grupos = useMemo(() => {
    const out: Record<'vencida' | 'proxima' | 'futura', ProximaPreventiva[]> = {
      vencida: [], proxima: [], futura: [],
    };
    for (const p of filtradas) {
      out[statusDe(p)].push(p);
    }
    return out;
  }, [filtradas]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-fg)] tracking-tight">
          Agenda preventiva
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
          Próximas atividades programadas em toda a frota com plano aplicado.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricaCard
          label="Vencidas"
          valor={metricas.vencidas}
          icon={AlertTriangle}
          cor="bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]"
          onClick={() => setParam('status', 'vencidas')}
        />
        <MetricaCard
          label="Próximas"
          valor={metricas.proximas30}
          icon={Clock}
          cor="bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]"
          onClick={() => setParam('status', 'proximas')}
        />
        <MetricaCard
          label="Total programadas"
          valor={metricas.total}
          icon={CalendarClock}
          cor="bg-[var(--color-info-soft)] text-[var(--color-info-fg)]"
          onClick={() => setParam('status', 'todas')}
        />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={filtroBusca}
          onChange={(e) => setParam('busca', e.target.value)}
          placeholder="Buscar por atividade ou equipamento…"
          className="flex-1 min-w-[200px] h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setParam('status', e.target.value === 'todas' ? '' : e.target.value)}
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setParam('categoria', e.target.value)}
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)]"
        >
          <option value="">Todas categorias</option>
          {(Object.keys(CATEGORIA_ATIVIDADE_LABEL) as CategoriaAtividade[]).map((k) => (
            <option key={k} value={k}>{CATEGORIA_ATIVIDADE_LABEL[k]}</option>
          ))}
        </select>
        <select
          value={filtroEquipamento}
          onChange={(e) => setParam('equipamento', e.target.value)}
          className="h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] max-w-[280px]"
        >
          <option value="">Todos equipamentos</option>
          {equipamentos
            .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
            .map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome}
              </option>
            ))}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando agenda…</p>
      ) : proximas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
          <CalendarClock aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-fg)]">Nenhuma preventiva programada</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-md mx-auto">
            Aplique planos preventivos aos equipamentos pelo detalhe da Frota
            para começar a popular esta agenda.
          </p>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">
          Nenhum item bate com os filtros aplicados.
        </p>
      ) : (
        <div className="space-y-5">
          <GrupoLista
            titulo="Vencidas"
            itens={grupos.vencida}
            corHeader="text-[var(--color-danger-fg)]"
            iconHeader={AlertTriangle}
            osAbertasPorAtividade={osAbertasPorAtividade}
          />
          <GrupoLista
            titulo="Próximas"
            itens={grupos.proxima}
            corHeader="text-[var(--color-warning-fg)]"
            iconHeader={Clock}
            osAbertasPorAtividade={osAbertasPorAtividade}
          />
          <GrupoLista
            titulo="Futuras"
            itens={grupos.futura}
            corHeader="text-[var(--color-fg-muted)]"
            iconHeader={CheckCircle2}
            osAbertasPorAtividade={osAbertasPorAtividade}
          />
        </div>
      )}
    </div>
  );
}

function GrupoLista({
  titulo, itens, corHeader, iconHeader: Icon, osAbertasPorAtividade,
}: {
  titulo: string;
  itens: ProximaPreventiva[];
  corHeader: string;
  iconHeader: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  osAbertasPorAtividade: Map<string, { id: string; numero: string }>;
}) {
  if (itens.length === 0) return null;
  return (
    <section>
      <h2 className={'text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ' + corHeader}>
        <Icon aria-hidden className="w-4 h-4" />
        {titulo} <span className="text-[var(--color-fg-subtle)] font-normal">· {itens.length}</span>
      </h2>
      <div className="space-y-2">
        {itens.map((pp) => (
          <ItemAgenda
            key={`${pp.equipamentoId}-${pp.atividadeId}`}
            pp={pp}
            osAberta={osAbertasPorAtividade.get(pp.atividadeId)}
          />
        ))}
      </div>
    </section>
  );
}

function ItemAgenda({
  pp, osAberta,
}: {
  pp: ProximaPreventiva;
  osAberta?: { id: string; numero: string };
}) {
  const navigate = useNavigate();
  const { usuario, temAcao } = useAuth();
  const { showToast } = useToast();
  const podeCriar = temAcao('criar_cadastros') || temAcao('editar_cadastros');
  const { data: medicaoAtual } = useMedicaoAtual(pp.equipamentoId);
  const gerarOS = useGerarOSDeAtividade();
  const [gerando, setGerando] = useState(false);

  async function handleGerarOS(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (gerando || osAberta) return;
    setGerando(true);
    try {
      const r = await gerarOS.mutateAsync({
        proxima: pp,
        criadoPor: usuario?.nome ?? '',
        medicaoAtual: medicaoAtual?.medicaoAtual ?? null,
      });
      showToast({ message: `OS ${r.numero} criada`, kind: 'success' });
      navigate(`/manutencao/os/${r.numero}`);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Erro ao gerar OS',
        kind: 'error',
      });
    } finally {
      setGerando(false);
    }
  }

  const status = statusDe(pp);
  const corCard =
    status === 'vencida' ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
      : status === 'proxima' ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]'
      : 'border-[var(--color-border)] bg-[var(--color-surface-1)]';

  return (
    <div
      className={
        'rounded-xl border p-3 transition-colors ' + corCard
      }
    >
      <div className="flex items-start gap-3">
        <Link
          to={`/frota?patrimonio=${encodeURIComponent(pp.codigoPatrimonio)}`}
          className="w-9 h-9 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg)] flex items-center justify-center shrink-0 hover:bg-[var(--color-surface-3)]"
          aria-label="Ver equipamento"
        >
          <Wrench className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">{pp.atividadeNome}</h4>
            {pp.categoria && (
              <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                {CATEGORIA_ATIVIDADE_LABEL[pp.categoria]}
              </span>
            )}
            {pp.obrigatoria && (
              <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]">
                Obrigatória
              </span>
            )}
          </div>
          <Link
            to={`/frota?patrimonio=${encodeURIComponent(pp.codigoPatrimonio)}`}
            className="block hover:text-[var(--color-fg)]"
          >
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              <span className="font-medium text-[var(--color-fg)]">{pp.codigoPatrimonio}</span>
              {' · '}{pp.equipamentoNome}{' · '}{pp.equipamentoTipo}
            </p>
          </Link>
          <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-[var(--color-fg-muted)]">
            {pp.unidadesRestantes != null && (
              <span className="inline-flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                {pp.unidadesRestantes < 0
                  ? `${Math.abs(pp.unidadesRestantes).toLocaleString('pt-BR')} ${pp.tipoMedicao === 'horimetro' ? 'h' : 'km'} atrás`
                  : `${pp.unidadesRestantes.toLocaleString('pt-BR')} ${pp.tipoMedicao === 'horimetro' ? 'h' : 'km'} restantes`}
              </span>
            )}
            {pp.diasRestantes != null && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {pp.diasRestantes < 0
                  ? `${Math.abs(pp.diasRestantes)} dias atrás`
                  : `${pp.diasRestantes} dias restantes`}
              </span>
            )}
            {pp.ultimaExecucaoData && (
              <span className="inline-flex items-center gap-1 text-[var(--color-fg-subtle)]">
                Última: {new Date(pp.ultimaExecucaoData).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>
        {/* Ação à direita */}
        <div className="shrink-0">
          {osAberta ? (
            <Link
              to={`/manutencao/os/${osAberta.numero}`}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)]"
              onClick={(e) => e.stopPropagation()}
            >
              OS {osAberta.numero}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : podeCriar ? (
            <button
              type="button"
              onClick={handleGerarOS}
              disabled={gerando}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 disabled:opacity-50"
            >
              <FilePlus className="w-3.5 h-3.5" />
              {gerando ? 'Gerando…' : 'Gerar OS'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricaCard({
  label, valor, icon: Icon, cor, onClick,
}: {
  label: string;
  valor: number;
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
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
          {label}
        </div>
        <div className="text-lg font-semibold text-[var(--color-fg)] truncate">
          {valor}
        </div>
      </div>
    </Tag>
  );
}
