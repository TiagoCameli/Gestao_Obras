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
// HF.13 — Follow-up: usar `invalidateQueries({ refetchType: 'all' })` em vez
//   de `refetchQueries`, e retornar Promise pro `onSuccess` aguardar.
//   `refetchQueries` no React Query v5 só refetcha queries ATIVAS e não
//   marca as inativas como stale — resultado: saldo só atualizava após
//   reload manual quando o observer tinha desmontado. `invalidateQueries`
//   marca stale (próxima montagem refetcha) E com refetchType:'all' força
//   refetch imediato de active + inactive. O `await Promise.all` faz com
//   que `mutateAsync` no caller só resolva depois do cache estar fresco,
//   então o UI fecha modal já com saldos atualizados.

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

export async function invalidateCombustivelCaches(qc: QueryClient): Promise<void> {
  await Promise.all(
    COMBUSTIVEL_QUERY_KEYS.map((key) =>
      qc.invalidateQueries({ queryKey: key, refetchType: 'all' }),
    ),
  );
}
