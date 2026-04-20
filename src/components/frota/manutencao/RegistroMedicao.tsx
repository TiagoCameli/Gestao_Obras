import { useState } from 'react';
import type { HistoricoMedicao, Equipamento } from '../../../types';
import Button from '../../ui/Button';

interface Props {
  equipamentos: Equipamento[];
  onSubmit: (medicao: HistoricoMedicao) => void;
  onCancel: () => void;
  usuario: string;
}

export default function RegistroMedicao({ equipamentos, onSubmit, onCancel, usuario }: Props) {
  const [form, setForm] = useState<HistoricoMedicao>({
    id: '',
    equipamentoId: '',
    tipoMedicao: 'horimetro',
    valor: 0,
    dataRegistro: new Date().toISOString().split('T')[0],
    observacoes: '',
    criadoPor: usuario,
  });

  function updateField<K extends keyof HistoricoMedicao>(key: K, value: HistoricoMedicao[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-set tipoMedicao when equipment is selected
  function handleEquipChange(eqId: string) {
    const eq = equipamentos.find((e) => e.id === eqId);
    setForm((prev) => ({
      ...prev,
      equipamentoId: eqId,
      tipoMedicao: eq?.tipoMedicao ?? 'horimetro',
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipamentoId || form.valor <= 0) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Equipamento *</label>
          <select
            value={form.equipamentoId}
            onChange={(e) => handleEquipChange(e.target.value)}
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
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de Medição</label>
          <select
            value={form.tipoMedicao}
            onChange={(e) => updateField('tipoMedicao', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          >
            <option value="horimetro">Horímetro</option>
            <option value="odometro">Odômetro</option>
            <option value="km">Quilometragem</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Valor *</label>
          <input
            type="number"
            value={form.valor || ''}
            onChange={(e) => updateField('valor', Number(e.target.value))}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
            step="0.1"
            required
            placeholder="Ex: 1500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data</label>
          <input
            type="date"
            value={form.dataRegistro}
            onChange={(e) => updateField('dataRegistro', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={(e) => updateField('observacoes', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Registrar Medição</Button>
      </div>
    </form>
  );
}
