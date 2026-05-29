-- Rollback — Engenharia backfill de acoes_permitidas por cargo
--
-- Remove TODAS as 17 chaves do grupo Engenharia de acoes_permitidas de todos
-- os usuários. Seguro porque, no estado anterior à migration de backfill,
-- NENHUM usuário possuía qualquer chave de Engenharia (verificado em
-- 2026-05-28). Logo, remover todas restaura o estado original.
--
-- ATENÇÃO: se após o backfill um admin tiver ajustado manualmente as chaves
-- de Engenharia de algum usuário, este rollback também as remove. Use só para
-- reverter o backfill em si.

UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array_agg(k) FROM unnest(acoes_permitidas) AS k
  WHERE k <> ALL (ARRAY[
    'ver_engenharia','criar_engenharia_pasta','editar_engenharia_pasta',
    'excluir_engenharia_pasta','criar_engenharia_nota','editar_engenharia_nota',
    'excluir_engenharia_nota','criar_engenharia_calculo','editar_engenharia_calculo',
    'excluir_engenharia_calculo','upload_engenharia_arquivo','excluir_engenharia_arquivo',
    'ver_lixeira_engenharia','restaurar_lixeira_engenharia','excluir_permanente_engenharia',
    'ver_historico_engenharia','gerenciar_locks_engenharia'
  ])
)
WHERE acoes_permitidas && ARRAY[
  'ver_engenharia','criar_engenharia_pasta','editar_engenharia_pasta',
  'excluir_engenharia_pasta','criar_engenharia_nota','editar_engenharia_nota',
  'excluir_engenharia_nota','criar_engenharia_calculo','editar_engenharia_calculo',
  'excluir_engenharia_calculo','upload_engenharia_arquivo','excluir_engenharia_arquivo',
  'ver_lixeira_engenharia','restaurar_lixeira_engenharia','excluir_permanente_engenharia',
  'ver_historico_engenharia','gerenciar_locks_engenharia'
];
