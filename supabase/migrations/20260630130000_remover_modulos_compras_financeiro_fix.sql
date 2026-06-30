-- Remover módulos Compras e Financeiro (decisão Tiago, 2026-06-30).
-- Os dois saem inteiros do app Gestão de Obras (compras e financeiro reais
-- vivem no ERP-EMT). O frontend (páginas, components/compras, components/financeiro,
-- hooks, utils, rotas, nav, as 35 chaves de permissão e o portal público de
-- cotação) já foi removido no mesmo commit.
--
-- MANTIDO (NÃO tocar aqui): o "Financeiro do equipamento" da Frota —
-- tabela financeiro_equipamento, view v_equipamento_depreciacao, chaves
-- ver_financeiro_equipamento / editar_financeiro_equipamento (grupo Frota) e
-- os componentes em src/components/frota/financeiro/.
--
-- Dado removido era só teste (1 OC, 2 pedidos, 1 cotação, 2 recebimentos,
-- 1 lançamento, 3 parcelas, 3 rateios, 11 categorias-semente). Verificado:
-- nenhuma tabela que fica tem FK apontando pra dentro destas. Buckets
-- compras-anexos e financeiro-anexos (0 objetos) removidos via Storage API fora daqui.
-- Destrutivo quanto a DADOS; o rollback recria estrutura, não conteúdo.

BEGIN;

-- 1. Tabelas Compras (CASCADE leva RLS, índices, FKs e triggers próprios)
DROP TABLE IF EXISTS public.recebimentos_oc CASCADE;
DROP TABLE IF EXISTS public.cotacao_respostas_fornecedor CASCADE;
DROP TABLE IF EXISTS public.cotacao_links_publicos CASCADE;
DROP TABLE IF EXISTS public.cotacoes CASCADE;
DROP TABLE IF EXISTS public.ordens_compra CASCADE;
DROP TABLE IF EXISTS public.pedidos_compra CASCADE;
DROP TABLE IF EXISTS public.compras_anexos CASCADE;
DROP TABLE IF EXISTS public.compras_auditoria CASCADE;
DROP TABLE IF EXISTS public.compras_lixeira CASCADE;
DROP TABLE IF EXISTS public.compras_notificacoes CASCADE;

-- 2. Tabelas do módulo /financeiro. financeiro_equipamento NÃO entra (é da Frota).
DROP TABLE IF EXISTS public.financeiro_pagamentos CASCADE;
DROP TABLE IF EXISTS public.financeiro_rateios CASCADE;
DROP TABLE IF EXISTS public.financeiro_parcelas CASCADE;
DROP TABLE IF EXISTS public.financeiro_lancamentos CASCADE;
DROP TABLE IF EXISTS public.financeiro_categorias CASCADE;

-- 3. Funções de Compras (cotação pública, notificação, lixeira, updated_at, lançamento pendente)
DROP FUNCTION IF EXISTS public.compras_notif_resposta_cotacao() CASCADE;
DROP FUNCTION IF EXISTS public.compras_oc_marcar_lancamento_pendente() CASCADE;
DROP FUNCTION IF EXISTS public.compras_purgar_lixeira_expirada() CASCADE;
DROP FUNCTION IF EXISTS public.compras_set_atualizado_em() CASCADE;
DROP FUNCTION IF EXISTS public.get_cotacao_publica(text) CASCADE;
DROP FUNCTION IF EXISTS public.responder_cotacao(text, jsonb) CASCADE;

-- 4. Policies de Storage dos 2 buckets (os buckets vazios saem via Storage API fora daqui)
DROP POLICY IF EXISTS compras_anexos_select ON storage.objects;
DROP POLICY IF EXISTS compras_anexos_insert ON storage.objects;
DROP POLICY IF EXISTS compras_anexos_update ON storage.objects;
DROP POLICY IF EXISTS compras_anexos_delete ON storage.objects;
DROP POLICY IF EXISTS financeiro_anexos_select ON storage.objects;
DROP POLICY IF EXISTS financeiro_anexos_insert ON storage.objects;
DROP POLICY IF EXISTS financeiro_anexos_update ON storage.objects;
DROP POLICY IF EXISTS financeiro_anexos_delete ON storage.objects;

-- 5. Limpa as 35 chaves de Compras + Financeiro de funcionarios.acoes_permitidas.
--    NÃO remove ver_financeiro_equipamento / editar_financeiro_equipamento (Frota),
--    nem criar_pedido_material_frete / ver_pedidos_material / exportar_pedidos_material (Frete).
UPDATE public.funcionarios
SET acoes_permitidas = (
  SELECT coalesce(array_agg(x), '{}'::text[])
  FROM unnest(acoes_permitidas) AS x
  WHERE x <> ALL (ARRAY[
    'ver_compras','criar_compra','editar_compra','excluir_compra',
    'criar_pedido_material','aprovar_pedido',
    'criar_cotacao','editar_cotacao','exportar_cotacao_pdf','anexar_pdf_cotacao',
    'criar_ordem_compra','editar_ordem_compra','aprovar_ordem_compra','reabrir_ordem_compra',
    'gerar_entrada_estoque_oc','importar_oc',
    'ver_dashboard_compras','criar_pedido_compra','editar_pedido_compra',
    'enviar_cotacao_fornecedor','cancelar_ordem_compra','marcar_oc_recebida',
    'restaurar_lixeira_compras','excluir_permanente_compras','ver_auditoria_compras',
    'cadastrar_insumo_via_compra',
    'ver_financeiro','criar_lancamento_financeiro','editar_lancamento_financeiro',
    'excluir_lancamento_financeiro','registrar_pagamento_financeiro','estornar_pagamento_financeiro',
    'fechar_lancamento_financeiro','reabrir_lancamento_financeiro','gerenciar_categorias_financeiro'
  ]::text[])
)
WHERE acoes_permitidas && ARRAY[
  'ver_compras','criar_compra','editar_compra','excluir_compra',
  'criar_pedido_material','aprovar_pedido',
  'criar_cotacao','editar_cotacao','exportar_cotacao_pdf','anexar_pdf_cotacao',
  'criar_ordem_compra','editar_ordem_compra','aprovar_ordem_compra','reabrir_ordem_compra',
  'gerar_entrada_estoque_oc','importar_oc',
  'ver_dashboard_compras','criar_pedido_compra','editar_pedido_compra',
  'enviar_cotacao_fornecedor','cancelar_ordem_compra','marcar_oc_recebida',
  'restaurar_lixeira_compras','excluir_permanente_compras','ver_auditoria_compras',
  'cadastrar_insumo_via_compra',
  'ver_financeiro','criar_lancamento_financeiro','editar_lancamento_financeiro',
  'excluir_lancamento_financeiro','registrar_pagamento_financeiro','estornar_pagamento_financeiro',
  'fechar_lancamento_financeiro','reabrir_lancamento_financeiro','gerenciar_categorias_financeiro'
]::text[];

COMMIT;
