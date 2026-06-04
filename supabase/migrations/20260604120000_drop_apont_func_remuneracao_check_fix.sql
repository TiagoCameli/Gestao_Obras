-- Salário base volta a ser opcional em apont_funcionarios.
--
-- CONTEXTO: a migration `20260525160000_apont_func_salario_base_required.sql`
-- recriou o CHECK `salario_base IS NOT NULL AND > 0` (fix #9 do audit), mas o
-- form do Apontamento RH foi tornado opcional 3 dias depois
-- (commit 5550f9f, 28/05) sem relaxar o banco. Resultado: cadastrar
-- funcionário sem salário (terceirizado/MEI/diarista) estoura o constraint
-- e o RH não consegue salvar.
--
-- DECISÃO (Tiago, 04/06): salário base é OPCIONAL pra todos os vínculos.
-- Folha não calcula sozinha pra quem ficar sem salário — é aceito.
--
-- Idempotente (DROP CONSTRAINT IF EXISTS). Backfill placeholder R$ 0,01
-- das linhas antigas permanece — não atrapalha (> 0 já não é exigido).
-- Rollback: 20260604120100_drop_apont_func_remuneracao_check_rollback.sql.

ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_remuneracao_check;
