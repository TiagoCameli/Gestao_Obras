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

  // Dashboard stats
  const apontamentosHoje = useMemo(() => apontamentos.filter((a) => a.data === hoje), [apontamentos, hoje]);
  const equipAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'equipamento' && a.status === 'aberto'), [apontamentosHoje]);
  const colabAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'colaborador' && a.status === 'aberto'), [apontamentosHoje]);
  const equipPendentes = useMemo(() => equipamentosAtivos.filter((e) => getStatusEntidade(apontamentos, 'equipamento', e.id, hoje) === 'pendente').length, [equipamentosAtivos, apontamentos, hoje]);
  const colabPendentes = useMemo(() => colaboradoresAtivos.filter((c) => getStatusEntidade(apontamentos, 'colaborador', c.id, hoje) === 'pendente').length, [colaboradoresAtivos, apontamentos, hoje]);

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
          {/* Summary cards */}
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

          {/* Equipamentos ativos agora */}
          {equipAbertosHoje.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Equipamentos Ativos Agora</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          {/* Colaboradores ativos agora */}
          {colabAbertosHoje.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Colaboradores Ativos Agora</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          {equipAbertosHoje.length === 0 && colabAbertosHoje.length === 0 && (
            <p className="text-gray-400 text-sm italic">Nenhum equipamento ou colaborador ativo no momento.</p>
          )}
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
