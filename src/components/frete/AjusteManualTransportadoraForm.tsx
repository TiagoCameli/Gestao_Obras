import { useState, type FormEvent } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useObras } from '../../hooks/useObras';
import { useCriarAjusteManualTransportadora } from '../../hooks/useTransportadoraMovimentos';

interface Props {
  transportadoraId: string;
  transportadoraNome: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AjusteManualTransportadoraForm({
  transportadoraId,
  transportadoraNome,
  onSuccess,
  onCancel,
}: Props) {
  const [tipo, setTipo] = useState<'credito' | 'debito'>('credito');
  const [valorStr, setValorStr] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 16));
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [descricao, setDescricao] = useState('');
  const [obraId, setObraId] = useState('');

  const { data: obras = [] } = useObras();
  const criarMut = useCriarAjusteManualTransportadora();

  const valorNum = parseFloat(valorStr.replace(',', '.')) || 0;
  const isValid = valorNum > 0 && data.length >= 16 && descricao.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    try {
      await criarMut.mutateAsync({
        transportadoraId,
        tipo: tipo === 'credito' ? 'ajuste_manual_credito' : 'ajuste_manual_debito',
        valor: valorNum,
        data,
        mesReferencia: mesRef ? `${mesRef}-01` : null,
        descricao: descricao.trim(),
        obraId: obraId || null,
      });
      onSuccess();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Falha ao criar ajuste manual', err);
      alert('Falha ao criar ajuste manual. Veja o console.');
    }
  }

  const sinalLabel = tipo === 'credito' ? '▲ Crédito' : '▼ Débito';
  const corLabel = tipo === 'credito' ? 'text-green-700' : 'text-red-700';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Ajuste manual em <strong>{transportadoraNome}</strong>. Crédito soma ao
        saldo; débito subtrai.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Tipo de Ajuste
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipo('credito')}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              tipo === 'credito'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            ▲ Crédito (soma)
          </button>
          <button
            type="button"
            onClick={() => setTipo('debito')}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              tipo === 'debito'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            ▼ Débito (subtrai)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Valor (R$)"
          id="ajusteValor"
          type="number"
          step="any"
          min="0"
          value={valorStr}
          onChange={(e) => setValorStr(e.target.value)}
          placeholder="0,00"
          required
        />
        <Input
          label="Data"
          id="ajusteData"
          type="datetime-local"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Input
          label="Mês de Referência"
          id="ajusteMesRef"
          type="month"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
        />
        <Select
          label="Obra (opcional)"
          id="ajusteObra"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="—"
        />
      </div>

      <div>
        <label htmlFor="ajusteDesc" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Descrição
        </label>
        <textarea
          id="ajusteDesc"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="Motivo do ajuste (obrigatório pra rastreio)"
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          required
        />
      </div>

      {valorNum > 0 && (
        <div className="text-sm rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2">
          <span className={`font-medium ${corLabel}`}>{sinalLabel}: {valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          {' '}será {tipo === 'credito' ? 'somado a' : 'subtraído de'} <strong>{transportadoraNome}</strong>.
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid || criarMut.isPending}>
          {criarMut.isPending ? 'Salvando...' : 'Criar Ajuste'}
        </Button>
      </div>
    </form>
  );
}
