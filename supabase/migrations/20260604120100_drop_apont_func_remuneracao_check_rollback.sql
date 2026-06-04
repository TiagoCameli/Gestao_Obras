-- ROLLBACK da 20260604120000_drop_apont_func_remuneracao_check_fix.sql.
--
-- ⚠️  Só aplique se quiser voltar a EXIGIR salário base > 0 no banco.
-- Antes de aplicar, garanta que não há linha com salario_base NULL
-- (senão o ADD CONSTRAINT falha). Backfill se necessário:
--   UPDATE public.apont_funcionarios SET salario_base = 0.01
--    WHERE salario_base IS NULL;

ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check;
ALTER TABLE public.apont_funcionarios
  ADD CONSTRAINT apont_func_remuneracao_check
  CHECK (salario_base IS NOT NULL AND salario_base > 0);
