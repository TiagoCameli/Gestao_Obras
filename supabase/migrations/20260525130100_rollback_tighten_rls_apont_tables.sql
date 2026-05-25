-- ROLLBACK da 20260525130000_tighten_rls_apont_tables.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Restaura as policies blanket
-- `FOR ALL TO authenticated USING(true)` (que reabrem TODAS as tabelas RH
-- pra qualquer login). Mantida no histórico do repo só pra emergência.

-- 1) apont_registros_ponto
DROP POLICY IF EXISTS apont_registros_ponto_select ON public.apont_registros_ponto;
DROP POLICY IF EXISTS apont_registros_ponto_insert ON public.apont_registros_ponto;
DROP POLICY IF EXISTS apont_registros_ponto_update ON public.apont_registros_ponto;
DROP POLICY IF EXISTS apont_registros_ponto_delete ON public.apont_registros_ponto;
CREATE POLICY apont_registros_ponto_authed
  ON public.apont_registros_ponto FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2) apont_ausencias
DROP POLICY IF EXISTS apont_ausencias_select ON public.apont_ausencias;
DROP POLICY IF EXISTS apont_ausencias_insert ON public.apont_ausencias;
DROP POLICY IF EXISTS apont_ausencias_update ON public.apont_ausencias;
DROP POLICY IF EXISTS apont_ausencias_delete ON public.apont_ausencias;
CREATE POLICY apont_ausencias_authed
  ON public.apont_ausencias FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 3) apont_equipes
DROP POLICY IF EXISTS apont_equipes_select ON public.apont_equipes;
DROP POLICY IF EXISTS apont_equipes_insert ON public.apont_equipes;
DROP POLICY IF EXISTS apont_equipes_update ON public.apont_equipes;
DROP POLICY IF EXISTS apont_equipes_delete ON public.apont_equipes;
CREATE POLICY apont_equipes_authed
  ON public.apont_equipes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4) apont_equipe_obras
DROP POLICY IF EXISTS apont_equipe_obras_select ON public.apont_equipe_obras;
DROP POLICY IF EXISTS apont_equipe_obras_insert ON public.apont_equipe_obras;
DROP POLICY IF EXISTS apont_equipe_obras_update ON public.apont_equipe_obras;
DROP POLICY IF EXISTS apont_equipe_obras_delete ON public.apont_equipe_obras;
CREATE POLICY "Authenticated full access"
  ON public.apont_equipe_obras FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 5) apont_aprovacao_funcionario_dia
DROP POLICY IF EXISTS apont_aprov_func_dia_select ON public.apont_aprovacao_funcionario_dia;
DROP POLICY IF EXISTS apont_aprov_func_dia_insert ON public.apont_aprovacao_funcionario_dia;
DROP POLICY IF EXISTS apont_aprov_func_dia_update ON public.apont_aprovacao_funcionario_dia;
DROP POLICY IF EXISTS apont_aprov_func_dia_delete ON public.apont_aprovacao_funcionario_dia;
CREATE POLICY "Authenticated full access"
  ON public.apont_aprovacao_funcionario_dia FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 6) apont_aprovacoes_ponto_dia
DROP POLICY IF EXISTS apont_aprov_ponto_dia_select ON public.apont_aprovacoes_ponto_dia;
DROP POLICY IF EXISTS apont_aprov_ponto_dia_insert ON public.apont_aprovacoes_ponto_dia;
DROP POLICY IF EXISTS apont_aprov_ponto_dia_update ON public.apont_aprovacoes_ponto_dia;
DROP POLICY IF EXISTS apont_aprov_ponto_dia_delete ON public.apont_aprovacoes_ponto_dia;
CREATE POLICY apont_aprovacoes_ponto_dia_authed
  ON public.apont_aprovacoes_ponto_dia FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 7) apontamentos
DROP POLICY IF EXISTS apontamentos_legacy_select ON public.apontamentos;
DROP POLICY IF EXISTS apontamentos_legacy_insert ON public.apontamentos;
DROP POLICY IF EXISTS apontamentos_legacy_update ON public.apontamentos;
DROP POLICY IF EXISTS apontamentos_legacy_delete ON public.apontamentos;
CREATE POLICY "Authenticated full access"
  ON public.apontamentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 8) apont_apontamentos_servico — re-cria a blanket pra restaurar o estado pré-fix
CREATE POLICY apont_apontamentos_servico_authed
  ON public.apont_apontamentos_servico FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
