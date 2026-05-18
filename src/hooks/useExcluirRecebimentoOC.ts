/**
 * useExcluirRecebimentoOC — Exclusão de remessa de recebimento de OC com
 * **validação de saldo** (regra de negócio v2.7).
 *
 * Regra: uma remessa SÓ pode ser excluída se os itens ainda estão no depósito
 * (ou seja, ninguém consumiu / transferiu / abastaceu equipamento). Senão a
 * exclusão deixaria o saldo do depósito/almoxarifado/tanque NEGATIVO — um
 * estado contábil inválido.
 *
 * Como validamos: pra cada item da remessa, consultamos o saldo do depósito
 * SIMULANDO que a entrada associada à remessa não existe (RPC
 * `calcular_estoque_material_na_data` com `p_excluir_id`). Se esse saldo
 * simulado for >= 0, OK. Se for < 0, bloqueia com erro descritivo.
 *
 * Side effects ao confirmar:
 *   1) Deleta EntradaMaterial / EntradaCombustivel associadas (hard delete
 *      — soft delete deixaria o saldo correto por causa do filtro
 *      `deleted_at IS NULL`, mas a auditoria fica mais limpa com hard).
 *   2) Soft-delete a remessa (marca `deletado_em` + `deletado_por`).
 *   3) Se a OC estava `recebida` e agora não tem mais a soma toda, volta
 *      status pra `aprovada`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  calcularEstoqueMaterialNaData,
  calcularEstoqueCombustivelNaData,
} from './useEstoque';
import type {
  RecebimentoOC,
  OrdemCompra,
  Insumo,
} from '../types';

interface ExcluirRecebimentoParams {
  recebimento: RecebimentoOC;
  ordemCompra: OrdemCompra;
  /** Demais remessas da mesma OC (pra decidir se OC volta de 'recebida' pra 'aprovada'). */
  outrasRemessas: RecebimentoOC[];
  /** Catálogo de insumos pra mensagens de erro mais úteis. */
  insumos: Insumo[];
}

export function useExcluirRecebimentoOC() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (params: ExcluirRecebimentoParams) => {
      const { recebimento, ordemCompra, outrasRemessas, insumos } = params;
      const nomeUsuario = usuario?.nome ?? 'sistema';
      const agora = new Date().toISOString();

      // ─── 1) VALIDAÇÃO: saldo simulado pra cada item ─────────────────
      // A ideia é projetar "se eu deletar essa entrada, o saldo do
      // depósito vai pra quanto?". Se < 0, bloqueia.
      for (const item of recebimento.itens) {
        const itemOC = ordemCompra.itens.find((i) => i.id === item.itemOrdemCompraId);
        const descricao = itemOC?.descricao || item.id;

        if (item.entradaMaterialId && item.depositoDestinoId && itemOC?.insumoId) {
          const saldoSimulado = await calcularEstoqueMaterialNaData(
            item.depositoDestinoId,
            itemOC.insumoId,
            agora,
            item.entradaMaterialId, // exclui essa entrada da soma
          );
          if (saldoSimulado < 0) {
            const insumo = insumos.find((i) => i.id === itemOC.insumoId);
            throw new Error(
              `Não dá pra excluir esta remessa: o item "${insumo?.nome || descricao}" já foi parcialmente consumido. ` +
                `Se a remessa fosse removida, o saldo do depósito ficaria negativo (${saldoSimulado.toFixed(2)}). ` +
                `Reverta as saídas/transferências primeiro.`,
            );
          }
        }

        if (item.entradaCombustivelId && item.depositoDestinoId) {
          const saldoSimulado = await calcularEstoqueCombustivelNaData(
            item.depositoDestinoId,
            agora,
            item.entradaCombustivelId,
          );
          if (saldoSimulado < 0) {
            throw new Error(
              `Não dá pra excluir esta remessa: o combustível em "${descricao}" já foi parcialmente usado. ` +
                `Saldo do tanque ficaria ${saldoSimulado.toFixed(2)} L. ` +
                `Reverta as saídas/transferências primeiro.`,
            );
          }
        }
      }

      // ─── 2) Deletar as entradas (hard) — só após validação OK ───────
      for (const item of recebimento.itens) {
        if (item.entradaMaterialId) {
          const { error } = await supabase
            .from('entradas_material')
            .delete()
            .eq('id', item.entradaMaterialId);
          if (error) throw new Error(`Falha ao excluir entrada de material: ${error.message}`);
        }
        if (item.entradaCombustivelId) {
          // Combustível usa soft delete (padrão da tabela)
          const { error } = await supabase
            .from('entradas_combustivel')
            .update({
              deleted_at: agora,
              deleted_by: nomeUsuario,
            })
            .eq('id', item.entradaCombustivelId);
          if (error) throw new Error(`Falha ao excluir entrada de combustível: ${error.message}`);
        }
      }

      // ─── 3) Soft-delete a remessa ───────────────────────────────────
      const { error: errRec } = await supabase
        .from('recebimentos_oc')
        .update({
          deletado_em: agora,
          deletado_por: nomeUsuario,
        })
        .eq('id', recebimento.id);
      if (errRec) throw new Error(`Falha ao excluir recebimento: ${errRec.message}`);

      // ─── 4) Status da OC: se estava 'recebida' e agora falta qtd,
      //         volta pra 'aprovada' (auditoria limpa). ────────────────
      if (ordemCompra.status === 'recebida') {
        const recebidoPorItem = new Map<string, number>();
        for (const r of outrasRemessas) {
          for (const it of r.itens) {
            recebidoPorItem.set(
              it.itemOrdemCompraId,
              (recebidoPorItem.get(it.itemOrdemCompraId) ?? 0) + it.quantidadeRecebida,
            );
          }
        }
        const aindaCompleto = ordemCompra.itens.every((itemOC) => {
          const recebido = recebidoPorItem.get(itemOC.id) ?? 0;
          return recebido >= itemOC.quantidade - 0.0001;
        });
        if (!aindaCompleto) {
          const { error: errOC } = await supabase
            .from('ordens_compra')
            .update({
              status: 'aprovada',
              recebida_por: null,
              recebida_em: null,
              atualizado_em: agora,
              atualizado_por: nomeUsuario,
            })
            .eq('id', ordemCompra.id);
          if (errOC) throw new Error(`Falha ao reverter status da OC: ${errOC.message}`);
        }
      }

      return { ok: true };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recebimentos_oc'] });
      qc.invalidateQueries({ queryKey: ['recebimentos_oc', 'oc', vars.ordemCompra.id] });
      qc.invalidateQueries({ queryKey: ['ordens_compra'] });
      qc.invalidateQueries({ queryKey: ['entradas_material'] });
      qc.invalidateQueries({ queryKey: ['entradas_combustivel'] });
      qc.invalidateQueries({ queryKey: ['depositos'] });
    },
  });
}
