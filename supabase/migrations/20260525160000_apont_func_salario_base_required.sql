-- Salário base obrigatório em apont_funcionarios.
--
-- ANTES: migration `20260425130000_apont_func_salario_base_required.sql` criou
--        o CHECK `salario_base IS NOT NULL AND > 0`, mas `20260429000200_seed_funcionarios.sql:14`
--        droppou (`DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check`).
--        Resultado: 70/71 funcionários com `salario_base IS NULL`, folha não calcula.
--
-- DEPOIS:
--   1) Backfill placeholder R$ 0,01 em todas as linhas NULL — força RH a corrigir,
--      mas não trava INSERT até o ajuste manual. Trigger de audit (#16) captura
--      cada UPDATE futuro de salario_base.
--   2) Recria o CHECK `apont_func_remuneracao_check`.
--   3) UI passa a exigir o campo (FuncionarioForm.tsx).
--
-- Fix #9 do apontamento-rh-audit.md.
-- Rollback: 20260525160100_rollback_apont_func_salario_base_required.sql.

-- 1) Backfill placeholder (R$ 0,01) — sinaliza "valor pendente revisão"
UPDATE public.apont_funcionarios
   SET salario_base = 0.01
 WHERE salario_base IS NULL;

-- 2) Recria CHECK constraint
ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check;
ALTER TABLE public.apont_funcionarios
  ADD CONSTRAINT apont_func_remuneracao_check
  CHECK (salario_base IS NOT NULL AND salario_base > 0);
