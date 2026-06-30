DROP TRIGGER IF EXISTS tg_os_oleos_soma ON public.os_oleos;
DROP TRIGGER IF EXISTS tg_os_terceiros_soma ON public.os_terceiros;
DROP FUNCTION IF EXISTS public.os_recalc_custo_oleos() CASCADE;
DROP FUNCTION IF EXISTS public.os_recalc_custo_terceiros() CASCADE;
DROP TABLE IF EXISTS public.os_oleos CASCADE;
DROP TABLE IF EXISTS public.os_terceiros CASCADE;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.ordens_servico ADD COLUMN custo_total numeric(14,2)
  GENERATED ALWAYS AS (coalesce(custo_pecas,0)+coalesce(custo_servico_terceiro,0)+coalesce(custo_mao_obra_propria,0)) STORED;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_oleos;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_terceiros;
-- (não reverte o CHECK de tipo: manter o ampliado é inofensivo)
