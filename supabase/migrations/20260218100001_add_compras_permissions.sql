-- Add compras permissions to all funcionarios that have acoes_permitidas defined
UPDATE funcionarios
SET acoes_permitidas = acoes_permitidas || ARRAY['ver_compras','criar_compra','editar_compra','excluir_compra','aprovar_pedido']
WHERE acoes_permitidas IS NOT NULL
  AND NOT 'ver_compras' = ANY(acoes_permitidas);
