import type { ContractItem } from "../types/activity";

export type NodeLevel = "etapa" | "subetapa" | "item" | "subitem";

/** Returns 1-based depth of a code (e.g. "1"→1, "1.1"→2, "1.1.3"→3). */
export function codeDepth(code: string | undefined | null): number {
  if (!code) return 0;
  const parts = code.trim().split(".").filter((p) => p.trim() !== "");
  return parts.length || 1;
}

/** Normalize "02.01" → "2.1" so zero-padded codes still match their parents. */
export function normalizeCode(code: string | undefined | null): string {
  if (!code) return "";
  return code
    .trim()
    .split(".")
    .filter((p) => p.trim() !== "")
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) ? String(n) : p.trim();
    })
    .join(".");
}

/** Map depth to display level label. 1=etapa, 2=item, >=3=subitem. */
export function levelFromDepth(depth: number): NodeLevel {
  if (depth <= 1) return "etapa";
  if (depth === 2) return "item";
  return "subitem";
}

export function getLevel(item: ContractItem): NodeLevel {
  // Explicit type wins over any code-depth guessing.
  if (item.type === "etapa") return "etapa";
  if (item.type === "subetapa") return "subetapa";
  if (item.type === "item") return "item";
  return levelFromDepth(codeDepth(item.code));
}

/**
 * Whether the row should aggregate from its code-children.
 *  - "etapa" / "subetapa" → always aggregators
 *  - "item"               → always a leaf
 *  - no explicit type     → fall back to code structure (non-leaf = aggregator)
 */
export function isAggregating(item: ContractItem, all: ContractItem[]): boolean {
  if (item.type === "item") return false;
  if (item.type === "etapa" || item.type === "subetapa") return true;
  return !isLeaf(item, all);
}

/** True if `childCode` is an immediate or nested descendant of `parentCode`. */
export function isDescendant(parentCode: string, childCode: string): boolean {
  if (!parentCode || !childCode) return false;
  const p = normalizeCode(parentCode);
  const c = normalizeCode(childCode);
  if (!p || !c) return false;
  return c.startsWith(p + ".");
}

/** True if the item has no descendant (is a leaf — eligible to hold its own qty/price). */
export function isLeaf(item: ContractItem, all: ContractItem[]): boolean {
  if (!item.code) return true;
  return !all.some((i) => i !== item && isDescendant(item.code!, i.code ?? ""));
}

/** Immediate children of a code (one level deeper). */
export function immediateChildren(parentCode: string, all: ContractItem[]): ContractItem[] {
  if (!parentCode) return [];
  const pNorm = normalizeCode(parentCode);
  if (!pNorm) return [];
  const prefix = pNorm + ".";
  return all.filter((i) => {
    const c = normalizeCode(i.code);
    if (!c.startsWith(prefix)) return false;
    const rest = c.slice(prefix.length);
    return !rest.includes(".");
  });
}

/**
 * Returns true when the node provides its own explicit value
 * (contractedQty × unitPrice > 0). Only meaningful for leaves — for nodes
 * with descendants, the aggregated children sum always wins.
 */
export function hasOwnValue(item: ContractItem): boolean {
  return (item.contractedQty || 0) * (item.unitPrice || 0) > 0;
}

/**
 * Total rules (SICRO / DNIT convention):
 *  - Every row contributes its OWN value (qty × price) plus the sum of its
 *    immediate children's totals — children are typically cost breakdowns
 *    that must be added to the parent, not replace it.
 *  - Etapas / subetapas have no own value (forced to 0), so their total is
 *    purely the aggregate of descendants.
 *  - A leaf item has 0 children, so total = own value.
 */
export function itemTotal(item: ContractItem, all: ContractItem[]): number {
  const own = isAggregating(item, all)
    ? 0
    : (item.contractedQty || 0) * (item.unitPrice || 0);
  const childrenSum = immediateChildren(item.code ?? "", all).reduce(
    (sum, child) => sum + itemTotal(child, all),
    0
  );
  return own + childrenSum;
}

/**
 * Grand total: sum of root rows (no ancestor in the set). Since each root's
 * itemTotal already includes all its descendants, this gives the full contract
 * without any double counting.
 */
export function grandTotal(all: ContractItem[]): number {
  return rootsOf(all).reduce((sum, r) => sum + itemTotal(r, all), 0);
}

/* ─── Measurement (medição) values ────────────────────────────────────── */

/** Código do Admin Local — item cuja qtd é computada automaticamente. */
export const ADMIN_LOCAL_CODE = "8.1";

export function isAdminLocal(item: ContractItem): boolean {
  return normalizeCode(item.code ?? "") === ADMIN_LOCAL_CODE;
}

/**
 * Quantidade da medição atual. Para a maioria dos itens é o campo
 * `currentQty` armazenado. Para o Admin Local (08.01) é computado
 * dinamicamente:
 *   (R$ medido na medição atual dos outros itens) / (R$ total do contrato) × 100
 *
 * Resultado: o próprio "percentual da medição", que multiplicado pelo valor
 * unitário do Admin Local gera o valor em R$ a ser faturado nesse ciclo.
 */
export function itemCurrentQty(item: ContractItem, all: ContractItem[]): number {
  if (isAdminLocal(item)) {
    const totalContract = grandTotal(all);
    if (totalContract <= 0) return 0;
    let othersCurrent = 0;
    for (const ci of all) {
      if (isAdminLocal(ci)) continue;
      if (isAggregating(ci, all)) continue;
      othersCurrent += (ci.currentQty ?? 0) * (ci.unitPrice ?? 0);
    }
    return (othersCurrent / totalContract) * 100;
  }
  return item.currentQty ?? 0;
}

/** Value executed in the current measurement period (qty × unitPrice, recursive). */
export function itemCurrentValue(item: ContractItem, all: ContractItem[]): number {
  const own = isAggregating(item, all)
    ? 0
    : itemCurrentQty(item, all) * (item.unitPrice || 0);
  const childrenSum = immediateChildren(item.code ?? "", all).reduce(
    (sum, child) => sum + itemCurrentValue(child, all),
    0
  );
  return own + childrenSum;
}

/**
 * Quantidade acumulada medida = medições anteriores (`measuredQty`) +
 * medição corrente (`currentQty`). A Qtd Total é sempre a soma de todas
 * medições acumuladas, inclusive a vigente.
 *
 * Para o Admin Local (08.01) a Qtd Total também é calculada: reflete o
 * percentual acumulado de execução do contrato (medido + vigente dos
 * outros itens, dividido pelo total do contrato, vezes 100).
 */
export function itemTotalMeasuredQty(item: ContractItem, all?: ContractItem[]): number {
  if (all && isAdminLocal(item)) {
    const totalContract = grandTotal(all);
    if (totalContract <= 0) return 0;
    let othersAccum = 0;
    for (const ci of all) {
      if (isAdminLocal(ci)) continue;
      if (isAggregating(ci, all)) continue;
      const qty = (ci.currentQty ?? 0) + (ci.measuredQty ?? 0);
      othersAccum += qty * (ci.unitPrice ?? 0);
    }
    return (othersAccum / totalContract) * 100;
  }
  return (item.measuredQty ?? 0) + (item.currentQty ?? 0);
}

/** Value executed in total (accumulated measured qty × unitPrice, recursive). */
export function itemMeasuredValue(item: ContractItem, all: ContractItem[]): number {
  const own = isAggregating(item, all)
    ? 0
    : itemTotalMeasuredQty(item, all) * (item.unitPrice || 0);
  const childrenSum = immediateChildren(item.code ?? "", all).reduce(
    (sum, child) => sum + itemMeasuredValue(child, all),
    0
  );
  return own + childrenSum;
}

export function grandCurrentValue(all: ContractItem[]): number {
  return rootsOf(all).reduce((sum, r) => sum + itemCurrentValue(r, all), 0);
}

export function grandMeasuredValue(all: ContractItem[]): number {
  return rootsOf(all).reduce((sum, r) => sum + itemMeasuredValue(r, all), 0);
}

function rootsOf(all: ContractItem[]): ContractItem[] {
  return all.filter((i) => {
    const code = i.code ?? "";
    if (!code) return true;
    return !all.some((j) => j !== i && isDescendant(j.code ?? "", code));
  });
}

/**
 * Natural-sort items by their dotted code (e.g. "1" < "1.1" < "1.1.1" < "1.2" < "2").
 * Items without a code fall to the end preserving their insertion order.
 */
export function sortByCode(items: ContractItem[]): ContractItem[] {
  return [...items]
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const ca = (a.item.code ?? "").trim();
      const cb = (b.item.code ?? "").trim();
      if (!ca && !cb) return a.idx - b.idx;
      if (!ca) return 1;
      if (!cb) return -1;
      const pa = ca.split(".").map((s) => parseInt(s, 10));
      const pb = cb.split(".").map((s) => parseInt(s, 10));
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const da = Number.isFinite(pa[i]) ? pa[i] : -1;
        const db = Number.isFinite(pb[i]) ? pb[i] : -1;
        if (da !== db) return da - db;
      }
      return a.idx - b.idx;
    })
    .map((w) => w.item);
}
