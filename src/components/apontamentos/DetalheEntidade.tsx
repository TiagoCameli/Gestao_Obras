import { useMemo, useState, type FormEvent } from 'react';
import type { Apontamento, Obra, EtapaObra, TipoApontamento, StatusApontamento } from '../../types';
import Button from '../ui/Button';
import SearchableSelect from './SearchableSelect';
import { hojeStr, agoraStr, calcHoras, formatHoras, inicioMes, fimMes, formatDateBR, diasUteisPeriodo, STATUS_AUSENCIA_LABELS } from './helpers';
import ConfirmWithCountdown from './ConfirmWithCountdown';

// ── Clock-in Form ──
function ClockInForm({
  obras,
  etapas,
  onSubmit,
  onCancel,
}: {
  obras: Obra[];
  etapas: EtapaObra[];
  onSubmit: (obraId: string, etapaId: string, horaInicio: string, data: string) => void;
  onCancel: () => void;
}) {
  const hoje = hojeStr();
  const [obraId, setObraId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [horaInicio, setHoraInicio] = useState(agoraStr());
  const [data, setData] = useState(hoje);

  const etapasFiltradas = useMemo(() => etapas.filter((e) => e.obraId === obraId), [etapas, obraId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (obraId && etapaId && horaInicio && data) {
      onSubmit(obraId, etapaId, horaInicio, data);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 p-3 bg-gray-50 rounded-lg border">
      <h4 className="text-sm font-semibold text-gray-700">Novo Clock-in</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
          <input
            type="date"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={data}
            onChange={(e) => setData(e.target.value)}
            max={hoje}
            required
          />
        </div>
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
        <Button type="submit" disabled={!obraId || !etapaId || !horaInicio || !data}>Registrar</Button>
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
export default function DetalheEntidade({
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
  onClockIn: (obraId: string, etapaId: string, horaInicio: string, data: string) => void;
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
              <span className="text-gray-400">&rsaquo;</span>
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
          onSubmit={(obraId, etapaId, horaInicio, data) => {
            onClockIn(obraId, etapaId, horaInicio, data);
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

      {/* Confirm delete with countdown */}
      <ConfirmWithCountdown
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
        title="Excluir Registro"
        message="Tem certeza que deseja excluir este registro de apontamento?"
      />
    </div>
  );
}
