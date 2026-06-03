import { useState, type FormEvent } from 'react';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useToast } from '../ui/Toast';
import { useObras } from '../../hooks/useObras';
import {
  useCriarAjusteManualTransportadora,
  useAtualizarAjusteManualTransportadora,
} from '../../hooks/useTransportadoraMovimentos';
import type { TransportadoraMovimento } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  transportadoraId: string;
  transportadoraNome: string;
  /** Se passado, o form entra em modo edição do ajuste existente.
   *  Apenas movimentos com origem_tabela='ajuste_manual' devem ser passados. */
  initial?: TransportadoraMovimento | null;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Converte ISO timestamptz pra valor de input datetime-local (yyyy-MM-ddTHH:mm).
 *  Pega o valor LOCAL do dispositivo (input datetime-local é sem TZ). */
function isoToDatetimeLocal(iso: string): string {
  if (!iso) return new Date().toISOString().slice(0, 16);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoToMonth(iso: string): string {
  if (!iso) return new Date().toISOString().slice(0, 7);
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return new Date().toISOString().slice(0, 7);
}

export default function AjusteManualTransportadoraForm({
  transportadoraId,
  transportadoraNome,
  initial,
  onSuccess,
  onCancel,
}: Props) {
  const editing = !!initial;
  const tipoInicial: 'credito' | 'debito' =
    initial?.tipo === 'ajuste_manual_debito' ? 'debito' : 'credito';

  const [tipo, setTipo] = useState<'credito' | 'debito'>(tipoInicial);
  const [valorStr, setValorStr] = useState(initial ? String(initial.valor).replace('.', ',') : '');
  const [data, setData] = useState(initial ? isoToDatetimeLocal(initial.data) : new Date().toISOString().slice(0, 16));
  const [mesRef, setMesRef] = useState(initial?.mesReferencia ? isoToMonth(initial.mesReferencia) : new Date().toISOString().slice(0, 7));
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [obraId, setObraId] = useState(initial?.obraId ?? '');

  const { data: obras = [] } = useObras();
  const criarMut = useCriarAjusteManualTransportadora();
  const atualizarMut = useAtualizarAjusteManualTransportadora();
  const { showToast } = useToast();

  const valorNum = parseFloat(valorStr.replace(',', '.')) || 0;
  const isValid = valorNum > 0 && data.length >= 16 && descricao.trim().length > 0;

  const isPending = criarMut.isPending || atualizarMut.isPending;

  const { temAcao } = useAuth();
  const canAjustar = temAcao('ajustar_saldo_transportadora');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canAjustar) return;
    if (!isValid) return;
    const payload = {
      transportadoraId,
      tipo: (tipo === 'credito' ? 'ajuste_manual_credito' : 'ajuste_manual_debito') as
        'ajuste_manual_credito' | 'ajuste_manual_debito',
      valor: valorNum,
      data,
      mesReferencia: mesRef ? `${mesRef}-01` : null,
      descricao: descricao.trim(),
      obraId: obraId || null,
    };
    try {
      if (editing && initial) {
        await atualizarMut.mutateAsync({ id: initial.id, ...payload });
      } else {
        await criarMut.mutateAsync(payload);
      }
      onSuccess();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Falha ao salvar ajuste manual', err);
      showToast({ kind: 'error', message: `Falha ao ${editing ? 'atualizar' : 'criar'} ajuste manual. Veja o console.` });
    }
  }

  const sinalLabel = tipo === 'credito' ? '▲ Crédito' : '▼ Débito';
  const corLabel = tipo === 'credito' ? 'text-green-700' : 'text-red-700';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        {editing ? 'Editando ajuste em' : 'Ajuste manual em'} <strong>{transportadoraNome}</strong>.{' '}
        Crédito soma ao saldo; débito subtrai.
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
        <SubmitButton loading={isPending} disabled={!isValid || !canAjustar} title={!canAjustar ? 'Sem permissão para ajustar saldo' : undefined}>
          {editing ? 'Salvar Alterações' : 'Criar Ajuste'}
        </SubmitButton>
      </div>
    </form>
  );
}
