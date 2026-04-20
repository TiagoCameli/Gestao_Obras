import { useState } from 'react';
import type { PlanoManutencao, Equipamento } from '../../../types';
import Button from '../../ui/Button';

interface Props {
  initial?: PlanoManutencao;
  equipamentos: Equipamento[];
  onSubmit: (plano: PlanoManutencao) => void;
  onCancel: () => void;
  usuario: string;
}

export default function FormPlano({ initial, equipamentos, onSubmit, onCancel, usuario }: Props) {
  const [form, setForm] = useState<PlanoManutencao>(
    initial ?? {
      id: '',
      equipamentoId: '',
      nome: '',
      descricao: '',
      intervaloHoras: null,
      intervaloKm: null,
      intervaloDias: null,
      ultimaExecucaoMedicao: 0,
      ultimaExecucaoData: '',
      ativo: true,
      criadoPor: usuario,
      createdAt: '',
    },
  );

  function updateField<K extends keyof PlanoManutencao>(key: K, value: PlanoManutencao[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipamentoId || !form.nome.trim()) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Equipamento *</label>
          <select
            value={form.equipamentoId}
            onChange={(e) => updateField('equipamentoId', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            required
          >
            <option value="">Selecione...</option>
            {equipamentos
              .filter((eq) => eq.ativo)
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome *</label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => updateField('nome', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            required
            placeholder="Ex: Troca de óleo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Intervalo (horas)</label>
          <input
            type="number"
            value={form.intervaloHoras ?? ''}
            onChange={(e) => updateField('intervaloHoras', e.target.value ? Number(e.target.value) : null)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
            placeholder="Ex: 500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Intervalo (km)</label>
          <input
            type="number"
            value={form.intervaloKm ?? ''}
            onChange={(e) => updateField('intervaloKm', e.target.value ? Number(e.target.value) : null)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
            placeholder="Ex: 10000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Intervalo (dias)</label>
          <input
            type="number"
            value={form.intervaloDias ?? ''}
            onChange={(e) => updateField('intervaloDias', e.target.value ? Number(e.target.value) : null)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
            placeholder="Ex: 90"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Última Execução (medição)</label>
          <input
            type="number"
            value={form.ultimaExecucaoMedicao}
            onChange={(e) => updateField('ultimaExecucaoMedicao', Number(e.target.value))}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Última Execução (data)</label>
          <input
            type="date"
            value={form.ultimaExecucaoData}
            onChange={(e) => updateField('ultimaExecucaoData', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer h-[44px]">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => updateField('ativo', e.target.checked)}
              className="rounded border-gray-300 dark:border-slate-600 text-emt-verde focus:ring-emt-verde"
            />
            Ativo
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descrição</label>
        <textarea
          value={form.descricao}
          onChange={(e) => updateField('descricao', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar' : 'Criar Plano'}</Button>
      </div>
    </form>
  );
}
