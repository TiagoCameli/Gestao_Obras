-- Audit Bloco 2.4: indexar 67 foreign keys sem covering index
-- Advisor get_advisors(performance) lint unindexed_foreign_keys
--
-- Index naming: idx_<table>_<column>. Idempotente (IF NOT EXISTS).
-- Sem CONCURRENTLY pq tabelas são pequenas (maior é 1925 rows) — locks
-- são breves. Em tabela grande, refazer com CONCURRENTLY (fora de transação).

CREATE INDEX IF NOT EXISTS idx_apont_adiantamentos_fechamento_id ON public.apont_adiantamentos (fechamento_id);
CREATE INDEX IF NOT EXISTS idx_apont_apontamentos_servico_registrado_por_id ON public.apont_apontamentos_servico (registrado_por_id);
CREATE INDEX IF NOT EXISTS idx_apont_aprovacoes_ponto_dia_engenheiro_id ON public.apont_aprovacoes_ponto_dia (engenheiro_id);
CREATE INDEX IF NOT EXISTS idx_apont_equipes_encarregado_id ON public.apont_equipes (encarregado_id);
CREATE INDEX IF NOT EXISTS idx_apont_fechamentos_folha_fechado_por_id ON public.apont_fechamentos_folha (fechado_por_id);
CREATE INDEX IF NOT EXISTS idx_apont_registros_ponto_aprovado_por_id ON public.apont_registros_ponto (aprovado_por_id);
CREATE INDEX IF NOT EXISTS idx_apont_registros_ponto_registrado_por_id ON public.apont_registros_ponto (registrado_por_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_colaborador_id ON public.apontamentos (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_equipamento_id ON public.apontamentos (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_etapa_obra_id ON public.apontamentos (etapa_obra_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_obra_id ON public.apontamentos (obra_id);
CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_os_gerada_id ON public.checklist_execucoes (os_gerada_id);
CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_template_id ON public.checklist_execucoes (template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_pergunta_id ON public.checklist_respostas (pergunta_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa_id ON public.colaboradores (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_links_publicos_fornecedor_id ON public.cotacao_links_publicos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_respostas_fornecedor_fornecedor_id ON public.cotacao_respostas_fornecedor (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_respostas_fornecedor_link_publico_id ON public.cotacao_respostas_fornecedor (link_publico_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_pedido_compra_id ON public.cotacoes (pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_depositos_combustivel_atual_id ON public.depositos (combustivel_atual_id);
CREATE INDEX IF NOT EXISTS idx_depositos_material_obra_id ON public.depositos_material (obra_id);
CREATE INDEX IF NOT EXISTS idx_documentos_equipamento_fornecedor_id ON public.documentos_equipamento (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_entradas_combustivel_deposito_id ON public.entradas_combustivel (deposito_id);
CREATE INDEX IF NOT EXISTS idx_entradas_material_insumo_id ON public.entradas_material (insumo_id);
CREATE INDEX IF NOT EXISTS idx_entradas_material_obra_id ON public.entradas_material (obra_id);
CREATE INDEX IF NOT EXISTS idx_equipamento_plano_plano_id ON public.equipamento_plano (plano_id);
CREATE INDEX IF NOT EXISTS idx_etapas_obra_obra_id ON public.etapas_obra (obra_id);
CREATE INDEX IF NOT EXISTS idx_execucoes_atividade_atividade_id ON public.execucoes_atividade (atividade_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_equipamento_fornecedor_aquisicao_id ON public.financeiro_equipamento (fornecedor_aquisicao_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_empresa_pagadora_id ON public.financeiro_lancamentos (empresa_pagadora_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_rateios_deposito_id ON public.financeiro_rateios (deposito_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_rateios_deposito_material_id ON public.financeiro_rateios (deposito_material_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_rateios_equipamento_id ON public.financeiro_rateios (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_rateios_etapa_obra_id ON public.financeiro_rateios (etapa_obra_id);
CREATE INDEX IF NOT EXISTS idx_fretes_insumo_id ON public.fretes (insumo_id);
CREATE INDEX IF NOT EXISTS idx_fretes_obra_id ON public.fretes (obra_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_auth_user_id ON public.funcionarios (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_cotacao_id ON public.ordens_compra (cotacao_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_equipamento_id ON public.ordens_compra (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_fornecedor_id ON public.ordens_compra (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_obra_id ON public.ordens_compra (obra_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_pedido_compra_id ON public.ordens_compra (pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_fornecedor_servico_id ON public.ordens_servico (fornecedor_servico_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_obra_id ON public.ordens_servico (obra_id);
CREATE INDEX IF NOT EXISTS idx_os_pecas_deposito_id ON public.os_pecas (deposito_id);
CREATE INDEX IF NOT EXISTS idx_os_pecas_insumo_id ON public.os_pecas (insumo_id);
CREATE INDEX IF NOT EXISTS idx_os_pecas_saida_material_id ON public.os_pecas (saida_material_id);
CREATE INDEX IF NOT EXISTS idx_os_pecas_unidade_medida_id ON public.os_pecas (unidade_medida_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_obra_id ON public.pedidos_compra (obra_id);
CREATE INDEX IF NOT EXISTS idx_perfis_permissao_funcionario_id ON public.perfis_permissao (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_plano_atividade_pecas_insumo_id ON public.plano_atividade_pecas (insumo_id);
CREATE INDEX IF NOT EXISTS idx_plano_atividade_pecas_unidade_medida_id ON public.plano_atividade_pecas (unidade_medida_id);
CREATE INDEX IF NOT EXISTS idx_registros_horas_diaristas_etapa_id ON public.registros_horas_diaristas (etapa_id);
CREATE INDEX IF NOT EXISTS idx_registros_horas_diaristas_obra_id ON public.registros_horas_diaristas (obra_id);
CREATE INDEX IF NOT EXISTS idx_registros_horas_diaristas_sequencia_id ON public.registros_horas_diaristas (sequencia_id);
CREATE INDEX IF NOT EXISTS idx_rodotracker_contract_items_user_id ON public.rodotracker_contract_items (user_id);
CREATE INDEX IF NOT EXISTS idx_rodotracker_medicao_user_id ON public.rodotracker_medicao (user_id);
CREATE INDEX IF NOT EXISTS idx_rodotracker_plan_items_user_id ON public.rodotracker_plan_items (user_id);
CREATE INDEX IF NOT EXISTS idx_saidas_combustivel_equipamento_id ON public.saidas_combustivel (equipamento_id);
CREATE INDEX IF NOT EXISTS idx_saidas_combustivel_etapa_id ON public.saidas_combustivel (etapa_id);
CREATE INDEX IF NOT EXISTS idx_saidas_combustivel_movimento_id ON public.saidas_combustivel (movimento_id);
CREATE INDEX IF NOT EXISTS idx_saidas_material_insumo_id ON public.saidas_material (insumo_id);
CREATE INDEX IF NOT EXISTS idx_saidas_material_obra_id ON public.saidas_material (obra_id);
CREATE INDEX IF NOT EXISTS idx_sequencias_diarias_obra_id ON public.sequencias_diarias (obra_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_combustivel_deposito_destino_id ON public.transferencias_combustivel (deposito_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_combustivel_deposito_origem_id ON public.transferencias_combustivel (deposito_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_material_insumo_id ON public.transferencias_material (insumo_id);
CREATE INDEX IF NOT EXISTS idx_transportadora_movimentos_obra_id ON public.transportadora_movimentos (obra_id);
