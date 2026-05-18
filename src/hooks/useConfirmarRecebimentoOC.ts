/**
 * useConfirmarRecebimentoOC — Orquestrador de recebimento de OC.
 *
 * Esse é o hook "transacional" (lógico — Supabase JS não tem transação multi-
 * statement, então fazemos best-effort com rollback manual em caso de falha)
 * que faz TODO o trabalho de confirmar uma remessa:
 *
 *   1) Persiste o RecebimentoOC (header + itens em JSONB)
 *   2) Pra cada item do recebimento que tem depósito/tanque resolvido:
 *        - Combustível → cria EntradaCombustivel (atualiza nivelAtualLitros
 *          do tanque via trigger PostgreSQL)
 *        - Material/peça → cria EntradaMaterial (estoque calculado por
 *          trigger no banco)
 *        - Serviço → não gera entrada (não estoca)
 *   3) Volta nos itens do recebimento e atualiza entradaMaterialId /
 *      entradaCombustivelId com os IDs gerados (rastreabilidade)
 *   4) Calcula quantidade total já recebida (todas as remessas anteriores +
 *      essa). Se >= total da OC, marca OC como 'recebida' + recebida_por/em.
 *
 * Permissão: "quem tiver a permissão ativa" — controlada upstream pelo
 * Compras.tsx via `pode(p, 'recebimento.executar')` ou similar.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  recebimentoOCToDb,
  entradaMaterialToDb,
  entradaCombustivelToDb,
} from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type {
  RecebimentoOC,
  ItemRecebimentoOC,
  OrdemCompra,
  EntradaMaterial,
  EntradaCombustivel,
  Insumo,
  Deposito,
  Fornecedor,
} from '../types';

interface ConfirmarRecebimentoParams {
  /** Recebimento a confirmar (já preenchido pelo drawer). */
  recebimento: RecebimentoOC;
  /** OC origem (precisamos pra herdar fornecedor, obra, número de NF, etc.). */
  ordemCompra: OrdemCompra;
  /** Lista TOTAL de recebimentos anteriores dessa OC (pra decidir se vai pra
   *  'recebida' ou continua 'aprovada'). NÃO inclui o atual sendo confirmado. */
  recebimentosAnteriores: RecebimentoOC[];
  /** Catálogo de insumos pra resolver tipo (combustível ou material). */
  insumos: Insumo[];
  /** Tanques (pra resolver tipo combustível). */
  tanques?: Deposito[];
  /** Fornecedores (não usado diretamente, mas mantido pra compat futura). */
  fornecedores?: Fornecedor[];
}

/**
 * Confirma um recebimento de OC. Retorna o recebimento gravado já com os
 * IDs das entradas associadas, e o novo status da OC.
 */
export function useConfirmarRecebimentoOC() {
  const qc = useQueryClient();
  const { usuario } = useAuth();

  return useMutation({
    mutationFn: async (params: ConfirmarRecebimentoParams) => {
      const { recebimento, ordemCompra, recebimentosAnteriores, insumos, tanques } = params;
      const nomeUsuario = usuario?.nome ?? 'sistema';
      const agora = new Date().toISOString();

      // ─── 1) Persiste header do recebimento (sem entradaIds ainda) ───
      const recebimentoInicial: RecebimentoOC = {
        ...recebimento,
        recebidoPor: nomeUsuario,
        recebidoEm: agora,
      };
      const { error: errRec } = await supabase
        .from('recebimentos_oc')
        .insert(recebimentoOCToDb(recebimentoInicial));
      if (errRec) throw new Error(`Falha ao salvar recebimento: ${errRec.message}`);

      // ─── 2) Pra cada item, gera EntradaMaterial ou EntradaCombustivel ───
      const itensAtualizados: ItemRecebimentoOC[] = [];

      for (const itemRec of recebimento.itens) {
        // Recupera dados do item original da OC (descrição, preço, insumo)
        const itemOC = ordemCompra.itens.find((i) => i.id === itemRec.itemOrdemCompraId);
        if (!itemOC) {
          itensAtualizados.push(itemRec);
          continue;
        }

        // Serviço não gera entrada (não estoca)
        const tipo = itemOC.tipo ?? 'material';
        if (tipo === 'servico') {
          itensAtualizados.push(itemRec);
          continue;
        }

        // Sem destino resolvido → não gera entrada (ficou pra futuro)
        if (!itemRec.depositoDestinoId) {
          itensAtualizados.push(itemRec);
          continue;
        }

        // Detecta se é combustível: ou pelo tipo do destino (tanque) ou
        // pelo tipo do insumo
        const ehDestinoTanque = itemOC.tipoDestino === 'tanque_combustivel'
          || (tanques?.some((t) => t.id === itemRec.depositoDestinoId) ?? false);
        const insumo = itemOC.insumoId ? insumos.find((i) => i.id === itemOC.insumoId) : undefined;
        const ehCombustivel = ehDestinoTanque
          || (insumo?.tipo || '').toLowerCase().includes('combust');

        // Calcula valor unitário e total proporcional à qtd recebida
        const precoUnit = itemOC.precoUnitario || 0;
        const valorTotalItem = precoUnit * itemRec.quantidadeRecebida;

        if (ehCombustivel) {
          // ─── EntradaCombustivel ───────────────────────────────────────
          const entradaComb: EntradaCombustivel = {
            id: `ecomb_${crypto.randomUUID()}`,
            dataHora: recebimento.dataRecebimento,
            depositoId: itemRec.depositoDestinoId,
            tipoCombustivel: insumo?.nome || itemOC.descricao,
            quantidadeLitros: itemRec.quantidadeRecebida,
            valorTotal: valorTotalItem,
            fornecedor: ordemCompra.fornecedorId,
            notaFiscal: recebimento.notaFiscalEntrega || ordemCompra.numero,
            observacoes: `OC ${ordemCompra.numero} · remessa ${recebimento.numeroRemessa}${itemRec.observacoes ? ' · ' + itemRec.observacoes : ''}`,
            criadoPor: nomeUsuario,
          };
          const { error: errEC } = await supabase
            .from('entradas_combustivel')
            .insert(entradaCombustivelToDb(entradaComb));
          if (errEC) {
            // Rollback parcial: deleta recebimento e levanta erro
            await supabase.from('recebimentos_oc').delete().eq('id', recebimento.id);
            throw new Error(`Falha ao criar entrada de combustível: ${errEC.message}`);
          }
          itensAtualizados.push({ ...itemRec, entradaCombustivelId: entradaComb.id });
        } else {
          // ─── EntradaMaterial (peça ou material) ───────────────────────
          if (!itemOC.insumoId) {
            // Material sem insumoId não pode entrar — pula
            itensAtualizados.push(itemRec);
            continue;
          }
          const entradaMat: EntradaMaterial = {
            id: `emat_${crypto.randomUUID()}`,
            dataHora: recebimento.dataRecebimento,
            depositoMaterialId: itemRec.depositoDestinoId,
            insumoId: itemOC.insumoId,
            obraId: itemOC.obraId || ordemCompra.obraId || '',
            quantidade: itemRec.quantidadeRecebida,
            valorUnitario: precoUnit,
            valorTotal: valorTotalItem,
            fornecedorId: ordemCompra.fornecedorId,
            notaFiscal: recebimento.notaFiscalEntrega || ordemCompra.numero,
            observacoes: `OC ${ordemCompra.numero} · remessa ${recebimento.numeroRemessa}${itemRec.observacoes ? ' · ' + itemRec.observacoes : ''}`,
            criadoPor: nomeUsuario,
          };
          const { error: errEM } = await supabase
            .from('entradas_material')
            .insert(entradaMaterialToDb(entradaMat));
          if (errEM) {
            await supabase.from('recebimentos_oc').delete().eq('id', recebimento.id);
            throw new Error(`Falha ao criar entrada de material: ${errEM.message}`);
          }
          itensAtualizados.push({ ...itemRec, entradaMaterialId: entradaMat.id });
        }
      }

      // ─── 3) Update do recebimento com IDs das entradas ──────────────
      const recebimentoCompleto: RecebimentoOC = {
        ...recebimentoInicial,
        itens: itensAtualizados,
      };
      const { error: errUpd } = await supabase
        .from('recebimentos_oc')
        .update({ itens: itensAtualizados })
        .eq('id', recebimento.id);
      if (errUpd) throw new Error(`Falha ao atualizar recebimento com IDs: ${errUpd.message}`);

      // ─── 4) Decide se OC vai pra 'recebida' ─────────────────────────
      // Soma qtd recebida em TODAS as remessas (anteriores + atual) por item
      const totalRecebidoPorItem = new Map<string, number>();
      for (const r of recebimentosAnteriores) {
        for (const it of r.itens) {
          totalRecebidoPorItem.set(
            it.itemOrdemCompraId,
            (totalRecebidoPorItem.get(it.itemOrdemCompraId) ?? 0) + it.quantidadeRecebida
          );
        }
      }
      for (const it of recebimento.itens) {
        totalRecebidoPorItem.set(
          it.itemOrdemCompraId,
          (totalRecebidoPorItem.get(it.itemOrdemCompraId) ?? 0) + it.quantidadeRecebida
        );
      }

      // Tudo recebido? Compara cada item da OC com a soma das remessas
      const tudoRecebido = ordemCompra.itens.every((itemOC) => {
        const recebido = totalRecebidoPorItem.get(itemOC.id) ?? 0;
        return recebido >= itemOC.quantidade - 0.0001; // tolerância float
      });

      let novoStatus = ordemCompra.status;
      if (tudoRecebido && ordemCompra.status !== 'recebida') {
        novoStatus = 'recebida';
        const { error: errOC } = await supabase
          .from('ordens_compra')
          .update({
            status: 'recebida',
            recebida_por: nomeUsuario,
            recebida_em: agora,
            atualizado_em: agora,
            atualizado_por: nomeUsuario,
            entrada_gerada: true,
          })
          .eq('id', ordemCompra.id);
        if (errOC) throw new Error(`Falha ao atualizar status da OC: ${errOC.message}`);
      }

      return {
        recebimento: recebimentoCompleto,
        novoStatusOC: novoStatus,
        tudoRecebido,
      };
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
