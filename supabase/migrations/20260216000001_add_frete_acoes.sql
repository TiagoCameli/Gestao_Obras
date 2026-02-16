-- Add frete actions to all funcionarios that have acoes_permitidas set (non-null)
UPDATE funcionarios
SET acoes_permitidas = acoes_permitidas || ARRAY['ver_frete','criar_frete','editar_frete','excluir_frete']
WHERE acoes_permitidas IS NOT NULL
  AND NOT 'ver_frete' = ANY(acoes_permitidas);
