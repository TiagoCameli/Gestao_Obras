/**
 * Helpers para calcular o progresso de recebimento de uma OC.
 *
 * Usados na lista (badge "X/Y") e no drawer de detalhes (linha-a-linha).
 */
import type { OrdemCompra, RecebimentoOC, ItemOrdemCompra } from '../types';

export interface ProgressoRecebimentoOC {
  /** Soma das qtds recebidas em todas as remessas. */
  totalRecebido: number;
  /** Soma das qtds da OC (todos os itens). */
  totalOC: number;
  /** Percentual 0–100. */
  pct: number;
  /** Recebimento já totalmente concluído? */
  completo: boolean;
  /** Houve ao menos 1 remessa registrada? */
  iniciado: boolean;
  /** Qtd recebida por item da OC (chave = item.id). */
  recebidoPorItem: Map<string, number>;
}

/** Calcula o progresso da OC baseado nas remessas registradas. */
export function calcularProgressoOC(
  oc: OrdemCompra,
  recebimentos: RecebimentoOC[]
): ProgressoRecebimentoOC {
  const recebimentosDaOC = recebimentos.filter((r) => r.ordemCompraId === oc.id);
  const recebidoPorItem = new Map<string, number>();
  for (const r of recebimentosDaOC) {
    for (const it of r.itens) {
      recebidoPorItem.set(
        it.itemOrdemCompraId,
        (recebidoPorItem.get(it.itemOrdemCompraId) ?? 0) + it.quantidadeRecebida
      );
    }
  }
  const totalRecebido = [...recebidoPorItem.values()].reduce((s, v) => s + v, 0);
  const totalOC = oc.itens.reduce((s, it) => s + it.quantidade, 0);
  const pct = totalOC === 0 ? 0 : Math.min(100, Math.round((totalRecebido / totalOC) * 100));
  const completo = oc.itens.every((it) => {
    const r = recebidoPorItem.get(it.id) ?? 0;
    return r >= it.quantidade - 0.0001;
  });
  return {
    totalRecebido,
    totalOC,
    pct,
    completo: completo && recebimentosDaOC.length > 0,
    iniciado: recebimentosDaOC.length > 0,
    recebidoPorItem,
  };
}

/** Qtd já recebida de um item específico em todas as remessas. */
export function qtdRecebidaItem(
  itemOC: ItemOrdemCompra,
  recebimentos: RecebimentoOC[],
  ordemCompraId: string
): number {
  return recebimentos
    .filter((r) => r.ordemCompraId === ordemCompraId)
    .reduce((s, r) => {
      const it = r.itens.find((x) => x.itemOrdemCompraId === itemOC.id);
      return s + (it?.quantidadeRecebida ?? 0);
    }, 0);
}
