-- Add 'ver_dashboard_insumos' to all employees that already have 'ver_insumos'
UPDATE funcionarios
SET acoes_permitidas = array_append(acoes_permitidas, 'ver_dashboard_insumos')
WHERE 'ver_insumos' = ANY(acoes_permitidas)
  AND NOT ('ver_dashboard_insumos' = ANY(acoes_permitidas));
