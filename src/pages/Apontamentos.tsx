import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DiaristasList from '../components/apontamentos/DiaristasList';

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

function diasUteisPeriodo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const d = new Date(inicio + 'T00:00:00');
  const end = new Date(fim + 'T00:00:00');
  while (d <= end) {
    const dow = d.getDay(); // 0=Sun
    if (dow >= 1 && dow <= 6) { // Mon-Sat
      dias.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

const STATUS_AUSENCIA_LABELS: Record<string, string> = {
  falta: 'Falta',
  licenca_medica: 'Licença Médica',
  ferias: 'Férias',
  manutencao: 'Em Manutenção',
  ocioso: 'Ocioso',
};

type Tab = 'painel' | 'equipamentos' | 'colaboradores' | 'diaristas';
const tabs: { key: Tab; label: string }[] = [
  { key: 'painel', label: 'Painel' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'colaboradores', label: 'Colaboradores' },
  { key: 'diaristas', label: 'Diaristas' },
];

// ── Searchable Select ──
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.id === value)?.label || '';

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`w-full h-[44px] border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between ${
          disabled ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed border-gray-200 dark:border-slate-600' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 cursor-pointer'
        }`}
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(''); } }}
        disabled={disabled}
      >
        <span className={selectedLabel ? 'text-gray-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500'}>
          {selectedLabel || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b dark:border-slate-600">
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500 italic">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${o.id === value ? 'bg-emt-verde/10 text-emt-verde font-medium' : 'text-gray-700 dark:text-slate-200'}`}
                  onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi Searchable Select ──
function MultiSearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Todos',
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selectedLabels = useMemo(() => {
    if (value.length === 0) return '';
    const map = new Map(options.map((o) => [o.id, o.label]));
    if (value.length <= 2) return value.map((id) => map.get(id) || id).join(', ');
    return `${value.length} selecionados`;
  }, [value, options]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="w-full h-[44px] border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between cursor-pointer"
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className={selectedLabels ? 'text-gray-800 dark:text-slate-200 truncate' : 'text-gray-400 dark:text-slate-500'}>
          {selectedLabels || placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b dark:border-slate-600 flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {value.length > 0 && (
              <button type="button" className="text-xs text-red-500 hover:underline shrink-0" onClick={() => onChange([])}>Limpar</button>
            )}
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500 italic">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 ${value.includes(o.id) ? 'bg-emt-verde/10' : ''}`}
                  onClick={() => toggle(o.id)}
                >
                  <span className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center ${value.includes(o.id) ? 'bg-emt-verde border-emt-verde text-white' : 'border-gray-300 dark:border-slate-600'}`}>
                    {value.includes(o.id) && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  <span className="text-gray-700 dark:text-slate-200">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
          <SearchableSelect
            options={obras.map((o) => ({ id: o.id, label: o.nome }))}
            value={obraId}
            onChange={(id) => { setObraId(id); setEtapaId(''); }}
            placeholder="Selecione a obra..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Etapa *</label>
          <SearchableSelect
            options={etapasFiltradas.map((et) => ({ id: et.id, label: et.nome }))}
            value={etapaId}
            onChange={setEtapaId}
            placeholder="Selecione a etapa..."
            disabled={!obraId}
          />
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
          <SearchableSelect
            options={obras.map((o) => ({ id: o.id, label: o.nome }))}
            value={obraId}
            onChange={(id) => { setObraId(id); setEtapaId(''); }}
            placeholder="Selecione a obra..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
          <SearchableSelect
            options={etapasFiltradas.map((et) => ({ id: et.id, label: et.nome }))}
            value={etapaId}
            onChange={setEtapaId}
            placeholder="Selecione a etapa..."
            disabled={!obraId}
          />
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
  onRegistrarAusencia,
}: {
  tipo: TipoApontamento;
  entidadeId: string;
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
  onRegistrarAusencia: (data: string, status: StatusApontamento) => void;
}) {
  const hoje = hojeStr();
  const [showClockIn, setShowClockIn] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filtro de período dentro do modal
  const [modalDataInicio, setModalDataInicio] = useState(inicioMes(hoje));
  const [modalDataFim, setModalDataFim] = useState(fimMes(hoje));

  // Ausência form
  const [showAusenciaForm, setShowAusenciaForm] = useState(false);
  const [ausenciaData, setAusenciaData] = useState(hoje);
  const [ausenciaTipo, setAusenciaTipo] = useState<StatusApontamento>(tipo === 'equipamento' ? 'manutencao' : 'falta');

  const registrosEntidade = useMemo(
    () => apontamentos.filter((a) =>
      a.tipo === tipo && (tipo === 'equipamento' ? a.equipamentoId === entidadeId : a.colaboradorId === entidadeId)
    ),
    [apontamentos, tipo, entidadeId]
  );

  const registrosHoje = useMemo(() => registrosEntidade.filter((a) => a.data === hoje), [registrosEntidade, hoje]);
  const aberto = registrosHoje.find((a) => a.status === 'aberto');

  // Registros no período filtrado
  const registrosPeriodo = useMemo(
    () => registrosEntidade.filter((a) => a.data >= modalDataInicio && a.data <= modalDataFim).sort((a, b) => b.data.localeCompare(a.data) || b.horaInicio.localeCompare(a.horaInicio)),
    [registrosEntidade, modalDataInicio, modalDataFim]
  );

  // Resumo do período
  const resumoPeriodo = useMemo(() => {
    const diasUteis = diasUteisPeriodo(modalDataInicio, modalDataFim);
    const diasTrabalhou = new Set(
      registrosPeriodo.filter((a) => a.status === 'encerrado' || a.status === 'aberto').map((a) => a.data)
    );
    const diasAusencia = new Set(
      registrosPeriodo.filter((a) => a.status !== 'encerrado' && a.status !== 'aberto').map((a) => a.data)
    );
    const diasUteisSet = new Set(diasUteis);
    const diasNaoTrabalhou = diasUteis.filter((d) => !diasTrabalhou.has(d) && !diasAusencia.has(d));
    const diasFalta = registrosPeriodo.filter((a) => a.status === 'falta').length;
    const diasLicenca = registrosPeriodo.filter((a) => a.status === 'licenca_medica').length;
    const diasFerias = registrosPeriodo.filter((a) => a.status === 'ferias').length;
    const diasManutencao = registrosPeriodo.filter((a) => a.status === 'manutencao').length;
    const diasOcioso = registrosPeriodo.filter((a) => a.status === 'ocioso').length;
    const totalHoras = registrosPeriodo.filter((a) => a.status === 'encerrado').reduce((s, a) => s + a.horasTrabalhadas, 0);
    const diasSemanaTrabalhou = [...diasTrabalhou].filter((d) => diasUteisSet.has(d)).length;

    return {
      totalDiasUteis: diasUteis.length,
      diasTrabalhou: diasSemanaTrabalhou,
      diasNaoTrabalhou: diasNaoTrabalhou.length,
      diasFalta,
      diasLicenca,
      diasFerias,
      diasManutencao,
      diasOcioso,
      totalHoras,
    };
  }, [registrosPeriodo, modalDataInicio, modalDataFim]);

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);

  // Distribuição de horas por obra/etapa
  const distribuicaoHoras = useMemo(() => {
    const encerrados = registrosPeriodo.filter((a) => a.status === 'encerrado' && a.obraId && a.etapaObraId);
    const totalH = encerrados.reduce((s, a) => s + a.horasTrabalhadas, 0);
    if (totalH === 0) return [];
    const grouped = new Map<string, { obraNome: string; etapas: Map<string, { etapaNome: string; horas: number }> }>();
    for (const a of encerrados) {
      let obra = grouped.get(a.obraId);
      if (!obra) {
        obra = { obraNome: obrasMap.get(a.obraId) || 'Obra', etapas: new Map() };
        grouped.set(a.obraId, obra);
      }
      const etapa = obra.etapas.get(a.etapaObraId) || { etapaNome: etapasMap.get(a.etapaObraId) || 'Etapa', horas: 0 };
      etapa.horas += a.horasTrabalhadas;
      obra.etapas.set(a.etapaObraId, etapa);
    }
    return [...grouped.entries()].map(([obraId, obra]) => ({
      obraId,
      obraNome: obra.obraNome,
      etapas: [...obra.etapas.entries()].map(([etapaId, et]) => ({
        etapaId,
        etapaNome: et.etapaNome,
        horas: et.horas,
        percentual: +((et.horas / totalH) * 100).toFixed(1),
      })).sort((a, b) => b.horas - a.horas),
    })).sort((a, b) => {
      const horasA = a.etapas.reduce((s, e) => s + e.horas, 0);
      const horasB = b.etapas.reduce((s, e) => s + e.horas, 0);
      return horasB - horasA;
    });
  }, [registrosPeriodo, obrasMap, etapasMap]);

  function statusLabel(s: StatusApontamento): string {
    if (s === 'aberto') return 'Em andamento';
    if (s === 'encerrado') return 'Encerrado';
    return STATUS_AUSENCIA_LABELS[s] || s;
  }

  function statusBg(s: StatusApontamento): string {
    if (s === 'aberto') return 'bg-green-50 border-green-200';
    if (s === 'falta') return 'bg-red-50 border-red-200';
    if (s === 'licenca_medica') return 'bg-yellow-50 border-yellow-200';
    if (s === 'ferias') return 'bg-purple-50 border-purple-200';
    if (s === 'manutencao') return 'bg-orange-50 border-orange-200';
    if (s === 'ocioso') return 'bg-gray-50 border-gray-300';
    return 'bg-white border-gray-200';
  }

  function renderRegistro(a: Apontamento) {
    const isAusencia = a.status === 'falta' || a.status === 'licenca_medica' || a.status === 'ferias' || a.status === 'manutencao' || a.status === 'ocioso';

    if (editandoId === a.id && !isAusencia) {
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
      <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${statusBg(a.status)}`}>
        <div className="flex-1 min-w-0">
          {isAusencia ? (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                a.status === 'falta' ? 'text-red-700' :
                a.status === 'licenca_medica' ? 'text-yellow-700' :
                a.status === 'ferias' ? 'text-purple-700' :
                a.status === 'manutencao' ? 'text-orange-700' :
                'text-gray-600'
              }`}>
                {statusLabel(a.status)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{obrasMap.get(a.obraId) || 'Obra'}</span>
              <span className="text-gray-400">›</span>
              <span className="text-sm text-gray-600">{etapasMap.get(a.etapaObraId) || 'Etapa'}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{formatDateBR(a.data)}</span>
            {!isAusencia && (
              <>
                <span>{a.horaInicio}{a.horaFim ? ` - ${a.horaFim}` : ''}</span>
                {a.status === 'aberto' ? (
                  <span className="text-green-600 font-medium">Em andamento</span>
                ) : (
                  <span>{formatHoras(a.horasTrabalhadas)}</span>
                )}
              </>
            )}
          </div>
          {a.observacoes && <p className="text-xs text-gray-400 mt-1">{a.observacoes}</p>}
        </div>
        <div className="flex gap-2 mt-2 sm:mt-0 shrink-0">
          {a.status === 'aberto' && canCreate && (
            <Button variant="primary" className="text-xs !py-1.5 !px-3 !min-h-0" onClick={() => onClockOut(a)}>
              Clock-out
            </Button>
          )}
          {a.status === 'encerrado' && canEdit && (
            <Button variant="ghost" className="text-xs !py-1.5 !px-3 !min-h-0" onClick={() => setEditandoId(a.id)}>
              Editar
            </Button>
          )}
          {(a.status === 'encerrado' || isAusencia) && canDelete && (
            <Button variant="danger" className="text-xs !py-1.5 !px-3 !min-h-0" onClick={() => setDeleteId(a.id)}>
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
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Registros de Hoje ({formatDateBR(hoje)})</h3>
        {registrosHoje.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum registro hoje.</p>
        ) : (
          <div className="space-y-2">
            {registrosHoje.map(renderRegistro)}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {canCreate && !aberto && !showClockIn && (
          <Button onClick={() => setShowClockIn(true)}>Clock-in</Button>
        )}
        {canCreate && !showAusenciaForm && (
          <Button variant="secondary" onClick={() => setShowAusenciaForm(true)}>
            {tipo === 'equipamento' ? 'Registrar Status' : 'Registrar Ausência'}
          </Button>
        )}
      </div>

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

      {/* Ausência form */}
      {showAusenciaForm && (
        <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">
            {tipo === 'equipamento' ? 'Registrar Status' : 'Registrar Ausência'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
              <input
                type="date"
                className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={ausenciaData}
                onChange={(e) => setAusenciaData(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={ausenciaTipo}
                onChange={(e) => setAusenciaTipo(e.target.value as StatusApontamento)}
              >
                {tipo === 'equipamento' ? (
                  <>
                    <option value="manutencao">Em Manutenção</option>
                    <option value="ocioso">Ocioso</option>
                  </>
                ) : (
                  <>
                    <option value="falta">Falta</option>
                    <option value="licenca_medica">Licença Médica</option>
                    <option value="ferias">Férias</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setShowAusenciaForm(false)}>Cancelar</Button>
            <Button
              type="button"
              onClick={() => {
                onRegistrarAusencia(ausenciaData, ausenciaTipo);
                setShowAusenciaForm(false);
                setAusenciaData(hoje);
                setAusenciaTipo(tipo === 'equipamento' ? 'manutencao' : 'falta');
              }}
              disabled={!ausenciaData}
            >
              Registrar
            </Button>
          </div>
        </div>
      )}

      {/* Período e resumo */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico e Resumo</h3>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Inicial</label>
            <input
              type="date"
              className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={modalDataInicio}
              onChange={(e) => setModalDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Final</label>
            <input
              type="date"
              className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={modalDataFim}
              onChange={(e) => setModalDataFim(e.target.value)}
            />
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border shadow-sm text-center">
            <p className="text-xs text-gray-500">Dias Trabalhados</p>
            <p className="text-xl font-bold text-green-600">{resumoPeriodo.diasTrabalhou}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm text-center">
            <p className="text-xs text-gray-500">Sem Registro</p>
            <p className="text-xl font-bold text-amber-600">{resumoPeriodo.diasNaoTrabalhou}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm text-center">
            <p className="text-xs text-gray-500">Total Horas</p>
            <p className="text-xl font-bold text-emt-verde">{formatHoras(resumoPeriodo.totalHoras)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm text-center">
            <p className="text-xs text-gray-500">Dias Úteis</p>
            <p className="text-xl font-bold text-gray-700">{resumoPeriodo.totalDiasUteis}</p>
          </div>
        </div>

        {(resumoPeriodo.diasFalta > 0 || resumoPeriodo.diasLicenca > 0 || resumoPeriodo.diasFerias > 0 || resumoPeriodo.diasManutencao > 0 || resumoPeriodo.diasOcioso > 0) && (
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            {resumoPeriodo.diasFalta > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                {resumoPeriodo.diasFalta} falta{resumoPeriodo.diasFalta > 1 ? 's' : ''}
              </span>
            )}
            {resumoPeriodo.diasLicenca > 0 && (
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                {resumoPeriodo.diasLicenca} licença{resumoPeriodo.diasLicenca > 1 ? 's' : ''}
              </span>
            )}
            {resumoPeriodo.diasFerias > 0 && (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                {resumoPeriodo.diasFerias} dia{resumoPeriodo.diasFerias > 1 ? 's' : ''} férias
              </span>
            )}
            {resumoPeriodo.diasManutencao > 0 && (
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                {resumoPeriodo.diasManutencao} dia{resumoPeriodo.diasManutencao > 1 ? 's' : ''} manutenção
              </span>
            )}
            {resumoPeriodo.diasOcioso > 0 && (
              <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
                {resumoPeriodo.diasOcioso} dia{resumoPeriodo.diasOcioso > 1 ? 's' : ''} ocioso
              </span>
            )}
          </div>
        )}

        {/* Distribuição de horas por obra/etapa */}
        {distribuicaoHoras.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Horas por Obra / Etapa</h4>
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {distribuicaoHoras.map((obra) => (
                <div key={obra.obraId} className="border-b last:border-0">
                  <div className="px-4 py-2 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-800">{obra.obraNome}</span>
                  </div>
                  {obra.etapas.map((et) => (
                    <div key={et.etapaId} className="px-4 py-2 flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{et.etapaNome}</span>
                      <div className="w-24 sm:w-32 bg-gray-200 rounded-full h-2 shrink-0">
                        <div
                          className="bg-emt-verde h-2 rounded-full"
                          style={{ width: `${Math.min(et.percentual, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-20 text-right shrink-0">
                        {formatHoras(et.horas)} ({et.percentual}%)
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de registros do período */}
        {registrosPeriodo.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum registro no período.</p>
        ) : (
          <div className="space-y-2">
            {registrosPeriodo.map(renderRegistro)}
          </div>
        )}
      </div>

      {/* Confirm delete (sem senha) */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Excluir Registro">
        <p className="text-gray-600 mb-4">Tem certeza que deseja excluir este registro de apontamento?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}>Confirmar</Button>
        </div>
      </Modal>
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

  // Painel state
  const [dataInicio, setDataInicio] = useState(inicioMes(hoje));
  const [dataFim, setDataFim] = useState(fimMes(hoje));
  const [filtroEquipId, setFiltroEquipId] = useState('');
  const [filtroColabId, setFiltroColabId] = useState('');
  const [filtroObraIds, setFiltroObraIds] = useState<string[]>([]);
  const [filtroEtapaIds, setFiltroEtapaIds] = useState<string[]>([]);

  const apontamentosPeriodo = useMemo(
    () => apontamentos.filter((a) => a.data >= dataInicio && a.data <= dataFim),
    [apontamentos, dataInicio, dataFim]
  );

  // Etapas disponíveis com base nas obras selecionadas
  const etapasFiltroOpcoes = useMemo(() => {
    if (filtroObraIds.length === 0) return etapas;
    return etapas.filter((e) => filtroObraIds.includes(e.obraId));
  }, [etapas, filtroObraIds]);

  // Dashboard stats (always based on today)
  const apontamentosHoje = useMemo(() => apontamentos.filter((a) => a.data === hoje), [apontamentos, hoje]);
  const equipAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'equipamento' && a.status === 'aberto'), [apontamentosHoje]);
  const colabAbertosHoje = useMemo(() => apontamentosHoje.filter((a) => a.tipo === 'colaborador' && a.status === 'aberto'), [apontamentosHoje]);
  const equipPendentes = useMemo(() => equipamentosAtivos.filter((e) => getStatusEntidade(apontamentos, 'equipamento', e.id, hoje) === 'pendente').length, [equipamentosAtivos, apontamentos, hoje]);
  const colabPendentes = useMemo(() => colaboradoresAtivos.filter((c) => getStatusEntidade(apontamentos, 'colaborador', c.id, hoje) === 'pendente').length, [colaboradoresAtivos, apontamentos, hoje]);

  // Relatórios por período
  const equipNomeMap = useMemo(() => new Map(todosEquipamentos.map((e) => [e.id, e.nome])), [todosEquipamentos]);
  const colabNomeMap = useMemo(() => new Map(todosColaboradores.map((c) => [c.id, c.nome])), [todosColaboradores]);

  // Registros filtrados por obra/etapa
  const apontamentosFiltrados = useMemo(() => {
    let registros = apontamentosPeriodo.filter((a) => a.status === 'encerrado');
    if (filtroObraIds.length > 0) registros = registros.filter((a) => filtroObraIds.includes(a.obraId));
    if (filtroEtapaIds.length > 0) registros = registros.filter((a) => filtroEtapaIds.includes(a.etapaObraId));
    return registros;
  }, [apontamentosPeriodo, filtroObraIds, filtroEtapaIds]);

  const relatorioEquip = useMemo(() => {
    let registros = apontamentosFiltrados.filter((a) => a.tipo === 'equipamento');
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
  }, [apontamentosFiltrados, filtroEquipId, equipNomeMap]);

  const relatorioColab = useMemo(() => {
    let registros = apontamentosFiltrados.filter((a) => a.tipo === 'colaborador');
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
  }, [apontamentosFiltrados, filtroColabId, colabNomeMap]);

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
    () => buildObraEtapaReport(apontamentosFiltrados.filter((a) => a.tipo === 'equipamento')),
    [apontamentosFiltrados, obrasMap, etapasMap]
  );

  const relatorioObraEtapaColab = useMemo(
    () => buildObraEtapaReport(apontamentosFiltrados.filter((a) => a.tipo === 'colaborador')),
    [apontamentosFiltrados, obrasMap, etapasMap]
  );

  // Relatório de ausências — colaboradores (falta, licença médica, férias)
  const relatorioAusenciasColab = useMemo(() => {
    const ausencias = apontamentosPeriodo.filter((a) => a.tipo === 'colaborador' && ['falta', 'licenca_medica', 'ferias'].includes(a.status));
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
  }, [apontamentosPeriodo, colabNomeMap]);

  // Relatório de status — equipamentos (manutenção, ocioso)
  const relatorioStatusEquip = useMemo(() => {
    const registros = apontamentosPeriodo.filter((a) => a.tipo === 'equipamento' && ['manutencao', 'ocioso'].includes(a.status));
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
  }, [apontamentosPeriodo, equipNomeMap]);

  // Relatório dias sem registro
  const diasUteis = useMemo(() => diasUteisPeriodo(dataInicio, dataFim), [dataInicio, dataFim]);

  const relatorioDiasSemRegistroEquip = useMemo(() => {
    return equipamentosAtivos.map((e) => {
      const diasComRegistro = new Set(apontamentosPeriodo.filter((a) => a.tipo === 'equipamento' && a.equipamentoId === e.id).map((a) => a.data));
      const semRegistro = diasUteis.filter((d) => !diasComRegistro.has(d)).length;
      return { id: e.id, nome: e.nome, diasUteis: diasUteis.length, diasComRegistro: diasComRegistro.size, semRegistro };
    }).filter((r) => r.semRegistro > 0).sort((a, b) => b.semRegistro - a.semRegistro);
  }, [equipamentosAtivos, apontamentosPeriodo, diasUteis]);

  const relatorioDiasSemRegistroColab = useMemo(() => {
    return colaboradoresAtivos.map((c) => {
      const diasComRegistro = new Set(apontamentosPeriodo.filter((a) => a.tipo === 'colaborador' && a.colaboradorId === c.id).map((a) => a.data));
      const semRegistro = diasUteis.filter((d) => !diasComRegistro.has(d)).length;
      return { id: c.id, nome: c.nome, diasUteis: diasUteis.length, diasComRegistro: diasComRegistro.size, semRegistro };
    }).filter((r) => r.semRegistro > 0).sort((a, b) => b.semRegistro - a.semRegistro);
  }, [colaboradoresAtivos, apontamentosPeriodo, diasUteis]);

  // Relatório Diaristas
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const relatorioDiaristas = useMemo(() => {
    let registros = registrosHorasDiaristas.filter(r => r.data >= dataInicio && r.data <= dataFim);
    if (filtroObraIds.length > 0) registros = registros.filter(r => filtroObraIds.includes(r.obraId));

    const registrosPorSeq = new Map<string, number>();
    for (const r of registros) {
      registrosPorSeq.set(r.sequenciaId, (registrosPorSeq.get(r.sequenciaId) || 0) + 1);
    }

    const seqIds = new Set(registrosPorSeq.keys());
    const seqsNoPeriodo = sequenciasDiarias.filter(s => seqIds.has(s.id));

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
  }, [sequenciasDiarias, registrosHorasDiaristas, dataInicio, dataFim, filtroObraIds, obrasMap]);

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
                <label className="block text-xs font-medium text-gray-600 mb-1">Data Inicial</label>
                <input
                  type="date"
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data Final</label>
                <input
                  type="date"
                  className="h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-56">
                <label className="block text-xs font-medium text-gray-600 mb-1">Obras</label>
                <MultiSearchableSelect
                  options={obras.map((o) => ({ id: o.id, label: o.nome }))}
                  value={filtroObraIds}
                  onChange={(ids) => { setFiltroObraIds(ids); setFiltroEtapaIds([]); }}
                  placeholder="Todas as obras"
                />
              </div>
              <div className="w-full sm:w-56">
                <label className="block text-xs font-medium text-gray-600 mb-1">Etapas</label>
                <MultiSearchableSelect
                  options={etapasFiltroOpcoes.map((e) => ({ id: e.id, label: e.nome }))}
                  value={filtroEtapaIds}
                  onChange={setFiltroEtapaIds}
                  placeholder="Todas as etapas"
                />
              </div>
            </div>

            {/* Período label */}
            <p className="text-xs text-gray-500 mb-6">
              Período: {formatDateBR(dataInicio)} a {formatDateBR(dataFim)}
            </p>

            {/* ═══ EQUIPAMENTOS ═══ */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                <h3 className="text-base font-semibold text-gray-800">Equipamentos</h3>
              </div>

              {/* Cards Equip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Horas Totais</p>
                  <p className="text-2xl font-bold text-emt-verde">{formatHoras(totalHorasEquip)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">No Período</p>
                  <p className="text-2xl font-bold text-gray-700">{relatorioEquip.length}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Filtro</p>
                  <select
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                    value={filtroEquipId}
                    onChange={(e) => setFiltroEquipId(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {equipamentosAtivos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Tabela Equip */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-blue-800">Horas por Equipamento</h3>
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

              {/* Horas por Obra/Etapa — Equip */}
              {relatorioObraEtapaEquip.totalHoras > 0 && (
                <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-blue-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold text-blue-800">Horas por Obra / Etapa</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Total: {formatHoras(relatorioObraEtapaEquip.totalHoras)}</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {relatorioObraEtapaEquip.obras.map((obra) => (
                      <div key={obra.obraId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800">{obra.obraNome}</span>
                          <span className="text-sm font-semibold text-gray-700">{formatHoras(obra.horasObra)} ({obra.percentualObra}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${obra.percentualObra}%` }} />
                        </div>
                        {obra.etapas.length > 0 && (
                          <div className="ml-4 space-y-1.5">
                            {obra.etapas.map((etapa) => (
                              <div key={etapa.etapaId}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600">{etapa.etapaNome}</span>
                                  <span className="text-xs text-gray-500">{formatHoras(etapa.horas)} ({etapa.percentual}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${etapa.percentual}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manutenção/Ociosidade — Equip */}
              {relatorioStatusEquip.length > 0 && (
                <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-blue-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold text-blue-800">Manutenção e Ociosidade</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Equipamento</th>
                          <th className="text-right px-4 py-2">Manutenção</th>
                          <th className="text-right px-4 py-2">Ocioso</th>
                          <th className="text-right px-4 py-2">Total dias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioStatusEquip.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-orange-600 font-semibold">{r.manutencao || '-'}</td>
                            <td className="px-4 py-2 text-right text-gray-500 font-semibold">{r.ocioso || '-'}</td>
                            <td className="px-4 py-2 text-right font-bold text-gray-700">{r.total}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-2 text-gray-700">Total</td>
                          <td className="px-4 py-2 text-right text-orange-600">{relatorioStatusEquip.reduce((s, r) => s + r.manutencao, 0)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{relatorioStatusEquip.reduce((s, r) => s + r.ocioso, 0)}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{relatorioStatusEquip.reduce((s, r) => s + r.total, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dias sem Registro — Equip */}
              <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-blue-800">Dias sem Registro</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{diasUteis.length} dias úteis no período</p>
                </div>
                {relatorioDiasSemRegistroEquip.length === 0 ? (
                  <p className="text-sm text-gray-400 italic p-4">Todos os equipamentos têm registro em todos os dias úteis.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Equipamento</th>
                          <th className="text-right px-4 py-2">Com registro</th>
                          <th className="text-right px-4 py-2">Sem registro</th>
                          <th className="text-right px-4 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioDiasSemRegistroEquip.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-green-600">{r.diasComRegistro}</td>
                            <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.semRegistro}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{r.diasUteis > 0 ? ((r.semRegistro / r.diasUteis) * 100).toFixed(0) : 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ COLABORADORES ═══ */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <h3 className="text-base font-semibold text-gray-800">Colaboradores</h3>
              </div>

              {/* Cards Colab */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Horas Totais</p>
                  <p className="text-2xl font-bold text-emt-verde">{formatHoras(totalHorasColab)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">No Período</p>
                  <p className="text-2xl font-bold text-gray-700">{relatorioColab.length}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border shadow-sm">
                  <p className="text-xs text-gray-500 uppercase">Filtro</p>
                  <select
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                    value={filtroColabId}
                    onChange={(e) => setFiltroColabId(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {colaboradoresAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Tabela Colab */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-green-800">Horas por Colaborador</h3>
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

              {/* Horas por Obra/Etapa — Colab */}
              {relatorioObraEtapaColab.totalHoras > 0 && (
                <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-green-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold text-green-800">Horas por Obra / Etapa</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Total: {formatHoras(relatorioObraEtapaColab.totalHoras)}</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {relatorioObraEtapaColab.obras.map((obra) => (
                      <div key={obra.obraId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800">{obra.obraNome}</span>
                          <span className="text-sm font-semibold text-gray-700">{formatHoras(obra.horasObra)} ({obra.percentualObra}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                          <div className="bg-green-600 h-3 rounded-full" style={{ width: `${obra.percentualObra}%` }} />
                        </div>
                        {obra.etapas.length > 0 && (
                          <div className="ml-4 space-y-1.5">
                            {obra.etapas.map((etapa) => (
                              <div key={etapa.etapaId}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600">{etapa.etapaNome}</span>
                                  <span className="text-xs text-gray-500">{formatHoras(etapa.horas)} ({etapa.percentual}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="bg-green-400 h-2 rounded-full" style={{ width: `${etapa.percentual}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Faltas, Licenças e Férias */}
              {relatorioAusenciasColab.length > 0 && (
                <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                  <div className="bg-green-50 px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold text-green-800">Faltas, Licenças e Férias</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Colaborador</th>
                          <th className="text-right px-4 py-2">Faltas</th>
                          <th className="text-right px-4 py-2">Licenças</th>
                          <th className="text-right px-4 py-2">Férias</th>
                          <th className="text-right px-4 py-2">Total dias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioAusenciasColab.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.faltas || '-'}</td>
                            <td className="px-4 py-2 text-right text-purple-600 font-semibold">{r.licencas || '-'}</td>
                            <td className="px-4 py-2 text-right text-cyan-600 font-semibold">{r.ferias || '-'}</td>
                            <td className="px-4 py-2 text-right font-bold text-gray-700">{r.total}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-2 text-gray-700">Total</td>
                          <td className="px-4 py-2 text-right text-red-600">{relatorioAusenciasColab.reduce((s, r) => s + r.faltas, 0)}</td>
                          <td className="px-4 py-2 text-right text-purple-600">{relatorioAusenciasColab.reduce((s, r) => s + r.licencas, 0)}</td>
                          <td className="px-4 py-2 text-right text-cyan-600">{relatorioAusenciasColab.reduce((s, r) => s + r.ferias, 0)}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{relatorioAusenciasColab.reduce((s, r) => s + r.total, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dias sem Registro — Colab */}
              <div className="mt-4 bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b">
                  <h3 className="text-sm font-semibold text-green-800">Dias sem Registro</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{diasUteis.length} dias úteis no período</p>
                </div>
                {relatorioDiasSemRegistroColab.length === 0 ? (
                  <p className="text-sm text-gray-400 italic p-4">Todos os colaboradores têm registro em todos os dias úteis.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                          <th className="text-left px-4 py-2">Colaborador</th>
                          <th className="text-right px-4 py-2">Com registro</th>
                          <th className="text-right px-4 py-2">Sem registro</th>
                          <th className="text-right px-4 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioDiasSemRegistroColab.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-4 py-2 text-right text-green-600">{r.diasComRegistro}</td>
                            <td className="px-4 py-2 text-right text-red-600 font-semibold">{r.semRegistro}</td>
                            <td className="px-4 py-2 text-right text-gray-500">{r.diasUteis > 0 ? ((r.semRegistro / r.diasUteis) * 100).toFixed(0) : 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ DIARISTAS ═══ */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-base font-semibold text-gray-800">Diárias</h3>
              </div>

              {relatorioDiaristas.totalSequencias === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma diária registrada no período.</p>
              ) : (
                <>
                  {/* Cards Diaristas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <p className="text-xs text-gray-500 uppercase">Total a Pagar</p>
                      <p className="text-xl font-bold text-orange-600">{fmtBRL(relatorioDiaristas.totalAPagar)}</p>
                      <p className="text-xs text-gray-400 mt-1">{relatorioDiaristas.totalDias} dias registrados</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <p className="text-xs text-gray-500 uppercase">Total Pago</p>
                      <p className="text-xl font-bold text-green-600">{fmtBRL(relatorioDiaristas.totalPago)}</p>
                      <p className="text-xs text-gray-400 mt-1">{relatorioDiaristas.pagas} seq. pagas</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <p className="text-xs text-gray-500 uppercase">Seq. Abertas</p>
                      <p className="text-xl font-bold text-amber-600">{relatorioDiaristas.abertas}</p>
                      <p className="text-xs text-gray-400 mt-1">em andamento</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <p className="text-xs text-gray-500 uppercase">Seq. Fechadas</p>
                      <p className="text-xl font-bold text-blue-600">{relatorioDiaristas.fechadas}</p>
                      <p className="text-xs text-gray-400 mt-1">{relatorioDiaristas.pagas} pagas</p>
                    </div>
                  </div>

                  {/* Tabela Diaristas por Obra */}
                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="bg-orange-50 px-4 py-3 border-b">
                      <h3 className="text-sm font-semibold text-orange-800">Diárias por Obra</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                            <th className="text-left px-4 py-2">Obra</th>
                            <th className="text-right px-4 py-2">Dias</th>
                            <th className="text-right px-4 py-2">Valor</th>
                            <th className="text-right px-4 py-2">Abertas</th>
                            <th className="text-right px-4 py-2">Fechadas</th>
                            <th className="text-right px-4 py-2">Pagas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorioDiaristas.porObra.map((r) => (
                            <tr key={r.obraId} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-800">{r.obraNome}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{r.dias}</td>
                              <td className="px-4 py-2 text-right font-semibold text-orange-600">{fmtBRL(r.valor)}</td>
                              <td className="px-4 py-2 text-right text-amber-600">{r.abertas || '-'}</td>
                              <td className="px-4 py-2 text-right text-blue-600">{r.fechadas || '-'}</td>
                              <td className="px-4 py-2 text-right text-green-600">{r.pagas || '-'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-4 py-2 text-gray-700">Total</td>
                            <td className="px-4 py-2 text-right text-gray-600">{relatorioDiaristas.totalDias}</td>
                            <td className="px-4 py-2 text-right text-orange-600">{fmtBRL(relatorioDiaristas.totalAPagar)}</td>
                            <td className="px-4 py-2 text-right text-amber-600">{relatorioDiaristas.abertas}</td>
                            <td className="px-4 py-2 text-right text-blue-600">{relatorioDiaristas.fechadas}</td>
                            <td className="px-4 py-2 text-right text-green-600">{relatorioDiaristas.pagas}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
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

      {/* ── Diaristas Tab ── */}
      {tab === 'diaristas' && (
        <DiaristasList
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
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
