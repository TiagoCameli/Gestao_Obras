/**
 * SaidaMaterialForm — saída de material (consumo ou perda) com alocações
 * por etapa.
 *
 * Regras (decisões finais):
 *  - Toda saída (consumo OU perda) precisa de ETAPA(s) atrelada(s)
 *  - Distribuição por QUANTIDADE em cada etapa (soma = qtd total)
 *  - Etapas filtradas pelas OBRAS vinculadas ao depósito (se não tiver
 *    nenhuma, mostra etapas de TODAS as obras — depósito central)
 *  - Bloqueia se quantidade total > saldo disponível (via RPC)
 *  - Se for PERDA, motivo é obrigatório (chuva/quebra/vencimento/roubo/outros)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, AlertCircle, Calendar, Plus, Trash2, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type {
  DepositoMaterial, SaidaMaterial, Insumo, EtapaObra, Obra,
  TipoSaidaMaterial, MotivoPerda,
} from '../../types';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { consultarSaldoInsumo } from '../../hooks/useDepositosObras';

interface Props {
  deposito: DepositoMaterial;
  insumos: Insumo[];
  etapas: EtapaObra[];
  obras: Obra[];
  onSubmit: (saida: SaidaMaterial) => Promise<void>;
  onCancel: () => void;
}

interface AlocacaoLinha {
  uid: string;
  etapaId: string;
  quantidade: number;
}

const MOTIVOS_PERDA: { value: MotivoPerda; label: string }[] = [
  { value: 'chuva', label: 'Chuva / clima' },
  { value: 'quebra', label: 'Quebra / dano' },
  { value: 'vencimento', label: 'Vencimento / validade' },
  { value: 'roubo', label: 'Roubo / extravio' },
  { value: 'outros', label: 'Outros' },
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function SaidaMaterialForm({
  deposito, insumos, etapas, obras, onSubmit, onCancel,
}: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const [dataHora, setDataHora] = useState(new Date().toISOString().slice(0, 16));
  const [tipoSaida, setTipoSaida] = useState<TipoSaidaMaterial>('consumo');
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda | ''>('');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [buscaInsumo, setBuscaInsumo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(0);
  const [alocacoes, setAlocacoes] = useState<AlocacaoLinha[]>([
    { uid: genId(), etapaId: '', quantidade: 0 },
  ]);
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);
  const [verificandoSaldo, setVerificandoSaldo] = useState(false);

  const insumoSelecionado = insumos.find((i) => i.id === insumoId);
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);

  // Etapas disponíveis: das obras vinculadas (ou todas se depósito central)
  const etapasDisponiveis = useMemo(() => {
    const obrasIds = deposito.obrasIds ?? [];
    if (obrasIds.length === 0) return etapas; // central: todas
    return etapas.filter((e) => obrasIds.includes(e.obraId));
  }, [etapas, deposito]);

  // Consulta saldo quando insumo muda
  useEffect(() => {
    if (!insumoId) { setSaldoDisponivel(null); return; }
    setVerificandoSaldo(true);
    consultarSaldoInsumo(deposito.id, insumoId)
      .then(setSaldoDisponivel)
      .finally(() => setVerificandoSaldo(false));
  }, [insumoId, deposito.id]);

  const sugestoesInsumo = useMemo(() => {
    const q = buscaInsumo.trim().toLowerCase();
    if (!q) return insumos.filter((i) => i.ativo !== false).slice(0, 8);
    return insumos
      .filter((i) => i.ativo !== false && i.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [insumos, buscaInsumo]);

  const somaAlocacoes = useMemo(
    () => alocacoes.reduce((s, a) => s + (Number(a.quantidade) || 0), 0),
    [alocacoes]
  );
  const diff = quantidade - somaAlocacoes;
  const alocacoesOk = quantidade > 0 && Math.abs(diff) < 0.0001;
  const saldoSuficiente = saldoDisponivel === null || quantidade <= saldoDisponivel;

  // Adicionar / remover / atualizar alocações
  const addLinha = () => setAlocacoes((prev) => [...prev, { uid: genId(), etapaId: '', quantidade: 0 }]);
  const removerLinha = (uid: string) => setAlocacoes((prev) => prev.filter((a) => a.uid !== uid));
  const atualizarLinha = (uid: string, patch: Partial<AlocacaoLinha>) =>
    setAlocacoes((prev) => prev.map((a) => (a.uid === uid ? { ...a, ...patch } : a)));

  // Atalho: distribuir a qtd total igualmente entre as alocações
  const distribuirIgualmente = () => {
    if (quantidade <= 0 || alocacoes.length === 0) return;
    const por = quantidade / alocacoes.length;
    setAlocacoes((prev) => prev.map((a) => ({ ...a, quantidade: por })));
  };

  // Encontra a obra de cada etapa (pra mostrar contexto no select)
  const obraDaEtapa = (etapaId: string) => {
    const et = etapas.find((e) => e.id === etapaId);
    return et ? obrasMap.get(et.obraId) ?? '?' : '?';
  };

  const podeSalvar = !!insumoId
    && quantidade > 0
    && alocacoesOk
    && alocacoes.every((a) => !!a.etapaId)
    && saldoSuficiente
    && (tipoSaida === 'consumo' || !!motivoPerda);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (!insumoId) { setErro('Selecione um insumo.'); return; }
      if (quantidade <= 0) { setErro('Quantidade total precisa ser maior que zero.'); return; }
      if (tipoSaida === 'perda' && !motivoPerda) { setErro('Selecione o motivo da perda.'); return; }
      if (alocacoes.some((a) => !a.etapaId)) { setErro('Cada alocação precisa de uma etapa.'); return; }
      if (!alocacoesOk) {
        setErro(`Soma das alocações (${somaAlocacoes}) precisa ser igual à quantidade total (${quantidade}). Diferença: ${diff}`);
        return;
      }
      if (!saldoSuficiente) {
        setErro(`Saldo insuficiente. Disponível: ${saldoDisponivel}, solicitado: ${quantidade}.`);
        return;
      }

      // Re-verifica saldo no servidor antes de gravar (corrige races)
      const saldoAtual = await consultarSaldoInsumo(deposito.id, insumoId);
      if (quantidade > saldoAtual) {
        setErro(`Saldo mudou! Disponível agora: ${saldoAtual}. Atualize.`);
        setSaldoDisponivel(saldoAtual);
        return;
      }

      setSubmitting(true);
      try {
        // Calcula valor_total proporcional ao saldo (snapshot do custo médio)
        const valorTotal = 0; // simplificação por enquanto — preço médio fica pra fase futura
        const motivoFinal = tipoSaida === 'perda'
          ? (motivoPerda === 'outros' && motivoCustom.trim() ? motivoCustom.trim() : motivoPerda)
          : undefined;
        const saida: SaidaMaterial = {
          id: genId(),
          dataHora,
          depositoMaterialId: deposito.id,
          insumoId,
          // obraId: primeira obra das alocações (compatibilidade — v2 usa alocações N:N)
          obraId: etapas.find((e) => e.id === alocacoes[0].etapaId)?.obraId ?? '',
          quantidade,
          valorTotal,
          alocacoes: alocacoes.map((a) => ({ etapaId: a.etapaId, quantidade: a.quantidade })),
          observacoes: observacoes.trim(),
          criadoPor: usuario?.nome || '',
          tipoSaida,
          motivoPerda: motivoFinal,
        };
        await onSubmit(saida);
        showToast({
          kind: 'success',
          message: tipoSaida === 'perda'
            ? `Perda registrada: ${quantidade} ${insumoSelecionado?.unidade ?? ''} de ${insumoSelecionado?.nome ?? 'insumo'}.`
            : `Saída registrada: ${quantidade} ${insumoSelecionado?.unidade ?? ''} de ${insumoSelecionado?.nome ?? 'insumo'} em ${alocacoes.length} etapa(s).`,
        });
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [insumoId, quantidade, tipoSaida, motivoPerda, motivoCustom, alocacoes, alocacoesOk,
     saldoSuficiente, saldoDisponivel, somaAlocacoes, diff, observacoes, deposito,
     dataHora, etapas, usuario, insumoSelecionado, onSubmit, showToast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info do depósito */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm">
        <Package className="w-4 h-4 text-[var(--color-fg-muted)]" />
        Saída do depósito <strong className="text-[var(--color-fg)]">{deposito.nome}</strong>
        {etapasDisponiveis.length === 0 && (
          <span className="ml-auto text-[10px] text-rose-700 dark:text-rose-400">
            ⚠ Sem etapas disponíveis — verifique obras vinculadas
          </span>
        )}
      </div>

      {/* Tipo de saída — chips coloridos */}
      <div>
        <Label>Tipo de saída</Label>
        <div className="grid grid-cols-2 gap-2">
          <ChipTipo
            ativo={tipoSaida === 'consumo'}
            cor="blue"
            label="Consumo"
            sub="Material usado em alguma etapa"
            onClick={() => setTipoSaida('consumo')}
          />
          <ChipTipo
            ativo={tipoSaida === 'perda'}
            cor="rose"
            label="Perda"
            sub="Material descartado/inutilizado"
            onClick={() => setTipoSaida('perda')}
          />
        </div>
      </div>

      {/* Motivo da perda (só aparece se perda) */}
      {tipoSaida === 'perda' && (
        <div>
          <Label>Motivo da perda <span className="text-rose-500">*</span></Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {MOTIVOS_PERDA.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMotivoPerda(m.value)}
                className={
                  'px-2.5 h-9 rounded-md text-xs font-medium border transition-colors text-left ' +
                  (motivoPerda === m.value
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300'
                    : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
                }
              >
                {m.label}
              </button>
            ))}
          </div>
          {motivoPerda === 'outros' && (
            <Input
              value={motivoCustom}
              onChange={(e) => setMotivoCustom(e.target.value)}
              placeholder="Descreva o motivo…"
              className="mt-2"
            />
          )}
        </div>
      )}

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
            placeholder="Buscar insumo no estoque…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            required
          />
          {insumoSelecionado && saldoDisponivel !== null && (
            <div className="text-[11px] mt-1 ml-1 flex items-center gap-2">
              <span className="text-emerald-700">✓ {insumoSelecionado.nome} ({insumoSelecionado.unidade})</span>
              <span className={'font-semibold ' + (saldoDisponivel > 0 ? 'text-[var(--color-fg)]' : 'text-rose-700')}>
                · Saldo: {saldoDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {insumoSelecionado.unidade}
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

      {/* Qtd total + data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Quantidade total <span className="text-rose-500">*</span></Label>
          <Input
            type="number" step="any" min="0"
            value={quantidade || ''}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            placeholder="0"
            required
          />
          {!saldoSuficiente && saldoDisponivel !== null && (
            <p className="text-[11px] text-rose-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Saldo insuficiente — disponível: {saldoDisponivel}
            </p>
          )}
        </div>
        <div>
          <Label>Data / hora</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Alocações por etapa */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <Label>Alocações por etapa <span className="text-rose-500">*</span></Label>
            <p className="text-xs text-[var(--color-fg-subtle)] -mt-1">
              Distribua a quantidade entre etapas. A soma precisa bater com a quantidade total.
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={distribuirIgualmente}
              disabled={quantidade <= 0 || alocacoes.length === 0}
              className="px-2 h-8 rounded-md text-[11px] font-medium border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors"
            >
              Dividir igualmente
            </button>
            <button
              type="button"
              onClick={addLinha}
              className="inline-flex items-center gap-1 px-2 h-8 rounded-md text-[11px] font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Plus className="w-3 h-3" /> Adicionar etapa
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {alocacoes.map((a) => (
            <div key={a.uid} className="flex items-center gap-2">
              <SmartSelect
                value={a.etapaId}
                onChange={(e) => atualizarLinha(a.uid, { etapaId: e.target.value })}
                wrapperClassName="relative flex-1"
                className="w-full h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 text-sm text-left focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] flex items-center"
              >
                <option value="">— selecione a etapa —</option>
                {etapasDisponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome} · {obraDaEtapa(e.id)}
                  </option>
                ))}
              </SmartSelect>
              <Input
                type="number" step="any" min="0"
                value={a.quantidade || ''}
                onChange={(e) => atualizarLinha(a.uid, { quantidade: Number(e.target.value) })}
                placeholder="qtd"
                className="w-28"
              />
              <button
                type="button"
                onClick={() => removerLinha(a.uid)}
                disabled={alocacoes.length === 1}
                className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 transition-colors"
                aria-label="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Resumo da soma */}
        {quantidade > 0 && (
          <div className={
            'mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ' +
            (alocacoesOk
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200')
          }>
            {alocacoesOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="tabular-nums">
              Soma das alocações: <strong>{somaAlocacoes.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</strong>
              {' '}/ Total: <strong>{quantidade}</strong>
              {!alocacoesOk && (
                <span className="ml-1 font-normal">
                  (diferença: {diff > 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { maximumFractionDigits: 3 })})
                </span>
              )}
            </span>
          </div>
        )}
      </section>

      {/* Observações */}
      <div>
        <Label>Observações</Label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          placeholder={tipoSaida === 'perda' ? 'Detalhes do que aconteceu…' : 'Observações sobre a aplicação…'}
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
        <SubmitButton loading={submitting} disabled={!podeSalvar} variant={tipoSaida === 'perda' ? 'danger' : 'primary'}>
          <Minus className="w-4 h-4" />
          {tipoSaida === 'perda' ? 'Registrar perda' : 'Registrar saída'}
        </SubmitButton>
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

function ChipTipo({
  ativo, cor, label, sub, onClick,
}: { ativo: boolean; cor: 'blue' | 'rose'; label: string; sub: string; onClick: () => void }) {
  const corAtivo = cor === 'rose'
    ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-200'
    : 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'p-3 rounded-lg border text-left transition-all ' +
        (ativo ? corAtivo : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]')
      }
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[11px] opacity-80 mt-0.5">{sub}</div>
    </button>
  );
}
