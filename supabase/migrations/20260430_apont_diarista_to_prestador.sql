-- ============================================================
-- Substitui o tipo de vínculo "diarista" por "prestador_servico".
-- 1) Relaxa a constraint pra aceitar o novo valor (e mantém os legados).
-- 2) Atualiza todos os funcionários atualmente como diarista.
-- ============================================================

BEGIN;

-- 1) Atualiza a CHECK constraint pra incluir 'prestador_servico'.
ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_vinculo_check;

ALTER TABLE public.apont_funcionarios
  ADD CONSTRAINT apont_func_vinculo_check
  CHECK (tipo_vinculo IN ('CLT','diarista','prestador_servico','terceirizado','MEI'));

-- 2) Migra os funcionários diaristas existentes.
UPDATE public.apont_funcionarios
   SET tipo_vinculo = 'prestador_servico'
 WHERE tipo_vinculo = 'diarista';

COMMIT;

-- Verificação:
-- SELECT tipo_vinculo, count(*) FROM public.apont_funcionarios GROUP BY tipo_vinculo;
