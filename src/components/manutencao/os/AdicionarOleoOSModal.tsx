// Adicionar troca de óleo em uma OS — agora com baixa de estoque (híbrido).
// Óleo sai de um almoxarifado (só os com saldo), unidade e custo (= custo médio
// da entrada) vêm automáticos, e o TIPO de óleo (pro alerta de vencimento) é
// derivado do insumo (marcado no cadastro da peça). Baixa via v_saldo_estoque +
// trigger tg_os_oleos_valida_saldo.

import { useState, useMemo, type FormEvent } from 'react';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import FilterCombobox from '../../ui/FilterCombobox';
import { useAdicionarOleoOS } from '../../../hooks/useOSOleos';
import { useInsumos } from '../../../hooks/useInsumos';
import { useSaldoEstoqueTotal, useSaldoEstoquePorDeposito } from '../../../hooks/useSaldoEstoque';
import { useAuth } from '../../../contexts/AuthContext';
import { parseNum } from '../../../utils/parseNum';
import { depositosComSaldo, acharSaldoDeposito, validarQtdContraSaldo } from '../../../utils/estoqueServico';

interface Props {
  osId: string;
  onClose: () => void;
}

function fmtQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export default function AdicionarOleoOSModal({ osId, onClose }: Props) {
  const { temAcao, usuario } = useAuth();
  const canAdd = temAcao('adicionar_oleo_os');
  const adicionarOleo = useAdicionarOleoOS();

  const { data: insumos = [] } = useInsumos();
  const { data: saldosTotais = [] } = useSaldoEstoqueTotal({ apenasManutencao: true });

  const [insumoId, setInsumoId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Óleos = insumos marcados com tipo de óleo E com saldo em algum depósito.
  const insumosPorId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const opcoesOleo = useMemo(
    () => saldosTotais
      .filter((s) => s.saldoTotal > 0 && insumosPorId.get(s.insumoId)?.tipoOleoId)
      .map((s) => ({ value: s.insumoId, label: `${s.insumoNome} (${fmtQty(s.saldoTotal)} ${s.unidade})` })),
    [saldosTotais, insumosPorId],
  );

  const { data: saldosDep = [] } = useSaldoEstoquePorDeposito(insumoId || null);
  const depOpcoes = useMemo(() => depositosComSaldo(saldosDep), [saldosDep]);

  // Trocar de óleo zera o depósito (evita depósito de outro item).
  const escolherInsumo = (id: string) => { setInsumoId(id); setDepositoId(''); };

  const saldoDep = depositoId ? acharSaldoDeposito(saldosDep, depositoId) : null;
  const unidadeInsumo = saldoDep?.unidade ?? '';
  // os_oleos.unidade só aceita 'L' ou 'kg' (CHECK). Coerção segura.
  const unidadeOleo: 'L' | 'kg' = unidadeInsumo.toLowerCase() === 'kg' ? 'kg' : 'L';
  const custoMedio = saldoDep?.custoMedio ?? null;
  const saldoDisponivel = saldoDep?.saldo ?? 0;
  const tipoOleoId = insumoId ? (insumosPorId.get(insumoId)?.tipoOleoId ?? '') : '';

  const quantidadeNum = parseNum(quantidade);
  const erroQtd = depositoId ? validarQtdContraSaldo(quantidadeNum, saldoDisponivel) : null;
  const total = quantidadeNum * (custoMedio ?? 0);

  const podeSalvar = !!insumoId && !!depositoId && !!tipoOleoId && custoMedio != null && !erroQtd;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canAdd || !podeSalvar || adicionarOleo.isPending || custoMedio == null || !tipoOleoId) return;
    setSubmitError(null);
    try {
      await adicionarOleo.mutateAsync({
        osId,
        tipoOleoId,
        insumoId,
        depositoId,
        quantidade: quantidadeNum,
        unidade: unidadeOleo,
        valorUnitario: custoMedio,
        valorTotal: quantidadeNum * custoMedio,
        createdBy: usuario?.nome ?? '',
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao adicionar troca de óleo.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Adicionar troca de óleo" size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="oleoInsumo" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Óleo (do almoxarifado) <span className="text-[var(--color-danger)]">*</span>
          </label>
          <FilterCombobox
            value={insumoId}
            onChange={escolherInsumo}
            options={opcoesOleo}
            placeholder="Buscar óleo com saldo…"
          />
          {opcoesOleo.length === 0 && (
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              Nenhum óleo com saldo. Cadastre o óleo no almoxarifado (marcando o tipo) e lance a entrada.
            </p>
          )}
        </div>

        <Select
          label="Almoxarifado (de onde sai)"
          id="oleoDeposito"
          value={depositoId}
          onChange={(e) => setDepositoId(e.target.value)}
          options={depOpcoes.map((d) => ({ value: d.depositoId, label: `${d.depositoNome} — ${fmtQty(d.saldo)} ${d.unidade}` }))}
          placeholder={insumoId ? 'Selecione o almoxarifado' : 'Escolha o óleo primeiro'}
          disabled={!insumoId}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label={`Quantidade${unidadeInsumo ? ` (${unidadeInsumo})` : ''}`}
              id="oleoQtd"
              type="number"
              step="any"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
            {depositoId && (
              <p className={`text-xs mt-1 ${erroQtd ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-muted)]'}`}>
                {erroQtd ?? `Disponível: ${fmtQty(saldoDisponivel)} ${unidadeInsumo}`}
              </p>
            )}
          </div>
          <Input
            label="Valor unitário (R$) — da entrada"
            id="oleoValorUnit"
            type="text"
            value={custoMedio != null ? custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
            readOnly
            disabled
          />
        </div>

        {total > 0 && !erroQtd && (
          <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
            Total da linha:{' '}
            <strong className="font-mono">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={adicionarOleo.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || adicionarOleo.isPending}>
            {adicionarOleo.isPending ? 'Salvando…' : 'Adicionar óleo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
