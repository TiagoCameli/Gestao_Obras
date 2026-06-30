-- Remover módulo Engenharia (decisão Tiago, 2026-06-30).
-- O módulo inteiro sai do app. O frontend (src/modules/engenharia, rotas no
-- App.tsx, link no Header, as 20 chaves de ação em src/utils/permissions.ts e
-- os testes) já foi removido no mesmo commit. Esta migration derruba os
-- objetos de banco do módulo:
--   - 3 triggers no public.obras (criavam/renomeavam/arquivavam a pasta raiz);
--   - 9 tabelas engenharia_* (RLS, índices, FKs e o trigger de ciclo caem via CASCADE);
--   - 9 funções (locks, salvar-com-versão, triggers de obra, check de ciclo);
--   - 4 policies de Storage do bucket engenharia-arquivos (o bucket em si,
--     vazio, é removido via Storage API fora desta migration);
--   - as chaves de engenharia gravadas em funcionarios.acoes_permitidas
--     (5 funcionários, 28 chaves na data da remoção).
--
-- ATENÇÃO: destrutivo quanto a DADOS. No momento da remoção o módulo só tinha
-- conteúdo de teste (2 cálculos, 2 pranchas, 6 pastas, 0 notas, 0 arquivos).
-- O rollback recria a ESTRUTURA, não restaura conteúdo.

BEGIN;

-- 1. Triggers no obras
DROP TRIGGER IF EXISTS trg_engenharia_after_insert_obra ON public.obras;
DROP TRIGGER IF EXISTS trg_engenharia_after_update_obra_nome ON public.obras;
DROP TRIGGER IF EXISTS trg_engenharia_before_delete_obra ON public.obras;

-- 2. Tabelas (CASCADE leva RLS policies, índices, FKs e triggers próprios)
DROP TABLE IF EXISTS public.engenharia_arquivos CASCADE;
DROP TABLE IF EXISTS public.engenharia_calculos_versoes CASCADE;
DROP TABLE IF EXISTS public.engenharia_calculos CASCADE;
DROP TABLE IF EXISTS public.engenharia_notas_versoes CASCADE;
DROP TABLE IF EXISTS public.engenharia_notas CASCADE;
DROP TABLE IF EXISTS public.engenharia_pranchas_versoes CASCADE;
DROP TABLE IF EXISTS public.engenharia_pranchas CASCADE;
DROP TABLE IF EXISTS public.engenharia_locks CASCADE;
DROP TABLE IF EXISTS public.engenharia_pastas CASCADE;

-- 3. Funções
DROP FUNCTION IF EXISTS public.engenharia_after_insert_obra() CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_after_update_obra_nome() CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_before_delete_obra() CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_pastas_check_no_cycle() CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_acquire_lock(text, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_release_lock(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, integer) CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, integer) CASCADE;

-- 4. Storage: dropa as 4 policies do bucket. O bucket engenharia-arquivos em si
--    (vazio, 0 objetos) é removido FORA daqui via Storage API — o Postgres
--    bloqueia DELETE direto em storage.objects/storage.buckets (protect_delete).
DROP POLICY IF EXISTS engenharia_arquivos_storage_select ON storage.objects;
DROP POLICY IF EXISTS engenharia_arquivos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS engenharia_arquivos_storage_update ON storage.objects;
DROP POLICY IF EXISTS engenharia_arquivos_storage_delete ON storage.objects;

-- 5. Limpa as chaves de engenharia gravadas nos usuários.
--    Nenhuma chave não-engenharia contém a substring 'engenharia', então o
--    filtro é exato. Linhas sem chave de engenharia não são tocadas.
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT coalesce(array_agg(x), '{}'::text[])
  FROM unnest(acoes_permitidas) AS x
  WHERE x NOT LIKE '%engenharia%'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(acoes_permitidas) AS y WHERE y LIKE '%engenharia%'
);

COMMIT;
