-- ═══════════════════════════════════════════════════════════════════════════
-- Apontamento — todos os vínculos passam a usar salário base.
-- Substitui o constraint condicional anterior (CLT/diarista/MEI) por um
-- constraint único: salario_base obrigatório e > 0 para qualquer vínculo.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.apont_funcionarios
  drop constraint if exists apont_func_remuneracao_check;

alter table public.apont_funcionarios
  add constraint apont_func_remuneracao_check
  check (salario_base is not null and salario_base > 0);
