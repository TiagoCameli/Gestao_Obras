/**
 * TransferenciaMaterialForm — move material entre depósitos.
 *
 * Regras:
 *  - Depósito origem é o atual (mostrado readonly)
 *  - Depósito destino: select de todos os outros ativos
 *  - Insumo: autocomplete com saldo na origem
 *  - Bloqueia se qtd > saldo
 *  - Bloqueia se origem == destino (defensivo)
 *  - Valor total opcional (snapshot)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, AlertCircle, Calendar, Package, AlertTriangle, ArrowRight } from 'lucide-react';
import type {
  DepositoMaterial, TransferenciaMaterial, Insumo,
} from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { consultarSaldoInsumo } from '../../hooks/useDepositosObras';

interface Props {
  origem: DepositoMaterial;
  depositos: DepositoMaterial[];
  insumos: Insumo[];
  onSubmit: (transferencia: TransferenciaMaterial) => Promise<void>;
  onCancel: () => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function TransferenciaMaterialForm({
  origem, depositos, insumos, onSubmit, onCancel,
}: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const [dataHora, setDataHora] = useState(new Date().toISOString().slice(0, 16));
  const [destinoId, setDestinoId] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [buscaInsumo, setBuscaInsumo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [observacoes, setObservacoes] = useState('');
  const [saldoOrigem, setSaldoOrigem] = useState<number | null>(null);
  const [verificandoSaldo, setVerificandoSaldo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const insumoSelecionado = insumos.find((i) => i.id === insumoId);
  const destinoSelecionado = depositos.find((d) => d.id === destinoId);

  // Outros depósitos disponíveis (≠ origem, ativos, não deletados)
  const destinosDisponiveis = useMemo(
    () => depositos.filter((d) => d.id !== origem.id && d.ativo && !d.deletadoEm),
    [depositos, origem.id]
  );

  // Consulta saldo na origem quando insumo muda
  useEffect(() => {
    if (!insumoId) { setSaldoOrigem(null); return; }
    setVerificandoSaldo(true);
    consultarSaldoInsumo(origem.id, insumoId)
      .then(setSaldoOrigem)
      .finally(() => setVerificandoSaldo(false));
  }, [insumoId, origem.id]);

  const sugestoesInsumo = useMemo(() => {
    const q = buscaInsumo.trim().toLowerCase();
    if (!q) return insumos.filter((i) => i.ativo !== false).slice(0, 8);
    return insumos
      .filter((i) => i.ativo !== false && i.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [insumos, buscaInsumo]);

  const saldoSuficiente = saldoOrigem === null || quantidade <= saldoOrigem;
  const podeSalvar = !!destinoId && !!insumoId && quantidade > 0 && saldoSuficiente && destinoId !== origem.id;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (!destinoId) { setErro('Selecione o depósito de destino.'); return; }
      if (destinoId === origem.id) { setErro('Depósito de destino precisa ser diferente da origem.'); return; }
      if (!insumoId) { setErro('Selecione um insumo.'); return; }
      if (quantidade <= 0) { setErro('Quantidade precisa ser maior que zero.'); return; }
      if (!saldoSuficiente) {
        setErro(`Saldo insuficiente. Disponível na origem: ${saldoOrigem}.`);
        return;
      }

      // Re-verifica saldo no servidor (anti race-condition)
      const saldoAtual = await consultarSaldoInsumo(origem.id, insumoId);
      if (quantidade > saldoAtual) {
        setErro(`Saldo mudou! Disponível agora: ${saldoAtual}.`);
        setSaldoOrigem(saldoAtual);
        return;
      }

      setSubmitting(true);
      try {
        const transf: TransferenciaMaterial = {
          id: genId(),
          dataHora,
          depositoOrigemId: origem.id,
          depositoDestinoId: destinoId,
          insumoId,
          quantidade,
          valorTotal,
          observacoes: observacoes.trim(),
          criadoPor: usuario?.nome || '',
        };
        await onSubmit(transf);
        showToast({
          kind: 'success',
          message: `Transferência: ${quantidade} ${insumoSelecionado?.unidade ?? ''} de ${insumoSelecionado?.nome ?? '?'} de "${origem.nome}" para "${destinoSelecionado?.nome ?? '?'}".`,
        });
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [destinoId, insumoId, quantidade, saldoSuficiente, saldoOrigem, origem,
     dataHora, valorTotal, observacoes, usuario, insumoSelecionado, destinoSelecionado, onSubmit, showToast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Origem → Destino visual */}
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
        <Package className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">De</div>
          <div className="text-sm font-semibold text-[var(--color-fg)] truncate">{origem.nome}</div>
        </div>
        <ArrowRight className="w-5 h-5 text-[var(--color-fg-subtle)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)]">Para</div>
          <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
            {destinoSelecionado?.nome || <span className="text-[var(--color-fg-subtle)] italic font-normal">— escolha o destino —</span>}
          </div>
        </div>
      </div>

      {/* Destino */}
      <div>
        <Label>Depósito de destino <span className="text-rose-500">*</span></Label>
        {destinosDisponiveis.length === 0 ? (
          <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">
            ⚠ Sem outros depósitos ativos. Crie outro depósito primeiro.
          </div>
        ) : (
          <select
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            required
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
          >
            <option value="">— selecione —</option>
            {destinosDisponiveis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
                {d.obrasIds && d.obrasIds.length === 0 ? ' (central)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Insumo */}
      <div>
        <Label>Insumo <span className="text-rose-500">*</span></Label>
        <div className="relative">
          <input
            type="text"
            value={aberto ? buscaInsumo : (insumoSelecionado?.nome ?? '')}
            onChange={(e) => { setBuscaInsumo(e.target.value); setAberto(true); setInsumoId(''); }}
            onFocus={() => { setAberto(true); setBuscaInsumo(''); }}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder="Buscar insumo na origem…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            required
          />
          {insumoSelecionado && saldoOrigem !== null && (
            <div className="text-[11px] mt-1 ml-1 flex items-center gap-2">
              <span className="text-emerald-700">✓ {insumoSelecionado.nome} ({insumoSelecionado.unidade})</span>
              <span className={'font-semibold ' + (saldoOrigem > 0 ? 'text-[var(--color-fg)]' : 'text-rose-700')}>
                · Saldo na origem: {saldoOrigem.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumoSelecionado.unidade}
              </span>
              {verificandoSaldo && <span className="text-[var(--color-fg-subtle)]">(consultando…)</span>}
            </div>
          )}
          {aberto && sugestoesInsumo.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg max-h-56 overflow-auto">
              {sugestoesInsumo.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onMouseDown={() => { setInsumoId(i.id); setAberto(false); setBuscaInsumo(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] flex items-center justify-between"
                >
                  <span>{i.nome}</span>
                  <span className="text-[10px] text-[var(--color-fg-subtle)]">{i.unidade}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quantidade + data + valor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Quantidade <span className="text-rose-500">*</span></Label>
          <Input
            type="number" step="any" min="0"
            value={quantidade || ''}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            placeholder="0"
            required
          />
          {!saldoSuficiente && saldoOrigem !== null && (
            <p className="text-[11px] text-rose-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Saldo insuficiente — disponível: {saldoOrigem}
            </p>
          )}
        </div>
        <div>
          <Label>Valor total (R$, opcional)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={valorTotal || ''}
            onChange={(e) => setValorTotal(Number(e.target.value))}
            placeholder="0,00"
          />
          <p className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">Snapshot para histórico</p>
        </div>
        <div>
          <Label>Data / hora</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <Label>Observações</Label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          placeholder="Ex.: transferência mensal de cimento para obra X"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeSalvar || submitting}>
          <ArrowRightLeft className="w-4 h-4" />
          {submitting ? 'Transferindo…' : 'Transferir'}
        </Button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}
