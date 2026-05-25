-- ROLLBACK da 20260525160000_apont_func_salario_base_required.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Remove o CHECK constraint
-- (linhas com salario_base=0.01 do backfill permanecem — quem ajuda
-- distinguir "placeholder pendente" de "real").

ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check;
