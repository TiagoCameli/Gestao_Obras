import type { AcaoPermissao, CargoFuncionario, ModuloPermissao, PermissoesFuncionario } from '../types';

export const MODULOS: { valor: ModuloPermissao; label: string }[] = [
  { valor: 'dashboard', label: 'Dashboard' },
  { valor: 'cadastros', label: 'Cadastros' },
  { valor: 'frete', label: 'Frete' },
  { valor: 'frota', label: 'Frota' },
  { valor: 'funcionarios', label: 'Usuários' },
];

export const ACOES: { valor: AcaoPermissao; label: string }[] = [
  { valor: 'visualizar', label: 'Visualizar' },
  { valor: 'criar', label: 'Criar' },
  { valor: 'editar', label: 'Editar' },
  { valor: 'excluir', label: 'Excluir' },
  { valor: 'exportar', label: 'Exportar' },
  { valor: 'ajustar_filtros', label: 'Ajustar Filtros' },
];

export const CARGOS: { valor: CargoFuncionario; label: string }[] = [
  { valor: 'Administrador', label: 'Administrador' },
  { valor: 'Gerente', label: 'Gerente' },
  { valor: 'Gerente Financeiro', label: 'Gerente Financeiro' },
  { valor: 'Gerente de Compras', label: 'Gerente de Compras' },
  { valor: 'Supervisor', label: 'Supervisor' },
  { valor: 'Operador', label: 'Operador' },
  { valor: 'Financeiro', label: 'Financeiro' },
  { valor: 'Apontador', label: 'Apontador' },
  { valor: 'Engenheiro Civil Sênior', label: 'Engenheiro Civil Sênior' },
  { valor: 'Engenheiro Civil', label: 'Engenheiro Civil' },
];

const TODAS: AcaoPermissao[] = ['visualizar', 'criar', 'editar', 'excluir', 'exportar', 'ajustar_filtros'];
const V: AcaoPermissao[] = ['visualizar'];
const VF: AcaoPermissao[] = ['visualizar', 'ajustar_filtros'];
const VCE: AcaoPermissao[] = ['visualizar', 'criar', 'editar'];
const VCEEX: AcaoPermissao[] = ['visualizar', 'criar', 'editar', 'excluir', 'exportar'];
const VE: AcaoPermissao[] = ['visualizar', 'exportar'];
const NENHUMA: AcaoPermissao[] = [];

export const PERFIL_ADMINISTRADOR: PermissoesFuncionario = {
  dashboard: TODAS,
  cadastros: TODAS,
  frete: TODAS,
  frota: TODAS,
  funcionarios: TODAS,
};

export const PERFIL_GERENTE: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: VCE,
};

export const PERFIL_SUPERVISOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
};

export const PERFIL_OPERADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
};

export const PERFIL_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: V,
  frete: VE,
  frota: V,
  funcionarios: V,
};

export const PERFIL_APONTADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
};

export const PERFIL_GERENTE_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
};

export const PERFIL_GERENTE_COMPRAS: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCEEX,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
};

export const PERFIL_ENGENHEIRO_CIVIL_SENIOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
};

export const PERFIL_ENGENHEIRO_CIVIL: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
};

export const PERFIS_PADRAO: Record<CargoFuncionario, PermissoesFuncionario> = {
  Administrador: PERFIL_ADMINISTRADOR,
  Gerente: PERFIL_GERENTE,
  'Gerente Financeiro': PERFIL_GERENTE_FINANCEIRO,
  'Gerente de Compras': PERFIL_GERENTE_COMPRAS,
  Supervisor: PERFIL_SUPERVISOR,
  Operador: PERFIL_OPERADOR,
  Financeiro: PERFIL_FINANCEIRO,
  Apontador: PERFIL_APONTADOR,
  'Engenheiro Civil Sênior': PERFIL_ENGENHEIRO_CIVIL_SENIOR,
  'Engenheiro Civil': PERFIL_ENGENHEIRO_CIVIL,
};

export function perfilPadraoPorCargo(cargo: CargoFuncionario): PermissoesFuncionario {
  return PERFIS_PADRAO[cargo];
}

// === Acoes da Plataforma (novo sistema de permissoes) ===

export interface AcaoPlataforma {
  chave: string;
  label: string;
  grupo: string;
}

export const ACOES_PLATAFORMA: AcaoPlataforma[] = [
  // ============================================================
  // Dashboard
  // ============================================================
  { chave: 'ver_dashboard', label: 'Visualizar o Dashboard', grupo: 'Dashboard' },
  { chave: 'filtros_dashboard', label: 'Ajustar filtros do Dashboard', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_combustivel', label: 'Ver dashboard de combustível', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_insumos', label: 'Ver dashboard de insumos', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_manutencao', label: 'Ver dashboard de manutenção', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_obras', label: 'Ver dashboard de obras', grupo: 'Dashboard' },

  // ============================================================
  // Obras
  // ============================================================
  { chave: 'ver_obras', label: 'Visualizar obras', grupo: 'Obras' },
  { chave: 'criar_obras', label: 'Criar obras', grupo: 'Obras' },
  { chave: 'editar_obras', label: 'Editar obras', grupo: 'Obras' },
  { chave: 'excluir_obras', label: 'Excluir obras', grupo: 'Obras' },
  { chave: 'importar_etapas_obra', label: 'Importar etapas via Excel', grupo: 'Obras' },
  { chave: 'importar_equipamentos_obra', label: 'Importar equipamentos via Excel', grupo: 'Obras' },
  { chave: 'exportar_orcamento', label: 'Exportar orçamento (PDF/Excel)', grupo: 'Obras' },
  { chave: 'gerenciar_tipos_equipamento_obra', label: 'Gerenciar tipos de equipamento (obra)', grupo: 'Obras' },
  { chave: 'gerenciar_categorias_material_obra', label: 'Gerenciar categorias de material (obra)', grupo: 'Obras' },

  // ============================================================
  // Cadastros (insumos, fornecedores, etapas, equipamentos, etc.)
  // ============================================================
  { chave: 'ver_cadastros', label: 'Visualizar cadastros', grupo: 'Cadastros' },
  { chave: 'criar_cadastros', label: 'Criar novos cadastros', grupo: 'Cadastros' },
  { chave: 'editar_cadastros', label: 'Editar cadastros', grupo: 'Cadastros' },
  { chave: 'excluir_cadastros', label: 'Excluir cadastros', grupo: 'Cadastros' },
  { chave: 'importar_cadastros', label: 'Importar cadastros via Excel', grupo: 'Cadastros' },
  // Insumos
  { chave: 'criar_insumos', label: 'Criar insumos', grupo: 'Cadastros' },
  { chave: 'editar_insumos', label: 'Editar insumos', grupo: 'Cadastros' },
  { chave: 'excluir_insumos', label: 'Excluir insumos', grupo: 'Cadastros' },
  { chave: 'exportar_insumos', label: 'Exportar insumos', grupo: 'Cadastros' },
  // Sub-cadastros granulares (cards do Hub de Cadastros)
  // Localidades
  { chave: 'criar_localidades', label: 'Criar localidades', grupo: 'Cadastros' },
  { chave: 'editar_localidades', label: 'Editar localidades', grupo: 'Cadastros' },
  { chave: 'excluir_localidades', label: 'Excluir localidades', grupo: 'Cadastros' },
  // Empresas
  { chave: 'criar_empresas', label: 'Criar empresas', grupo: 'Cadastros' },
  { chave: 'editar_empresas', label: 'Editar empresas', grupo: 'Cadastros' },
  { chave: 'excluir_empresas', label: 'Excluir empresas', grupo: 'Cadastros' },
  // Colaboradores
  { chave: 'criar_colaboradores', label: 'Criar colaboradores', grupo: 'Cadastros' },
  { chave: 'editar_colaboradores', label: 'Editar colaboradores', grupo: 'Cadastros' },
  { chave: 'excluir_colaboradores', label: 'Excluir colaboradores', grupo: 'Cadastros' },
  // Tipos de insumo
  { chave: 'criar_tipos_insumo', label: 'Criar tipos de insumo', grupo: 'Cadastros' },
  { chave: 'editar_tipos_insumo', label: 'Editar tipos de insumo', grupo: 'Cadastros' },
  { chave: 'excluir_tipos_insumo', label: 'Excluir tipos de insumo', grupo: 'Cadastros' },
  // Categorias de material
  { chave: 'criar_categorias_material', label: 'Criar categorias de material', grupo: 'Cadastros' },
  { chave: 'editar_categorias_material', label: 'Editar categorias de material', grupo: 'Cadastros' },
  { chave: 'excluir_categorias_material', label: 'Excluir categorias de material', grupo: 'Cadastros' },
  // Unidades
  { chave: 'criar_unidades', label: 'Criar unidades de medida', grupo: 'Cadastros' },
  { chave: 'editar_unidades', label: 'Editar unidades de medida', grupo: 'Cadastros' },
  { chave: 'excluir_unidades', label: 'Excluir unidades de medida', grupo: 'Cadastros' },
  // Depósitos de material
  { chave: 'criar_depositos_material', label: 'Criar depósitos de material', grupo: 'Cadastros' },
  { chave: 'editar_depositos_material', label: 'Editar depósitos de material', grupo: 'Cadastros' },
  { chave: 'excluir_depositos_material', label: 'Excluir depósitos de material', grupo: 'Cadastros' },
  // Fornecedores
  { chave: 'criar_fornecedores', label: 'Criar fornecedores', grupo: 'Cadastros' },
  { chave: 'editar_fornecedores', label: 'Editar fornecedores', grupo: 'Cadastros' },
  { chave: 'excluir_fornecedores', label: 'Excluir fornecedores', grupo: 'Cadastros' },
  // Tipos de equipamento
  { chave: 'criar_tipos_equipamento', label: 'Criar tipos de equipamento', grupo: 'Cadastros' },
  { chave: 'editar_tipos_equipamento', label: 'Editar tipos de equipamento', grupo: 'Cadastros' },
  { chave: 'excluir_tipos_equipamento', label: 'Excluir tipos de equipamento', grupo: 'Cadastros' },
  // Equipamentos (alias granular do Cadastros Hub — separado de criar_veiculo
  // que pertence à Frota e dispara tela diferente)
  { chave: 'criar_equipamentos', label: 'Criar equipamentos (cadastro)', grupo: 'Cadastros' },
  { chave: 'editar_equipamentos', label: 'Editar equipamentos (cadastro)', grupo: 'Cadastros' },
  { chave: 'excluir_equipamentos', label: 'Excluir equipamentos (cadastro)', grupo: 'Cadastros' },
  // Tanques (cadastro Hub — separado das chaves de Combustível)
  { chave: 'criar_tanques', label: 'Criar tanques (cadastro)', grupo: 'Cadastros' },
  { chave: 'editar_tanques', label: 'Editar tanques (cadastro)', grupo: 'Cadastros' },
  { chave: 'excluir_tanques', label: 'Excluir tanques (cadastro)', grupo: 'Cadastros' },
  // Etapas (sub-cadastro)
  { chave: 'ver_etapas', label: 'Visualizar etapas', grupo: 'Cadastros' },
  { chave: 'criar_etapas', label: 'Criar etapas', grupo: 'Cadastros' },
  { chave: 'editar_etapas', label: 'Editar etapas', grupo: 'Cadastros' },
  { chave: 'excluir_etapas', label: 'Excluir etapas', grupo: 'Cadastros' },
  // Unificação Colaborador × Funcionário (operação sensível)
  { chave: 'unificar_funcionarios', label: 'Unificar colaborador com funcionário', grupo: 'Cadastros' },
  { chave: 'backfill_apontamentos', label: 'Executar backfill de apontamentos', grupo: 'Cadastros' },

  // ============================================================
  // Frete
  // ============================================================
  { chave: 'ver_frete', label: 'Visualizar fretes', grupo: 'Frete' },
  { chave: 'criar_frete', label: 'Criar frete', grupo: 'Frete' },
  { chave: 'editar_frete', label: 'Editar frete', grupo: 'Frete' },
  { chave: 'excluir_frete', label: 'Excluir frete', grupo: 'Frete' },
  { chave: 'exportar_frete', label: 'Exportar fretes', grupo: 'Frete' },
  { chave: 'importar_frete', label: 'Importar fretes via Excel', grupo: 'Frete' },
  { chave: 'anexar_documentos_frete', label: 'Anexar documentos/fotos de frete', grupo: 'Frete' },
  // Pagamentos
  { chave: 'gerenciar_pagamentos_frete', label: 'Gerenciar pagamentos de frete', grupo: 'Frete' },
  { chave: 'criar_pagamento_frete', label: 'Lançar pagamento de frete', grupo: 'Frete' },
  { chave: 'editar_pagamento_frete', label: 'Editar pagamento de frete', grupo: 'Frete' },
  { chave: 'excluir_pagamento_frete', label: 'Excluir pagamento de frete', grupo: 'Frete' },
  // Pedidos de material (na aba do Frete)
  { chave: 'ver_pedidos_material', label: 'Visualizar pedidos de material', grupo: 'Frete' },
  { chave: 'criar_pedido_material_frete', label: 'Criar pedido de material', grupo: 'Frete' },
  { chave: 'editar_pedido_material_frete', label: 'Editar pedido de material', grupo: 'Frete' },
  { chave: 'excluir_pedido_material_frete', label: 'Excluir pedido de material', grupo: 'Frete' },
  { chave: 'exportar_pedidos_material', label: 'Exportar pedidos de material', grupo: 'Frete' },
  // Conta corrente / extrato de transportadora
  { chave: 'ver_extrato_transportadora', label: 'Visualizar extrato de transportadora', grupo: 'Frete' },
  { chave: 'exportar_extrato_transportadora', label: 'Exportar extrato de transportadora', grupo: 'Frete' },
  { chave: 'ajustar_saldo_transportadora', label: 'Ajustar saldo de transportadora (manual)', grupo: 'Frete' },
  // Lixeira
  { chave: 'ver_lixeira_frete', label: 'Visualizar lixeira de frete', grupo: 'Frete' },
  { chave: 'restaurar_lixeira_frete', label: 'Restaurar itens da lixeira de frete', grupo: 'Frete' },

  // ============================================================
  // Combustível
  // ============================================================
  { chave: 'ver_combustivel', label: 'Visualizar combustível', grupo: 'Combustível' },
  { chave: 'criar_entrada_combustivel', label: 'Lançar entrada de combustível', grupo: 'Combustível' },
  { chave: 'criar_saida_combustivel', label: 'Lançar saída de combustível', grupo: 'Combustível' },
  { chave: 'criar_transferencia_combustivel', label: 'Transferir combustível', grupo: 'Combustível' },
  { chave: 'editar_combustivel', label: 'Editar movimentações de combustível', grupo: 'Combustível' },
  { chave: 'excluir_combustivel', label: 'Excluir movimentações de combustível', grupo: 'Combustível' },
  { chave: 'exportar_combustivel', label: 'Exportar combustível', grupo: 'Combustível' },
  { chave: 'exportar_raw_combustivel', label: 'Exportar dados brutos (5 abas)', grupo: 'Combustível' },
  { chave: 'criar_abastecimento_carreta', label: 'Lançar abastecimento de carreta', grupo: 'Combustível' },
  { chave: 'anexar_documentos_combustivel', label: 'Anexar fotos/PDFs em movimentações', grupo: 'Combustível' },
  // Tanques
  { chave: 'criar_tanque', label: 'Cadastrar tanque', grupo: 'Combustível' },
  { chave: 'editar_tanque', label: 'Editar tanque', grupo: 'Combustível' },
  { chave: 'excluir_tanque', label: 'Excluir tanque', grupo: 'Combustível' },
  { chave: 'esvaziar_tanque', label: 'Esvaziar tanque (ajuste de saldo)', grupo: 'Combustível' },
  // Anomalias / Sentinela
  { chave: 'ver_anomalias_combustivel', label: 'Visualizar anomalias de combustível', grupo: 'Combustível' },
  { chave: 'corrigir_anomalias_combustivel', label: 'Atribuir saídas Sentinela / corrigir anomalias', grupo: 'Combustível' },
  // Views salvas
  { chave: 'salvar_views_combustivel', label: 'Salvar/carregar views de filtro', grupo: 'Combustível' },
  // Lixeira
  { chave: 'ver_lixeira_combustivel', label: 'Visualizar lixeira de combustível', grupo: 'Combustível' },
  { chave: 'restaurar_lixeira_combustivel', label: 'Restaurar itens da lixeira de combustível', grupo: 'Combustível' },

  // ============================================================
  // Material / Almoxarifado (Insumos)
  // ============================================================
  { chave: 'ver_materiais', label: 'Visualizar movimentações de material', grupo: 'Material' },
  { chave: 'criar_entrada_material', label: 'Lançar entrada de material', grupo: 'Material' },
  { chave: 'criar_saida_material', label: 'Lançar saída de material', grupo: 'Material' },
  { chave: 'criar_transferencia_material', label: 'Transferir material', grupo: 'Material' },
  { chave: 'editar_material', label: 'Editar movimentações de material', grupo: 'Material' },
  { chave: 'excluir_material', label: 'Excluir movimentações de material', grupo: 'Material' },
  { chave: 'exportar_material', label: 'Exportar movimentações de material', grupo: 'Material' },

  // ============================================================
  // Compras
  // ============================================================
  { chave: 'ver_compras', label: 'Visualizar compras', grupo: 'Compras' },
  { chave: 'criar_compra', label: 'Criar compra', grupo: 'Compras' },
  { chave: 'editar_compra', label: 'Editar compra', grupo: 'Compras' },
  { chave: 'excluir_compra', label: 'Excluir compra', grupo: 'Compras' },
  // Pedido de compra
  { chave: 'criar_pedido_material', label: 'Criar pedido de material', grupo: 'Compras' },
  { chave: 'aprovar_pedido', label: 'Aprovar pedido de material', grupo: 'Compras' },
  // Cotação
  { chave: 'criar_cotacao', label: 'Criar cotação', grupo: 'Compras' },
  { chave: 'editar_cotacao', label: 'Editar cotação', grupo: 'Compras' },
  { chave: 'exportar_cotacao_pdf', label: 'Exportar PDF de cotação', grupo: 'Compras' },
  { chave: 'anexar_pdf_cotacao', label: 'Anexar PDF (autofill) de cotação', grupo: 'Compras' },
  // Ordem de Compra
  { chave: 'criar_ordem_compra', label: 'Criar ordem de compra', grupo: 'Compras' },
  { chave: 'editar_ordem_compra', label: 'Editar ordem de compra', grupo: 'Compras' },
  { chave: 'aprovar_ordem_compra', label: 'Aprovar ordem de compra', grupo: 'Compras' },
  { chave: 'reabrir_ordem_compra', label: 'Reabrir ordem de compra', grupo: 'Compras' },
  { chave: 'gerar_entrada_estoque_oc', label: 'Gerar entrada no estoque a partir de OC', grupo: 'Compras' },
  { chave: 'importar_oc', label: 'Importar OC via Excel', grupo: 'Compras' },

  // ============================================================
  // Frota
  // ============================================================
  { chave: 'ver_frota', label: 'Visualizar frota', grupo: 'Frota' },
  { chave: 'criar_veiculo', label: 'Cadastrar veículo/equipamento', grupo: 'Frota' },
  { chave: 'editar_veiculo', label: 'Editar veículo/equipamento', grupo: 'Frota' },
  { chave: 'excluir_veiculo', label: 'Excluir veículo/equipamento', grupo: 'Frota' },
  { chave: 'exportar_frota', label: 'Exportar frota (PDF/Excel)', grupo: 'Frota' },
  { chave: 'gerar_etiquetas_qr', label: 'Gerar etiquetas QR em lote', grupo: 'Frota' },
  { chave: 'mudar_status_equipamento', label: 'Mudar status do equipamento (ativo/manutenção/fora)', grupo: 'Frota' },
  { chave: 'editar_especificacoes_equipamento', label: 'Editar especificações técnicas', grupo: 'Frota' },
  // Documentos / Fotos
  { chave: 'ver_documentos_equipamento', label: 'Ver documentos do equipamento', grupo: 'Frota' },
  { chave: 'gerenciar_documentos_equipamento', label: 'Anexar/excluir documentos do equipamento', grupo: 'Frota' },
  { chave: 'gerenciar_fotos_equipamento', label: 'Gerenciar galeria de fotos do equipamento', grupo: 'Frota' },
  // Financeiro do equipamento
  { chave: 'ver_financeiro_equipamento', label: 'Ver financeiro do equipamento', grupo: 'Frota' },
  { chave: 'editar_financeiro_equipamento', label: 'Editar financeiro do equipamento', grupo: 'Frota' },
  // Histórico / Custos
  { chave: 'ver_historico_equipamento', label: 'Ver histórico do equipamento', grupo: 'Frota' },
  { chave: 'ver_custos_pecas_equipamento', label: 'Ver custos de peças por equipamento', grupo: 'Frota' },
  // Checklists e planos preventivos (Frota)
  { chave: 'gerenciar_checklists', label: 'Gerenciar checklists e inspeções', grupo: 'Frota' },
  { chave: 'aplicar_plano_preventivo_equip', label: 'Aplicar plano preventivo a equipamento', grupo: 'Frota' },

  // ============================================================
  // Manutenção
  // ============================================================
  { chave: 'ver_manutencao', label: 'Visualizar manutenção', grupo: 'Manutenção' },
  // OS
  { chave: 'criar_os', label: 'Criar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'editar_os', label: 'Editar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'excluir_os', label: 'Excluir Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'aprovar_os', label: 'Aprovar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'cancelar_os', label: 'Cancelar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'mudar_status_os', label: 'Mudar status da OS', grupo: 'Manutenção' },
  { chave: 'editar_diagnostico_os', label: 'Editar diagnóstico da OS', grupo: 'Manutenção' },
  { chave: 'adicionar_peca_os', label: 'Adicionar peça à OS', grupo: 'Manutenção' },
  { chave: 'adicionar_mao_obra_os', label: 'Adicionar mão de obra à OS', grupo: 'Manutenção' },
  { chave: 'ver_custos', label: 'Visualizar custos de manutenção', grupo: 'Manutenção' },
  // Planos preventivos
  { chave: 'ver_planos_preventivos', label: 'Visualizar planos preventivos', grupo: 'Manutenção' },
  { chave: 'criar_plano_preventivo', label: 'Criar plano preventivo', grupo: 'Manutenção' },
  { chave: 'editar_plano_preventivo', label: 'Editar plano preventivo', grupo: 'Manutenção' },
  { chave: 'excluir_plano_preventivo', label: 'Excluir plano preventivo', grupo: 'Manutenção' },
  { chave: 'ver_agenda_preventiva', label: 'Visualizar agenda preventiva', grupo: 'Manutenção' },
  // Almoxarifado de peças
  { chave: 'ver_almoxarifado', label: 'Visualizar almoxarifado', grupo: 'Manutenção' },
  { chave: 'criar_peca_almoxarifado', label: 'Cadastrar peça no almoxarifado', grupo: 'Manutenção' },
  { chave: 'editar_peca_almoxarifado', label: 'Editar peça no almoxarifado', grupo: 'Manutenção' },
  { chave: 'criar_entrada_almoxarifado', label: 'Lançar entrada no almoxarifado', grupo: 'Manutenção' },
  // Checklists pré-uso
  { chave: 'ver_checklists', label: 'Visualizar checklists pré-uso', grupo: 'Manutenção' },
  { chave: 'criar_checklist', label: 'Criar modelo de checklist', grupo: 'Manutenção' },
  { chave: 'executar_checklist', label: 'Executar checklist pré-uso', grupo: 'Manutenção' },
  { chave: 'bloquear_equipamento_checklist', label: 'Bloquear equipamento via checklist crítico', grupo: 'Manutenção' },

  // ============================================================
  // Apontamento RH
  // ============================================================
  { chave: 'ver_apontamento_rh', label: 'Acessar módulo Apontamento RH', grupo: 'Apontamento RH' },
  // Funcionários (no contexto do RH)
  { chave: 'criar_func_rh', label: 'Cadastrar funcionário', grupo: 'Apontamento RH' },
  { chave: 'editar_func_rh', label: 'Editar funcionário', grupo: 'Apontamento RH' },
  { chave: 'excluir_func_rh', label: 'Excluir funcionário', grupo: 'Apontamento RH' },
  // Equipes / Alocação
  { chave: 'gerenciar_equipes', label: 'Gerenciar equipes e alocação', grupo: 'Apontamento RH' },
  { chave: 'criar_equipe', label: 'Criar equipe', grupo: 'Apontamento RH' },
  { chave: 'editar_equipe', label: 'Editar equipe', grupo: 'Apontamento RH' },
  { chave: 'excluir_equipe', label: 'Excluir equipe', grupo: 'Apontamento RH' },
  { chave: 'alocar_funcionarios_equipe', label: 'Alocar funcionários em equipe', grupo: 'Apontamento RH' },
  { chave: 'transferir_equipe_obra', label: 'Transferir equipe entre obras', grupo: 'Apontamento RH' },
  // Ponto
  { chave: 'registrar_ponto', label: 'Registrar ponto da equipe', grupo: 'Apontamento RH' },
  { chave: 'registrar_ponto_lote', label: 'Registrar ponto em lote', grupo: 'Apontamento RH' },
  { chave: 'captura_facial_ponto', label: 'Captura facial / reconhecimento no ponto', grupo: 'Apontamento RH' },
  { chave: 'lancar_ponto_manual', label: 'Lançar saída manual de ponto', grupo: 'Apontamento RH' },
  { chave: 'editar_batida_ponto', label: 'Editar hora de uma batida', grupo: 'Apontamento RH' },
  { chave: 'excluir_batida_ponto', label: 'Excluir batida de ponto', grupo: 'Apontamento RH' },
  { chave: 'aprovar_lancamento_manual', label: 'Aprovar lançamento manual (supervisor)', grupo: 'Apontamento RH' },
  { chave: 'aprovar_ponto_diario', label: 'Aprovar ponto do dia (engenheiro)', grupo: 'Apontamento RH' },
  { chave: 'sincronizar_fila_offline', label: 'Sincronizar fila offline de ponto', grupo: 'Apontamento RH' },
  // Apontamento por serviço
  { chave: 'lancar_apontamento_servico', label: 'Lançar apontamento por serviço', grupo: 'Apontamento RH' },
  { chave: 'editar_apontamento_servico', label: 'Editar apontamento por serviço', grupo: 'Apontamento RH' },
  // Histórico de apontamentos
  { chave: 'ver_historico_apontamentos', label: 'Ver histórico de apontamentos', grupo: 'Apontamento RH' },
  { chave: 'editar_apontamentos', label: 'Editar apontamentos do histórico', grupo: 'Apontamento RH' },
  { chave: 'excluir_apontamentos', label: 'Excluir apontamentos do histórico', grupo: 'Apontamento RH' },
  // Ausências / Folha
  { chave: 'lancar_ausencia', label: 'Lançar falta / atestado / licença', grupo: 'Apontamento RH' },
  { chave: 'lancar_adiantamento', label: 'Lançar adiantamento quinzenal', grupo: 'Apontamento RH' },
  { chave: 'fechar_folha', label: 'Fechar folha mensal', grupo: 'Apontamento RH' },
  { chave: 'exportar_folha', label: 'Exportar folha (Excel/CSV)', grupo: 'Apontamento RH' },
  { chave: 'reabrir_periodo', label: 'Reabrir período fechado', grupo: 'Apontamento RH' },
  // Relatórios / Aprovações
  { chave: 'ver_relatorios_rh', label: 'Visualizar relatórios de RH', grupo: 'Apontamento RH' },
  { chave: 'ver_aprovacoes_rh', label: 'Ver aba de Aprovação (calendário diário)', grupo: 'Apontamento RH' },
  { chave: 'aprovar_apontamento_rh', label: 'Aprovar registro de ponto e apontamento por serviço', grupo: 'Apontamento RH' },
  { chave: 'reverter_aprovacao_rh', label: 'Reverter aprovação diária', grupo: 'Apontamento RH' },

  // ============================================================
  // Medição (RodoTracker)
  // ============================================================
  { chave: 'ver_medicao', label: 'Acessar o módulo de Medição', grupo: 'Medição' },
  // Obras de medição
  { chave: 'criar_obra_medicao', label: 'Criar obra de medição', grupo: 'Medição' },
  { chave: 'editar_obra_medicao', label: 'Editar obra de medição', grupo: 'Medição' },
  { chave: 'excluir_obra_medicao', label: 'Excluir obra de medição', grupo: 'Medição' },
  // Atividades
  { chave: 'criar_atividade_medicao', label: 'Lançar atividade no mapa', grupo: 'Medição' },
  { chave: 'editar_atividade_medicao', label: 'Editar atividade', grupo: 'Medição' },
  { chave: 'excluir_atividade_medicao', label: 'Excluir atividade', grupo: 'Medição' },
  { chave: 'upload_fotos_medicao', label: 'Upload de fotos da atividade', grupo: 'Medição' },
  { chave: 'upload_pdfs_medicao', label: 'Upload de PDFs (boletim)', grupo: 'Medição' },
  // Imports
  { chave: 'importar_cbuq_medicao', label: 'Importar CBUQ (Excel)', grupo: 'Medição' },
  { chave: 'importar_contrato_medicao', label: 'Importar contrato (Excel/CSV)', grupo: 'Medição' },
  { chave: 'baixar_template_contrato', label: 'Baixar template do contrato', grupo: 'Medição' },
  // Planejamento e contrato
  { chave: 'gerenciar_planejamento', label: 'Gerenciar planejamento de obra (Gantt)', grupo: 'Medição' },
  { chave: 'gerenciar_contrato', label: 'Gerenciar itens de contrato', grupo: 'Medição' },
  { chave: 'editar_itens_contrato', label: 'Editar itens do contrato (modo edição)', grupo: 'Medição' },
  // Período
  { chave: 'trocar_periodo_medicao', label: 'Avançar/voltar período de medição', grupo: 'Medição' },
  { chave: 'fechar_medicao', label: 'Fechar medição mensal', grupo: 'Medição' },
  { chave: 'exportar_medicao', label: 'Exportar relatórios de medição', grupo: 'Medição' },
  // Migração local → Supabase
  { chave: 'migrar_medicao_local', label: 'Migrar dados locais → Supabase (Medição)', grupo: 'Medição' },

  // ============================================================
  // Usuários e permissões
  // ============================================================
  { chave: 'ver_funcionarios', label: 'Visualizar usuários', grupo: 'Usuários' },
  { chave: 'criar_funcionarios', label: 'Cadastrar usuários', grupo: 'Usuários' },
  { chave: 'editar_funcionarios', label: 'Editar usuários', grupo: 'Usuários' },
  { chave: 'excluir_funcionarios', label: 'Excluir usuários', grupo: 'Usuários' },
  { chave: 'gerenciar_permissoes', label: 'Gerenciar permissões de outros usuários', grupo: 'Usuários' },
  { chave: 'ver_matriz_permissoes', label: 'Ver matriz de permissões', grupo: 'Usuários' },
  { chave: 'redefinir_senha', label: 'Redefinir senha de outros usuários', grupo: 'Usuários' },
  { chave: 'importar_funcionarios', label: 'Importar usuários via Excel', grupo: 'Usuários' },

  // ============================================================
  // Mobile (operações realizadas pelo app mobile)
  // ============================================================
  { chave: 'usar_app_mobile', label: 'Acessar o app mobile', grupo: 'Mobile' },
  { chave: 'bater_ponto_mobile', label: 'Bater ponto pelo mobile', grupo: 'Mobile' },
  { chave: 'saida_combustivel_mobile', label: 'Lançar saída de combustível pelo mobile', grupo: 'Mobile' },
  { chave: 'abrir_os_mobile', label: 'Abrir OS pelo mobile', grupo: 'Mobile' },
  { chave: 'executar_checklist_mobile', label: 'Executar checklist pelo mobile', grupo: 'Mobile' },
  { chave: 'lancar_medicao_mobile', label: 'Lançar atividade de medição pelo mobile', grupo: 'Mobile' },
  { chave: 'scan_qr_equipamento', label: 'Escanear QR de equipamento (Hub)', grupo: 'Mobile' },

  // ============================================================
  // Sistema / Administração
  // ============================================================
  { chave: 'migrar_dados', label: 'Executar migração de dados', grupo: 'Sistema' },
  { chave: 'ver_auditoria', label: 'Visualizar trilha de auditoria', grupo: 'Sistema' },
  { chave: 'configurar_sistema', label: 'Configurar parâmetros do sistema', grupo: 'Sistema' },
  { chave: 'gerenciar_integracao_supabase', label: 'Gerenciar integração com Supabase', grupo: 'Sistema' },
  { chave: 'limpar_cache_sistema', label: 'Limpar cache / dados locais', grupo: 'Sistema' },

  // ============================================================
  // Abas dos módulos (controlam a VISIBILIDADE de cada tab interna)
  //
  // Cada chave abaixo controla se determinada aba aparece na nav do
  // módulo. Útil pra esconder seções inteiras (ex: tirar a aba
  // "Lixeira" de quem não é admin, ou tirar "Pagamentos" de operadores).
  //
  // O usuário só vê o módulo se tiver `ver_<modulo>` (ex: `ver_frete`)
  // E tiver ao menos uma das abas habilitadas.
  // ============================================================

  // --- Frete ---
  { chave: 'aba_frete_dashboard', label: 'Aba: Dashboard de Frete', grupo: 'Abas · Frete' },
  { chave: 'aba_frete_fretes', label: 'Aba: Fretes', grupo: 'Abas · Frete' },
  { chave: 'aba_frete_pagamentos', label: 'Aba: Pagamentos', grupo: 'Abas · Frete' },
  { chave: 'aba_frete_conta_corrente', label: 'Aba: Conta Corrente', grupo: 'Abas · Frete' },
  { chave: 'aba_frete_pedidos', label: 'Aba: Pedidos de Material', grupo: 'Abas · Frete' },
  { chave: 'aba_frete_lixeira', label: 'Aba: Lixeira', grupo: 'Abas · Frete' },

  // --- Manutenção ---
  { chave: 'aba_manutencao_dashboard', label: 'Aba: Dashboard de Manutenção', grupo: 'Abas · Manutenção' },
  { chave: 'aba_manutencao_os', label: 'Aba: Ordens de Serviço', grupo: 'Abas · Manutenção' },
  { chave: 'aba_manutencao_agenda', label: 'Aba: Agenda Preventiva', grupo: 'Abas · Manutenção' },
  { chave: 'aba_manutencao_planos', label: 'Aba: Planos Preventivos', grupo: 'Abas · Manutenção' },
  { chave: 'aba_manutencao_almoxarifado', label: 'Aba: Almoxarifado', grupo: 'Abas · Manutenção' },
  { chave: 'aba_manutencao_checklists', label: 'Aba: Checklists pré-uso', grupo: 'Abas · Manutenção' },

  // --- Combustível ---
  { chave: 'aba_combustivel_visao_geral', label: 'Aba: Visão Geral', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_saidas', label: 'Aba: Saídas', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_entradas', label: 'Aba: Entradas', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_transferencias', label: 'Aba: Transferências', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_tanques', label: 'Aba: Tanques', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_consumidores', label: 'Aba: Equipamentos/Carretas', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_obras', label: 'Aba: Obras (combustível)', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_fornecedores', label: 'Aba: Fornecedores (combustível)', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_anomalias', label: 'Aba: Anomalias', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_relatorios', label: 'Aba: Relatórios', grupo: 'Abas · Combustível' },
  { chave: 'aba_combustivel_lixeira', label: 'Aba: Lixeira (combustível)', grupo: 'Abas · Combustível' },

  // --- Apontamento RH ---
  { chave: 'aba_rh_dashboard', label: 'Aba: Dashboard RH', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_funcionarios', label: 'Aba: Funcionários', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_alocacao', label: 'Aba: Alocação', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_ponto', label: 'Aba: Registro de Ponto', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_servico', label: 'Aba: Apontamento por Serviço', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_aprovacao', label: 'Aba: Aprovação', grupo: 'Abas · Apontamento RH' },
  { chave: 'aba_rh_historico', label: 'Aba: Histórico', grupo: 'Abas · Apontamento RH' },

  // --- Medição (Rodotracker) ---
  { chave: 'aba_medicao_mapa', label: 'Aba: Mapa de Atividades', grupo: 'Abas · Medição' },
  { chave: 'aba_medicao_planejamento', label: 'Aba: Planejamento (Gantt)', grupo: 'Abas · Medição' },
  { chave: 'aba_medicao_contrato', label: 'Aba: Medição/Contrato', grupo: 'Abas · Medição' },
];

export const TODAS_ACOES_PLATAFORMA: string[] = ACOES_PLATAFORMA.map((a) => a.chave);

export const GRUPOS_ACOES = [...new Set(ACOES_PLATAFORMA.map((a) => a.grupo))];

/**
 * Grupos cujos módulos ainda não estão implementados (rotas 404).
 * São escondidos da UI até que existam rotas reais.
 */
export const GRUPOS_NAO_IMPLEMENTADOS: ReadonlySet<string> = new Set([
  'Material',
  'Compras',
  'Sistema',
]);

export const GRUPOS_ACOES_VISIVEIS = GRUPOS_ACOES.filter(
  (g) => !GRUPOS_NAO_IMPLEMENTADOS.has(g)
);

export const ACOES_PLATAFORMA_VISIVEIS = ACOES_PLATAFORMA.filter(
  (a) => !GRUPOS_NAO_IMPLEMENTADOS.has(a.grupo)
);

/**
 * Ações cujo nome inclui "Excluir" — usadas pelas validações de dependência
 * e para flagging visual de permissões destrutivas no formulário.
 */
export const ACOES_DESTRUTIVAS: ReadonlySet<string> = new Set(
  ACOES_PLATAFORMA.filter((a) => /excluir/i.test(a.label)).map((a) => a.chave)
);

/**
 * Dependências lógicas entre ações.
 * Mapa: chave → lista de chaves que precisam estar marcadas.
 *
 * Regras:
 *   - "Excluir X" depende de "Visualizar X" (não faz sentido excluir sem ver)
 *   - "Editar X" depende de "Visualizar X"
 *   - "Aprovar X" depende de "Visualizar X"
 *   - "Excluir X" depende de "Editar X" (quem apaga deveria poder editar)
 *   - Filhos de um módulo dependem do "Acessar/Visualizar" do módulo
 */
export const DEPENDENCIAS_ACOES: Record<string, string[]> = {
  // Dashboard
  filtros_dashboard: ['ver_dashboard'],
  ver_dashboard_combustivel: ['ver_dashboard'],
  ver_dashboard_insumos: ['ver_dashboard'],
  ver_dashboard_manutencao: ['ver_dashboard'],
  ver_dashboard_obras: ['ver_dashboard'],

  // Obras
  criar_obras: ['ver_obras'],
  editar_obras: ['ver_obras'],
  excluir_obras: ['ver_obras', 'editar_obras'],
  importar_etapas_obra: ['ver_obras', 'editar_obras'],
  importar_equipamentos_obra: ['ver_obras', 'editar_obras'],
  exportar_orcamento: ['ver_obras'],
  gerenciar_tipos_equipamento_obra: ['ver_obras', 'editar_obras'],
  gerenciar_categorias_material_obra: ['ver_obras', 'editar_obras'],

  // Cadastros
  criar_cadastros: ['ver_cadastros'],
  editar_cadastros: ['ver_cadastros'],
  excluir_cadastros: ['ver_cadastros', 'editar_cadastros'],
  importar_cadastros: ['ver_cadastros', 'criar_cadastros'],
  editar_insumos: ['ver_cadastros'],
  excluir_insumos: ['ver_cadastros', 'editar_insumos'],
  exportar_insumos: ['ver_cadastros'],
  ver_etapas: ['ver_cadastros'],
  criar_etapas: ['ver_etapas'],
  editar_etapas: ['ver_etapas'],
  excluir_etapas: ['ver_etapas', 'editar_etapas'],
  unificar_funcionarios: ['ver_cadastros'],
  backfill_apontamentos: ['ver_cadastros', 'unificar_funcionarios'],

  // Frete
  criar_frete: ['ver_frete'],
  editar_frete: ['ver_frete'],
  excluir_frete: ['ver_frete', 'editar_frete'],
  exportar_frete: ['ver_frete'],
  importar_frete: ['ver_frete', 'editar_frete'],
  anexar_documentos_frete: ['ver_frete'],
  gerenciar_pagamentos_frete: ['ver_frete'],
  criar_pagamento_frete: ['ver_frete', 'gerenciar_pagamentos_frete'],
  editar_pagamento_frete: ['ver_frete', 'gerenciar_pagamentos_frete'],
  excluir_pagamento_frete: ['ver_frete', 'gerenciar_pagamentos_frete', 'editar_pagamento_frete'],
  ver_pedidos_material: ['ver_frete'],
  criar_pedido_material_frete: ['ver_pedidos_material'],
  editar_pedido_material_frete: ['ver_pedidos_material'],
  excluir_pedido_material_frete: ['ver_pedidos_material', 'editar_pedido_material_frete'],
  exportar_pedidos_material: ['ver_pedidos_material'],
  ver_extrato_transportadora: ['ver_frete'],
  exportar_extrato_transportadora: ['ver_extrato_transportadora'],
  ajustar_saldo_transportadora: ['ver_extrato_transportadora'],
  ver_lixeira_frete: ['ver_frete'],
  restaurar_lixeira_frete: ['ver_lixeira_frete'],

  // Combustível
  criar_entrada_combustivel: ['ver_combustivel'],
  criar_saida_combustivel: ['ver_combustivel'],
  criar_transferencia_combustivel: ['ver_combustivel'],
  editar_combustivel: ['ver_combustivel'],
  excluir_combustivel: ['ver_combustivel', 'editar_combustivel'],
  exportar_combustivel: ['ver_combustivel'],
  exportar_raw_combustivel: ['ver_combustivel', 'exportar_combustivel'],
  criar_abastecimento_carreta: ['ver_combustivel'],
  anexar_documentos_combustivel: ['ver_combustivel'],
  criar_tanque: ['ver_combustivel'],
  editar_tanque: ['ver_combustivel'],
  excluir_tanque: ['ver_combustivel', 'editar_tanque'],
  esvaziar_tanque: ['ver_combustivel', 'editar_tanque'],
  ver_anomalias_combustivel: ['ver_combustivel'],
  corrigir_anomalias_combustivel: ['ver_anomalias_combustivel'],
  salvar_views_combustivel: ['ver_combustivel'],
  ver_lixeira_combustivel: ['ver_combustivel'],
  restaurar_lixeira_combustivel: ['ver_lixeira_combustivel'],

  // Material
  criar_entrada_material: ['ver_materiais'],
  criar_saida_material: ['ver_materiais'],
  criar_transferencia_material: ['ver_materiais'],
  editar_material: ['ver_materiais'],
  excluir_material: ['ver_materiais', 'editar_material'],
  exportar_material: ['ver_materiais'],

  // Compras
  criar_compra: ['ver_compras'],
  editar_compra: ['ver_compras'],
  excluir_compra: ['ver_compras', 'editar_compra'],
  criar_pedido_material: ['ver_compras'],
  aprovar_pedido: ['ver_compras', 'criar_pedido_material'],
  criar_cotacao: ['ver_compras'],
  editar_cotacao: ['ver_compras'],
  exportar_cotacao_pdf: ['ver_compras', 'criar_cotacao'],
  anexar_pdf_cotacao: ['ver_compras', 'criar_cotacao'],
  criar_ordem_compra: ['ver_compras'],
  editar_ordem_compra: ['ver_compras', 'criar_ordem_compra'],
  aprovar_ordem_compra: ['ver_compras', 'criar_ordem_compra'],
  reabrir_ordem_compra: ['ver_compras', 'aprovar_ordem_compra'],
  gerar_entrada_estoque_oc: ['ver_compras', 'aprovar_ordem_compra'],
  importar_oc: ['ver_compras', 'criar_ordem_compra'],

  // Frota
  criar_veiculo: ['ver_frota'],
  editar_veiculo: ['ver_frota'],
  excluir_veiculo: ['ver_frota', 'editar_veiculo'],
  exportar_frota: ['ver_frota'],
  gerar_etiquetas_qr: ['ver_frota'],
  mudar_status_equipamento: ['ver_frota', 'editar_veiculo'],
  editar_especificacoes_equipamento: ['ver_frota', 'editar_veiculo'],
  ver_documentos_equipamento: ['ver_frota'],
  gerenciar_documentos_equipamento: ['ver_documentos_equipamento'],
  gerenciar_fotos_equipamento: ['ver_frota'],
  ver_financeiro_equipamento: ['ver_frota'],
  editar_financeiro_equipamento: ['ver_financeiro_equipamento'],
  ver_historico_equipamento: ['ver_frota'],
  ver_custos_pecas_equipamento: ['ver_frota'],
  gerenciar_checklists: ['ver_frota'],
  aplicar_plano_preventivo_equip: ['ver_frota'],

  // Manutenção
  criar_os: ['ver_manutencao'],
  editar_os: ['ver_manutencao'],
  excluir_os: ['ver_manutencao', 'editar_os'],
  aprovar_os: ['ver_manutencao'],
  cancelar_os: ['ver_manutencao', 'editar_os'],
  mudar_status_os: ['ver_manutencao', 'editar_os'],
  editar_diagnostico_os: ['ver_manutencao', 'editar_os'],
  adicionar_peca_os: ['ver_manutencao', 'editar_os'],
  adicionar_mao_obra_os: ['ver_manutencao', 'editar_os'],
  ver_custos: ['ver_manutencao'],
  ver_planos_preventivos: ['ver_manutencao'],
  criar_plano_preventivo: ['ver_planos_preventivos'],
  editar_plano_preventivo: ['ver_planos_preventivos'],
  excluir_plano_preventivo: ['ver_planos_preventivos', 'editar_plano_preventivo'],
  ver_agenda_preventiva: ['ver_manutencao'],
  ver_almoxarifado: ['ver_manutencao'],
  criar_peca_almoxarifado: ['ver_almoxarifado'],
  editar_peca_almoxarifado: ['ver_almoxarifado'],
  criar_entrada_almoxarifado: ['ver_almoxarifado'],
  ver_checklists: ['ver_manutencao'],
  criar_checklist: ['ver_checklists'],
  executar_checklist: ['ver_checklists'],
  bloquear_equipamento_checklist: ['ver_checklists', 'executar_checklist'],

  // Apontamento RH
  criar_func_rh: ['ver_apontamento_rh'],
  editar_func_rh: ['ver_apontamento_rh'],
  excluir_func_rh: ['ver_apontamento_rh', 'editar_func_rh'],
  gerenciar_equipes: ['ver_apontamento_rh'],
  criar_equipe: ['gerenciar_equipes'],
  editar_equipe: ['gerenciar_equipes'],
  excluir_equipe: ['gerenciar_equipes', 'editar_equipe'],
  alocar_funcionarios_equipe: ['gerenciar_equipes'],
  transferir_equipe_obra: ['gerenciar_equipes'],
  registrar_ponto: ['ver_apontamento_rh'],
  registrar_ponto_lote: ['registrar_ponto'],
  captura_facial_ponto: ['registrar_ponto'],
  lancar_ponto_manual: ['ver_apontamento_rh'],
  editar_batida_ponto: ['ver_apontamento_rh', 'registrar_ponto'],
  excluir_batida_ponto: ['ver_apontamento_rh', 'editar_batida_ponto'],
  aprovar_lancamento_manual: ['ver_apontamento_rh', 'lancar_ponto_manual'],
  aprovar_ponto_diario: ['ver_apontamento_rh'],
  sincronizar_fila_offline: ['ver_apontamento_rh', 'registrar_ponto'],
  lancar_apontamento_servico: ['ver_apontamento_rh'],
  editar_apontamento_servico: ['ver_apontamento_rh', 'lancar_apontamento_servico'],
  ver_historico_apontamentos: ['ver_apontamento_rh'],
  editar_apontamentos: ['ver_historico_apontamentos'],
  excluir_apontamentos: ['ver_historico_apontamentos', 'editar_apontamentos'],
  lancar_ausencia: ['ver_apontamento_rh'],
  lancar_adiantamento: ['ver_apontamento_rh'],
  fechar_folha: ['ver_apontamento_rh'],
  exportar_folha: ['ver_apontamento_rh'],
  reabrir_periodo: ['ver_apontamento_rh', 'fechar_folha'],
  ver_relatorios_rh: ['ver_apontamento_rh'],
  ver_aprovacoes_rh: ['ver_apontamento_rh'],
  aprovar_apontamento_rh: ['ver_apontamento_rh', 'ver_aprovacoes_rh'],
  reverter_aprovacao_rh: ['ver_apontamento_rh', 'aprovar_apontamento_rh'],

  // Medição
  criar_obra_medicao: ['ver_medicao'],
  editar_obra_medicao: ['ver_medicao'],
  excluir_obra_medicao: ['ver_medicao', 'editar_obra_medicao'],
  criar_atividade_medicao: ['ver_medicao'],
  editar_atividade_medicao: ['ver_medicao'],
  excluir_atividade_medicao: ['ver_medicao', 'editar_atividade_medicao'],
  upload_fotos_medicao: ['ver_medicao'],
  upload_pdfs_medicao: ['ver_medicao'],
  importar_cbuq_medicao: ['ver_medicao'],
  importar_contrato_medicao: ['ver_medicao', 'gerenciar_contrato'],
  baixar_template_contrato: ['ver_medicao'],
  gerenciar_planejamento: ['ver_medicao'],
  gerenciar_contrato: ['ver_medicao'],
  editar_itens_contrato: ['ver_medicao', 'gerenciar_contrato'],
  trocar_periodo_medicao: ['ver_medicao'],
  fechar_medicao: ['ver_medicao'],
  exportar_medicao: ['ver_medicao'],
  migrar_medicao_local: ['ver_medicao'],

  // Usuários
  criar_funcionarios: ['ver_funcionarios'],
  editar_funcionarios: ['ver_funcionarios'],
  excluir_funcionarios: ['ver_funcionarios', 'editar_funcionarios'],
  gerenciar_permissoes: ['ver_funcionarios', 'editar_funcionarios'],
  ver_matriz_permissoes: ['ver_funcionarios'],
  redefinir_senha: ['ver_funcionarios', 'editar_funcionarios'],
  importar_funcionarios: ['ver_funcionarios', 'criar_funcionarios'],

  // Mobile
  bater_ponto_mobile: ['usar_app_mobile', 'registrar_ponto'],
  saida_combustivel_mobile: ['usar_app_mobile', 'criar_saida_combustivel'],
  abrir_os_mobile: ['usar_app_mobile', 'criar_os'],
  executar_checklist_mobile: ['usar_app_mobile', 'executar_checklist'],
  lancar_medicao_mobile: ['usar_app_mobile', 'criar_atividade_medicao'],
  scan_qr_equipamento: ['usar_app_mobile', 'ver_frota'],
};

/**
 * Resolve TODAS as dependências (transitivas) de uma ação.
 * Ex: excluir_obras → [ver_obras, editar_obras]
 */
export function resolverDependencias(chave: string): string[] {
  const visitadas = new Set<string>();
  const stack = [...(DEPENDENCIAS_ACOES[chave] ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (visitadas.has(c)) continue;
    visitadas.add(c);
    stack.push(...(DEPENDENCIAS_ACOES[c] ?? []));
  }
  return [...visitadas];
}

/**
 * Detecta inconsistências numa lista de ações marcadas.
 * Retorna lista de mensagens de erro (vazio = OK).
 */
export function validarDependencias(acoes: string[]): string[] {
  const set = new Set(acoes);
  const labelDe = (k: string) => ACOES_PLATAFORMA.find((a) => a.chave === k)?.label ?? k;
  const grupoDe = (k: string) => ACOES_PLATAFORMA.find((a) => a.chave === k)?.grupo;

  // Filtra silenciosamente dependências envolvendo chaves de grupos
  // ocultos (Material, Compras, Sistema). Esses grupos estão escondidos
  // do formulário, então o admin não consegue marcar essas chaves — não
  // faz sentido cobrar dependências contra elas. Quando os módulos forem
  // implementados (removidos de GRUPOS_NAO_IMPLEMENTADOS), as validações
  // passam a ser cobradas automaticamente.
  function isOculto(k: string): boolean {
    const g = grupoDe(k);
    return !!g && GRUPOS_NAO_IMPLEMENTADOS.has(g);
  }

  const erros: string[] = [];
  for (const chave of acoes) {
    if (isOculto(chave)) continue;
    const deps = DEPENDENCIAS_ACOES[chave] ?? [];
    for (const d of deps) {
      if (isOculto(d)) continue;
      if (!set.has(d)) {
        erros.push(`"${labelDe(chave)}" requer também "${labelDe(d)}"`);
      }
    }
  }
  return erros;
}

// ============================================================
// Templates de Ações por Cargo (novo sistema granular)
// ============================================================

const T_VIEW_BASICO = ['ver_dashboard', 'filtros_dashboard'];
const T_MOBILE_OPERACIONAL = ['usar_app_mobile', 'scan_qr_equipamento'];

/**
 * Mapa cargo → lista de chaves de ações marcadas por padrão.
 * Usado pelo formulário ao criar usuário e ao trocar o select de Cargo.
 *
 * Princípio: menor privilégio. Quando em dúvida, deixe desmarcado —
 * o admin marca explicitamente as ações que precisa.
 */
export const TEMPLATES_ACOES_POR_CARGO: Record<CargoFuncionario, string[]> = {
  Administrador: [...TODAS_ACOES_PLATAFORMA],

  'Gerente Financeiro': [
    ...T_VIEW_BASICO,
    'ver_dashboard_combustivel', 'ver_dashboard_insumos', 'ver_dashboard_obras',
    'ver_obras', 'exportar_orcamento',
    'ver_cadastros', 'criar_cadastros', 'editar_cadastros', 'exportar_insumos',
    'ver_etapas',
    'ver_frete', 'criar_frete', 'editar_frete', 'exportar_frete',
    'gerenciar_pagamentos_frete', 'criar_pagamento_frete', 'editar_pagamento_frete',
    'ver_pedidos_material', 'exportar_pedidos_material',
    'ver_extrato_transportadora', 'exportar_extrato_transportadora',
    'ver_combustivel', 'exportar_combustivel', 'exportar_raw_combustivel',
    'ver_frota', 'ver_financeiro_equipamento', 'ver_custos_pecas_equipamento',
    'ver_manutencao', 'ver_custos',
    'ver_apontamento_rh', 'ver_relatorios_rh', 'fechar_folha', 'exportar_folha',
    'lancar_adiantamento',
    'ver_medicao', 'exportar_medicao', 'fechar_medicao',
    'ver_funcionarios',
  ],

  'Gerente de Compras': [
    ...T_VIEW_BASICO,
    'ver_dashboard_insumos',
    'ver_obras',
    'ver_cadastros', 'criar_cadastros', 'editar_cadastros', 'importar_cadastros',
    'editar_insumos', 'exportar_insumos',
    'ver_etapas',
    'ver_frete', 'criar_frete', 'editar_frete', 'exportar_frete',
    'ver_pedidos_material', 'criar_pedido_material_frete', 'editar_pedido_material_frete',
    'exportar_pedidos_material',
    'ver_combustivel', 'criar_entrada_combustivel', 'exportar_combustivel',
    'ver_compras', 'criar_compra', 'editar_compra',
    'criar_pedido_material', 'aprovar_pedido',
    'criar_cotacao', 'editar_cotacao', 'exportar_cotacao_pdf', 'anexar_pdf_cotacao',
    'criar_ordem_compra', 'editar_ordem_compra', 'aprovar_ordem_compra',
    'gerar_entrada_estoque_oc', 'importar_oc',
    'ver_frota',
    'ver_manutencao', 'ver_almoxarifado', 'criar_peca_almoxarifado',
    'criar_entrada_almoxarifado',
    'ver_funcionarios',
  ],

  Gerente: [
    ...T_VIEW_BASICO,
    'ver_dashboard_combustivel', 'ver_dashboard_insumos',
    'ver_dashboard_manutencao', 'ver_dashboard_obras',
    'ver_obras', 'criar_obras', 'editar_obras',
    'importar_etapas_obra', 'importar_equipamentos_obra', 'exportar_orcamento',
    'gerenciar_tipos_equipamento_obra', 'gerenciar_categorias_material_obra',
    'ver_cadastros', 'criar_cadastros', 'editar_cadastros', 'importar_cadastros',
    'editar_insumos', 'exportar_insumos',
    'ver_etapas', 'criar_etapas', 'editar_etapas',
    'ver_frete', 'criar_frete', 'editar_frete', 'exportar_frete',
    'anexar_documentos_frete',
    'gerenciar_pagamentos_frete', 'criar_pagamento_frete', 'editar_pagamento_frete',
    'ver_pedidos_material', 'criar_pedido_material_frete', 'editar_pedido_material_frete',
    'exportar_pedidos_material',
    'ver_extrato_transportadora', 'exportar_extrato_transportadora',
    'ver_combustivel', 'criar_entrada_combustivel', 'criar_saida_combustivel',
    'criar_transferencia_combustivel', 'editar_combustivel', 'exportar_combustivel',
    'exportar_raw_combustivel', 'criar_abastecimento_carreta',
    'anexar_documentos_combustivel', 'ver_anomalias_combustivel',
    'corrigir_anomalias_combustivel', 'salvar_views_combustivel',
    'criar_tanque', 'editar_tanque',
    'ver_frota', 'criar_veiculo', 'editar_veiculo', 'exportar_frota',
    'gerar_etiquetas_qr', 'mudar_status_equipamento',
    'editar_especificacoes_equipamento',
    'ver_documentos_equipamento', 'gerenciar_documentos_equipamento',
    'gerenciar_fotos_equipamento',
    'ver_financeiro_equipamento', 'editar_financeiro_equipamento',
    'ver_historico_equipamento', 'ver_custos_pecas_equipamento',
    'gerenciar_checklists', 'aplicar_plano_preventivo_equip',
    'ver_manutencao', 'criar_os', 'editar_os', 'aprovar_os',
    'mudar_status_os', 'editar_diagnostico_os',
    'adicionar_peca_os', 'adicionar_mao_obra_os', 'ver_custos',
    'ver_planos_preventivos', 'criar_plano_preventivo', 'editar_plano_preventivo',
    'ver_agenda_preventiva',
    'ver_almoxarifado', 'criar_peca_almoxarifado', 'editar_peca_almoxarifado',
    'criar_entrada_almoxarifado',
    'ver_checklists', 'criar_checklist',
    'ver_apontamento_rh', 'gerenciar_equipes',
    'criar_equipe', 'editar_equipe', 'alocar_funcionarios_equipe', 'transferir_equipe_obra',
    'registrar_ponto', 'aprovar_lancamento_manual', 'aprovar_ponto_diario',
    'lancar_apontamento_servico', 'editar_apontamento_servico',
    'ver_historico_apontamentos', 'editar_apontamentos',
    'ver_relatorios_rh', 'ver_aprovacoes_rh',
    'aprovar_apontamento_rh', 'reverter_aprovacao_rh',
    'lancar_ausencia', 'lancar_adiantamento',
    'fechar_folha', 'exportar_folha',
    'ver_medicao', 'criar_obra_medicao', 'editar_obra_medicao',
    'criar_atividade_medicao', 'editar_atividade_medicao',
    'upload_fotos_medicao', 'upload_pdfs_medicao',
    'importar_cbuq_medicao', 'importar_contrato_medicao', 'baixar_template_contrato',
    'gerenciar_planejamento', 'gerenciar_contrato', 'editar_itens_contrato',
    'trocar_periodo_medicao',
    'fechar_medicao', 'exportar_medicao',
    'ver_funcionarios',
  ],

  Supervisor: [
    ...T_VIEW_BASICO, ...T_MOBILE_OPERACIONAL,
    'ver_dashboard_combustivel', 'ver_dashboard_manutencao',
    'ver_obras', 'editar_obras',
    'ver_cadastros', 'criar_cadastros', 'editar_cadastros',
    'editar_insumos', 'exportar_insumos',
    'ver_etapas',
    'ver_frete', 'criar_frete', 'editar_frete', 'anexar_documentos_frete',
    'ver_pedidos_material', 'criar_pedido_material_frete', 'editar_pedido_material_frete',
    'ver_combustivel', 'criar_entrada_combustivel', 'criar_saida_combustivel',
    'criar_transferencia_combustivel', 'editar_combustivel',
    'criar_abastecimento_carreta', 'anexar_documentos_combustivel',
    'ver_anomalias_combustivel', 'salvar_views_combustivel',
    'ver_frota', 'gerenciar_checklists', 'mudar_status_equipamento',
    'ver_documentos_equipamento', 'gerenciar_fotos_equipamento',
    'ver_historico_equipamento',
    'ver_manutencao', 'criar_os', 'editar_os',
    'mudar_status_os', 'editar_diagnostico_os',
    'adicionar_peca_os', 'adicionar_mao_obra_os',
    'ver_almoxarifado', 'criar_entrada_almoxarifado',
    'ver_checklists', 'executar_checklist',
    'ver_apontamento_rh', 'gerenciar_equipes',
    'criar_equipe', 'editar_equipe', 'alocar_funcionarios_equipe',
    'registrar_ponto', 'registrar_ponto_lote', 'captura_facial_ponto',
    'lancar_ponto_manual', 'aprovar_lancamento_manual',
    'editar_batida_ponto', 'sincronizar_fila_offline',
    'lancar_apontamento_servico', 'editar_apontamento_servico',
    'ver_historico_apontamentos',
    'lancar_ausencia',
    'ver_aprovacoes_rh',
    'ver_medicao', 'criar_atividade_medicao', 'editar_atividade_medicao',
    'upload_fotos_medicao',
    // Mobile
    'bater_ponto_mobile', 'executar_checklist_mobile',
    'abrir_os_mobile', 'saida_combustivel_mobile',
  ],

  'Engenheiro Civil Sênior': [
    ...T_VIEW_BASICO, ...T_MOBILE_OPERACIONAL,
    'ver_dashboard_combustivel', 'ver_dashboard_insumos',
    'ver_dashboard_manutencao', 'ver_dashboard_obras',
    'ver_obras', 'criar_obras', 'editar_obras', 'exportar_orcamento',
    'ver_cadastros', 'editar_cadastros',
    'ver_etapas', 'criar_etapas', 'editar_etapas',
    'ver_frete', 'anexar_documentos_frete',
    'ver_pedidos_material',
    'ver_combustivel', 'ver_anomalias_combustivel',
    'ver_frota', 'ver_documentos_equipamento', 'ver_historico_equipamento',
    'gerenciar_checklists',
    'ver_manutencao', 'aprovar_os', 'ver_custos',
    'mudar_status_os',
    'ver_planos_preventivos', 'ver_agenda_preventiva',
    'ver_checklists', 'executar_checklist',
    'ver_apontamento_rh', 'aprovar_ponto_diario',
    'ver_aprovacoes_rh', 'aprovar_apontamento_rh',
    'ver_relatorios_rh', 'ver_historico_apontamentos',
    'lancar_ausencia',
    'ver_medicao', 'criar_obra_medicao', 'editar_obra_medicao',
    'criar_atividade_medicao', 'editar_atividade_medicao',
    'upload_fotos_medicao', 'upload_pdfs_medicao',
    'importar_cbuq_medicao', 'importar_contrato_medicao',
    'gerenciar_planejamento', 'gerenciar_contrato', 'editar_itens_contrato',
    'trocar_periodo_medicao',
    'exportar_medicao',
    // Mobile
    'executar_checklist_mobile', 'lancar_medicao_mobile', 'abrir_os_mobile',
  ],

  'Engenheiro Civil': [
    ...T_VIEW_BASICO, ...T_MOBILE_OPERACIONAL,
    'ver_dashboard_obras',
    'ver_obras', 'editar_obras',
    'ver_cadastros', 'ver_etapas',
    'ver_combustivel',
    'ver_frota', 'ver_documentos_equipamento',
    'gerenciar_checklists',
    'ver_manutencao', 'ver_planos_preventivos',
    'ver_checklists', 'executar_checklist',
    'ver_apontamento_rh', 'aprovar_ponto_diario',
    'ver_aprovacoes_rh',
    'ver_medicao', 'criar_atividade_medicao', 'editar_atividade_medicao',
    'upload_fotos_medicao',
    // Mobile
    'executar_checklist_mobile', 'lancar_medicao_mobile',
  ],

  Operador: [
    'ver_dashboard', ...T_MOBILE_OPERACIONAL,
    'ver_frete', 'criar_frete', 'anexar_documentos_frete',
    'ver_combustivel', 'criar_entrada_combustivel', 'criar_saida_combustivel',
    'criar_abastecimento_carreta', 'anexar_documentos_combustivel',
    'ver_frota', 'gerenciar_checklists',
    'ver_documentos_equipamento',
    'ver_checklists', 'executar_checklist',
    // Mobile
    'executar_checklist_mobile', 'saida_combustivel_mobile',
  ],

  Apontador: [
    'ver_dashboard', ...T_MOBILE_OPERACIONAL,
    'ver_combustivel', 'criar_entrada_combustivel', 'criar_saida_combustivel',
    'criar_abastecimento_carreta', 'anexar_documentos_combustivel',
    'ver_frota', 'gerenciar_checklists',
    'ver_checklists', 'executar_checklist',
    'ver_apontamento_rh',
    'registrar_ponto', 'registrar_ponto_lote', 'captura_facial_ponto',
    'sincronizar_fila_offline',
    'lancar_apontamento_servico',
    // Mobile
    'bater_ponto_mobile', 'executar_checklist_mobile', 'saida_combustivel_mobile',
  ],

  Financeiro: [
    ...T_VIEW_BASICO,
    'ver_dashboard_combustivel', 'ver_dashboard_insumos', 'ver_dashboard_obras',
    'ver_obras', 'exportar_orcamento',
    'ver_cadastros', 'exportar_insumos',
    'ver_etapas',
    'ver_frete', 'exportar_frete',
    'gerenciar_pagamentos_frete', 'criar_pagamento_frete', 'editar_pagamento_frete',
    'ver_pedidos_material', 'exportar_pedidos_material',
    'ver_extrato_transportadora', 'exportar_extrato_transportadora',
    'ver_combustivel', 'exportar_combustivel', 'exportar_raw_combustivel',
    'ver_frota', 'ver_financeiro_equipamento', 'ver_custos_pecas_equipamento',
    'ver_manutencao', 'ver_custos',
    'ver_apontamento_rh', 'ver_relatorios_rh',
    'lancar_adiantamento', 'fechar_folha', 'exportar_folha',
    'ver_medicao', 'exportar_medicao',
  ],
};

// ============================================================
// Distribuição automática de ABAS por cargo
// ============================================================
//
// As 33 chaves de "Abas dos módulos" (aba_frete_*, aba_manutencao_*, etc.)
// são distribuídas aqui em um passo pós-processado, para evitar repetição
// nos templates acima.
//
// Regra:
//   - Administrador     → todas as abas (já incluso via TODAS_ACOES_PLATAFORMA)
//   - Gerente, Sup., Eng. Sênior → todas as abas (operação completa)
//   - Eng. Civil, Gerente Financeiro, Gerente Compras, Financeiro → exceto lixeiras
//   - Operador          → só abas operacionais essenciais do que vê
//   - Apontador         → só abas operacionais essenciais do que vê

const ABAS_TODAS = ACOES_PLATAFORMA
  .filter((a) => a.chave.startsWith('aba_'))
  .map((a) => a.chave);

const ABAS_SEM_LIXEIRA = ABAS_TODAS.filter(
  (k) => !k.includes('lixeira'),
);

const ABAS_OPERADOR = [
  // Frete: operador só lança/vê fretes, não vê pagamentos/extrato
  'aba_frete_fretes',
  // Combustível: saídas/entradas/transferências
  'aba_combustivel_visao_geral',
  'aba_combustivel_saidas',
  'aba_combustivel_entradas',
  'aba_combustivel_transferencias',
];

const ABAS_APONTADOR = [
  // RH: só ponto e serviço
  'aba_rh_ponto',
  'aba_rh_servico',
  // Combustível básico
  'aba_combustivel_visao_geral',
  'aba_combustivel_saidas',
  'aba_combustivel_entradas',
];

// Injeta abas em cada cargo (sem mutar os arrays originais)
function withAbas(perms: string[], abas: string[]): string[] {
  return Array.from(new Set([...perms, ...abas]));
}

TEMPLATES_ACOES_POR_CARGO.Gerente = withAbas(TEMPLATES_ACOES_POR_CARGO.Gerente, ABAS_TODAS);
TEMPLATES_ACOES_POR_CARGO.Supervisor = withAbas(TEMPLATES_ACOES_POR_CARGO.Supervisor, ABAS_TODAS);
TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil Sênior'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil Sênior'],
  ABAS_SEM_LIXEIRA,
);
TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil'],
  ABAS_SEM_LIXEIRA.filter(
    (k) =>
      !k.startsWith('aba_combustivel_') ||
      ['aba_combustivel_visao_geral'].includes(k),
  ),
);
TEMPLATES_ACOES_POR_CARGO['Gerente Financeiro'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Gerente Financeiro'],
  ABAS_SEM_LIXEIRA,
);
TEMPLATES_ACOES_POR_CARGO['Gerente de Compras'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Gerente de Compras'],
  ABAS_SEM_LIXEIRA,
);
TEMPLATES_ACOES_POR_CARGO.Financeiro = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Financeiro,
  ABAS_SEM_LIXEIRA,
);
TEMPLATES_ACOES_POR_CARGO.Operador = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Operador,
  ABAS_OPERADOR,
);
TEMPLATES_ACOES_POR_CARGO.Apontador = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Apontador,
  ABAS_APONTADOR,
);

// ============================================================
// Distribuição automática dos cadastros granulares (cards do Hub)
// ============================================================
//
// Cada card do CadastrosHub usa uma chave própria (criar_localidades,
// criar_fornecedores, etc.). Aqui distribuímos essas 40 chaves nos
// templates para que o card apareça em cada cargo relevante.

const CADASTROS_GRANULARES_CRUD = [
  // Localidades
  'criar_localidades', 'editar_localidades', 'excluir_localidades',
  // Empresas
  'criar_empresas', 'editar_empresas', 'excluir_empresas',
  // Colaboradores
  'criar_colaboradores', 'editar_colaboradores', 'excluir_colaboradores',
  // Insumos
  'criar_insumos',
  // Tipos de insumo
  'criar_tipos_insumo', 'editar_tipos_insumo', 'excluir_tipos_insumo',
  // Categorias de material
  'criar_categorias_material', 'editar_categorias_material', 'excluir_categorias_material',
  // Unidades
  'criar_unidades', 'editar_unidades', 'excluir_unidades',
  // Depósitos
  'criar_depositos_material', 'editar_depositos_material', 'excluir_depositos_material',
  // Fornecedores
  'criar_fornecedores', 'editar_fornecedores', 'excluir_fornecedores',
  // Tipos de equipamento
  'criar_tipos_equipamento', 'editar_tipos_equipamento', 'excluir_tipos_equipamento',
  // Equipamentos
  'criar_equipamentos', 'editar_equipamentos', 'excluir_equipamentos',
  // Tanques
  'criar_tanques', 'editar_tanques', 'excluir_tanques',
];

const CADASTROS_GRANULARES_VIEW_ONLY = CADASTROS_GRANULARES_CRUD.filter(
  (k) => k.startsWith('editar_')
);

const CADASTROS_GRANULARES_CRIAR_EDITAR = CADASTROS_GRANULARES_CRUD.filter(
  (k) => !k.startsWith('excluir_')
);

TEMPLATES_ACOES_POR_CARGO.Gerente = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Gerente,
  CADASTROS_GRANULARES_CRUD,
);
TEMPLATES_ACOES_POR_CARGO['Gerente Financeiro'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Gerente Financeiro'],
  CADASTROS_GRANULARES_VIEW_ONLY,
);
TEMPLATES_ACOES_POR_CARGO['Gerente de Compras'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Gerente de Compras'],
  CADASTROS_GRANULARES_CRUD,
);
TEMPLATES_ACOES_POR_CARGO.Supervisor = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Supervisor,
  CADASTROS_GRANULARES_CRIAR_EDITAR,
);
TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil Sênior'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil Sênior'],
  CADASTROS_GRANULARES_CRIAR_EDITAR,
);
TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil'] = withAbas(
  TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil'],
  CADASTROS_GRANULARES_VIEW_ONLY,
);
TEMPLATES_ACOES_POR_CARGO.Financeiro = withAbas(
  TEMPLATES_ACOES_POR_CARGO.Financeiro,
  CADASTROS_GRANULARES_VIEW_ONLY,
);

/**
 * Permissões consideradas perigosas para cargos operacionais.
 * O formulário mostra um aviso quando o admin marca uma delas
 * para um cargo de baixa hierarquia.
 */
export const ACOES_PERIGOSAS_OPERACIONAL: ReadonlySet<string> = new Set([
  // Excluir entidades
  'excluir_veiculo',
  'excluir_combustivel',
  'excluir_obras',
  'excluir_cadastros',
  'excluir_etapas',
  'excluir_insumos',
  'excluir_frete',
  'excluir_pagamento_frete',
  'excluir_pedido_material_frete',
  'excluir_func_rh',
  'excluir_funcionarios',
  'excluir_equipe',
  'excluir_apontamentos',
  'excluir_batida_ponto',
  'excluir_os',
  'excluir_plano_preventivo',
  'excluir_compra',
  'excluir_obra_medicao',
  'excluir_atividade_medicao',
  'excluir_material',
  'excluir_tanque',
  // Aprovações e operações financeiras
  'aprovar_pedido',
  'aprovar_ordem_compra',
  'aprovar_os',
  'aprovar_ponto_diario',
  'aprovar_lancamento_manual',
  'aprovar_apontamento_rh',
  'reverter_aprovacao_rh',
  'ajustar_saldo_transportadora',
  'esvaziar_tanque',
  'gerar_entrada_estoque_oc',
  'reabrir_ordem_compra',
  'gerenciar_pagamentos_frete',
  // Operações de fechamento / período
  'fechar_folha',
  'reabrir_periodo',
  'fechar_medicao',
  // Restaurar / lixeira (operação reversa, ainda assim sensível)
  'restaurar_lixeira_frete',
  'restaurar_lixeira_combustivel',
  // Bloqueio operacional
  'bloquear_equipamento_checklist',
  'mudar_status_equipamento',
  // Gestão de usuários
  'gerenciar_permissoes',
  'redefinir_senha',
  'ver_matriz_permissoes',
  'importar_funcionarios',
  'unificar_funcionarios',
  'backfill_apontamentos',
  // Sistema
  'migrar_dados',
  'configurar_sistema',
  'gerenciar_integracao_supabase',
  'limpar_cache_sistema',
  'migrar_medicao_local',
]);

export const CARGOS_OPERACIONAIS: ReadonlySet<CargoFuncionario> = new Set<CargoFuncionario>([
  'Operador',
  'Apontador',
  'Engenheiro Civil',
]);

export function acoesPadraoDoCargo(cargo: CargoFuncionario): string[] {
  return [...(TEMPLATES_ACOES_POR_CARGO[cargo] ?? [])];
}

export function permissoesVazias(): PermissoesFuncionario {
  return {
    dashboard: [],
    cadastros: [],
    frete: [],
    frota: [],
    funcionarios: [],
  };
}
