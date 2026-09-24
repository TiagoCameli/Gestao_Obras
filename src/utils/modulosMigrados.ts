// Fase 5 da migração para o ERP-EMT (plano do ERP, docs/PLANO-FRETE-COMBUSTIVEL-MANUTENCAO.md):
// Manutenção (virada em 23/09/2026), Combustível e Frete (24/09/2026) passaram para o ERP.
// Aqui eles ficam SÓ LEITURA por um ciclo de fechamento, e depois saem do menu.
//
// O banco já recusa gravação nessas tabelas (gatilhos de congelamento, migrations
// 20260923180000 e 20260924200000). Esta lista esconde da tela o que só daria erro ao salvar:
// `temAcao` devolve falso para estas chaves, para todo mundo. Ver e exportar continuam.
//
// Fica de fora de propósito o que continua no Gestão Obras: Depósitos de material, Medição
// (RodoTracker), obras, cadastro de equipamentos e o horímetro (medicoes_equipamento ficou aberta).

export const ERP_URL = 'https://erp-emt-tiagocameli-4731s-projects.vercel.app';

export const ACOES_MIGRADAS_PARA_ERP: ReadonlySet<string> = new Set([
  // Frete
  'criar_frete', 'editar_frete', 'excluir_frete', 'importar_frete', 'anexar_documentos_frete', 'restaurar_lixeira_frete',
  'criar_pagamento_frete', 'editar_pagamento_frete', 'excluir_pagamento_frete', 'gerenciar_pagamentos_frete',
  'criar_pedido_material_frete', 'editar_pedido_material_frete', 'excluir_pedido_material_frete',
  'ajustar_saldo_transportadora',
  // Combustível
  'criar_abastecimento_carreta', 'criar_entrada_combustivel', 'criar_saida_combustivel', 'criar_transferencia_combustivel',
  'saida_combustivel_mobile', 'editar_combustivel', 'excluir_combustivel', 'esvaziar_tanque',
  'criar_tanque', 'criar_tanques', 'editar_tanque', 'editar_tanques', 'excluir_tanque', 'excluir_tanques',
  'corrigir_anomalias_combustivel', 'anexar_documentos_combustivel', 'restaurar_lixeira_combustivel',
  // Manutenção
  'criar_os', 'editar_os', 'excluir_os', 'editar_diagnostico_os', 'adicionar_peca_os', 'adicionar_oleo_os',
  'adicionar_terceiro_os', 'abrir_os_mobile', 'criar_entrada_almoxarifado', 'criar_peca_almoxarifado',
  'editar_peca_almoxarifado', 'gerenciar_tipos_oleo',
]);

export function acaoMigradaParaErp(chave: string): boolean {
  return ACOES_MIGRADAS_PARA_ERP.has(chave);
}
