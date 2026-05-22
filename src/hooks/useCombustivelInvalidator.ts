// HF.12 — Invalidator centralizado pras 4 entidades de combustível.
//
// Motivação: cada mutation (add/update/delete/restore) em entradas, saídas,
// transferências ou esvaziamentos altera `depositos.nivel_atual_litros` via
// trigger no DB. Pra UI refletir, todas as queries cacheadas que dependem
// desses saldos precisam ser invalidadas/refetchadas — não só a tabela
// mutada.
//
// Bugs corrigidos:
//   #4 — useSaidasCombustivel esquecera ['depositos'] no INVALIDATE_KEYS:
//        editar uma saída não refrescava o saldo do tanque.
//   #5 — Cross-entity: editar uma entrada deveria também invalidar caches
//        de saídas/transferências que mostram saldo derivado (point-in-time).
//
// Estratégia: `refetchQueries` (não `invalidateQueries`) pra forçar refetch
// IMEDIATO, evitando dependência do staleTime/observer da query.

import type { QueryClient } from '@tanstack/react-query';

const COMBUSTIVEL_QUERY_KEYS: readonly (readonly string[])[] = [
  ['depositos'],
  ['entradas_combustivel'],
  ['saidas_combustivel'],
  ['transferencias_combustivel'],
  ['esvaziamentos_tanque'],
  ['transportadora_movimentos'],
  ['transportadora_saldos'],
  ['abastecimentos'],
  ['abastecimentos_carreta'],
];

export function invalidateCombustivelCaches(qc: QueryClient): void {
  for (const key of COMBUSTIVEL_QUERY_KEYS) {
    qc.refetchQueries({ queryKey: key });
  }
}
