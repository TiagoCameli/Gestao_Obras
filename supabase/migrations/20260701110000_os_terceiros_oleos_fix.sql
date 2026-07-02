-- (a) Colunas de custo novas + regeneração do custo_total (sai mão de obra da soma)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custo_terceiros numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custo_oleos numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS custo_total;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custo_total numeric(14,2)
  GENERATED ALWAYS AS (coalesce(custo_pecas,0) + coalesce(custo_terceiros,0) + coalesce(custo_oleos,0)) STORED;

-- (b) Expande o CHECK de tipo (preserva os antigos)
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_tipo_check;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_tipo_check
  CHECK (tipo IN ('preventiva','corretiva','preditiva','melhoria','garantia','recall',
                  'troca_oleo','lubrificacao','pneu','solda','eletrica','revisao_geral','outro'));

-- (c) os_terceiros
CREATE TABLE IF NOT EXISTS public.os_terceiros (
  id          text PRIMARY KEY,
  os_id       text NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  prestador   text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  valor       numeric(14,2) NOT NULL CHECK (valor >= 0),
  nota_fiscal text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);
CREATE INDEX IF NOT EXISTS idx_os_terceiros_os ON public.os_terceiros(os_id);
ALTER TABLE public.os_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_terceiros_select ON public.os_terceiros FOR SELECT USING (private.current_has_action('ver_manutencao'));
CREATE POLICY os_terceiros_insert ON public.os_terceiros FOR INSERT WITH CHECK (private.current_has_action('adicionar_terceiro_os'));
CREATE POLICY os_terceiros_update ON public.os_terceiros FOR UPDATE USING (private.current_has_action('adicionar_terceiro_os'));
CREATE POLICY os_terceiros_delete ON public.os_terceiros FOR DELETE USING (private.current_has_action('adicionar_terceiro_os'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_terceiros TO authenticated;

-- (d) os_oleos
CREATE TABLE IF NOT EXISTS public.os_oleos (
  id             text PRIMARY KEY,
  os_id          text NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo_oleo_id   text NOT NULL REFERENCES public.tipos_oleo(id),
  quantidade     numeric NOT NULL CHECK (quantidade > 0),
  unidade        text NOT NULL DEFAULT 'L' CHECK (unidade IN ('L','kg')),
  valor_unitario numeric(14,2) NOT NULL CHECK (valor_unitario >= 0),
  valor_total    numeric(14,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text
);
CREATE INDEX IF NOT EXISTS idx_os_oleos_os ON public.os_oleos(os_id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_tipo ON public.os_oleos(tipo_oleo_id);
ALTER TABLE public.os_oleos ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_oleos_select ON public.os_oleos FOR SELECT USING (private.current_has_action('ver_manutencao'));
CREATE POLICY os_oleos_insert ON public.os_oleos FOR INSERT WITH CHECK (private.current_has_action('adicionar_oleo_os'));
CREATE POLICY os_oleos_update ON public.os_oleos FOR UPDATE USING (private.current_has_action('adicionar_oleo_os'));
CREATE POLICY os_oleos_delete ON public.os_oleos FOR DELETE USING (private.current_has_action('adicionar_oleo_os'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_oleos TO authenticated;

-- (e) Trigger de soma: terceiros -> ordens_servico.custo_terceiros
CREATE OR REPLACE FUNCTION public.os_recalc_custo_terceiros() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os text;
BEGIN
  v_os := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.ordens_servico SET custo_terceiros = (
    SELECT COALESCE(sum(valor),0) FROM public.os_terceiros WHERE os_id = v_os
  ) WHERE id = v_os;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_os_terceiros_soma ON public.os_terceiros;
CREATE TRIGGER tg_os_terceiros_soma AFTER INSERT OR UPDATE OR DELETE ON public.os_terceiros
  FOR EACH ROW EXECUTE FUNCTION public.os_recalc_custo_terceiros();

-- (f) Trigger de soma: óleos -> ordens_servico.custo_oleos
CREATE OR REPLACE FUNCTION public.os_recalc_custo_oleos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os text;
BEGIN
  v_os := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.ordens_servico SET custo_oleos = (
    SELECT COALESCE(sum(valor_total),0) FROM public.os_oleos WHERE os_id = v_os
  ) WHERE id = v_os;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_os_oleos_soma ON public.os_oleos;
CREATE TRIGGER tg_os_oleos_soma AFTER INSERT OR UPDATE OR DELETE ON public.os_oleos
  FOR EACH ROW EXECUTE FUNCTION public.os_recalc_custo_oleos();
