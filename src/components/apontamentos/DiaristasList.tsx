import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { SequenciaDiaria, RegistroHorasDiarista, Obra, EtapaObra } from '../../types';
import { useSequenciasDiarias, useAdicionarSequenciaDiaria, useAtualizarSequenciaDiaria, useExcluirSequenciaDiaria } from '../../hooks/useSequenciasDiarias';
import { useRegistrosHorasDiaristas, useAdicionarRegistroHorasDiarista, useAtualizarRegistroHorasDiarista, useExcluirRegistroHorasDiarista } from '../../hooks/useRegistrosHorasDiaristas';
import { useObras } from '../../hooks/useObras';
import { useEtapas } from '../../hooks/useEtapas';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import SearchableSelect from './SearchableSelect';
import { gerarId, hojeStr, formatDateBR, formatCurrency, formatTelefone } from './helpers';

// ── Status Badge ──

function StatusBadgeDiarista({ seq }: { seq: SequenciaDiaria }) {
  if (seq.pago) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
        Paga
      </span>
    );
  }
  if (seq.status === 'fechada') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
        Fechada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      Aberta
    </span>
  );
}

// ── Sequencia Form (criar/editar) ──

function SequenciaForm({
  editando,
  onSalvar,
  onCancelar,
}: {
  editando: SequenciaDiaria | null;
  onSalvar: (dados: Omit<SequenciaDiaria, 'id' | 'createdAt'>) => void;
  onCancelar: () => void;
}) {
  const [nomeDiarista, setNomeDiarista] = useState(editando?.nomeDiarista || '');
  const [telefone, setTelefone] = useState(editando?.telefone || '');
  const [valorDiaria, setValorDiaria] = useState(editando ? String(editando.valorDiaria) : '');
  const [detalhesServico, setDetalhesServico] = useState(editando?.detalhesServico || '');
  const [observacoes, setObservacoes] = useState(editando?.observacoes || '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nomeDiarista.trim() || !telefone.trim() || !valorDiaria) return;
    onSalvar({
      obraId: '',
      nomeDiarista: nomeDiarista.trim(),
      telefone: telefone.trim(),
      valorDiaria: Number(valorDiaria),
      detalhesServico: detalhesServico.trim(),
      observacoes: observacoes.trim(),
      status: editando?.status || 'aberta',
      dataAbertura: editando?.dataAbertura || hojeStr(),
      dataFechamento: editando?.dataFechamento || '',
      pago: editando?.pago || false,
      dataPagamento: editando?.dataPagamento || '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Diarista *</label>
          <input
            type="text"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={nomeDiarista}
            onChange={(e) => setNomeDiarista(e.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Telefone *</label>
          <input
            type="text"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={telefone}
            onChange={(e) => setTelefone(formatTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Valor da Diaria (R$) *</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          value={valorDiaria}
          onChange={(e) => setValorDiaria(e.target.value)}
          placeholder="0,00"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Detalhes do Servico *</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde min-h-[80px]"
          value={detalhesServico}
          onChange={(e) => setDetalhesServico(e.target.value)}
          placeholder="Ex: Pedreiro para levantar parede bloco 3"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Observacoes</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde min-h-[60px]"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: Pagamento via PIX ao final da sequencia"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" disabled={!nomeDiarista.trim() || !telefone.trim() || !valorDiaria}>
          {editando ? 'Salvar' : 'Criar Sequencia'}
        </Button>
      </div>
    </form>
  );
}

// ── Registro Horas Form ──

function RegistroHorasForm({
  sequencia,
  obras,
  etapas,
  editando,
  onSalvar,
  onCancelar,
}: {
  sequencia: SequenciaDiaria;
  obras: Obra[];
  etapas: EtapaObra[];
  editando: RegistroHorasDiarista | null;
  onSalvar: (dados: Omit<RegistroHorasDiarista, 'id' | 'createdAt'>) => void;
  onCancelar: () => void;
}) {
  const [obraId, setObraId] = useState(editando?.obraId || '');
  const [data, setData] = useState(editando?.data || hojeStr());
  const [etapaId, setEtapaId] = useState(editando?.etapaId || '');
  const [horas, setHoras] = useState(editando ? String(editando.horas) : '');
  const [descricao, setDescricao] = useState(editando?.descricao || '');

  const etapasObra = useMemo(() => etapas.filter((e) => e.obraId === obraId), [etapas, obraId]);

  const dataValida = !!data;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!obraId || !etapaId || !horas || !dataValida) return;
    onSalvar({
      sequenciaId: sequencia.id,
      obraId,
      etapaId,
      data,
      horas: Number(horas),
      descricao: descricao.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
          <input
            type="date"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Horas Trabalhadas *</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="24"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            placeholder="Ex: 8"
            required
          />
        </div>
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
        <label className="block text-xs font-medium text-gray-600 mb-1">Etapa da Obra *</label>
        <SearchableSelect
          options={etapasObra.map((e) => ({ id: e.id, label: e.nome }))}
          value={etapaId}
          onChange={setEtapaId}
          placeholder="Selecione a etapa..."
          disabled={!obraId}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Descricao</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde min-h-[60px]"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Reboco da parede leste"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" disabled={!obraId || !etapaId || !horas || !dataValida}>
          {editando ? 'Salvar' : 'Registrar'}
        </Button>
      </div>
    </form>
  );
}

// ── Detalhe da Sequencia ──

function DetalheSequencia({
  seq,
  registros,
  obras,
  etapas,
  diasCount,
  totalValue,
  canEdit,
  canDelete,
  onEditar,
  onFechar,
  onReabrir,
  onPagar,
  onEstornarPagamento,
  onExcluir,
  onAdicionarRegistro,
  onEditarRegistro,
  onExcluirRegistro,
}: {
  seq: SequenciaDiaria;
  registros: RegistroHorasDiarista[];
  obras: Obra[];
  etapas: EtapaObra[];
  diasCount: number;
  totalValue: number;
  canEdit: boolean;
  canDelete: boolean;
  onEditar: () => void;
  onFechar: () => void;
  onReabrir: () => void;
  onPagar: () => void;
  onEstornarPagamento: () => void;
  onExcluir: () => void;
  onAdicionarRegistro: (dados: Omit<RegistroHorasDiarista, 'id' | 'createdAt'>) => void;
  onEditarRegistro: (reg: RegistroHorasDiarista) => void;
  onExcluirRegistro: (id: string) => void;
}) {
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const etapaMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);

  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [editandoRegistro, setEditandoRegistro] = useState<RegistroHorasDiarista | null>(null);
  const [confirmDeleteRegId, setConfirmDeleteRegId] = useState<string | null>(null);

  const registrosSeq = useMemo(
    () => registros.filter((r) => r.sequenciaId === seq.id).sort((a, b) => b.data.localeCompare(a.data)),
    [registros, seq.id]
  );

  const totalHoras = useMemo(() => registrosSeq.reduce((sum, r) => sum + r.horas, 0), [registrosSeq]);

  const isAberta = seq.status === 'aberta' && !seq.pago;
  const isFechada = seq.status === 'fechada' && !seq.pago;

  // Group registros by obra > etapa
  const resumoObrasEtapas = useMemo(() => {
    if (totalHoras === 0) return [];
    const obraMap = new Map<string, { horas: number; etapas: Map<string, number> }>();
    registrosSeq.forEach((r) => {
      const entry = obraMap.get(r.obraId) || { horas: 0, etapas: new Map() };
      entry.horas += r.horas;
      entry.etapas.set(r.etapaId, (entry.etapas.get(r.etapaId) || 0) + r.horas);
      obraMap.set(r.obraId, entry);
    });
    return Array.from(obraMap.entries())
      .map(([obraId, { horas, etapas: etMap }]) => ({
        obraId,
        obraNome: obrasMap.get(obraId) || '-',
        horas,
        percentual: +((horas / totalHoras) * 100).toFixed(1),
        etapas: Array.from(etMap.entries())
          .map(([etapaId, h]) => ({
            etapaId,
            etapaNome: etapaMap.get(etapaId) || '-',
            horas: h,
            percentual: +((h / totalHoras) * 100).toFixed(1),
          }))
          .sort((a, b) => b.horas - a.horas),
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [registrosSeq, totalHoras, obrasMap, etapaMap]);

  // Group registros by date
  const registrosPorDia = useMemo(() => {
    const map = new Map<string, RegistroHorasDiarista[]>();
    registrosSeq.forEach((r) => {
      const list = map.get(r.data) || [];
      list.push(r);
      map.set(r.data, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [registrosSeq]);

  return (
    <div className="space-y-6">
      {/* Info Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500">Diarista</p>
            <p className="text-sm font-semibold text-gray-800">{seq.nomeDiarista}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Telefone</p>
            <p className="text-sm text-gray-700">{seq.telefone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Detalhes do Servico</p>
            <p className="text-sm text-gray-700">{seq.detalhesServico || '-'}</p>
          </div>
          {seq.observacoes && (
            <div>
              <p className="text-xs text-gray-500">Observacoes</p>
              <p className="text-sm text-gray-700">{seq.observacoes}</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <StatusBadgeDiarista seq={seq} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Valor da Diaria</p>
            <p className="text-sm font-semibold text-gray-800">{formatCurrency(seq.valorDiaria)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Periodo</p>
            <p className="text-sm text-gray-700">
              {formatDateBR(seq.dataAbertura)}
              {seq.dataFechamento ? ` ate ${formatDateBR(seq.dataFechamento)}` : ' ate hoje'}
            </p>
          </div>
          {seq.dataPagamento && (
            <div>
              <p className="text-xs text-gray-500">Data do Pagamento</p>
              <p className="text-sm text-gray-700">{formatDateBR(seq.dataPagamento)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border text-center">
          <p className="text-xs text-gray-500">Diarias</p>
          <p className="text-xl font-bold text-gray-800">{diasCount}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border text-center">
          <p className="text-xs text-gray-500">Horas Total</p>
          <p className="text-xl font-bold text-gray-800">{totalHoras.toFixed(1)}h</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border text-center">
          <p className="text-xs text-gray-500">Valor Total</p>
          <p className="text-xl font-bold text-emt-verde">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Resumo por Obra / Etapa */}
      {resumoObrasEtapas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Distribuicao por Obra / Etapa</h3>
          {resumoObrasEtapas.map((obra) => (
            <div key={obra.obraId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{obra.obraNome}</span>
                <span className="text-sm font-semibold text-gray-700">{obra.horas.toFixed(1)}h ({obra.percentual}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${obra.percentual}%` }} />
              </div>
              {obra.etapas.length > 0 && (
                <div className="ml-4 space-y-1.5">
                  {obra.etapas.map((etapa) => (
                    <div key={etapa.etapaId}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{etapa.etapaNome}</span>
                        <span className="text-xs text-gray-500">{etapa.horas.toFixed(1)}h ({etapa.percentual}%)</span>
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
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(isAberta || isFechada) && canEdit && (
          <Button variant="secondary" onClick={onEditar}>Editar</Button>
        )}
        {isAberta && canEdit && (
          <Button variant="danger" onClick={onFechar}>Fechar Sequencia</Button>
        )}
        {isFechada && canEdit && (
          <Button variant="secondary" onClick={onReabrir}>Reabrir Sequencia</Button>
        )}
        {isFechada && canEdit && (
          <Button onClick={onPagar}>Registrar Pagamento</Button>
        )}
        {seq.pago && canEdit && (
          <Button variant="danger" onClick={onEstornarPagamento}>Estornar Pagamento</Button>
        )}
        {canDelete && (
          <Button variant="danger" onClick={onExcluir}>Excluir</Button>
        )}
      </div>

      {/* Registros Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Registros de Horas</h3>
          {(isAberta || isFechada) && canEdit && !showRegistroForm && !editandoRegistro && (
            <Button onClick={() => setShowRegistroForm(true)}>+ Novo Registro</Button>
          )}
        </div>

        {showRegistroForm && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Novo Registro</h4>
            <RegistroHorasForm
              sequencia={seq}
              obras={obras}
              etapas={etapas}
              editando={null}
              onSalvar={(dados) => {
                onAdicionarRegistro(dados);
                setShowRegistroForm(false);
              }}
              onCancelar={() => setShowRegistroForm(false)}
            />
          </div>
        )}

        {editandoRegistro && (
          <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Editar Registro</h4>
            <RegistroHorasForm
              sequencia={seq}
              obras={obras}
              etapas={etapas}
              editando={editandoRegistro}
              onSalvar={(dados) => {
                onEditarRegistro({ ...dados, id: editandoRegistro.id, createdAt: editandoRegistro.createdAt });
                setEditandoRegistro(null);
              }}
              onCancelar={() => setEditandoRegistro(null)}
            />
          </div>
        )}

        {registrosPorDia.length === 0 ? (
          <p className="text-gray-400 text-sm italic">Nenhum registro de horas.</p>
        ) : (
          <div className="space-y-4">
            {registrosPorDia.map(([dia, regs]) => (
              <div key={dia}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {formatDateBR(dia)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {regs.reduce((s, r) => s + r.horas, 0).toFixed(1)}h total
                  </span>
                </div>
                <div className="space-y-2 ml-2">
                  {regs.map((reg) => (
                    <div key={reg.id} className="flex items-center justify-between bg-white rounded-lg p-3 border shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">{obrasMap.get(reg.obraId) || '-'}</span>
                          <span className="text-xs text-gray-300">›</span>
                          <span className="text-sm font-medium text-gray-800">{etapaMap.get(reg.etapaId) || '-'}</span>
                          <span className="text-xs font-semibold text-emt-verde">{reg.horas}h</span>
                        </div>
                        {reg.descricao && <p className="text-xs text-gray-500 mt-0.5 truncate">{reg.descricao}</p>}
                      </div>
                      {(isAberta || isFechada) && canEdit && !showRegistroForm && !editandoRegistro && (
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                            onClick={() => setEditandoRegistro(reg)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                            onClick={() => setConfirmDeleteRegId(reg.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete registro */}
      <Modal open={confirmDeleteRegId !== null} onClose={() => setConfirmDeleteRegId(null)} title="Excluir Registro">
        <p className="text-gray-600 mb-4">Tem certeza que deseja excluir este registro de horas?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDeleteRegId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { if (confirmDeleteRegId) { onExcluirRegistro(confirmDeleteRegId); setConfirmDeleteRegId(null); } }}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Main Component ──

interface DiaristasListProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function DiaristasList({ canCreate, canEdit, canDelete }: DiaristasListProps) {
  const { data: sequencias = [], isLoading: loadingSeq } = useSequenciasDiarias();
  const { data: registros = [] } = useRegistrosHorasDiaristas();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();

  const adicionarSeqMutation = useAdicionarSequenciaDiaria();
  const atualizarSeqMutation = useAtualizarSequenciaDiaria();
  const excluirSeqMutation = useExcluirSequenciaDiaria();
  const adicionarRegMutation = useAdicionarRegistroHorasDiarista();
  const atualizarRegMutation = useAtualizarRegistroHorasDiarista();
  const excluirRegMutation = useExcluirRegistroHorasDiarista();

  // Filters
  const [filtroObraId, setFiltroObraId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroNome, setFiltroNome] = useState('');

  // Modals
  const [showCriarModal, setShowCriarModal] = useState(false);
  const [editarSeq, setEditarSeq] = useState<SequenciaDiaria | null>(null);
  const [detalheSeqId, setDetalheSeqId] = useState<string | null>(null);
  const [confirmarFechar, setConfirmarFechar] = useState<string | null>(null);
  const [confirmarPagar, setConfirmarPagar] = useState<string | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null);

  // Derived
  const detalheSeq = useMemo(
    () => sequencias.find((s) => s.id === detalheSeqId) ?? null,
    [sequencias, detalheSeqId]
  );

  // Helper functions
  const getDiariasCount = useCallback(
    (seqId: string) => {
      const datas = new Set(registros.filter((r) => r.sequenciaId === seqId).map((r) => r.data));
      return datas.size;
    },
    [registros]
  );

  const getTotalValue = useCallback(
    (seq: SequenciaDiaria) => getDiariasCount(seq.id) * seq.valorDiaria,
    [getDiariasCount]
  );

  // Set of sequencia IDs that have registros in the filtered obra
  const seqIdsComObra = useMemo(() => {
    if (!filtroObraId) return null;
    return new Set(registros.filter((r) => r.obraId === filtroObraId).map((r) => r.sequenciaId));
  }, [registros, filtroObraId]);

  // Filtered list
  const sequenciasFiltradas = useMemo(() => {
    let lista = sequencias;
    if (seqIdsComObra) lista = lista.filter((s) => seqIdsComObra.has(s.id));
    if (filtroStatus === 'aberta') lista = lista.filter((s) => s.status === 'aberta' && !s.pago);
    else if (filtroStatus === 'fechada') lista = lista.filter((s) => s.status === 'fechada' && !s.pago);
    else if (filtroStatus === 'paga') lista = lista.filter((s) => s.pago);
    if (filtroNome) {
      const lower = filtroNome.toLowerCase();
      lista = lista.filter((s) => s.nomeDiarista.toLowerCase().includes(lower));
    }
    return lista;
  }, [sequencias, seqIdsComObra, filtroStatus, filtroNome]);

  // Stats
  const stats = useMemo(() => {
    const abertas = sequencias.filter((s) => s.status === 'aberta' && !s.pago).length;
    const fechadas = sequencias.filter((s) => s.status === 'fechada' && !s.pago).length;
    const pagas = sequencias.filter((s) => s.pago).length;
    const valorTotal = sequencias.reduce((sum, s) => sum + getTotalValue(s), 0);
    return { abertas, fechadas, pagas, valorTotal };
  }, [sequencias, getTotalValue]);

  // Handlers
  const handleCriar = useCallback(
    async (dados: Omit<SequenciaDiaria, 'id' | 'createdAt'>) => {
      const nova: SequenciaDiaria = { ...dados, id: gerarId(), createdAt: '' };
      await adicionarSeqMutation.mutateAsync(nova);
      setShowCriarModal(false);
    },
    [adicionarSeqMutation]
  );

  const handleEditar = useCallback(
    async (dados: Omit<SequenciaDiaria, 'id' | 'createdAt'>) => {
      if (!editarSeq) return;
      const updated: SequenciaDiaria = { ...dados, id: editarSeq.id, createdAt: editarSeq.createdAt };
      await atualizarSeqMutation.mutateAsync(updated);
      setEditarSeq(null);
    },
    [editarSeq, atualizarSeqMutation]
  );

  const handleFechar = useCallback(
    async (id: string) => {
      const seq = sequencias.find((s) => s.id === id);
      if (!seq) return;
      await atualizarSeqMutation.mutateAsync({ ...seq, status: 'fechada', dataFechamento: hojeStr() });
      setConfirmarFechar(null);
    },
    [sequencias, atualizarSeqMutation]
  );

  const handlePagar = useCallback(
    async (id: string) => {
      const seq = sequencias.find((s) => s.id === id);
      if (!seq) return;
      await atualizarSeqMutation.mutateAsync({ ...seq, pago: true, dataPagamento: hojeStr() });
      setConfirmarPagar(null);
    },
    [sequencias, atualizarSeqMutation]
  );

  const handleReabrir = useCallback(
    async (id: string) => {
      const seq = sequencias.find((s) => s.id === id);
      if (!seq) return;
      await atualizarSeqMutation.mutateAsync({ ...seq, status: 'aberta', dataFechamento: '' });
    },
    [sequencias, atualizarSeqMutation]
  );

  const handleEstornarPagamento = useCallback(
    async (id: string) => {
      const seq = sequencias.find((s) => s.id === id);
      if (!seq) return;
      await atualizarSeqMutation.mutateAsync({ ...seq, pago: false, dataPagamento: '' });
    },
    [sequencias, atualizarSeqMutation]
  );

  const handleExcluir = useCallback(
    async (id: string) => {
      await excluirSeqMutation.mutateAsync(id);
      setConfirmarExcluir(null);
      setDetalheSeqId(null);
    },
    [excluirSeqMutation]
  );

  const handleAdicionarRegistro = useCallback(
    async (dados: Omit<RegistroHorasDiarista, 'id' | 'createdAt'>) => {
      await adicionarRegMutation.mutateAsync({ ...dados, id: gerarId(), createdAt: '' });
    },
    [adicionarRegMutation]
  );

  const handleEditarRegistro = useCallback(
    async (reg: RegistroHorasDiarista) => {
      await atualizarRegMutation.mutateAsync(reg);
    },
    [atualizarRegMutation]
  );

  const handleExcluirRegistro = useCallback(
    async (id: string) => {
      await excluirRegMutation.mutateAsync(id);
    },
    [excluirRegMutation]
  );

  if (loadingSeq) {
    return <p className="text-gray-400 text-sm">Carregando...</p>;
  }

  // Sequencia being confirmed for close/pay
  const seqFechar = confirmarFechar ? sequencias.find((s) => s.id === confirmarFechar) : null;
  const seqPagar = confirmarPagar ? sequencias.find((s) => s.id === confirmarPagar) : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
        <div className="w-full sm:w-56">
          <label className="block text-xs font-medium text-gray-600 mb-1">Obra</label>
          <SearchableSelect
            options={[{ id: '', label: 'Todas' }, ...obras.map((o) => ({ id: o.id, label: o.nome }))]}
            value={filtroObraId}
            onChange={setFiltroObraId}
            placeholder="Todas as obras"
          />
        </div>
        <div className="w-full sm:w-40">
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="fechada">Fechada</option>
            <option value="paga">Paga</option>
          </select>
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
          <input
            type="text"
            className="w-full h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            placeholder="Buscar por nome..."
          />
        </div>
        <div className="flex-1" />
        {canCreate && (
          <Button onClick={() => setShowCriarModal(true)}>+ Nova Sequencia</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Abertas</p>
          <p className="text-2xl font-bold text-green-600">{stats.abertas}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Fechadas</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.fechadas}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Pagas</p>
          <p className="text-2xl font-bold text-blue-600">{stats.pagas}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Valor Total</p>
          <p className="text-2xl font-bold text-emt-verde">{formatCurrency(stats.valorTotal)}</p>
        </div>
      </div>

      {/* List */}
      {sequenciasFiltradas.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Nenhuma sequencia de diaria encontrada.</p>
      ) : (
        <div className="space-y-3">
          {sequenciasFiltradas.map((seq) => {
            const dias = getDiariasCount(seq.id);
            const total = getTotalValue(seq);
            return (
              <div
                key={seq.id}
                className="bg-white rounded-lg p-4 border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDetalheSeqId(seq.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{seq.nomeDiarista}</h3>
                  <StatusBadgeDiarista seq={seq} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>{formatCurrency(seq.valorDiaria)}/dia</span>
                  <span>{dias} diaria{dias !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-emt-verde">{formatCurrency(total)}</span>
                </div>
                <div className="flex gap-x-4 text-xs text-gray-400 mt-1">
                  <span>{formatDateBR(seq.dataAbertura)}{seq.dataFechamento ? ` - ${formatDateBR(seq.dataFechamento)}` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Criar */}
      <Modal open={showCriarModal} onClose={() => setShowCriarModal(false)} title="Nova Sequencia de Diaria">
        <SequenciaForm
          editando={null}
          onSalvar={handleCriar}
          onCancelar={() => setShowCriarModal(false)}
        />
      </Modal>

      {/* Modal: Editar */}
      <Modal open={editarSeq !== null} onClose={() => setEditarSeq(null)} title="Editar Sequencia">
        {editarSeq && (
          <SequenciaForm
            editando={editarSeq}
            onSalvar={handleEditar}
            onCancelar={() => setEditarSeq(null)}
          />
        )}
      </Modal>

      {/* Modal: Detalhe */}
      <Modal
        open={detalheSeq !== null}
        onClose={() => setDetalheSeqId(null)}
        title={detalheSeq?.nomeDiarista || ''}
        size="lg"
      >
        {detalheSeq && (
          <DetalheSequencia
            seq={detalheSeq}
            registros={registros}
            obras={obras}
            etapas={etapas}
            diasCount={getDiariasCount(detalheSeq.id)}
            totalValue={getTotalValue(detalheSeq)}
            canEdit={canEdit}
            canDelete={canDelete}
            onEditar={() => { setDetalheSeqId(null); setEditarSeq(detalheSeq); }}
            onFechar={() => setConfirmarFechar(detalheSeq.id)}
            onReabrir={() => handleReabrir(detalheSeq.id)}
            onPagar={() => setConfirmarPagar(detalheSeq.id)}
            onEstornarPagamento={() => handleEstornarPagamento(detalheSeq.id)}
            onExcluir={() => setConfirmarExcluir(detalheSeq.id)}
            onAdicionarRegistro={handleAdicionarRegistro}
            onEditarRegistro={handleEditarRegistro}
            onExcluirRegistro={handleExcluirRegistro}
          />
        )}
      </Modal>

      {/* Modal: Confirmar Fechar */}
      <Modal open={confirmarFechar !== null} onClose={() => setConfirmarFechar(null)} title="Fechar Sequencia">
        {seqFechar && (
          <div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600"><strong>Diarista:</strong> {seqFechar.nomeDiarista}</p>
              <p className="text-sm text-gray-600"><strong>Total de diarias:</strong> {getDiariasCount(seqFechar.id)}</p>
              <p className="text-sm text-gray-600"><strong>Valor total:</strong> {formatCurrency(getTotalValue(seqFechar))}</p>
              <p className="text-sm text-gray-600"><strong>Periodo:</strong> {formatDateBR(seqFechar.dataAbertura)} ate hoje</p>
            </div>
            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              Ao fechar a sequencia, nao sera possivel adicionar mais registros de horas.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmarFechar(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => handleFechar(seqFechar.id)}>Confirmar Fechamento</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar Pagamento */}
      <Modal open={confirmarPagar !== null} onClose={() => setConfirmarPagar(null)} title="Registrar Pagamento">
        {seqPagar && (
          <div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600"><strong>Diarista:</strong> {seqPagar.nomeDiarista}</p>
              <p className="text-sm text-gray-600"><strong>Valor total a pagar:</strong> <span className="text-emt-verde font-semibold">{formatCurrency(getTotalValue(seqPagar))}</span></p>
              {seqPagar.observacoes && (
                <p className="text-sm text-gray-600"><strong>Forma de pagamento:</strong> {seqPagar.observacoes}</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmarPagar(null)}>Cancelar</Button>
              <Button onClick={() => handlePagar(seqPagar.id)}>Confirmar Pagamento</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar Excluir */}
      <Modal open={confirmarExcluir !== null} onClose={() => setConfirmarExcluir(null)} title="Excluir Sequencia">
        <p className="text-gray-600 mb-4">Tem certeza que deseja excluir esta sequencia de diaria?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmarExcluir(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { if (confirmarExcluir) handleExcluir(confirmarExcluir); }}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  );
}
