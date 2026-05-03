import type { AcaoPermissao, CargoFuncionario, ModuloPermissao, PermissoesFuncionario } from '../types';

export const MODULOS: { valor: ModuloPermissao; label: string }[] = [
  { valor: 'dashboard', label: 'Dashboard' },
  { valor: 'cadastros', label: 'Cadastros' },
  { valor: 'frete', label: 'Frete' },
  { valor: 'frota', label: 'Frota' },
  { valor: 'funcionarios', label: 'Usuários' },
  { valor: 'apontamentos', label: 'Apontamentos' },
  { valor: 'manutencao', label: 'Manutenção' },
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
  apontamentos: TODAS,
  manutencao: TODAS,
};

export const PERFIL_GERENTE: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: VCE,
  apontamentos: VCEEX,
  manutencao: VCE,
};

export const PERFIL_SUPERVISOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
  apontamentos: VCE,
  manutencao: VCE,
};

export const PERFIL_OPERADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: V,
  manutencao: V,
};

export const PERFIL_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: V,
  frete: VE,
  frota: V,
  funcionarios: V,
  apontamentos: V,
  manutencao: V,
};

export const PERFIL_APONTADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: VCEEX,
  manutencao: V,
};

export const PERFIL_GERENTE_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
  apontamentos: V,
  manutencao: V,
};

export const PERFIL_GERENTE_COMPRAS: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCEEX,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
  apontamentos: V,
  manutencao: V,
};

export const PERFIL_ENGENHEIRO_CIVIL_SENIOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
  apontamentos: VCE,
  manutencao: VCE,
};

export const PERFIL_ENGENHEIRO_CIVIL: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: VCE,
  manutencao: V,
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
  // Dashboard
  { chave: 'ver_dashboard', label: 'Visualizar o Dashboard', grupo: 'Dashboard' },
  { chave: 'filtros_dashboard', label: 'Ajustar filtros do Dashboard', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_combustivel', label: 'Ver dashboard de combustível', grupo: 'Dashboard' },
  { chave: 'ver_dashboard_insumos', label: 'Ver dashboard de insumos', grupo: 'Dashboard' },

  // Obras
  { chave: 'ver_obras', label: 'Visualizar obras', grupo: 'Obras' },
  { chave: 'criar_obras', label: 'Criar obras', grupo: 'Obras' },
  { chave: 'editar_obras', label: 'Editar obras', grupo: 'Obras' },
  { chave: 'excluir_obras', label: 'Excluir obras', grupo: 'Obras' },

  // Cadastros (insumos, equipamentos, fornecedores, etc.)
  { chave: 'ver_cadastros', label: 'Visualizar cadastros', grupo: 'Cadastros' },
  { chave: 'criar_cadastros', label: 'Criar novos cadastros', grupo: 'Cadastros' },
  { chave: 'editar_cadastros', label: 'Editar cadastros', grupo: 'Cadastros' },
  { chave: 'excluir_cadastros', label: 'Excluir cadastros', grupo: 'Cadastros' },
  { chave: 'editar_insumos', label: 'Editar insumos', grupo: 'Cadastros' },
  { chave: 'excluir_insumos', label: 'Excluir insumos', grupo: 'Cadastros' },
  { chave: 'exportar_insumos', label: 'Exportar insumos', grupo: 'Cadastros' },

  // Frete
  { chave: 'ver_frete', label: 'Visualizar fretes', grupo: 'Frete' },
  { chave: 'criar_frete', label: 'Criar frete', grupo: 'Frete' },
  { chave: 'editar_frete', label: 'Editar frete', grupo: 'Frete' },
  { chave: 'excluir_frete', label: 'Excluir frete', grupo: 'Frete' },
  { chave: 'exportar_frete', label: 'Exportar fretes', grupo: 'Frete' },
  { chave: 'gerenciar_pagamentos_frete', label: 'Gerenciar pagamentos de frete', grupo: 'Frete' },

  // Combustível
  { chave: 'ver_combustivel', label: 'Visualizar combustível', grupo: 'Combustível' },
  { chave: 'criar_entrada_combustivel', label: 'Lançar entrada de combustível', grupo: 'Combustível' },
  { chave: 'criar_saida_combustivel', label: 'Lançar saída de combustível', grupo: 'Combustível' },
  { chave: 'criar_transferencia_combustivel', label: 'Transferir combustível', grupo: 'Combustível' },
  { chave: 'editar_combustivel', label: 'Editar movimentações de combustível', grupo: 'Combustível' },
  { chave: 'excluir_combustivel', label: 'Excluir movimentações de combustível', grupo: 'Combustível' },
  { chave: 'exportar_combustivel', label: 'Exportar combustível', grupo: 'Combustível' },
  { chave: 'criar_abastecimento_carreta', label: 'Lançar abastecimento de carreta', grupo: 'Combustível' },

  // Material / Almoxarifado
  { chave: 'ver_materiais', label: 'Visualizar movimentações de material', grupo: 'Material' },
  { chave: 'criar_entrada_material', label: 'Lançar entrada de material', grupo: 'Material' },
  { chave: 'criar_saida_material', label: 'Lançar saída de material', grupo: 'Material' },
  { chave: 'criar_transferencia_material', label: 'Transferir material', grupo: 'Material' },
  { chave: 'editar_material', label: 'Editar movimentações de material', grupo: 'Material' },
  { chave: 'excluir_material', label: 'Excluir movimentações de material', grupo: 'Material' },

  // Compras e pedidos
  { chave: 'ver_compras', label: 'Visualizar compras', grupo: 'Compras' },
  { chave: 'criar_compra', label: 'Criar compra', grupo: 'Compras' },
  { chave: 'editar_compra', label: 'Editar compra', grupo: 'Compras' },
  { chave: 'excluir_compra', label: 'Excluir compra', grupo: 'Compras' },
  { chave: 'criar_pedido_material', label: 'Criar pedido de material', grupo: 'Compras' },
  { chave: 'aprovar_pedido', label: 'Aprovar pedido de material', grupo: 'Compras' },
  { chave: 'criar_cotacao', label: 'Criar cotação', grupo: 'Compras' },
  { chave: 'criar_ordem_compra', label: 'Criar ordem de compra', grupo: 'Compras' },
  { chave: 'aprovar_ordem_compra', label: 'Aprovar ordem de compra', grupo: 'Compras' },

  // Frota
  { chave: 'ver_frota', label: 'Visualizar frota', grupo: 'Frota' },
  { chave: 'criar_veiculo', label: 'Cadastrar veículo/equipamento', grupo: 'Frota' },
  { chave: 'editar_veiculo', label: 'Editar veículo/equipamento', grupo: 'Frota' },
  { chave: 'excluir_veiculo', label: 'Excluir veículo/equipamento', grupo: 'Frota' },
  { chave: 'gerenciar_checklists', label: 'Gerenciar checklists e inspeções', grupo: 'Frota' },

  // Manutenção
  { chave: 'ver_manutencao', label: 'Visualizar manutenção', grupo: 'Manutenção' },
  { chave: 'criar_os', label: 'Criar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'editar_os', label: 'Editar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'excluir_os', label: 'Excluir Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'aprovar_os', label: 'Aprovar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'ver_custos', label: 'Visualizar custos de manutenção', grupo: 'Manutenção' },
  { chave: 'executar_manutencao', label: 'Executar manutenção em campo (registrar)', grupo: 'Manutenção' },
  { chave: 'editar_manutencao', label: 'Editar registros e agendamentos de manutenção', grupo: 'Manutenção' },
  { chave: 'gerenciar_catalogo_manutencao', label: 'Gerenciar catálogo (modelos, tarefas, peças, fluidos)', grupo: 'Manutenção' },

  // Apontamentos (legado — clock in/out por etapa de obra)
  { chave: 'ver_apontamentos', label: 'Visualizar apontamentos', grupo: 'Apontamentos' },
  { chave: 'criar_apontamentos', label: 'Criar apontamentos', grupo: 'Apontamentos' },
  { chave: 'editar_apontamentos', label: 'Editar apontamentos', grupo: 'Apontamentos' },
  { chave: 'excluir_apontamentos', label: 'Excluir apontamentos', grupo: 'Apontamentos' },

  // Apontamento RH (novo módulo: ponto + serviço + folha)
  { chave: 'ver_apontamento_rh', label: 'Acessar módulo Apontamento RH', grupo: 'Apontamento RH' },
  { chave: 'criar_func_rh', label: 'Cadastrar funcionário', grupo: 'Apontamento RH' },
  { chave: 'editar_func_rh', label: 'Editar funcionário', grupo: 'Apontamento RH' },
  { chave: 'excluir_func_rh', label: 'Excluir funcionário', grupo: 'Apontamento RH' },
  { chave: 'gerenciar_equipes', label: 'Gerenciar equipes e alocação', grupo: 'Apontamento RH' },
  { chave: 'registrar_ponto', label: 'Registrar ponto da equipe', grupo: 'Apontamento RH' },
  { chave: 'lancar_ponto_manual', label: 'Lançar saída manual de ponto', grupo: 'Apontamento RH' },
  { chave: 'aprovar_lancamento_manual', label: 'Aprovar lançamento manual (supervisor)', grupo: 'Apontamento RH' },
  { chave: 'aprovar_ponto_diario', label: 'Aprovar ponto do dia (engenheiro)', grupo: 'Apontamento RH' },
  { chave: 'lancar_apontamento_servico', label: 'Lançar apontamento por serviço', grupo: 'Apontamento RH' },
  { chave: 'editar_apontamento_servico', label: 'Editar apontamento por serviço', grupo: 'Apontamento RH' },
  { chave: 'lancar_ausencia', label: 'Lançar falta / atestado / licença', grupo: 'Apontamento RH' },
  { chave: 'lancar_adiantamento', label: 'Lançar adiantamento quinzenal', grupo: 'Apontamento RH' },
  { chave: 'fechar_folha', label: 'Fechar folha mensal', grupo: 'Apontamento RH' },
  { chave: 'exportar_folha', label: 'Exportar folha (Excel/CSV)', grupo: 'Apontamento RH' },
  { chave: 'reabrir_periodo', label: 'Reabrir período fechado', grupo: 'Apontamento RH' },
  { chave: 'ver_relatorios_rh', label: 'Visualizar relatórios de RH', grupo: 'Apontamento RH' },
  { chave: 'ver_aprovacoes_rh', label: 'Ver aba de Aprovação (calendário diário)', grupo: 'Apontamento RH' },
  { chave: 'aprovar_apontamento_rh', label: 'Aprovar registro de ponto e apontamento por serviço', grupo: 'Apontamento RH' },

  // Medição (RodoTracker)
  { chave: 'ver_medicao', label: 'Acessar o módulo de Medição', grupo: 'Medição' },
  { chave: 'criar_obra_medicao', label: 'Criar obra de medição', grupo: 'Medição' },
  { chave: 'editar_obra_medicao', label: 'Editar obra de medição', grupo: 'Medição' },
  { chave: 'excluir_obra_medicao', label: 'Excluir obra de medição', grupo: 'Medição' },
  { chave: 'criar_atividade_medicao', label: 'Lançar atividade no mapa', grupo: 'Medição' },
  { chave: 'editar_atividade_medicao', label: 'Editar atividade', grupo: 'Medição' },
  { chave: 'excluir_atividade_medicao', label: 'Excluir atividade', grupo: 'Medição' },
  { chave: 'gerenciar_planejamento', label: 'Gerenciar planejamento de obra', grupo: 'Medição' },
  { chave: 'gerenciar_contrato', label: 'Gerenciar itens de contrato', grupo: 'Medição' },
  { chave: 'fechar_medicao', label: 'Fechar medição mensal', grupo: 'Medição' },
  { chave: 'exportar_medicao', label: 'Exportar relatórios de medição', grupo: 'Medição' },

  // Usuários e permissões
  { chave: 'ver_funcionarios', label: 'Visualizar usuários', grupo: 'Usuários' },
  { chave: 'criar_funcionarios', label: 'Cadastrar usuários', grupo: 'Usuários' },
  { chave: 'editar_funcionarios', label: 'Editar usuários', grupo: 'Usuários' },
  { chave: 'excluir_funcionarios', label: 'Excluir usuários', grupo: 'Usuários' },
  { chave: 'gerenciar_permissoes', label: 'Gerenciar permissões de outros usuários', grupo: 'Usuários' },
  { chave: 'redefinir_senha', label: 'Redefinir senha de outros usuários', grupo: 'Usuários' },

  // Sistema / Administração
  { chave: 'migrar_dados', label: 'Executar migração de dados', grupo: 'Sistema' },
  { chave: 'ver_auditoria', label: 'Visualizar trilha de auditoria', grupo: 'Sistema' },
  { chave: 'configurar_sistema', label: 'Configurar parâmetros do sistema', grupo: 'Sistema' },
];

export const TODAS_ACOES_PLATAFORMA: string[] = ACOES_PLATAFORMA.map((a) => a.chave);

export const GRUPOS_ACOES = [...new Set(ACOES_PLATAFORMA.map((a) => a.grupo))];

export function permissoesVazias(): PermissoesFuncionario {
  return {
    dashboard: [],
    cadastros: [],
    frete: [],
    frota: [],
    funcionarios: [],
    apontamentos: [],
    manutencao: [],
  };
}
