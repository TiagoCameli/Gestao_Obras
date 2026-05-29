-- Engenharia — Backfill de acoes_permitidas por cargo (Onda 6a, correção)
--
-- Contexto:
--   A Onda 1 adicionou as 17 chaves de ação do grupo "Engenharia" aos
--   templates de cargo (TEMPLATES_ACOES_POR_CARGO em src/utils/permissions.ts),
--   mas NÃO fez o backfill nos usuários já existentes. O fallback de template
--   no AuthContext só se aplica quando acoes_permitidas está vazio; todos os
--   usuários já tinham arrays populados, então nenhum recebeu as chaves novas
--   e o módulo Engenharia ficava invisível pra todos (inclusive Admin).
--
-- Esta migration distribui as chaves de Engenharia conforme o template de cada
-- cargo, espelhando exatamente TEMPLATES_ACOES_POR_CARGO. É IDEMPOTENTE
-- (union + distinct), então reaplicar é no-op.
--
-- Já aplicada ao banco de produção em 2026-05-28 via service-role
-- (mesmo efeito deste SQL). Mantida aqui para versionamento e reprodução
-- em outros ambientes.
--
-- Mapa cargo -> chaves (fonte: TEMPLATES_ACOES_POR_CARGO):
--   Administrador ............ 17 (todas)
--   Engenheiro Civil Sênior .. 16 (todas menos excluir_permanente_engenharia)
--   Engenheiro Civil ......... 10
--   Gerente / Supervisor / Financeiro / Gerente Financeiro /
--     Gerente de Compras ..... 2  (ver_engenharia, ver_lixeira_engenharia)
--   Operador / Apontador ..... 0  (sem acesso — nenhum update)

-- Administrador: todas as 17
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array_agg(DISTINCT k) FROM unnest(
    coalesce(acoes_permitidas, '{}'::text[]) || ARRAY[
      'ver_engenharia','criar_engenharia_pasta','editar_engenharia_pasta',
      'excluir_engenharia_pasta','criar_engenharia_nota','editar_engenharia_nota',
      'excluir_engenharia_nota','criar_engenharia_calculo','editar_engenharia_calculo',
      'excluir_engenharia_calculo','upload_engenharia_arquivo','excluir_engenharia_arquivo',
      'ver_lixeira_engenharia','restaurar_lixeira_engenharia','excluir_permanente_engenharia',
      'ver_historico_engenharia','gerenciar_locks_engenharia'
    ]
  ) AS k
)
WHERE cargo = 'Administrador';

-- Engenheiro Civil Sênior: 16 (todas menos excluir_permanente_engenharia)
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array_agg(DISTINCT k) FROM unnest(
    coalesce(acoes_permitidas, '{}'::text[]) || ARRAY[
      'ver_engenharia','criar_engenharia_pasta','editar_engenharia_pasta',
      'excluir_engenharia_pasta','criar_engenharia_nota','editar_engenharia_nota',
      'excluir_engenharia_nota','criar_engenharia_calculo','editar_engenharia_calculo',
      'excluir_engenharia_calculo','upload_engenharia_arquivo','excluir_engenharia_arquivo',
      'ver_lixeira_engenharia','restaurar_lixeira_engenharia',
      'ver_historico_engenharia','gerenciar_locks_engenharia'
    ]
  ) AS k
)
WHERE cargo = 'Engenheiro Civil Sênior';

-- Engenheiro Civil: 10
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array_agg(DISTINCT k) FROM unnest(
    coalesce(acoes_permitidas, '{}'::text[]) || ARRAY[
      'ver_engenharia','criar_engenharia_pasta','editar_engenharia_pasta',
      'criar_engenharia_nota','editar_engenharia_nota','criar_engenharia_calculo',
      'editar_engenharia_calculo','upload_engenharia_arquivo','ver_lixeira_engenharia',
      'ver_historico_engenharia'
    ]
  ) AS k
)
WHERE cargo = 'Engenheiro Civil';

-- Gerente, Supervisor, Financeiro, Gerente Financeiro, Gerente de Compras: 2
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT array_agg(DISTINCT k) FROM unnest(
    coalesce(acoes_permitidas, '{}'::text[]) || ARRAY[
      'ver_engenharia','ver_lixeira_engenharia'
    ]
  ) AS k
)
WHERE cargo IN ('Gerente','Supervisor','Financeiro','Gerente Financeiro','Gerente de Compras');
