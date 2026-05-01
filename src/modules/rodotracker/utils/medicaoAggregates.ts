import type { Activity, ContractItem } from "../types/activity";
import { normalizeCode, isAdminLocal, isAggregating, grandTotal, immediateChildren } from "./contractTree";

export type ContribMap = Map<string, Map<number, number>>;

/**
 * Indexa as contribuições (TS + CBUQ) de todas as atividades por código do
 * contrato e por medicaoNumber. Retorna { code → { medicao → qty } }.
 */
export function buildContribsByCodeAndMedicao(activities: Activity[]): ContribMap {
  const byCode: ContribMap = new Map();

  function add(code: string, medicao: number, qty: number) {
    if (!Number.isFinite(qty) || qty <= 0) return;
    const norm = normalizeCode(code);
    let medMap = byCode.get(norm);
    if (!medMap) {
      medMap = new Map();
      byCode.set(norm, medMap);
    }
    medMap.set(medicao, (medMap.get(medicao) ?? 0) + qty);
  }

  for (const a of activities) {
    if (a.trocaSolo?.contributions) {
      const m = a.trocaSolo.medicaoNumber;
      for (const [code, qty] of Object.entries(a.trocaSolo.contributions)) {
        add(code, m, qty);
      }
    }
    if (a.cbuq?.contributions) {
      const m = a.cbuq.medicaoNumber;
      for (const [code, qty] of Object.entries(a.cbuq.contributions)) {
        add(code, m, qty);
      }
    }
    if (a.sinalizacaoVertical?.contributions) {
      const m = a.sinalizacaoVertical.medicaoNumber;
      for (const [code, qty] of Object.entries(a.sinalizacaoVertical.contributions)) {
        add(code, m, qty);
      }
    }
    if (a.conserva?.contributions) {
      const m = a.conserva.medicaoNumber;
      for (const [code, qty] of Object.entries(a.conserva.contributions)) {
        add(code, m, qty);
      }
    }
  }

  return byCode;
}

/** Qty derivada das atividades para um item e medição específicos. */
export function qtyFromActivitiesForMedicao(
  item: ContractItem,
  byCode: ContribMap,
  medicao: number
): number {
  const code = normalizeCode(item.code ?? "");
  return byCode.get(code)?.get(medicao) ?? 0;
}

/** Qty derivada das atividades em TODAS as medições, acumulada. */
export function qtyFromActivitiesAccumulated(
  item: ContractItem,
  byCode: ContribMap
): number {
  const code = normalizeCode(item.code ?? "");
  const medMap = byCode.get(code);
  if (!medMap) return 0;
  let total = 0;
  for (const qty of medMap.values()) total += qty;
  return total;
}

/**
 * Qty de uma medição específica para exibição na coluna "Qtd Nª Medição".
 *
 *  - Itens-folha: soma das atividades com `medicaoNumber === medicao`.
 *  - Admin Local (08.01): percentual dessa medição — soma de R$ medido na
 *    medição `medicao` dos demais itens (atividade ou `currentQty` do
 *    ciclo vigente) dividido pelo total do contrato × 100.
 *  - Agregadores (etapa / subetapa): 0 (a soma sai do itemCurrentValue).
 */
export function itemQtyForMedicao(
  item: ContractItem,
  all: ContractItem[],
  byCode: ContribMap,
  medicao: number,
  currentMedicao: number
): number {
  if (isAggregating(item, all)) return 0;
  if (isAdminLocal(item)) {
    const totalContract = grandTotal(all);
    if (totalContract <= 0) return 0;
    let othersR = 0;
    for (const ci of all) {
      if (isAdminLocal(ci)) continue;
      if (isAggregating(ci, all)) continue;
      const qty = itemQtyForMedicao(ci, all, byCode, medicao, currentMedicao);
      othersR += qty * (ci.unitPrice ?? 0);
    }
    return (othersR / totalContract) * 100;
  }
  // Qty da medição = exclusivamente a soma das atividades cujo
  // `medicaoNumber === medicao`. Não considera `currentQty` legado —
  // esse campo era um rolling acumulado e não pertence a uma medição
  // específica (dava falsos positivos quando se trocava o stepper).
  void currentMedicao;
  return qtyFromActivitiesForMedicao(item, byCode, medicao);
}

/**
 * Qty total acumulada para um item-folha. Para a maioria dos itens é a
 * soma das contribuições em todas as medições (+ `measuredQty` legado).
 * Para o Admin Local (08.01) é a % acumulada derivada dos R$ totais dos
 * demais itens. Agregadores retornam 0 (a soma sai via valor).
 */
export function itemAccumulatedQty(
  item: ContractItem,
  all: ContractItem[],
  byCode: ContribMap
): number {
  if (isAggregating(item, all)) return 0;
  if (isAdminLocal(item)) {
    const totalContract = grandTotal(all);
    if (totalContract <= 0) return 0;
    let othersR = 0;
    for (const ci of all) {
      if (isAdminLocal(ci)) continue;
      if (isAggregating(ci, all)) continue;
      othersR += aggregatedAccumulatedValue(ci, all, byCode);
    }
    return (othersR / totalContract) * 100;
  }
  return qtyFromActivitiesAccumulated(item, byCode) + (item.measuredQty ?? 0);
}

/** R$ medido na medição selecionada, recursivo para agregadores. */
export function aggregatedCurrentValue(
  item: ContractItem,
  all: ContractItem[],
  byCode: ContribMap,
  medicao: number
): number {
  if (isAggregating(item, all)) {
    return immediateChildren(item.code ?? "", all).reduce(
      (sum, child) => sum + aggregatedCurrentValue(child, all, byCode, medicao),
      0
    );
  }
  const qty = itemQtyForMedicao(item, all, byCode, medicao, medicao);
  return qty * (item.unitPrice ?? 0);
}

/** R$ total acumulado (todas medições), recursivo para agregadores. */
export function aggregatedAccumulatedValue(
  item: ContractItem,
  all: ContractItem[],
  byCode: ContribMap
): number {
  if (isAggregating(item, all)) {
    return immediateChildren(item.code ?? "", all).reduce(
      (sum, child) => sum + aggregatedAccumulatedValue(child, all, byCode),
      0
    );
  }
  if (isAdminLocal(item)) {
    const totalContract = grandTotal(all);
    if (totalContract <= 0) return 0;
    let othersR = 0;
    for (const ci of all) {
      if (isAdminLocal(ci)) continue;
      if (isAggregating(ci, all)) continue;
      othersR += aggregatedAccumulatedValue(ci, all, byCode);
    }
    return (othersR / totalContract) * 100 * (item.unitPrice ?? 0);
  }
  const qty = qtyFromActivitiesAccumulated(item, byCode) + (item.measuredQty ?? 0);
  return qty * (item.unitPrice ?? 0);
}
