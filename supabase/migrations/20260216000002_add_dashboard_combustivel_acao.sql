-- Add 'ver_dashboard_combustivel' to all employees that already have 'ver_combustivel'
UPDATE funcionarios
SET acoes_permitidas = array_append(acoes_permitidas, 'ver_dashboard_combustivel')
WHERE 'ver_combustivel' = ANY(acoes_permitidas)
  AND NOT ('ver_dashboard_combustivel' = ANY(acoes_permitidas));
