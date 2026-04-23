import type { Activity, ContractItem } from "../types/activity";
import { isAdminLocal } from "./contractTree";

/**
 * Recalcula `currentQty` de cada item do contrato a partir da união das
 * contribuições de TODAS as atividades (Troca de Solo + CBUQ). Útil para
 * corrigir drift histórico — por exemplo, quando um bug causou aplicação
 * em duplicata ou rollback inconsistente.
 *
 * Preserva `measuredQty` (acumulado de medições passadas), já que ele
 * só é atualizado ao fechar a medição, não em cada save de atividade.
 */
export function reconcileCurrentQty(
  items: ContractItem[],
  activities: Activity[]
): ContractItem[] {
  const totals = new Map<string, number>();
  for (const a of activities) {
    for (const map of [a.trocaSolo?.contributions, a.cbuq?.contributions]) {
      if (!map) continue;
      for (const [code, qty] of Object.entries(map)) {
        if (!Number.isFinite(qty) || qty <= 0) continue;
        totals.set(code, (totals.get(code) ?? 0) + qty);
      }
    }
  }

  const now = Date.now();
  return items.map((ci) => {
    // Admin Local (08.01) é derivado — nunca recebe contribuição direta.
    if (isAdminLocal(ci)) return ci;
    const code = ci.code ?? "";
    if (!code) return ci;
    const target = totals.get(code);
    if (target == null) {
      return ci;
    }
    const current = ci.currentQty ?? 0;
    if (Math.abs(current - target) < 1e-9) return ci;
    return { ...ci, currentQty: target, updatedAt: now };
  });
}
