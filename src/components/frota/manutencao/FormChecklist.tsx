import { useState } from 'react';
import type { Equipamento, ChecklistEquipamento, TurnoChecklist, RespostaChecklist } from '../../../types';
import { CHECKLIST_ITENS, CHECKLIST_CATEGORIAS } from './checklistItens';
import Button from '../../ui/Button';

interface Props {
  equipamentos: Equipamento[];
  onSubmit: (checklist: ChecklistEquipamento) => void;
  onCancel: () => void;
  usuario: string;
  initial?: ChecklistEquipamento;
}

function criarTurnoVazio(turno: 1 | 2 | 3): TurnoChecklist {
  return {
    turno,
    horimetroInicial: '',
    horimetroFinal: '',
    tipoManutencao: 'preventiva',
    parouManutencao: false,
    horaParada: '',
    horaRetorno: '',
    nomeOperador: '',
    cs: '',
  };
}

function criarRespostasVazias() {
  const respostas: Record<string, { turno1: RespostaChecklist; turno2: RespostaChecklist; turno3: RespostaChecklist }> = {};
  for (const item of CHECKLIST_ITENS) {
    respostas[item.numero] = { turno1: '', turno2: '', turno3: '' };
  }
  return respostas;
}

export default function FormChecklist({ equipamentos, onSubmit, onCancel, usuario, initial }: Props) {
  const [form, setForm] = useState<ChecklistEquipamento>(
    initial ?? {
      id: '',
      equipamentoId: '',
      data: new Date().toISOString().split('T')[0],
      unidade: '',
      areaInspecao: '',
      turnos: [criarTurnoVazio(1), criarTurnoVazio(2), criarTurnoVazio(3)],
      respostas: criarRespostasVazias(),
      observacoes: '',
      criadoPor: usuario,
      createdAt: '',
    },
  );

  function updateField<K extends keyof ChecklistEquipamento>(key: K, value: ChecklistEquipamento[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTurno(idx: number, field: keyof TurnoChecklist, value: string | boolean) {
    setForm((prev) => {
      const turnos = [...prev.turnos];
      turnos[idx] = { ...turnos[idx], [field]: value };
      return { ...prev, turnos };
    });
  }

  function updateResposta(itemNumero: string, turnoKey: 'turno1' | 'turno2' | 'turno3', value: RespostaChecklist) {
    setForm((prev) => {
      const respostas = { ...prev.respostas };
      respostas[itemNumero] = { ...respostas[itemNumero], [turnoKey]: value };
      return { ...prev, respostas };
    });
  }

  const equipAtivo = equipamentos.filter((e) => e.ativo).sort((a, b) => a.nome.localeCompare(b.nome));

  const inputClass = 'w-full h-[40px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
      {/* Cabeçalho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Equipamento *</label>
          <select
            value={form.equipamentoId}
            onChange={(e) => updateField('equipamentoId', e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {equipAtivo.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nome} {eq.codigoPatrimonio ? `(${eq.codigoPatrimonio})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Data *</label>
          <input type="date" value={form.data} onChange={(e) => updateField('data', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Unidade</label>
          <input type="text" value={form.unidade} onChange={(e) => updateField('unidade', e.target.value)} className={inputClass} placeholder="Ex: Obra Centro" />
        </div>
        <div>
          <label className={labelClass}>Área / Local da Inspeção</label>
          <input type="text" value={form.areaInspecao} onChange={(e) => updateField('areaInspecao', e.target.value)} className={inputClass} placeholder="Ex: Pátio principal" />
        </div>
      </div>

      {/* Turnos */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Turnos</h3>
        {form.turnos.map((turno, idx) => (
          <div key={turno.turno} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">{idx + 1}o Turno</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Horímetro Inicial</label>
                <input type="text" value={turno.horimetroInicial} onChange={(e) => updateTurno(idx, 'horimetroInicial', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Horímetro Final</label>
                <input type="text" value={turno.horimetroFinal} onChange={(e) => updateTurno(idx, 'horimetroFinal', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tipo Manutenção</label>
                <select value={turno.tipoManutencao} onChange={(e) => updateTurno(idx, 'tipoManutencao', e.target.value)} className={inputClass}>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Parou p/ manutenção?</label>
                <select value={turno.parouManutencao ? 'sim' : 'nao'} onChange={(e) => updateTurno(idx, 'parouManutencao', e.target.value === 'sim')} className={inputClass}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              {turno.parouManutencao && (
                <>
                  <div>
                    <label className={labelClass}>H. Parada</label>
                    <input type="time" value={turno.horaParada} onChange={(e) => updateTurno(idx, 'horaParada', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>H. Retorno</label>
                    <input type="time" value={turno.horaRetorno} onChange={(e) => updateTurno(idx, 'horaRetorno', e.target.value)} className={inputClass} />
                  </div>
                </>
              )}
              <div>
                <label className={labelClass}>Nome Operador</label>
                <input type="text" value={turno.nomeOperador} onChange={(e) => updateTurno(idx, 'nomeOperador', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CS</label>
                <input type="text" value={turno.cs} onChange={(e) => updateTurno(idx, 'cs', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Itens do Checklist */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Itens de Verificação</h3>

        {/* Header */}
        <div className="hidden sm:grid sm:grid-cols-[60px_1fr_repeat(3,120px)] gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 px-2">
          <span>#</span>
          <span>Descrição</span>
          <span className="text-center">1o Turno</span>
          <span className="text-center">2o Turno</span>
          <span className="text-center">3o Turno</span>
        </div>

        {CHECKLIST_CATEGORIAS.map((cat) => (
          <div key={cat}>
            <div className="bg-emt-verde/10 dark:bg-emerald-900/30 rounded-lg px-3 py-2 mb-2">
              <span className="text-sm font-semibold text-emt-verde dark:text-emerald-400">{cat}</span>
            </div>
            {CHECKLIST_ITENS.filter((i) => i.categoria === cat).map((item) => {
              const resp = form.respostas[item.numero] ?? { turno1: '', turno2: '', turno3: '' };
              return (
                <div key={item.numero} className="grid grid-cols-1 sm:grid-cols-[60px_1fr_repeat(3,120px)] gap-2 items-center px-2 py-1.5 border-b border-gray-100 dark:border-slate-700">
                  <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{item.numero}</span>
                  <span className="text-sm text-gray-700 dark:text-slate-300">{item.descricao}</span>
                  {(['turno1', 'turno2', 'turno3'] as const).map((tk) => (
                    <div key={tk} className="flex gap-1 justify-center">
                      {(['sim', 'nao', 'na'] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateResposta(item.numero, tk, resp[tk] === val ? '' : val)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            resp[tk] === val
                              ? val === 'sim'
                                ? 'bg-green-500 text-white'
                                : val === 'nao'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-500'
                          }`}
                        >
                          {val === 'sim' ? 'S' : val === 'nao' ? 'N' : 'NA'}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Observações */}
      <div>
        <label className={labelClass}>Observações</label>
        <textarea
          value={form.observacoes}
          onChange={(e) => updateField('observacoes', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
          rows={3}
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-600">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() => onSubmit(form)}
          disabled={!form.equipamentoId || !form.data}
        >
          {initial ? 'Salvar Alterações' : 'Registrar Checklist'}
        </Button>
      </div>
    </div>
  );
}
