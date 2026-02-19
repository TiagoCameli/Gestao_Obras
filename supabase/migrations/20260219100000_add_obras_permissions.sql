-- Add obras actions to all funcionarios that have acoes_permitidas set (non-null)
UPDATE funcionarios
SET acoes_permitidas = acoes_permitidas || ARRAY['ver_obras','criar_obras','editar_obras','excluir_obras']
WHERE acoes_permitidas IS NOT NULL
  AND NOT 'ver_obras' = ANY(acoes_permitidas);
