// Exclusão de UMA entrada de peça, com guarda de saldo + confirmação por senha.
//
// Se remover a entrada deixaria o saldo da peça no depósito negativo (peça já
// consumida em OS), bloqueia com um aviso — deletar aí corromperia o custo
// médio. Caso contrário, cai no ConfirmDialog padrão (senha), igual à exclusão
// de saída de material.

import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import type { EntradaMaterial } from '../../../types';
import { useExcluirEntradaMaterial } from '../../../hooks/useEntradasMaterial';
import { useSaldoEstoquePorDeposito } from '../../../hooks/useSaldoEstoque';
import { acharSaldoDeposito } from '../../../utils/estoqueServico';
import { saldoAposExcluirEntrada, mensagemSaldoNegativo } from '../../../utils/movimentacoesAlmoxarifado';

interface Props {
  entrada: EntradaMaterial;
  onClose: () => void;
}

export default function ExcluirEntradaDialog({ entrada, onClose }: Props) {
  const excluir = useExcluirEntradaMaterial();
  const qc = useQueryClient();
  const { data: saldos = [] } = useSaldoEstoquePorDeposito(entrada.insumoId);

  const saldoOrig = acharSaldoDeposito(saldos, entrada.depositoMaterialId)?.saldo ?? 0;
  const bloqueio = mensagemSaldoNegativo(saldoAposExcluirEntrada(saldoOrig, entrada.quantidade));

  async function confirmar() {
    await excluir.mutateAsync(entrada.id);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
      qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
    ]);
  }

  if (bloqueio) {
    return (
      <Modal open onClose={onClose} title="Não dá pra excluir esta entrada">
        <p className="text-[var(--color-fg-muted)] mb-5 leading-relaxed">{bloqueio}</p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Entendi</Button>
        </div>
      </Modal>
    );
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirmar}
      title="Excluir entrada de peça"
      message="Tem certeza que deseja excluir esta entrada? O estoque será recalculado."
    />
  );
}
