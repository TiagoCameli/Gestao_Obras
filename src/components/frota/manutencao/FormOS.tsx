import { useState } from 'react';
import type { OrdemServico, ItemOS, Equipamento, StatusOS, TipoOS, PrioridadeOS, TipoCustoOS } from '../../../types';
import Button from '../../ui/Button';

interface Props {
  initial?: OrdemServico;
  itensIniciais?: ItemOS[];
  equipamentos: Equipamento[];
  onSubmit: (os: OrdemServico, itens: ItemOS[]) => void;
  onCancel: () => void;
  usuario: string;
}

const statusOptions: { value: StatusOS; label: string }[] = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'aguardando_peca', label: 'Aguardando Peça' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const tipoCustoOptions: { value: TipoCustoOS; label: string }[] = [
  { value: 'peca', label: 'Peça' },
  { value: 'mao_de_obra', label: 'Mão de Obra' },
  { value: 'servico_externo', label: 'Serviço Externo' },
];

export default function FormOS({ initial, itensIniciais = [], equipamentos, onSubmit, onCancel, usuario }: Props) {
  const isEditing = !!initial;

  const [form, setForm] = useState<OrdemServico>(
    initial ?? {
      id: '',
      numero: '',
      equipamentoId: '',
      tipo: 'corretiva',
      prioridade: 'normal',
      status: 'aberta',
      descricao: '',
      dataAbertura: new Date().toISOString().split('T')[0],
      dataPrevista: '',
      dataConclusao: '',
      medicaoAbertura: 0,
      medicaoConclusao: null,
      responsavel: '',
      observacoes: '',
      criadoPor: usuario,
    },
  );

  const [itens, setItens] = useState<ItemOS[]>(itensIniciais);

  function updateField<K extends keyof OrdemServico>(key: K, value: OrdemServico[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addItem() {
    setItens((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ordemServicoId: form.id,
        descricao: '',
        tipo: 'peca',
        quantidade: 1,
        valorUnitario: 0,
        criadoPor: usuario,
      },
    ]);
  }

  function updateItem(idx: number, field: keyof ItemOS, value: string | number) {
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalCustos = itens.reduce((acc, item) => acc + item.quantidade * item.valorUnitario, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipamentoId || !form.descricao.trim()) return;
    onSubmit(form, itens);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Main fields - grid 2 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Equipamento */}
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

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => updateField('tipo', e.target.value as TipoOS)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          >
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
          </select>
        </div>

        {/* Prioridade */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prioridade</label>
          <select
            value={form.prioridade}
            onChange={(e) => updateField('prioridade', e.target.value as PrioridadeOS)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          >
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => updateField('status', e.target.value as StatusOS)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Data Abertura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Abertura</label>
          <input
            type="date"
            value={form.dataAbertura}
            onChange={(e) => updateField('dataAbertura', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
        </div>

        {/* Data Prevista */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Prevista</label>
          <input
            type="date"
            value={form.dataPrevista}
            onChange={(e) => updateField('dataPrevista', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
        </div>

        {/* Data Conclusão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Conclusão</label>
          <input
            type="date"
            value={form.dataConclusao}
            onChange={(e) => updateField('dataConclusao', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          />
        </div>

        {/* Responsável */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Responsável</label>
          <input
            type="text"
            value={form.responsavel}
            onChange={(e) => updateField('responsavel', e.target.value)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Nome do responsável"
          />
        </div>

        {/* Medição Abertura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Medição Abertura</label>
          <input
            type="number"
            value={form.medicaoAbertura}
            onChange={(e) => updateField('medicaoAbertura', Number(e.target.value))}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
          />
        </div>

        {/* Medição Conclusão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Medição Conclusão</label>
          <input
            type="number"
            value={form.medicaoConclusao ?? ''}
            onChange={(e) => updateField('medicaoConclusao', e.target.value ? Number(e.target.value) : null)}
            className="w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
            min={0}
          />
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Descrição *</label>
        <textarea
          value={form.descricao}
          onChange={(e) => updateField('descricao', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          required
          placeholder="Descreva o serviço..."
        />
      </div>

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={(e) => updateField('observacoes', e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
        />
      </div>

      {/* Itens / Custos */}
      <div className="border-t dark:border-slate-600 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Itens / Custos</h3>
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-emt-verde hover:underline font-medium"
          >
            + Adicionar Item
          </button>
        </div>

        {itens.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-slate-400 border-b dark:border-slate-600">
                  <th className="pb-2 pr-2">Descrição</th>
                  <th className="pb-2 pr-2 w-32">Tipo</th>
                  <th className="pb-2 pr-2 w-20">Qtd</th>
                  <th className="pb-2 pr-2 w-28">Vlr Unit.</th>
                  <th className="pb-2 pr-2 w-24 text-right">Subtotal</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => (
                  <tr key={item.id} className="border-b dark:border-slate-700">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => updateItem(idx, 'descricao', e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emt-verde"
                        placeholder="Descrição do item"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={item.tipo}
                        onChange={(e) => updateItem(idx, 'tipo', e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emt-verde"
                      >
                        {tipoCustoOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={item.quantidade}
                        onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emt-verde"
                        min={0}
                        step="0.01"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={item.valorUnitario}
                        onChange={(e) => updateItem(idx, 'valorUnitario', Number(e.target.value))}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emt-verde"
                        min={0}
                        step="0.01"
                      />
                    </td>
                    <td className="py-2 pr-2 text-right text-gray-700 dark:text-slate-300 font-medium">
                      {(item.quantidade * item.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-2 text-right font-semibold text-gray-700 dark:text-slate-300">Total:</td>
                  <td className="pt-2 text-right font-bold text-gray-800 dark:text-slate-200">
                    {totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{isEditing ? 'Salvar' : 'Criar OS'}</Button>
      </div>
    </form>
  );
}
