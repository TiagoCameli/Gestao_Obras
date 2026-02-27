import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Apontamento, Obra, EtapaObra, TipoApontamento, StatusApontamento } from '../types';
import { useApontamentos, useAdicionarApontamento, useAtualizarApontamento, useExcluirApontamento } from '../hooks/useApontamentos';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useColaboradores } from '../hooks/useColaboradores';
import { useEmpresas } from '../hooks/useEmpresas';
import { useSequenciasDiarias } from '../hooks/useSequenciasDiarias';
import { useRegistrosHorasDiaristas } from '../hooks/useRegistrosHorasDiaristas';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';
import DiaristasList from '../components/apontamentos/DiaristasList';
import StatusBadge, { getStatusEntidade } from '../components/apontamentos/StatusBadge';
import { gerarId, hojeStr, agoraStr, calcHoras, formatHoras, inicioMes, fimMes, formatDateBR, diasUteisPeriodo, formatCurrency, tabs } from '../components/apontamentos/helpers';
import type { Tab } from '../components/apontamentos/helpers';
import SummaryCards from '../components/apontamentos/SummaryCards';
import ActiveEntityCard from '../components/apontamentos/ActiveEntityCard';
import { SkeletonPainel } from '../components/apontamentos/SkeletonLoader';
import EmptyState from '../components/apontamentos/EmptyState';
import DataTableSortable from '../components/apontamentos/DataTableSortable';
import ReportFilters from '../components/apontamentos/ReportFilters';
import ProgressBarGroup from '../components/apontamentos/ProgressBarGroup';
import { WrenchIcon, UsersIcon, AlertTriangleIcon, ClockIcon, DownloadIcon, CurrencyIcon } from '../components/apontamentos/icons';
import { exportarRelatorioEquipPDF, exportarRelatorioEquipExcel, exportarRelatorioColabPDF, exportarRelatorioColabExcel, exportarRelatorioDiaristasPDF, exportarRelatorioDiaristasExcel } from '../utils/apontamentosExport';
import DetalheEntidade from '../components/apontamentos/DetalheEntidade';

// ══════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════

export default function Apontamentos() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_apontamentos');
  const canEdit = temAcao('editar_apontamentos');
  const canDelete = temAcao('excluir_apontamentos');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['painel', 'equipamentos', 'colaboradores', 'diaristas'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'painel';
  const setTab = useCallback((t: Tab) => setSearchParams({ tab: t }, { replace: true }), [setSearchParams]);

  // Data
  const { data: apontamentos = [], isLoading } = useApontamentos();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: todosEquipamentos = [] } = useEquipamentos();
  const { data: todosColaboradores = [] } = useColaboradores();
  const { data: todasEmpresas = [] } = useEmpresas();
  const { data: sequenciasDiarias = [] } = useSequenciasDiarias();
  const { data: registrosHorasDiaristas = [] } = useRegistrosHorasDiaristas();

  // Mutations
  const adicionarMutation = useAdicionarApontamento();
  const atualizarMutation = useAtualizarApontamento();
  const excluirMutation = useExcluirApontamento();

  // State
  const [detalheModal, setDetalheModal] = useState<{ tipo: TipoApontamento; id: string; nome: string } | null>(null);

  const hoje = hojeStr();

  const equipamentosAtivos = useMemo(() => todosEquipamentos.filter((e) => e.ativo), [todosEquipamentos]);
  const colaboradoresAtivos = useMemo(() => todosColaboradores.filter((c) => c.ativo), [todosColaboradores]);
  const empresasMap = useMemo(() => new Map(todasEmpresas.map((e) => [e.id, e.nome])), [todasEmpresas]);
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);

  // Painel state — filtros independentes por seção
  // Equipamentos
  const [eqDataInicio, setEqDataInicio] = useState(inicioMes(hoje));
  const [eqDataFim, setEqDataFim] = useState(fimMes(hoje));
  const [eqObraIds, setEqObraIds] = useState<string[]>([]);
  const [eqEtapaIds, setEqEtapaIds] = useState<string[]>([]);
  const [eqEquipId, setEqEquipId] = useState('');
  // Colaboradores
  const [coDataInicio, setCoDataInicio] = useState(inicioMes(hoje));
  const [coDataFim, setCoDataFim] = useState(fimMes(hoje));
  const [coObraIds, setCoObraIds] = useState<string[]>([]);
  const [coEtapaIds, setCoEtapaIds] = useState<string[]>([]);
  const [coColabId, setCoColabId] = useState('');
  // Diárias
  const [diDataInicio, setDiDataInicio] = useState(inicioMes(hoje));
  const [diDataFim, setDiDataFim] = useState(fimMes(hoje));
  const [diObraIds, setDiObraIds] = useState<string[]>([]);
  const [diEtapaIds, setDiEtapaIds] = useState<string[]>([]);
  const [diDiaristaFilter, setDiDiaristaFilter] = useState('');

  // Apontamentos por período — independentes
  const eqApontamentosPeriodo = useMemo(
    () => apontamentos.filter((a) => a.data >= eqDataInicio && a.data <= eqDataFim),
    [apontamentos, eqDataInicio, eqDataFim]
  );
  const coApontamentosPeriodo = useMemo(
    () => apontamentos.filter((a) => a.data >= coDataInicio && a.data <= coDataFim),
    [apontamentos, coDataInicio, coDataFim]
  );

  // Etapas por seção
  const eqEtapasFiltro = useMemo(() => {
    if (eqObraIds.length === 0) return etapas;
    return etapas.filter((e) => eqObraIds.includes(e.obraId));
  }, [etapas, eqObraIds]);
  const coEtapasFiltro = useMemo(() => {
    if (coObraIds.length === 0) return etapas;
    return etapas.filter((e) => coObraIds.includes(e.obraId));
  }, [etapas, coObraIds]);
  const diEtapasFiltro = useMemo(() => {
    if (diObraIds.length === 0) return etapas;
    return etapas.filter((e) => diObraIds.includes(e.obraId));
  }, [etapas, diObraIds]);

  // Dashboard stats (always based on today)
  const apontamentosHoje = useMemo(() => apontamentos.filter((a) => a.data === hoje), [apontamentos, hoje]);
  const equipAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'equipamento' && a.status === 'aberto'), [apontamentosHoje]);
  const colabAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'colaborador' && a.status === 'aberto'), [apontamentosHoje]);
  const equipPendentes = useMemo(() => equipamentosAtivos.filter((e) => getStatusEntidade(apontamentos, 'equipamento', e.id, hoje) === 'pendente').length, [equipamentosAtivos, apontamentos, hoje]);
  const colabPendentes = useMemo(() => colaboradoresAtivos.filter((c) => getStatusEntidade(apontamentos, 'colaborador', c.id, hoje) === 'pendente').length, [colaboradoresAtivos, apontamentos, hoje]);

  // Trends (comparação com ontem)
  const ontem = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const apontamentosOntem = useMemo(() => apontamentos.filter((a) => a.data === ontem), [apontamentos, ontem]);
  const equipAtivosOntem = useMemo(() => new Set(apontamentosOntem.filter((a) => a.tipo === 'equipamento' && (a.status === 'aberto' || a.status === 'encerrado')).map((a) => a.equipamentoId)).size, [apontamentosOntem]);
  const colabAtivosOntem = useMemo(() => new Set(apontamentosOntem.filter((a) => a.tipo === 'colaborador' && (a.status === 'aberto' || a.status === 'encerrado')).map((a) => a.colaboradorId)).size, [apontamentosOntem]);
  const equipAtivosHojeCount = useMemo(() => new Set(apontamentosHoje.filter((a) => a.tipo === 'equipamento' && (a.status === 'aberto' || a.status === 'encerrado')).map((a) => a.equipamentoId)).size, [apontamentosHoje]);
  const colabAtivosHojeCount = useMemo(() => new Set(apontamentosHoje.filter((a) => a.tipo === 'colaborador' && (a.status === 'aberto' || a.status === 'encerrado')).map((a) => a.colaboradorId)).size, [apontamentosHoje]);

  // Relatórios por período
  const equipNomeMap = useMemo(() => new Map(todosEquipamentos.map((e) => [e.id, e.nome])), [todosEquipamentos]);
  const colabNomeMap = useMemo(() => new Map(todosColaboradores.map((c) => [c.id, c.nome])), [todosColaboradores]);

  // Registros filtrados — Equipamentos
  const eqFiltrados = useMemo(() => {
    let registros = eqApontamentosPeriodo.filter((a) => a.status === 'encerrado' && a.tipo === 'equipamento');
    if (eqObraIds.length > 0) registros = registros.filter((a) => eqObraIds.includes(a.obraId));
    if (eqEtapaIds.length > 0) registros = registros.filter((a) => eqEtapaIds.includes(a.etapaObraId));
    if (eqEquipId) registros = registros.filter((a) => a.equipamentoId === eqEquipId);
    return registros;
  }, [eqApontamentosPeriodo, eqObraIds, eqEtapaIds, eqEquipId]);

  const relatorioEquip = useMemo(() => {
    const grouped = new Map<string, { nome: string; horas: number; registros: number; dias: Set<string> }>();
    for (const a of eqFiltrados) {
      const entry = grouped.get(a.equipamentoId) || { nome: equipNomeMap.get(a.equipamentoId) || 'Equipamento', horas: 0, registros: 0, dias: new Set<string>() };
      entry.horas += a.horasTrabalhadas;
      entry.registros += 1;
      entry.dias.add(a.data);
      grouped.set(a.equipamentoId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({ id, ...v, diasTrabalhados: v.dias.size })).sort((a, b) => b.horas - a.horas);
  }, [eqFiltrados, equipNomeMap]);

  // Registros filtrados — Colaboradores
  const coFiltrados = useMemo(() => {
    let registros = coApontamentosPeriodo.filter((a) => a.status === 'encerrado' && a.tipo === 'colaborador');
    if (coObraIds.length > 0) registros = registros.filter((a) => coObraIds.includes(a.obraId));
    if (coEtapaIds.length > 0) registros = registros.filter((a) => coEtapaIds.includes(a.etapaObraId));
    if (coColabId) registros = registros.filter((a) => a.colaboradorId === coColabId);
    return registros;
  }, [coApontamentosPeriodo, coObraIds, coEtapaIds, coColabId]);

  const relatorioColab = useMemo(() => {
    const grouped = new Map<string, { nome: string; horas: number; registros: number; dias: Set<string> }>();
    for (const a of coFiltrados) {
      const entry = grouped.get(a.colaboradorId) || { nome: colabNomeMap.get(a.colaboradorId) || 'Colaborador', horas: 0, registros: 0, dias: new Set<string>() };
      entry.horas += a.horasTrabalhadas;
      entry.registros += 1;
      entry.dias.add(a.data);
      grouped.set(a.colaboradorId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({ id, ...v, diasTrabalhados: v.dias.size })).sort((a, b) => b.horas - a.horas);
  }, [coFiltrados, colabNomeMap]);

  const totalHorasEquip = useMemo(() => relatorioEquip.reduce((s, r) => s + r.horas, 0), [relatorioEquip]);
  const totalHorasColab = useMemo(() => relatorioColab.reduce((s, r) => s + r.horas, 0), [relatorioColab]);

  // Relatório por Obra/Etapa — helper reutilizado para equip e colab
  function buildObraEtapaReport(registros: Apontamento[]) {
    const totalH = registros.reduce((s, a) => s + a.horasTrabalhadas, 0);
    if (totalH === 0) return { obras: [] as { obraId: string; obraNome: string; horasObra: number; percentualObra: number; etapas: { etapaId: string; etapaNome: string; horas: number; percentual: number }[] }[], totalHoras: 0 };
    const grouped = new Map<string, { obraNome: string; horasObra: number; etapas: Map<string, { etapaNome: string; horas: number }> }>();
    for (const a of registros) {
      if (!a.obraId) continue;
      let obra = grouped.get(a.obraId);
      if (!obra) { obra = { obraNome: obrasMap.get(a.obraId) || 'Obra', horasObra: 0, etapas: new Map() }; grouped.set(a.obraId, obra); }
      obra.horasObra += a.horasTrabalhadas;
      if (a.etapaObraId) {
        const etapa = obra.etapas.get(a.etapaObraId) || { etapaNome: etapasMap.get(a.etapaObraId) || 'Etapa', horas: 0 };
        etapa.horas += a.horasTrabalhadas;
        obra.etapas.set(a.etapaObraId, etapa);
      }
    }
    return {
      obras: [...grouped.entries()].map(([obraId, obra]) => ({
        obraId, obraNome: obra.obraNome, horasObra: obra.horasObra,
        percentualObra: +((obra.horasObra / totalH) * 100).toFixed(1),
        etapas: [...obra.etapas.entries()].map(([etapaId, et]) => ({
          etapaId, etapaNome: et.etapaNome, horas: et.horas,
          percentual: +((et.horas / totalH) * 100).toFixed(1),
        })).sort((a, b) => b.horas - a.horas),
      })).sort((a, b) => b.horasObra - a.horasObra),
      totalHoras: totalH,
    };
  }

  const relatorioObraEtapaEquip = useMemo(
    () => buildObraEtapaReport(eqFiltrados),
    [eqFiltrados, obrasMap, etapasMap]
  );

  const relatorioObraEtapaColab = useMemo(
    () => buildObraEtapaReport(coFiltrados),
    [coFiltrados, obrasMap, etapasMap]
  );

  // Relatório de ausências — colaboradores (falta, licença médica, férias)
  const relatorioAusenciasColab = useMemo(() => {
    const ausencias = coApontamentosPeriodo.filter((a) => a.tipo === 'colaborador' && ['falta', 'licenca_medica', 'ferias'].includes(a.status));
    const grouped = new Map<string, { nome: string; faltas: Set<string>; licencas: Set<string>; ferias: Set<string> }>();
    for (const a of ausencias) {
      const entry = grouped.get(a.colaboradorId) || { nome: colabNomeMap.get(a.colaboradorId) || 'Colaborador', faltas: new Set(), licencas: new Set(), ferias: new Set() };
      if (a.status === 'falta') entry.faltas.add(a.data);
      else if (a.status === 'licenca_medica') entry.licencas.add(a.data);
      else if (a.status === 'ferias') entry.ferias.add(a.data);
      grouped.set(a.colaboradorId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({
      id, nome: v.nome, faltas: v.faltas.size, licencas: v.licencas.size, ferias: v.ferias.size,
      total: v.faltas.size + v.licencas.size + v.ferias.size,
    })).sort((a, b) => b.total - a.total);
  }, [coApontamentosPeriodo, colabNomeMap]);

  // Relatório de status — equipamentos (manutenção, ocioso)
  const relatorioStatusEquip = useMemo(() => {
    const registros = eqApontamentosPeriodo.filter((a) => a.tipo === 'equipamento' && ['manutencao', 'ocioso'].includes(a.status));
    const grouped = new Map<string, { nome: string; manutencao: Set<string>; ocioso: Set<string> }>();
    for (const a of registros) {
      const entry = grouped.get(a.equipamentoId) || { nome: equipNomeMap.get(a.equipamentoId) || 'Equipamento', manutencao: new Set(), ocioso: new Set() };
      if (a.status === 'manutencao') entry.manutencao.add(a.data);
      else if (a.status === 'ocioso') entry.ocioso.add(a.data);
      grouped.set(a.equipamentoId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({
      id, nome: v.nome, manutencao: v.manutencao.size, ocioso: v.ocioso.size,
      total: v.manutencao.size + v.ocioso.size,
    })).sort((a, b) => b.total - a.total);
  }, [eqApontamentosPeriodo, equipNomeMap]);

  // Relatório dias sem registro — Equipamentos
  const eqDiasUteis = useMemo(() => diasUteisPeriodo(eqDataInicio, eqDataFim), [eqDataInicio, eqDataFim]);
  const relatorioDiasSemRegistroEquip = useMemo(() => {
    return equipamentosAtivos.map((e) => {
      const diasComRegistro = new Set(eqApontamentosPeriodo.filter((a) => a.tipo === 'equipamento' && a.equipamentoId === e.id).map((a) => a.data));
      const semRegistro = eqDiasUteis.filter((d) => !diasComRegistro.has(d)).length;
      return { id: e.id, nome: e.nome, diasUteis: eqDiasUteis.length, diasComRegistro: diasComRegistro.size, semRegistro };
    }).filter((r) => r.semRegistro > 0).sort((a, b) => b.semRegistro - a.semRegistro);
  }, [equipamentosAtivos, eqApontamentosPeriodo, eqDiasUteis]);

  // Relatório dias sem registro — Colaboradores
  const coDiasUteis = useMemo(() => diasUteisPeriodo(coDataInicio, coDataFim), [coDataInicio, coDataFim]);
  const relatorioDiasSemRegistroColab = useMemo(() => {
    return colaboradoresAtivos.map((c) => {
      const diasComRegistro = new Set(coApontamentosPeriodo.filter((a) => a.tipo === 'colaborador' && a.colaboradorId === c.id).map((a) => a.data));
      const semRegistro = coDiasUteis.filter((d) => !diasComRegistro.has(d)).length;
      return { id: c.id, nome: c.nome, diasUteis: coDiasUteis.length, diasComRegistro: diasComRegistro.size, semRegistro };
    }).filter((r) => r.semRegistro > 0).sort((a, b) => b.semRegistro - a.semRegistro);
  }, [colaboradoresAtivos, coApontamentosPeriodo, coDiasUteis]);

  // Relatório Diaristas
  // Nomes únicos de diaristas para filtro
  const diaristaNames = useMemo(() => {
    const names = new Set(sequenciasDiarias.map(s => s.nomeDiarista));
    return [...names].sort();
  }, [sequenciasDiarias]);

  const relatorioDiaristas = useMemo(() => {
    let registros = registrosHorasDiaristas.filter(r => r.data >= diDataInicio && r.data <= diDataFim);
    if (diObraIds.length > 0) registros = registros.filter(r => diObraIds.includes(r.obraId));
    if (diEtapaIds.length > 0) registros = registros.filter(r => diEtapaIds.includes(r.etapaId));

    const registrosPorSeq = new Map<string, number>();
    for (const r of registros) {
      registrosPorSeq.set(r.sequenciaId, (registrosPorSeq.get(r.sequenciaId) || 0) + 1);
    }

    const seqIds = new Set(registrosPorSeq.keys());
    let seqsNoPeriodo = sequenciasDiarias.filter(s => seqIds.has(s.id));
    if (diDiaristaFilter) seqsNoPeriodo = seqsNoPeriodo.filter(s => s.nomeDiarista === diDiaristaFilter);

    let totalAPagar = 0;
    let totalPago = 0;
    let abertas = 0;
    let fechadas = 0;
    let pagas = 0;
    const porObra = new Map<string, { obraNome: string; valor: number; dias: number; abertas: number; fechadas: number; pagas: number }>();

    for (const seq of seqsNoPeriodo) {
      const diasNoPeriodo = registrosPorSeq.get(seq.id) || 0;
      const valorSeq = diasNoPeriodo * seq.valorDiaria;
      totalAPagar += valorSeq;

      if (seq.status === 'aberta') abertas++;
      else fechadas++;
      if (seq.pago) { pagas++; totalPago += valorSeq; }

      const obraNome = obrasMap.get(seq.obraId) || 'Obra';
      const entry = porObra.get(seq.obraId) || { obraNome, valor: 0, dias: 0, abertas: 0, fechadas: 0, pagas: 0 };
      entry.valor += valorSeq;
      entry.dias += diasNoPeriodo;
      if (seq.status === 'aberta') entry.abertas++;
      else entry.fechadas++;
      if (seq.pago) entry.pagas++;
      porObra.set(seq.obraId, entry);
    }

    return {
      totalAPagar,
      totalPago,
      abertas,
      fechadas,
      pagas,
      totalSequencias: seqsNoPeriodo.length,
      totalDias: registros.length,
      porObra: [...porObra.entries()]
        .map(([obraId, v]) => ({ obraId, ...v }))
        .sort((a, b) => b.valor - a.valor),
    };
  }, [sequenciasDiarias, registrosHorasDiaristas, diDataInicio, diDataFim, diObraIds, diEtapaIds, diDiaristaFilter, obrasMap]);

  // Handlers
  const handleClockIn = useCallback(
    async (tipo: TipoApontamento, entidadeId: string, obraId: string, etapaId: string, horaInicio: string) => {
      const novo: Apontamento = {
        id: gerarId(),
        data: hoje,
        horaInicio,
        horaFim: '',
        obraId,
        etapaObraId: etapaId,
        equipamentoId: tipo === 'equipamento' ? entidadeId : '',
        colaboradorId: tipo === 'colaborador' ? entidadeId : '',
        tipo,
        horasTrabalhadas: 0,
        observacoes: '',
        status: 'aberto',
        criadoPor: usuario?.nome || '',
      };
      await adicionarMutation.mutateAsync(novo);
    },
    [hoje, usuario, adicionarMutation]
  );

  const handleClockOut = useCallback(
    async (a: Apontamento) => {
      const horaFim = agoraStr();
      const horas = calcHoras(a.horaInicio, horaFim);
      await atualizarMutation.mutateAsync({
        ...a,
        horaFim,
        horasTrabalhadas: horas,
        status: 'encerrado',
      });
    },
    [atualizarMutation]
  );

  const handleUpdate = useCallback(
    async (a: Apontamento) => {
      await atualizarMutation.mutateAsync(a);
    },
    [atualizarMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await excluirMutation.mutateAsync(id);
    },
    [excluirMutation]
  );

  const handleRegistrarAusencia = useCallback(
    async (tipo: TipoApontamento, entidadeId: string, data: string, statusAusencia: StatusApontamento) => {
      const novo: Apontamento = {
        id: gerarId(),
        data,
        horaInicio: '',
        horaFim: '',
        obraId: '',
        etapaObraId: '',
        equipamentoId: tipo === 'equipamento' ? entidadeId : '',
        colaboradorId: tipo === 'colaborador' ? entidadeId : '',
        tipo,
        horasTrabalhadas: 0,
        observacoes: '',
        status: statusAusencia,
        criadoPor: usuario?.nome || '',
      };
      await adicionarMutation.mutateAsync(novo);
    },
    [usuario, adicionarMutation]
  );

  if (isLoading) {
    return <SkeletonPainel />;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Apontamentos</h1>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 bg-gray-200 dark:bg-slate-700 rounded-lg p-1 w-full sm:w-fit overflow-x-auto"
        role="tablist"
        aria-label="Seções de apontamentos"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            id={`tab-${t.key}`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emt-verde ${
              tab === t.key
                ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Painel Tab ── */}
      {tab === 'painel' && (
        <div className="space-y-6" role="tabpanel" id="tabpanel-painel" aria-labelledby="tab-painel">
          {/* Status do dia (sempre hoje) */}
          <SummaryCards items={[
            {
              label: 'Equip. Ativos',
              value: equipAbertosHoje.length,
              color: 'green',
              icon: <WrenchIcon className="w-4 h-4" />,
              trend: { value: equipAtivosHojeCount - equipAtivosOntem, label: 'vs ontem' },
              tooltip: 'Equipamentos com apontamento aberto agora',
            },
            {
              label: 'Colab. Ativos',
              value: colabAbertosHoje.length,
              color: 'green',
              icon: <UsersIcon className="w-4 h-4" />,
              trend: { value: colabAtivosHojeCount - colabAtivosOntem, label: 'vs ontem' },
              tooltip: 'Colaboradores com apontamento aberto agora',
            },
            {
              label: 'Equip. Pendentes',
              value: equipPendentes,
              color: 'amber',
              icon: <AlertTriangleIcon className="w-4 h-4" />,
              tooltip: 'Equipamentos sem apontamento hoje',
            },
            {
              label: 'Colab. Pendentes',
              value: colabPendentes,
              color: 'amber',
              icon: <ClockIcon className="w-4 h-4" />,
              tooltip: 'Colaboradores sem apontamento hoje',
            },
          ]} />

          {/* Ativos agora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Equipamentos Ativos Agora</h2>
              {equipAbertosHoje.length === 0 ? (
                <EmptyState type="equipamentos" message="Nenhum equipamento ativo no momento" />
              ) : (
                <div className="space-y-2">
                  {equipAbertosHoje.map((a) => {
                    const equip = todosEquipamentos.find((e) => e.id === a.equipamentoId);
                    return (
                      <ActiveEntityCard
                        key={a.id}
                        name={equip?.nome || 'Equipamento'}
                        obra={obrasMap.get(a.obraId) || ''}
                        etapa={etapasMap.get(a.etapaObraId) || ''}
                        horaInicio={a.horaInicio}
                        type="equipamento"
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Colaboradores Ativos Agora</h2>
              {colabAbertosHoje.length === 0 ? (
                <EmptyState type="colaboradores" message="Nenhum colaborador ativo no momento" />
              ) : (
                <div className="space-y-2">
                  {colabAbertosHoje.map((a) => {
                    const colab = todosColaboradores.find((c) => c.id === a.colaboradorId);
                    return (
                      <ActiveEntityCard
                        key={a.id}
                        name={colab?.nome || 'Colaborador'}
                        obra={obrasMap.get(a.obraId) || ''}
                        etapa={etapasMap.get(a.etapaObraId) || ''}
                        horaInicio={a.horaInicio}
                        type="colaborador"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Relatórios ── */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Relatórios</h2>

            {/* ═══ EQUIPAMENTOS ═══ */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <WrenchIcon className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-semibold text-gray-800">Equipamentos</h3>
                </div>
                {relatorioEquip.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors" onClick={() => exportarRelatorioEquipPDF(relatorioEquip.map((r) => ({ nome: r.nome, dias: r.diasTrabalhados, registros: r.registros, horas: r.horas })), totalHorasEquip, eqDataInicio, eqDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors" onClick={() => exportarRelatorioEquipExcel(relatorioEquip.map((r) => ({ nome: r.nome, dias: r.diasTrabalhados, registros: r.registros, horas: r.horas })), totalHorasEquip, eqDataInicio, eqDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> Excel
                    </button>
                  </div>
                )}
              </div>

              <ReportFilters
                dataInicio={eqDataInicio} dataFim={eqDataFim}
                onDataInicioChange={setEqDataInicio} onDataFimChange={setEqDataFim}
                obraIds={eqObraIds} onObraIdsChange={(ids) => { setEqObraIds(ids); setEqEtapaIds([]); }}
                obras={obras.map((o) => ({ id: o.id, label: o.nome }))}
                etapaIds={eqEtapaIds} onEtapaIdsChange={setEqEtapaIds}
                etapas={eqEtapasFiltro.map((e) => ({ id: e.id, label: e.nome }))}
                entityValue={eqEquipId} onEntityChange={setEqEquipId}
                entityOptions={[{ id: '', label: 'Todos' }, ...equipamentosAtivos.map((e) => ({ id: e.id, label: e.nome }))]}
                entityLabel="Equipamento" entityPlaceholder="Todos"
                onClear={() => { setEqObraIds([]); setEqEtapaIds([]); setEqEquipId(''); setEqDataInicio(inicioMes(hoje)); setEqDataFim(fimMes(hoje)); }}
              />

              <SummaryCards columns={2} items={[
                { label: 'Horas Totais', value: Math.round(totalHorasEquip), color: 'green', icon: <ClockIcon className="w-4 h-4" />, tooltip: `${formatHoras(totalHorasEquip)} no período` },
                { label: 'Equipamentos no Período', value: relatorioEquip.length, color: 'blue', icon: <WrenchIcon className="w-4 h-4" /> },
              ]} />

              <div className="mt-4 space-y-4">
                <DataTableSortable
                  title="Horas por Equipamento"
                  headerBgClass="bg-blue-50"
                  headerTextClass="text-blue-800"
                  data={relatorioEquip}
                  columns={[
                    { key: 'nome', header: 'Equipamento', accessor: (r) => r.nome },
                    { key: 'dias', header: 'Dias', accessor: (r) => r.diasTrabalhados, align: 'right' },
                    { key: 'registros', header: 'Registros', accessor: (r) => r.registros, align: 'right' },
                    { key: 'horas', header: 'Horas', accessor: (r) => r.horas, align: 'right', render: (r) => <span className="font-semibold text-emt-verde">{formatHoras(r.horas)}</span> },
                  ]}
                  totalsRow={{ nome: 'Total', dias: '-', registros: relatorioEquip.reduce((s, r) => s + r.registros, 0), horas: <span className="text-emt-verde">{formatHoras(totalHorasEquip)}</span> }}
                />

                {relatorioObraEtapaEquip.totalHoras > 0 && (
                  <ProgressBarGroup
                    title={`Horas por Obra / Etapa — Total: ${formatHoras(relatorioObraEtapaEquip.totalHoras)}`}
                    headerBgClass="bg-blue-50"
                    headerTextClass="text-blue-800"
                    items={relatorioObraEtapaEquip.obras.map((obra) => ({
                      label: obra.obraNome,
                      value: obra.horasObra,
                      maxValue: relatorioObraEtapaEquip.totalHoras,
                      detail: `${formatHoras(obra.horasObra)} (${obra.percentualObra}%)`,
                      children: obra.etapas.map((et) => ({
                        label: et.etapaNome,
                        value: et.horas,
                        maxValue: obra.horasObra,
                        detail: `${formatHoras(et.horas)} (${et.percentual}%)`,
                      })),
                    }))}
                  />
                )}

                {relatorioStatusEquip.length > 0 && (
                  <DataTableSortable
                    title="Manutenção e Ociosidade"
                    headerBgClass="bg-blue-50"
                    headerTextClass="text-blue-800"
                    data={relatorioStatusEquip}
                    columns={[
                      { key: 'nome', header: 'Equipamento', accessor: (r) => r.nome },
                      { key: 'manutencao', header: 'Manutenção', accessor: (r) => r.manutencao, align: 'right', render: (r) => <span className="text-orange-600 font-semibold">{r.manutencao || '-'}</span> },
                      { key: 'ocioso', header: 'Ocioso', accessor: (r) => r.ocioso, align: 'right', render: (r) => <span className="text-gray-500 font-semibold">{r.ocioso || '-'}</span> },
                      { key: 'total', header: 'Total dias', accessor: (r) => r.total, align: 'right', render: (r) => <span className="font-bold">{r.total}</span> },
                    ]}
                    totalsRow={{ nome: 'Total', manutencao: relatorioStatusEquip.reduce((s, r) => s + r.manutencao, 0), ocioso: relatorioStatusEquip.reduce((s, r) => s + r.ocioso, 0), total: relatorioStatusEquip.reduce((s, r) => s + r.total, 0) }}
                  />
                )}

                <DataTableSortable
                  title={`Dias sem Registro — ${eqDiasUteis.length} dias úteis no período`}
                  headerBgClass="bg-blue-50"
                  headerTextClass="text-blue-800"
                  data={relatorioDiasSemRegistroEquip}
                  emptyMessage="Todos os equipamentos têm registro em todos os dias úteis"
                  columns={[
                    { key: 'nome', header: 'Equipamento', accessor: (r) => r.nome },
                    { key: 'comRegistro', header: 'Com registro', accessor: (r) => r.diasComRegistro, align: 'right', render: (r) => <span className="text-green-600">{r.diasComRegistro}</span> },
                    { key: 'semRegistro', header: 'Sem registro', accessor: (r) => r.semRegistro, align: 'right', render: (r) => <span className="text-red-600 font-semibold">{r.semRegistro}</span> },
                    { key: 'pct', header: '%', accessor: (r) => r.diasUteis > 0 ? (r.semRegistro / r.diasUteis) * 100 : 0, align: 'right', render: (r) => <>{r.diasUteis > 0 ? ((r.semRegistro / r.diasUteis) * 100).toFixed(0) : 0}%</> },
                  ]}
                />
              </div>
            </div>

            {/* ═══ COLABORADORES ═══ */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-green-600" />
                  <h3 className="text-base font-semibold text-gray-800">Colaboradores</h3>
                </div>
                {relatorioColab.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors" onClick={() => exportarRelatorioColabPDF(relatorioColab.map((r) => ({ nome: r.nome, dias: r.diasTrabalhados, registros: r.registros, horas: r.horas })), totalHorasColab, coDataInicio, coDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors" onClick={() => exportarRelatorioColabExcel(relatorioColab.map((r) => ({ nome: r.nome, dias: r.diasTrabalhados, registros: r.registros, horas: r.horas })), totalHorasColab, coDataInicio, coDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> Excel
                    </button>
                  </div>
                )}
              </div>

              <ReportFilters
                dataInicio={coDataInicio} dataFim={coDataFim}
                onDataInicioChange={setCoDataInicio} onDataFimChange={setCoDataFim}
                obraIds={coObraIds} onObraIdsChange={(ids) => { setCoObraIds(ids); setCoEtapaIds([]); }}
                obras={obras.map((o) => ({ id: o.id, label: o.nome }))}
                etapaIds={coEtapaIds} onEtapaIdsChange={setCoEtapaIds}
                etapas={coEtapasFiltro.map((e) => ({ id: e.id, label: e.nome }))}
                entityValue={coColabId} onEntityChange={setCoColabId}
                entityOptions={[{ id: '', label: 'Todos' }, ...colaboradoresAtivos.map((c) => ({ id: c.id, label: c.nome }))]}
                entityLabel="Colaborador" entityPlaceholder="Todos"
                onClear={() => { setCoObraIds([]); setCoEtapaIds([]); setCoColabId(''); setCoDataInicio(inicioMes(hoje)); setCoDataFim(fimMes(hoje)); }}
              />

              <SummaryCards columns={2} items={[
                { label: 'Horas Totais', value: Math.round(totalHorasColab), color: 'green', icon: <ClockIcon className="w-4 h-4" />, tooltip: `${formatHoras(totalHorasColab)} no período` },
                { label: 'Colaboradores no Período', value: relatorioColab.length, color: 'blue', icon: <UsersIcon className="w-4 h-4" /> },
              ]} />

              <div className="mt-4 space-y-4">
                <DataTableSortable
                  title="Horas por Colaborador"
                  headerBgClass="bg-green-50"
                  headerTextClass="text-green-800"
                  data={relatorioColab}
                  columns={[
                    { key: 'nome', header: 'Colaborador', accessor: (r) => r.nome },
                    { key: 'dias', header: 'Dias', accessor: (r) => r.diasTrabalhados, align: 'right' },
                    { key: 'registros', header: 'Registros', accessor: (r) => r.registros, align: 'right' },
                    { key: 'horas', header: 'Horas', accessor: (r) => r.horas, align: 'right', render: (r) => <span className="font-semibold text-emt-verde">{formatHoras(r.horas)}</span> },
                  ]}
                  totalsRow={{ nome: 'Total', dias: '-', registros: relatorioColab.reduce((s, r) => s + r.registros, 0), horas: <span className="text-emt-verde">{formatHoras(totalHorasColab)}</span> }}
                />

                {relatorioObraEtapaColab.totalHoras > 0 && (
                  <ProgressBarGroup
                    title={`Horas por Obra / Etapa — Total: ${formatHoras(relatorioObraEtapaColab.totalHoras)}`}
                    headerBgClass="bg-green-50"
                    headerTextClass="text-green-800"
                    items={relatorioObraEtapaColab.obras.map((obra) => ({
                      label: obra.obraNome,
                      value: obra.horasObra,
                      maxValue: relatorioObraEtapaColab.totalHoras,
                      detail: `${formatHoras(obra.horasObra)} (${obra.percentualObra}%)`,
                      children: obra.etapas.map((et) => ({
                        label: et.etapaNome,
                        value: et.horas,
                        maxValue: obra.horasObra,
                        detail: `${formatHoras(et.horas)} (${et.percentual}%)`,
                      })),
                    }))}
                  />
                )}

                {relatorioAusenciasColab.length > 0 && (
                  <DataTableSortable
                    title="Faltas, Licenças e Férias"
                    headerBgClass="bg-green-50"
                    headerTextClass="text-green-800"
                    data={relatorioAusenciasColab}
                    columns={[
                      { key: 'nome', header: 'Colaborador', accessor: (r) => r.nome },
                      { key: 'faltas', header: 'Faltas', accessor: (r) => r.faltas, align: 'right', render: (r) => <span className="text-red-600 font-semibold">{r.faltas || '-'}</span> },
                      { key: 'licencas', header: 'Licenças', accessor: (r) => r.licencas, align: 'right', render: (r) => <span className="text-purple-600 font-semibold">{r.licencas || '-'}</span> },
                      { key: 'ferias', header: 'Férias', accessor: (r) => r.ferias, align: 'right', render: (r) => <span className="text-cyan-600 font-semibold">{r.ferias || '-'}</span> },
                      { key: 'total', header: 'Total dias', accessor: (r) => r.total, align: 'right', render: (r) => <span className="font-bold">{r.total}</span> },
                    ]}
                    totalsRow={{
                      nome: 'Total',
                      faltas: <span className="text-red-600">{relatorioAusenciasColab.reduce((s, r) => s + r.faltas, 0)}</span>,
                      licencas: <span className="text-purple-600">{relatorioAusenciasColab.reduce((s, r) => s + r.licencas, 0)}</span>,
                      ferias: <span className="text-cyan-600">{relatorioAusenciasColab.reduce((s, r) => s + r.ferias, 0)}</span>,
                      total: relatorioAusenciasColab.reduce((s, r) => s + r.total, 0),
                    }}
                  />
                )}

                <DataTableSortable
                  title={`Dias sem Registro — ${coDiasUteis.length} dias úteis no período`}
                  headerBgClass="bg-green-50"
                  headerTextClass="text-green-800"
                  data={relatorioDiasSemRegistroColab}
                  emptyMessage="Todos os colaboradores têm registro em todos os dias úteis"
                  columns={[
                    { key: 'nome', header: 'Colaborador', accessor: (r) => r.nome },
                    { key: 'comRegistro', header: 'Com registro', accessor: (r) => r.diasComRegistro, align: 'right', render: (r) => <span className="text-green-600">{r.diasComRegistro}</span> },
                    { key: 'semRegistro', header: 'Sem registro', accessor: (r) => r.semRegistro, align: 'right', render: (r) => <span className="text-red-600 font-semibold">{r.semRegistro}</span> },
                    { key: 'pct', header: '%', accessor: (r) => r.diasUteis > 0 ? (r.semRegistro / r.diasUteis) * 100 : 0, align: 'right', render: (r) => <>{r.diasUteis > 0 ? ((r.semRegistro / r.diasUteis) * 100).toFixed(0) : 0}%</> },
                  ]}
                />
              </div>
            </div>

            {/* ═══ DIARISTAS ═══ */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CurrencyIcon className="w-5 h-5 text-orange-600" />
                  <h3 className="text-base font-semibold text-gray-800">Diárias</h3>
                </div>
                {relatorioDiaristas.porObra.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors" onClick={() => exportarRelatorioDiaristasPDF(relatorioDiaristas.porObra.map((r) => ({ obra: r.obraNome, dias: r.dias, valor: r.valor, abertas: r.abertas, fechadas: r.fechadas, pagas: r.pagas })), { totalAPagar: relatorioDiaristas.totalAPagar, totalPago: relatorioDiaristas.totalPago }, diDataInicio, diDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors" onClick={() => exportarRelatorioDiaristasExcel(relatorioDiaristas.porObra.map((r) => ({ obra: r.obraNome, dias: r.dias, valor: r.valor, abertas: r.abertas, fechadas: r.fechadas, pagas: r.pagas })), { totalAPagar: relatorioDiaristas.totalAPagar, totalPago: relatorioDiaristas.totalPago }, diDataInicio, diDataFim)}>
                      <DownloadIcon className="w-3.5 h-3.5" /> Excel
                    </button>
                  </div>
                )}
              </div>

              <ReportFilters
                dataInicio={diDataInicio} dataFim={diDataFim}
                onDataInicioChange={setDiDataInicio} onDataFimChange={setDiDataFim}
                obraIds={diObraIds} onObraIdsChange={(ids) => { setDiObraIds(ids); setDiEtapaIds([]); }}
                obras={obras.map((o) => ({ id: o.id, label: o.nome }))}
                etapaIds={diEtapaIds} onEtapaIdsChange={setDiEtapaIds}
                etapas={diEtapasFiltro.map((e) => ({ id: e.id, label: e.nome }))}
                entityValue={diDiaristaFilter} onEntityChange={setDiDiaristaFilter}
                entityOptions={[{ id: '', label: 'Todos' }, ...diaristaNames.map((name) => ({ id: name, label: name }))]}
                entityLabel="Diarista" entityPlaceholder="Todos"
                onClear={() => { setDiObraIds([]); setDiEtapaIds([]); setDiDiaristaFilter(''); setDiDataInicio(inicioMes(hoje)); setDiDataFim(fimMes(hoje)); }}
              />

              {relatorioDiaristas.totalSequencias === 0 ? (
                <EmptyState type="diaristas" message="Nenhuma diária registrada no período" />
              ) : (
                <>
                  <SummaryCards columns={4} items={[
                    { label: 'Total a Pagar', value: Math.round(relatorioDiaristas.totalAPagar), color: 'orange', icon: <CurrencyIcon className="w-4 h-4" />, format: (n) => formatCurrency(n), subtitle: `${relatorioDiaristas.totalDias} dias registrados` },
                    { label: 'Total Pago', value: Math.round(relatorioDiaristas.totalPago), color: 'green', icon: <CurrencyIcon className="w-4 h-4" />, format: (n) => formatCurrency(n), subtitle: `${relatorioDiaristas.pagas} seq. pagas` },
                    { label: 'Seq. Abertas', value: relatorioDiaristas.abertas, color: 'amber', icon: <ClockIcon className="w-4 h-4" />, subtitle: 'em andamento' },
                    { label: 'Seq. Fechadas', value: relatorioDiaristas.fechadas, color: 'blue', icon: <UsersIcon className="w-4 h-4" />, subtitle: `${relatorioDiaristas.pagas} pagas` },
                  ]} />

                  <div className="mt-4">
                    <DataTableSortable
                      title="Diárias por Obra"
                      headerBgClass="bg-orange-50"
                      headerTextClass="text-orange-800"
                      data={relatorioDiaristas.porObra}
                      columns={[
                        { key: 'obra', header: 'Obra', accessor: (r) => r.obraNome },
                        { key: 'dias', header: 'Dias', accessor: (r) => r.dias, align: 'right' },
                        { key: 'valor', header: 'Valor', accessor: (r) => r.valor, align: 'right', render: (r) => <span className="font-semibold text-orange-600">{formatCurrency(r.valor)}</span> },
                        { key: 'abertas', header: 'Abertas', accessor: (r) => r.abertas, align: 'right', render: (r) => <span className="text-amber-600">{r.abertas || '-'}</span> },
                        { key: 'fechadas', header: 'Fechadas', accessor: (r) => r.fechadas, align: 'right', render: (r) => <span className="text-blue-600">{r.fechadas || '-'}</span> },
                        { key: 'pagas', header: 'Pagas', accessor: (r) => r.pagas, align: 'right', render: (r) => <span className="text-green-600">{r.pagas || '-'}</span> },
                      ]}
                      totalsRow={{
                        obra: 'Total',
                        dias: relatorioDiaristas.totalDias,
                        valor: <span className="text-orange-600">{formatCurrency(relatorioDiaristas.totalAPagar)}</span>,
                        abertas: <span className="text-amber-600">{relatorioDiaristas.abertas}</span>,
                        fechadas: <span className="text-blue-600">{relatorioDiaristas.fechadas}</span>,
                        pagas: <span className="text-green-600">{relatorioDiaristas.pagas}</span>,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Equipamentos Tab ── */}
      {tab === 'equipamentos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="tabpanel" id="tabpanel-equipamentos" aria-labelledby="tab-equipamentos">
          {equipamentosAtivos.length === 0 && (
            <div className="col-span-full"><EmptyState type="equipamentos" message="Nenhum equipamento cadastrado" /></div>
          )}
          {equipamentosAtivos.map((equip) => {
            const status = getStatusEntidade(apontamentos, 'equipamento', equip.id, hoje);
            return (
              <div
                key={equip.id}
                className="bg-white rounded-lg p-4 border shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                onClick={() => setDetalheModal({ tipo: 'equipamento', id: equip.id, nome: equip.nome })}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{equip.nome}</h3>
                  <StatusBadge status={status} />
                </div>
                <p className="text-xs text-gray-500">{equip.marca} {equip.codigoPatrimonio && `| ${equip.codigoPatrimonio}`}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Colaboradores Tab ── */}
      {tab === 'colaboradores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="tabpanel" id="tabpanel-colaboradores" aria-labelledby="tab-colaboradores">
          {colaboradoresAtivos.length === 0 && (
            <div className="col-span-full"><EmptyState type="colaboradores" message="Nenhum colaborador cadastrado" /></div>
          )}
          {colaboradoresAtivos.map((colab) => {
            const status = getStatusEntidade(apontamentos, 'colaborador', colab.id, hoje);
            return (
              <div
                key={colab.id}
                className="bg-white rounded-lg p-4 border shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                onClick={() => setDetalheModal({ tipo: 'colaborador', id: colab.id, nome: colab.nome })}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{colab.nome}</h3>
                  <StatusBadge status={status} />
                </div>
                <p className="text-xs text-gray-500">{empresasMap.get(colab.empresaId) || ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Diaristas Tab ── */}
      {tab === 'diaristas' && (
        <div role="tabpanel" id="tabpanel-diaristas" aria-labelledby="tab-diaristas">
        <DiaristasList
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
        </div>
      )}

      {/* ── Detail Modal ── */}
      <Modal
        open={detalheModal !== null}
        onClose={() => setDetalheModal(null)}
        title={detalheModal?.nome || ''}
        size="lg"
      >
        {detalheModal && (
          <DetalheEntidade
            tipo={detalheModal.tipo}
            entidadeId={detalheModal.id}
            apontamentos={apontamentos}
            obras={obras}
            etapas={etapas}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            onClockIn={(obraId, etapaId, horaInicio) => handleClockIn(detalheModal.tipo, detalheModal.id, obraId, etapaId, horaInicio)}
            onClockOut={handleClockOut}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRegistrarAusencia={(data, status) => handleRegistrarAusencia(detalheModal.tipo, detalheModal.id, data, status)}
          />
        )}
      </Modal>
    </div>
  );
}
