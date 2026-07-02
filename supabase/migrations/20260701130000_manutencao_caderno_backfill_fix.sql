UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array(SELECT DISTINCT unnest(acoes_permitidas || ARRAY['adicionar_terceiro_os','adicionar_oleo_os','gerenciar_tipos_oleo']))
)
WHERE 'adicionar_peca_os' = ANY(acoes_permitidas);
