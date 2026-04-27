import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Sparkles,
  Wallet,
  Fuel,
  TrendingUp,
  TrendingDown,
  Equal,
  Calendar,
  MapPin,
  Package,
} from 'lucide-react';
import { useFretes } from '../hooks/useFretes';
import { usePagamentosFrete } from '../hooks/usePagamentosFrete';
import { useAbastecimentosCarreta } from '../hooks/useAbastecimentosCarreta';
import { useObras } from '../hooks/useObras';
import { useInsumos } from '../hooks/useInsumos';
import { formatCurrency, formatDate } from '../utils/formatters';
import Card from '../components/ui/Card';
import type { Frete, PagamentoFrete, AbastecimentoCarreta } from '../types';

// ── Configuração das transportadoras ─────────────────────────────────────
type Sign = '+' | '−';

interface ComponenteFormula {
  label: string;
  sign: Sign;
  valor: number;
  qtd: number;
  hint?: string;
}

interface SaldoConfig {
  slug: string;
  nome: string;
  subtitulo: string;
  componentes: ComponenteFormula[];
  fretesDetalhe: Frete[];
  pagamentosParaDetalhe: PagamentoFrete[];
  pagamentosPelaDetalhe?: PagamentoFrete[];
  abastecimentosDetalhe: AbastecimentoCarreta[];
}

const SLUG_TO_TRANSPORTADORA: Record<string, { nome: string; transportadora: string }> = {
  areacre: { nome: 'Areacre', transportadora: 'Areacre' },
  amazonia: { nome: 'Amazonia', transportadora: 'Amazonia Agroindustria' },
  triunfo: { nome: 'Triunfo', transportadora: 'Transportadora Triunfo' },
  andrade: { nome: 'Andrade Transporte', transportadora: 'Andrade Transporte' },
  etam: { nome: 'ETAM', transportadora: 'ETAM Construtora' },
  'emt-transportes': { nome: 'EMT TRANSPORTES', transportadora: 'EMT Transportes' },
};

const isEmtTransportes = (s: string | undefined | null) =>
  (s ?? '').trim().toLowerCase() === 'emt transportes';

export default function SaldoTransportadora() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const dataInicio = searchParams.get('inicio') || '';
  const dataFim = searchParams.get('fim') || '';
  const obraIdFiltro = searchParams.get('obra') || '';

  const updateParam = (key: 'inicio' | 'fim', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const limparPeriodo = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('inicio');
    next.delete('fim');
    setSearchParams(next, { replace: true });
  };

  const { data: fretes = [], isLoading: loadingFretes } = useFretes();
  const { data: pagamentos = [], isLoading: loadingPag } = usePagamentosFrete();
  const { data: abastecimentos = [], isLoading: loadingAbast } = useAbastecimentosCarreta();
  const { data: obras = [] } = useObras();
  const { data: insumosData } = useInsumos();

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const insumosMap = useMemo(
    () => new Map((insumosData ?? []).map((i) => [i.id, i.nome])),
    [insumosData]
  );

  // ── Aplica filtros de período / obra (mesma lógica do dashboard) ──
  const fretesF = useMemo(
    () =>
      fretes.filter((f) => {
        if (f.data && dataInicio && f.data < dataInicio) return false;
        if (f.data && dataFim && f.data > dataFim) return false;
        if (obraIdFiltro && f.obraId !== obraIdFiltro) return false;
        return true;
      }),
    [fretes, dataInicio, dataFim, obraIdFiltro]
  );
  const pagamentosF = useMemo(
    () =>
      pagamentos.filter((p) => {
        const mr = p.mesReferencia;
        if (!mr) return true;
        if (dataInicio && mr < dataInicio.slice(0, 7)) return false;
        if (dataFim && mr > dataFim.slice(0, 7)) return false;
        return true;
      }),
    [pagamentos, dataInicio, dataFim]
  );
  const abastF = useMemo(
    () =>
      abastecimentos.filter((a) => {
        if (a.data && dataInicio && a.data < dataInicio) return false;
        if (a.data && dataFim && a.data > dataFim) return false;
        return true;
      }),
    [abastecimentos, dataInicio, dataFim]
  );

  const config = useMemo<SaldoConfig | null>(() => {
    const meta = SLUG_TO_TRANSPORTADORA[slug];
    if (!meta) return null;
    const sum = (arr: { valor?: number; valorTotal?: number }[], key: 'valor' | 'valorTotal') =>
      arr.reduce((s, x) => s + ((x as Record<string, number>)[key] || 0), 0);

    const t = meta.transportadora;

    if (slug === 'areacre') {
      const fretesT = fretesF.filter((f) => f.transportadora === t);
      const pagosPara = pagamentosF.filter((p) => p.transportadora === t && p.pagoPor?.trim() !== 'Areacre');
      // Areacre soma TODOS os abastecimentos (regra original do dashboard).
      const abastTodos = abastF;
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo apurado a partir dos fretes prestados pela Areacre, descontando pagamentos efetuados pela EMT e somando o total de abastecimentos.',
        componentes: [
          { label: 'Fretes Areacre', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length, hint: 'Fretes lançados onde a transportadora é a Areacre.' },
          { label: 'Pago para Areacre', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length, hint: 'Pagamentos feitos para a Areacre (excluindo os pagos pela própria Areacre).' },
          { label: 'Abastecimentos (total)', sign: '+', valor: sum(abastTodos, 'valorTotal'), qtd: abastTodos.length, hint: 'Soma de todos os abastecimentos de carreta no período.' },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        abastecimentosDetalhe: abastTodos,
      };
    }
    if (slug === 'amazonia') {
      const fretesT = fretesF.filter((f) => f.transportadora === t);
      const abastT = abastF.filter((a) => a.transportadora === t);
      const pagosPara = pagamentosF.filter((p) => p.transportadora === t);
      const pagosPela = pagamentosF.filter((p) => p.pagoPor?.trim() === t);
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo da Amazonia Agroindustria considerando fretes, abastecimentos da carreta, pagamentos recebidos e pagamentos efetuados pela própria Amazonia.',
        componentes: [
          { label: 'Fretes Amazonia', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length },
          { label: 'Abastecimentos Amazonia', sign: '−', valor: sum(abastT, 'valorTotal'), qtd: abastT.length, hint: 'Combustível abastecido para a frota da Amazonia.' },
          { label: 'Pago para Amazonia', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length },
          { label: 'Pago pela Amazonia', sign: '+', valor: sum(pagosPela, 'valor'), qtd: pagosPela.length, hint: 'Pagamentos quitados pela Amazonia em nome de outros.' },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        pagamentosPelaDetalhe: pagosPela,
        abastecimentosDetalhe: abastT,
      };
    }
    if (slug === 'triunfo') {
      const fretesT = fretesF.filter((f) => f.transportadora === t);
      const pagosPara = pagamentosF.filter((p) => p.transportadora === t);
      const abastT = abastF.filter((a) => a.transportadora === t);
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo da Transportadora Triunfo: fretes prestados menos pagamentos efetuados e abastecimentos consumidos.',
        componentes: [
          { label: 'Fretes Triunfo', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length },
          { label: 'Pago para Triunfo', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length },
          { label: 'Abastecimentos Triunfo', sign: '−', valor: sum(abastT, 'valorTotal'), qtd: abastT.length },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        abastecimentosDetalhe: abastT,
      };
    }
    if (slug === 'andrade') {
      const fretesT = fretesF.filter((f) => f.transportadora === t);
      const pagosPara = pagamentosF.filter((p) => p.transportadora === t);
      const abastT = abastF.filter((a) => a.transportadora === t);
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo da Andrade Transporte: fretes lançados descontados pagamentos e abastecimentos.',
        componentes: [
          { label: 'Fretes Andrade', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length },
          { label: 'Pago para Andrade', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length },
          { label: 'Abastecimentos Andrade', sign: '−', valor: sum(abastT, 'valorTotal'), qtd: abastT.length },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        abastecimentosDetalhe: abastT,
      };
    }
    if (slug === 'etam') {
      const fretesT = fretesF.filter((f) => f.transportadora === t);
      const pagosPela = pagamentosF.filter((p) => p.pagoPor?.trim() === t);
      const pagosPara = pagamentosF.filter((p) => p.transportadora === t);
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo da ETAM Construtora: fretes prestados, pagamentos quitados pela ETAM e pagamentos recebidos.',
        componentes: [
          { label: 'Fretes ETAM', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length },
          { label: 'Pago pela ETAM', sign: '+', valor: sum(pagosPela, 'valor'), qtd: pagosPela.length, hint: 'Pagamentos quitados pela ETAM em nome de outros.' },
          { label: 'Pago para ETAM', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        pagamentosPelaDetalhe: pagosPela,
        abastecimentosDetalhe: [],
      };
    }
    if (slug === 'emt-transportes') {
      const fretesT = fretesF.filter((f) => isEmtTransportes(f.transportadora));
      const pagosPara = pagamentosF.filter((p) => isEmtTransportes(p.transportadora));
      const abastT = abastF.filter((a) => isEmtTransportes(a.transportadora));
      return {
        slug,
        nome: meta.nome,
        subtitulo: 'Saldo da EMT Transportes: fretes prestados descontados pagamentos efetuados e abastecimentos consumidos.',
        componentes: [
          { label: 'Fretes EMT Transportes', sign: '+', valor: sum(fretesT, 'valorTotal'), qtd: fretesT.length },
          { label: 'Pago para EMT Transportes', sign: '−', valor: sum(pagosPara, 'valor'), qtd: pagosPara.length },
          { label: 'Abastecimentos EMT Transportes', sign: '−', valor: sum(abastT, 'valorTotal'), qtd: abastT.length },
        ],
        fretesDetalhe: fretesT,
        pagamentosParaDetalhe: pagosPara,
        abastecimentosDetalhe: abastT,
      };
    }
    return null;
  }, [slug, fretesF, pagamentosF, abastF]);

  if (!SLUG_TO_TRANSPORTADORA[slug]) {
    return <Navigate to="/frete" replace />;
  }

  const isLoading = loadingFretes || loadingPag || loadingAbast;
  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-fg-subtle)]">Carregando relatório...</p>
      </div>
    );
  }

  const saldo = config.componentes.reduce(
    (s, c) => s + (c.sign === '+' ? c.valor : -c.valor),
    0
  );
  const saldoCor = saldo > 0 ? 'text-red-500' : saldo < 0 ? 'text-emerald-500' : 'text-[var(--color-fg-subtle)]';
  const saldoLabel = saldo > 0 ? 'A receber da EMT' : saldo < 0 ? 'A pagar para a EMT' : 'Conta zerada';

  const totalEntradas = config.componentes.filter((c) => c.sign === '+').reduce((s, c) => s + c.valor, 0);
  const totalSaidas = config.componentes.filter((c) => c.sign === '−').reduce((s, c) => s + c.valor, 0);

  const dashboardLink = `/frete?tab=dashboard${dataInicio ? `&inicio=${dataInicio}` : ''}${dataFim ? `&fim=${dataFim}` : ''}${obraIdFiltro ? `&obra=${obraIdFiltro}` : ''}`;

  const periodoLabel = dataInicio && dataFim
    ? `${formatDate(dataInicio)} → ${formatDate(dataFim)}`
    : dataInicio
    ? `Desde ${formatDate(dataInicio)}`
    : dataFim
    ? `Até ${formatDate(dataFim)}`
    : 'Todos os períodos';
  const obraLabel = obraIdFiltro ? obrasMap.get(obraIdFiltro) || '—' : null;

  return (
    <div
      className="frete-premium ambient-bg -mx-3 sm:-mx-6 -my-6 sm:-my-8 px-3 sm:px-6 py-6 sm:py-8 min-h-[calc(100dvh-64px)]"
      style={
        {
          ['--color-accent' as string]: 'var(--color-accent-amber)',
          ['--color-accent-hover' as string]: 'var(--color-accent-amber-hover)',
          ['--color-accent-soft' as string]: 'var(--color-accent-amber-soft)',
          ['--color-accent-fg' as string]: 'var(--color-accent-amber-fg)',
          ['--color-ring' as string]: 'var(--color-accent-amber-glow)',
        } as React.CSSProperties
      }
    >
      {/* ── Hero header ───────────────────────────────────────────────── */}
      <Link
        to={dashboardLink}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Dashboard de Frete
      </Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
              boxShadow:
                '0 10px 24px -8px var(--color-accent-amber-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <Wallet className="h-5 w-5" style={{ color: 'var(--color-fg-on-accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
              <span className="label-eyebrow">Relatório · Saldo</span>
            </div>
            <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[var(--color-fg)] leading-tight truncate">
              Saldo <span style={{ color: 'var(--color-accent)' }}>{config.nome}</span>.
            </h1>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[680px] leading-relaxed">
              {config.subtitulo}
            </p>
          </div>
        </div>

        {/* Filtro de período + chip de obra */}
        <div className="flex flex-wrap items-end gap-3 shrink-0">
          <div className="flex flex-col">
            <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1 uppercase tracking-wider">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => updateParam('inicio', e.target.value)}
              className="rounded-md px-3 text-sm h-[34px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <div className="flex flex-col">
            <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1 uppercase tracking-wider">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => updateParam('fim', e.target.value)}
              className="rounded-md px-3 text-sm h-[34px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          {(dataInicio || dataFim) && (
            <button
              type="button"
              onClick={limparPeriodo}
              className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger-fg)] font-medium pb-2"
            >
              Limpar período
            </button>
          )}
          {obraLabel && (
            <span className="chip pb-2 self-end" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-fg)' }}>
              <MapPin className="h-3 w-3" /> {obraLabel}
            </span>
          )}
        </div>
      </div>

      {/* Chip resumo de período (somente visual, abaixo do header) */}
      <div className="-mt-4 mb-6">
        <span className="chip" style={{ background: 'var(--color-surface-1)', color: 'var(--color-fg-muted)' }}>
          <Calendar className="h-3 w-3" /> {periodoLabel}
        </span>
      </div>

      {/* ── KPI principal + resumo entradas/saídas ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Saldo principal — card destaque */}
        <Card elevated className="lg:col-span-1 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
          />
          <div className="relative">
            <p className="label-eyebrow mb-2">Saldo apurado</p>
            <p className={`text-4xl font-bold tracking-tight ${saldoCor}`}>{formatCurrency(saldo)}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-fg-muted)]">
              {saldo > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-red-500" />
              ) : saldo < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Equal className="h-3.5 w-3.5" />
              )}
              <span>{saldoLabel}</span>
            </div>
          </div>
        </Card>

        {/* Total entradas */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="label-eyebrow">Entradas</p>
            <TrendingUp className="h-3.5 w-3.5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-fg)] tracking-tight">
            {formatCurrency(totalEntradas)}
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Soma dos componentes positivos da fórmula.
          </p>
        </Card>

        {/* Total saídas */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="label-eyebrow">Saídas</p>
            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-fg)] tracking-tight">
            {formatCurrency(totalSaidas)}
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Soma dos componentes negativos da fórmula.
          </p>
        </Card>
      </div>

      {/* ── Fórmula visual ─────────────────────────────────────────── */}
      <Card elevated className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="label-eyebrow mb-1">Composição do saldo</p>
            <h3 className="text-base font-semibold text-[var(--color-fg)]">Como esse valor é calculado</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {config.componentes.map((c, idx) => {
            const isPos = c.sign === '+';
            return (
              <div
                key={idx}
                className="surface-sunken p-4 flex flex-col gap-2"
                style={{
                  borderLeft: `3px solid ${isPos ? 'var(--color-danger)' : 'var(--color-success)'}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
                      {c.label}
                    </p>
                    {c.hint && (
                      <p className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5 leading-snug">
                        {c.hint}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-sm font-bold"
                    style={{
                      background: isPos
                        ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)'
                        : 'color-mix(in srgb, var(--color-success) 15%, transparent)',
                      color: isPos ? 'var(--color-danger)' : 'var(--color-success)',
                    }}
                  >
                    {c.sign}
                  </span>
                </div>
                <p className={`text-xl font-bold tracking-tight ${isPos ? 'text-red-500' : 'text-emerald-500'}`}>
                  {c.sign === '−' ? '−' : '+'}
                  {formatCurrency(c.valor)}
                </p>
                <p className="text-[11px] text-[var(--color-fg-subtle)]">
                  {c.qtd} registro{c.qtd !== 1 ? 's' : ''}
                </p>
              </div>
            );
          })}

          {/* Resultado final */}
          <div
            className="p-4 rounded-[var(--radius-md)] flex flex-col gap-2 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 12%, transparent), color-mix(in srgb, var(--color-accent) 4%, transparent))',
              border: '1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border))',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent-fg)' }}>
                Saldo final
              </p>
              <span
                className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-sm font-bold"
                style={{
                  background: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
                  color: 'var(--color-accent-fg)',
                }}
              >
                =
              </span>
            </div>
            <p className={`text-xl font-bold tracking-tight ${saldoCor}`}>{formatCurrency(saldo)}</p>
            <p className="text-[11px] text-[var(--color-fg-subtle)]">{saldoLabel}</p>
          </div>
        </div>
      </Card>

      {/* ── Detalhamento: Fretes ───────────────────────────────────── */}
      <DetalheSection
        icon={<Truck className="h-4 w-4" />}
        title="Fretes"
        subtitle={`${config.fretesDetalhe.length} frete${config.fretesDetalhe.length !== 1 ? 's' : ''} registrados no período`}
        total={config.fretesDetalhe.reduce((s, f) => s + f.valorTotal, 0)}
      >
        {config.fretesDetalhe.length === 0 ? (
          <EmptyRow text="Nenhum frete encontrado neste filtro." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  <Th>Data</Th>
                  <Th>NF</Th>
                  <Th>Placa</Th>
                  <Th>Origem → Destino</Th>
                  <Th>Material</Th>
                  <Th className="text-right">Peso (t)</Th>
                  <Th className="text-right">KM</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {config.fretesDetalhe
                  .slice()
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <Td className="whitespace-nowrap text-[var(--color-fg-muted)]">{formatDate(f.data)}</Td>
                      <Td className="font-mono text-[var(--color-fg-muted)]">{f.notaFiscal || '—'}</Td>
                      <Td className="font-mono text-[var(--color-fg)] whitespace-nowrap">{f.placaCarreta || '—'}</Td>
                      <Td className="text-[var(--color-fg)]">
                        <span className="truncate inline-block max-w-[140px] align-middle">{f.origem || '—'}</span>
                        <span className="text-[var(--color-fg-subtle)] mx-1">→</span>
                        <span className="truncate inline-block max-w-[140px] align-middle">{f.destino || '—'}</span>
                      </Td>
                      <Td className="text-[var(--color-fg-muted)]">{insumosMap.get(f.insumoId) || '—'}</Td>
                      <Td className="text-right tabular-nums text-[var(--color-fg-muted)]">{f.pesoToneladas?.toFixed(2) || '—'}</Td>
                      <Td className="text-right tabular-nums text-[var(--color-fg-muted)]">{f.kmRodados || '—'}</Td>
                      <Td className="text-right tabular-nums font-semibold text-[var(--color-fg)]">{formatCurrency(f.valorTotal)}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </DetalheSection>

      {/* ── Detalhamento: Pagamentos para a transportadora ─────────── */}
      <DetalheSection
        icon={<Wallet className="h-4 w-4" />}
        title={`Pagamentos para ${config.nome}`}
        subtitle={`${config.pagamentosParaDetalhe.length} pagamento${config.pagamentosParaDetalhe.length !== 1 ? 's' : ''} no período`}
        total={config.pagamentosParaDetalhe.reduce((s, p) => s + p.valor, 0)}
      >
        <PagamentoTable pagamentos={config.pagamentosParaDetalhe} />
      </DetalheSection>

      {/* ── Detalhamento: Pagamentos efetuados PELA transportadora ──── */}
      {config.pagamentosPelaDetalhe && (
        <DetalheSection
          icon={<Wallet className="h-4 w-4" />}
          title={`Pagamentos efetuados pela ${config.nome}`}
          subtitle={`${config.pagamentosPelaDetalhe.length} pagamento${config.pagamentosPelaDetalhe.length !== 1 ? 's' : ''} quitados pela transportadora`}
          total={config.pagamentosPelaDetalhe.reduce((s, p) => s + p.valor, 0)}
        >
          <PagamentoTable pagamentos={config.pagamentosPelaDetalhe} showTransportadora />
        </DetalheSection>
      )}

      {/* ── Detalhamento: Abastecimentos ───────────────────────────── */}
      {config.abastecimentosDetalhe.length > 0 && (
        <DetalheSection
          icon={<Fuel className="h-4 w-4" />}
          title={slug === 'areacre' ? 'Abastecimentos (todas as transportadoras)' : `Abastecimentos ${config.nome}`}
          subtitle={`${config.abastecimentosDetalhe.length} abastecimento${config.abastecimentosDetalhe.length !== 1 ? 's' : ''} no período`}
          total={config.abastecimentosDetalhe.reduce((s, a) => s + a.valorTotal, 0)}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  <Th>Data</Th>
                  <Th>Transportadora</Th>
                  <Th>Placa</Th>
                  <Th>Combustível</Th>
                  <Th className="text-right">Litros</Th>
                  <Th className="text-right">R$/L</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {config.abastecimentosDetalhe
                  .slice()
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <Td className="whitespace-nowrap text-[var(--color-fg-muted)]">{formatDate(a.data)}</Td>
                      <Td className="text-[var(--color-fg)]">{a.transportadora || '—'}</Td>
                      <Td className="font-mono text-[var(--color-fg-muted)]">{a.placaCarreta || '—'}</Td>
                      <Td className="text-[var(--color-fg-muted)]">{insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel || '—'}</Td>
                      <Td className="text-right tabular-nums text-[var(--color-fg-muted)]">{a.quantidadeLitros?.toFixed(1) || '—'}</Td>
                      <Td className="text-right tabular-nums text-[var(--color-fg-muted)]">{formatCurrency(a.valorUnidade)}</Td>
                      <Td className="text-right tabular-nums font-semibold text-[var(--color-fg)]">{formatCurrency(a.valorTotal)}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DetalheSection>
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────

function DetalheSection({
  icon,
  title,
  subtitle,
  total,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center h-7 w-7 rounded-md shrink-0"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-fg)',
            }}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{title}</h3>
            <p className="text-[11px] text-[var(--color-fg-subtle)] truncate">{subtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="label-eyebrow">Total</p>
          <p className="text-base font-bold text-[var(--color-fg)] tabular-nums">{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="hairline-divider mb-3" />
      {children}
    </Card>
  );
}

function PagamentoTable({
  pagamentos,
  showTransportadora,
}: {
  pagamentos: PagamentoFrete[];
  showTransportadora?: boolean;
}) {
  if (pagamentos.length === 0) {
    return <EmptyRow text="Nenhum pagamento encontrado neste filtro." />;
  }
  const METODOS: Record<string, string> = {
    pix: 'Pix',
    boleto: 'Boleto',
    cheque: 'Cheque',
    dinheiro: 'Dinheiro',
    transferencia: 'Transferência',
    combustivel: 'Combustível',
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
            <Th>Data</Th>
            <Th>Mês ref.</Th>
            {showTransportadora && <Th>Para</Th>}
            <Th>Método</Th>
            <Th>Pago por</Th>
            <Th>NF</Th>
            <Th className="text-right">Valor</Th>
          </tr>
        </thead>
        <tbody>
          {pagamentos
            .slice()
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <Td className="whitespace-nowrap text-[var(--color-fg-muted)]">{formatDate(p.data)}</Td>
                <Td className="text-[var(--color-fg-muted)] font-mono">{p.mesReferencia || '—'}</Td>
                {showTransportadora && <Td className="text-[var(--color-fg)]">{p.transportadora || '—'}</Td>}
                <Td className="text-[var(--color-fg-muted)]">{METODOS[p.metodo] || p.metodo || '—'}</Td>
                <Td className="text-[var(--color-fg-muted)]">{p.pagoPor || '—'}</Td>
                <Td className="font-mono text-[var(--color-fg-muted)]">{p.notaFiscal || '—'}</Td>
                <Td className="text-right tabular-nums font-semibold text-[var(--color-fg)]">{formatCurrency(p.valor)}</Td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Package className="h-8 w-8 text-[var(--color-fg-subtle)] mb-2" />
      <p className="text-sm text-[var(--color-fg-muted)]">{text}</p>
      <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
        Ajuste o período ou a obra no Dashboard de Frete para alterar o resultado.
      </p>
    </div>
  );
}

