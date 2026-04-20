import { useState } from 'react';
import type { Equipamento, HistoricoInspecao } from '../../../types';
import Button from '../../ui/Button';

interface Props {
  equipamentos: Equipamento[];
  onSubmit: (registro: HistoricoInspecao) => void;
  onCancel: () => void;
  usuario: string;
  initial?: HistoricoInspecao;
  equipamentoIdPrefixado?: string;
}

export default function FormHistoricoInspecao({ equipamentos, onSubmit, onCancel, usuario, initial, equipamentoIdPrefixado }: Props) {
  const [form, setForm] = useState<HistoricoInspecao>(
    initial ?? {
      id: '',
      equipamentoId: equipamentoIdPrefixado ?? '',
      data: new Date().toISOString().split('T')[0],
      horario: '',
      descricao: '',
      providencia: '',
      operador: '',
      encarregado: '',
      criadoPor: usuario,
      createdAt: '',
    },
  );

  function updateField<K extends keyof HistoricoInspecao>(key: K, value: HistoricoInspecao[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const equipAtivo = equipamentos.filter((e) => e.ativo).sort((a, b) => a.nome.localeCompare(b.nome));

  const inputClass = 'w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-4">
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Data *</label>
            <input type="date" value={form.data} onChange={(e) => updateField('data', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Horário</label>
            <input type="time" value={form.horario} onChange={(e) => updateField('horario', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Descrição da Não Conformidade *</label>
        <textarea
          value={form.descricao}
          onChange={(e) => updateField('descricao', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
          rows={3}
          placeholder="Descreva com clareza a não conformidade encontrada..."
        />
      </div>

      <div>
        <label className={labelClass}>Providência Tomada</label>
        <textarea
          value={form.providencia}
          onChange={(e) => updateField('providencia', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
          rows={3}
          placeholder="Descreva a providência tomada..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Operador</label>
          <input type="text" value={form.operador} onChange={(e) => updateField('operador', e.target.value)} className={inputClass} placeholder="Nome do operador" />
        </div>
        <div>
          <label className={labelClass}>Encarregado / Supervisor</label>
          <input type="text" value={form.encarregado} onChange={(e) => updateField('encarregado', e.target.value)} className={inputClass} placeholder="Nome do encarregado" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-600">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button
          onClick={() => onSubmit(form)}
          disabled={!form.equipamentoId || !form.data || !form.descricao.trim()}
        >
          {initial ? 'Salvar Alterações' : 'Registrar Inspeção'}
        </Button>
      </div>
    </div>
  );
}
