UPDATE public.funcionarios
SET acoes_permitidas = array(
  SELECT a FROM unnest(acoes_permitidas) AS a
  WHERE a <> ALL(ARRAY['adicionar_terceiro_os','adicionar_oleo_os','gerenciar_tipos_oleo'])
)
WHERE 'adicionar_peca_os' = ANY(acoes_permitidas);
