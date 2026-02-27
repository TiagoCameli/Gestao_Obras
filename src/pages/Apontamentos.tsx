import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Apontamento, Obra, EtapaObra, TipoApontamento } from '../types';
import { useApontamentos, useAdicionarApontamento, useAtualizarApontamento, useExcluirApontamento } from '../hooks/useApontamentos';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useColaboradores } from '../hooks/useColaboradores';
import { useEmpresas } from '../hooks/useEmpresas';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hojeStr(): string {
  return new Date().toISOString().split('T')[0];
}

function agoraStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function calcHoras(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const diff = (hf * 60 + mf) - (hi * 60 + mi);
  return Math.max(0, +(diff / 60).toFixed(2));
}

function formatHoras(h: number): string {
  if (!h) return '-';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h${mins > 0 ? ` ${mins}min` : ''}`;
}

function inicioSemana(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function fimSemana(dateStr: string): string {
  const inicio = inicioSemana(dateStr);
  const d = new Date(inicio + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function inicioMes(dateStr: string): string {
  return dateStr.substring(0, 7) + '-01';
}

function fimMes(dateStr: string): string {
  const [y, m] = dateStr.substring(0, 7).split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${dateStr.substring(0, 7)}-${String(last).padStart(2, '0')}`;
}

function formatDateBR(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

type PeriodoRelatorio = 'diario' | 'semanal' | 'mensal';

type Tab = 'painel' | 'equipamentos' | 'colaboradores';
const tabs: { key: Tab; label: string }[] = [
  { key: 'painel', label: 'Painel' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'colaboradores', label: 'Colaboradores' },
];

// ── Clock-in Form ──
function ClockInForm({
  obras,
  etapas,
  onSubmit,
  onCancel,
}: {
  obras: Obra[];
  etapas: EtapaObra[];
  onSubmit: (obraId: string, etapaId: string, horaInicio: string) => void;
  onCancel: () => void;
}) {
  const [obraId, setObraId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [horaInicio, setHoraInicio] = useState(agoraStr());

  const etapasFiltradas = useMemo(() => etapas.filter((e) => e.obraId === obraId), [etapas, obraId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (obraId && etapaId && horaInicio) {
      onSubmit(obraId, etapaId, horaInicio);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 p-3 bg-gray-50 rounded-lg border">
      <h4 className="text-sm font-semibold text-gray-700">Novo Clock-in</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Obra *</label>
          <select
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={obraId}
            onChange={(e) => { setObraId(e.target.value); setEtapaId(''); }}
            required
          >
            <option value="">Selecione...</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Etapa *</label>
          <select
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            required
            disabled={!obraId}
          >
            <option value="">Selecione...</option>
            {etapasFiltradas.map((et) => <option key={et.id} value={et.id}>{et.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora Inicio *</label>
          <input
            type="time"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={!obraId || !etapaId || !horaInicio}>Registrar</Button>
      </div>
    </form>
  );
}

// ── Edit Form ──
function EditApontamentoForm({
  apontamento,
  obras,
  etapas,
  onSubmit,
  onCancel,
}: {
  apontamento: Apontamento;
  obras: Obra[];
  etapas: EtapaObra[];
  onSubmit: (a: Apontamento) => void;
  onCancel: () => void;
}) {
  const [obraId, setObraId] = useState(apontamento.obraId);
  const [etapaId, setEtapaId] = useState(apontamento.etapaObraId);
  const [horaInicio, setHoraInicio] = useState(apontamento.horaInicio);
  const [horaFim, setHoraFim] = useState(apontamento.horaFim);
  const [observacoes, setObservacoes] = useState(apontamento.observacoes);

  const etapasFiltradas = useMemo(() => etapas.filter((e) => e.obraId === obraId), [etapas, obraId]);
  const horas = calcHoras(horaInicio, horaFim);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...apontamento,
      obraId,
      etapaObraId: etapaId,
      horaInicio,
      horaFim,
      horasTrabalhadas: horas,
      observacoes,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
      <h4 className="text-sm font-semibold text-gray-700">Editar Registro</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Obra</label>
          <select
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={obraId}
            onChange={(e) => { setObraId(e.target.value); setEtapaId(''); }}
          >
            <option value="">Selecione...</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
          <select
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            disabled={!obraId}
          >
            <option value="">Selecione...</option>
            {etapasFiltradas.map((et) => <option key={et.id} value={et.id}>{et.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora Inicio</label>
          <input type="time" className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora Fim</label>
          <input type="time" className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      {horaInicio && horaFim && <p className="text-xs text-gray-500">Horas calculadas: <strong>{formatHoras(horas)}</strong></p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}

// ── Detail Modal Content ──
function DetalheEntidade({
  tipo,
  entidadeId,
  nome: _nome,
  apontamentos,
  obras,
  etapas,
  canCreate,
  canEdit,
  canDelete,
  onClockIn,
  onClockOut,
  onUpdate,
  onDelete,
}: {
  tipo: TipoApontamento;
  entidadeId: string;
  nome: string;
  apontamentos: Apontamento[];
  obras: Obra[];
  etapas: EtapaObra[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClockIn: (obraId: string, etapaId: string, horaInicio: string) => void;
  onClockOut: (a: Apontamento) => void;
  onUpdate: (a: Apontamento) => void;
  onDelete: (id: string) => void;
}) {
  const hoje = hojeStr();
  const [showClockIn, setShowClockIn] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const registrosEntidade = useMemo(
    () => apontamentos.filter((a) =>
      a.tipo === tipo && (tipo === 'equipamento' ? a.equipamentoId === entidadeId : a.colaboradorId === entidadeId)
    ),
    [apontamentos, tipo, entidadeId]
  );

  const registrosHoje = useMemo(() => registrosEntidade.filter((a) => a.data === hoje), [registrosEntidade, hoje]);
  const registrosOutros = useMemo(() => registrosEntidade.filter((a) => a.data !== hoje), [registrosEntidade, hoje]);
  const aberto = registrosHoje.find((a) => a.status === 'aberto');

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);

  function renderRegistro(a: Apontamento) {
    if (editandoId === a.id) {
      return (
        <EditApontamentoForm
          key={a.id}
          apontamento={a}
          obras={obras}
          etapas={etapas}
          onSubmit={(updated) => { onUpdate(updated); setEditandoId(null); }}
          onCancel={() => setEditandoId(null)}
        />
      );
    }

    return (
      <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${a.status === 'aberto' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{obrasMap.get(a.obraId) || 'Obra'}</span>
            <span className="text-gray-400">›</span>
            <span className="text-sm text-gray-600">{etapasMap.get(a.etapaObraId) || 'Etapa'}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{a.data}</span>
            <span>{a.horaInicio}{a.horaFim ? ` - ${a.horaFim}` : ''}</span>
            {a.status === 'aberto' ? (
              <span className="text-green-600 font-medium">Em andamento</span>
            ) : (
              <span>{formatHoras(a.horasTrabalhadas)}</span>
            )}
          </div>
          {a.observacoes && <p className="text-xs text-gray-400 mt-1">{a.observacoes}</p>}
        </div>
        <div className="flex gap-2 mt-2 sm:mt-0 shrink-0">
          {a.status === 'aberto' && canCreate && (
            <Button
              variant="primary"
              className="text-xs !py-1.5 !px-3 !min-h-0"
              onClick={() => onClockOut(a)}
            >
              Clock-out
            </Button>
          )}
          {a.status === 'encerrado' && canEdit && (
            <Button
              variant="ghost"
              className="text-xs !py-1.5 !px-3 !min-h-0"
              onClick={() => setEditandoId(a.id)}
            >
              Editar
            </Button>
          )}
          {a.status === 'encerrado' && canDelete && (
            <Button
              variant="danger"
              className="text-xs !py-1.5 !px-3 !min-h-0"
              onClick={() => setDeleteId(a.id)}
            >
              Excluir
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Registros de hoje */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Registros de Hoje ({hoje})</h3>
        {registrosHoje.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum registro hoje.</p>
        ) : (
          <div className="space-y-2">
            {registrosHoje.map(renderRegistro)}
          </div>
        )}
      </div>

      {/* Ações */}
      {canCreate && !aberto && !showClockIn && (
        <Button onClick={() => setShowClockIn(true)}>Clock-in</Button>
      )}

      {showClockIn && (
        <ClockInForm
          obras={obras}
          etapas={etapas}
          onSubmit={(obraId, etapaId, horaInicio) => {
            onClockIn(obraId, etapaId, horaInicio);
            setShowClockIn(false);
          }}
          onCancel={() => setShowClockIn(false)}
        />
      )}

      {/* Histórico */}
      {registrosOutros.length > 0 && (
        <div>
          <button
            className="text-sm text-emt-verde hover:underline"
            onClick={() => setMostrarHistorico((v) => !v)}
          >
            {mostrarHistorico ? 'Ocultar histórico' : `Ver histórico (${registrosOutros.length} registros)`}
          </button>
          {mostrarHistorico && (
            <div className="space-y-2 mt-2">
              {registrosOutros.map(renderRegistro)}
            </div>
          )}
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { onDelete(deleteId); setDeleteId(null); }
        }}
        title="Excluir Registro"
        message="Tem certeza que deseja excluir este registro de apontamento?"
      />
    </div>
  );
}

// ── Status Badge ──
function StatusBadge({ status }: { status: 'pendente' | 'ativo' | 'concluido' }) {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Ativo
      </span>
    );
  }
  if (status === 'concluido') {
    return (
      <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
        Concluído
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Pendente
    </span>
  );
}

function getStatusEntidade(apontamentos: Apontamento[], tipo: TipoApontamento, entidadeId: string, hoje: string): 'pendente' | 'ativo' | 'concluido' {
  const registros = apontamentos.filter((a) =>
    a.tipo === tipo && a.data === hoje &&
    (tipo === 'equipamento' ? a.equipamentoId === entidadeId : a.colaboradorId === entidadeId)
  );
  if (registros.length === 0) return 'pendente';
  if (registros.some((a) => a.status === 'aberto')) return 'ativo';
  return 'concluido';
}

// ══════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════

export default function Apontamentos() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_apontamentos');
  const canEdit = temAcao('editar_apontamentos');
  const canDelete = temAcao('excluir_apontamentos');

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['painel', 'equipamentos', 'colaboradores'];
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

  // Painel state
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('diario');
  const [dataRef, setDataRef] = useState(hoje);
  const [filtroEquipId, setFiltroEquipId] = useState('');
  const [filtroColabId, setFiltroColabId] = useState('');

  const rangeInicio = useMemo(() => {
    if (periodo === 'diario') return dataRef;
    if (periodo === 'semanal') return inicioSemana(dataRef);
    return inicioMes(dataRef);
  }, [periodo, dataRef]);

  const rangeFim = useMemo(() => {
    if (periodo === 'diario') return dataRef;
    if (periodo === 'semanal') return fimSemana(dataRef);
    return fimMes(dataRef);
  }, [periodo, dataRef]);

  const apontamentosPeriodo = useMemo(
    () => apontamentos.filter((a) => a.data >= rangeInicio && a.data <= rangeFim),
    [apontamentos, rangeInicio, rangeFim]
  );

  // Dashboard stats (always based on today)
  const apontamentosHoje = useMemo(() => apontamentos.filter((a) => a.data === hoje), [apontamentos, hoje]);
  const equipAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'equipamento' && a.status === 'aberto'), [apontamentosHoje]);
  const colabAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'colaborador' && a.status === 'aberto'), [apontamentosHoje]);
  const equipPendentes = useMemo(() => equipamentosAtivos.filter((e) => getStatusEntidade(apontamentos, 'equipamento', e.id, hoje) === 'pendente').length, [equipamentosAtivos, apontamentos, hoje]);
  const colabPendentes = useMemo(() => colaboradoresAtivos.filter((c) => getStatusEntidade(apontamentos, 'colaborador', c.id, hoje) === 'pendente').length, [colaboradoresAtivos, apontamentos, hoje]);

  // Relatórios por período
  const equipNomeMap = useMemo(() => new Map(todosEquipamentos.map((e) => [e.id, e.nome])), [todosEquipamentos]);
  const colabNomeMap = useMemo(() => new Map(todosColaboradores.map((c) => [c.id, c.nome])), [todosColaboradores]);

  const relatorioEquip = useMemo(() => {
    let registros = apontamentosPeriodo.filter((a) => a.tipo === 'equipamento' && a.status === 'encerrado');
    if (filtroEquipId) registros = registros.filter((a) => a.equipamentoId === filtroEquipId);
    const grouped = new Map<string, { nome: string; horas: number; registros: number; dias: Set<string> }>();
    for (const a of registros) {
      const entry = grouped.get(a.equipamentoId) || { nome: equipNomeMap.get(a.equipamentoId) || 'Equipamento', horas: 0, registros: 0, dias: new Set<string>() };
      entry.horas += a.horasTrabalhadas;
      entry.registros += 1;
      entry.dias.add(a.data);
      grouped.set(a.equipamentoId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({ id, ...v, diasTrabalhados: v.dias.size })).sort((a, b) => b.horas - a.horas);
  }, [apontamentosPeriodo, filtroEquipId, equipNomeMap]);

  const relatorioColab = useMemo(() => {
    let registros = apontamentosPeriodo.filter((a) => a.tipo === 'colaborador' && a.status === 'encerrado');
    if (filtroColabId) registros = registros.filter((a) => a.colaboradorId === filtroColabId);
    const grouped = new Map<string, { nome: string; horas: number; registros: number; dias: Set<string> }>();
    for (const a of registros) {
      const entry = grouped.get(a.colaboradorId) || { nome: colabNomeMap.get(a.colaboradorId) || 'Colaborador', horas: 0, registros: 0, dias: new Set<string>() };
      entry.horas += a.horasTrabalhadas;
      entry.registros += 1;
      entry.dias.add(a.data);
      grouped.set(a.colaboradorId, entry);
    }
    return [...grouped.entries()].map(([id, v]) => ({ id, ...v, diasTrabalhados: v.dias.size })).sort((a, b) => b.horas - a.horas);
  }, [apontamentosPeriodo, filtroColabId, colabNomeMap]);

  const totalHorasEquip = useMemo(() => relatorioEquip.reduce((s, r) => s + r.horas, 0), [relatorioEquip]);
  const totalHorasColab = useMemo(() => relatorioColab.reduce((s, r) => s + r.horas, 0), [relatorioColab]);

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Carregando...</p></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Apontamentos</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-200 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Painel Tab ── */}
      {tab === 'painel' && (
        <div className="space-y-6">
          {/* Status do dia (sempre hoje) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Equip. Ativos</p>
              <p className="text-2xl font-bold text-green-600">{equipAbertosHoje.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Colab. Ativos</p>
              <p className="text-2xl font-bold text-green-600">{colabAbertosHoje.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Equip. Pendentes</p>
              <p className="text-2xl font-bold text-amber-600">{equipPendentes}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Colab. Pendentes</p>
              <p className="text-2xl font-bold text-amber-600">{colabPendentes}</p>
            </div>
          </div>

          {/* Ativos agora */}
          {(equipAbertosHoje.length > 0 || colabAbertosHoje.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {equipAbertosHoje.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Equipamentos Ativos Agora</h2>
                  <div className="space-y-2">
                    {equipAbertosHoje.map((a) => {
                      const equip = todosEquipamentos.find((e) => e.id === a.equipamentoId);
                      return (
                        <div key={a.id} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{equip?.nome || 'Equipamento'}</p>
                            <p className="text-xs text-gray-500">{obrasMap.get(a.obraId)} › {etapasMap.get(a.etapaObraId)}</p>
                            <p className="text-xs text-gray-400">Desde {a.horaInicio}</p>
                          </div>
                          <StatusBadge status="ativo" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {colabAbertosHoje.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Colaboradores Ativos Agora</h2>
                  <div className="space-y-2">
                    {colabAbertosHoje.map((a) => {
                      const colab = todosColaboradores.find((c) => c.id === a.colaboradorId);
                      return (
                        <div key={a.id} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{colab?.nome || 'Colaborador'}</p>
                            <p className="text-xs text-gray-500">{obrasMap.get(a.obraId)} › {etapasMap.get(a.etapaObraId)}</p>
                            <p className="text-xs text-gray-400">Desde {a.horaInicio}</p>
                          </div>
                          <StatusBadge status="ativo" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Relatórios ── */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Relatórios</h2>

            {/* Filtros de período */}
            <div className="flex flex-wrap gap-3 mb-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                <select
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as PeriodoRelatorio)}
                >
                  <option value="diario">Diário</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {periodo === 'mensal' ? 'Mês' : 'Data'}
                </label>
                <input
                  type={periodo === 'mensal' ? 'month' : 'date'}
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={periodo === 'mensal' ? dataRef.substring(0, 7) : dataRef}
                  onChange={(e) => setDataRef(periodo === 'mensal' ? e.target.value + '-01' : e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Equipamento</label>
                <select
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:w-48"
                  value={filtroEquipId}
                  onChange={(e) => setFiltroEquipId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {equipamentosAtivos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Colaborador</label>
                <select
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full sm:w-48"
                  value={filtroColabId}
                  onChange={(e) => setFiltroColabId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {colaboradoresAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Período label */}
            <p className="text-xs text-gray-500 mb-4">
              {periodo === 'diario' && `Dia: ${formatDateBR(dataRef)}`}
              {periodo === 'semanal' && `Semana: ${formatDateBR(rangeInicio)} a ${formatDateBR(rangeFim)}`}
              {periodo === 'mensal' && `Mês: ${formatDateBR(rangeInicio)} a ${formatDateBR(rangeFim)}`}
            </p>

            {/* Totais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <p className="text-xs text-gray-500 uppercase">Horas Equip.</p>
                <p className="text-2xl font-bold text-emt-verde">{formatHoras(totalHorasEquip)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <p className="text-xs text-gray-500 uppercase">Horas Colab.</p>
                <p className="text-2xl font-bold text-emt-verde">{formatHoras(totalHorasColab)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <p className="text-xs text-gray-500 uppercase">Equip. no Período</p>
                <p className="text-2xl font-bold text-gray-700">{relatorioEquip.length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border shadow-sm">
                <p className="text-xs text-gray-500 uppercase">Colab. no Período</p>
                <p className="text-2xl font-bold text-gray-700">{relatorioColab.length}</p>
              </div>
            </div>

            {/* Tabelas de relatório */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Equipamentos */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-700">Equipamentos</h3>
                </div>
                {relatorioEquip.length === 0 ? (
                  <p className="text-sm text-gray-400 italic p-4">Nenhum registro no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Equipamento</th>
                          <th className="text-right px-4 py-2">Dias</th>
                          <th className="text-right px-4 py-2">Registros</th>
                          <th className="text-right px-4 py-2">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioEquip.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{r.diasTrabalhados}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{r.registros}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emt-verde">{formatHoras(r.horas)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-2 text-gray-700">Total</td>
                          <td className="px-4 py-2 text-right text-gray-600">-</td>
                          <td className="px-4 py-2 text-right text-gray-600">{relatorioEquip.reduce((s, r) => s + r.registros, 0)}</td>
                          <td className="px-4 py-2 text-right text-emt-verde">{formatHoras(totalHorasEquip)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Colaboradores */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-700">Colaboradores</h3>
                </div>
                {relatorioColab.length === 0 ? (
                  <p className="text-sm text-gray-400 italic p-4">Nenhum registro no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Colaborador</th>
                          <th className="text-right px-4 py-2">Dias</th>
                          <th className="text-right px-4 py-2">Registros</th>
                          <th className="text-right px-4 py-2">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioColab.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{r.diasTrabalhados}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{r.registros}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emt-verde">{formatHoras(r.horas)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-2 text-gray-700">Total</td>
                          <td className="px-4 py-2 text-right text-gray-600">-</td>
                          <td className="px-4 py-2 text-right text-gray-600">{relatorioColab.reduce((s, r) => s + r.registros, 0)}</td>
                          <td className="px-4 py-2 text-right text-emt-verde">{formatHoras(totalHorasColab)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Equipamentos Tab ── */}
      {tab === 'equipamentos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipamentosAtivos.length === 0 && (
            <p className="text-gray-400 text-sm italic col-span-full">Nenhum equipamento cadastrado.</p>
          )}
          {equipamentosAtivos.map((equip) => {
            const status = getStatusEntidade(apontamentos, 'equipamento', equip.id, hoje);
            return (
              <div
                key={equip.id}
                className="bg-white rounded-lg p-4 border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colaboradoresAtivos.length === 0 && (
            <p className="text-gray-400 text-sm italic col-span-full">Nenhum colaborador cadastrado.</p>
          )}
          {colaboradoresAtivos.map((colab) => {
            const status = getStatusEntidade(apontamentos, 'colaborador', colab.id, hoje);
            return (
              <div
                key={colab.id}
                className="bg-white rounded-lg p-4 border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
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
            nome={detalheModal.nome}
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
          />
        )}
      </Modal>
    </div>
  );
}
