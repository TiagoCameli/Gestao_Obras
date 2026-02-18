import type { AcaoPermissao, CargoFuncionario, ModuloPermissao, PermissoesFuncionario } from '../types';

export const MODULOS: { valor: ModuloPermissao; label: string }[] = [
  { valor: 'dashboard', label: 'Dashboard' },
  { valor: 'cadastros', label: 'Cadastros' },
  { valor: 'combustivel', label: 'Combustíveis' },
  { valor: 'insumos', label: 'Insumos' },
  { valor: 'frete', label: 'Frete' },
  { valor: 'compras', label: 'Compras' },
  { valor: 'funcionarios', label: 'Funcionários' },
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
  { valor: 'Supervisor', label: 'Supervisor' },
  { valor: 'Operador', label: 'Operador' },
  { valor: 'Financeiro', label: 'Financeiro' },
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
  combustivel: TODAS,
  insumos: TODAS,
  frete: TODAS,
  compras: TODAS,
  funcionarios: TODAS,
};

export const PERFIL_GERENTE: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  combustivel: VCEEX,
  insumos: VCEEX,
  frete: VCEEX,
  compras: VCEEX,
  funcionarios: VCE,
};

export const PERFIL_SUPERVISOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  combustivel: VCE,
  insumos: VCE,
  frete: VCE,
  compras: VCE,
  funcionarios: V,
};

export const PERFIL_OPERADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  combustivel: VCE,
  insumos: VCE,
  frete: VCE,
  compras: VCE,
  funcionarios: NENHUMA,
};

export const PERFIL_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: V,
  combustivel: VE,
  insumos: VE,
  frete: VE,
  compras: VE,
  funcionarios: V,
};

export const PERFIS_PADRAO: Record<CargoFuncionario, PermissoesFuncionario> = {
  Administrador: PERFIL_ADMINISTRADOR,
  Gerente: PERFIL_GERENTE,
  Supervisor: PERFIL_SUPERVISOR,
  Operador: PERFIL_OPERADOR,
  Financeiro: PERFIL_FINANCEIRO,
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
  // Cadastros
  { chave: 'ver_cadastros', label: 'Visualizar cadastros', grupo: 'Cadastros' },
  { chave: 'criar_cadastros', label: 'Criar novos cadastros', grupo: 'Cadastros' },
  { chave: 'editar_cadastros', label: 'Editar cadastros', grupo: 'Cadastros' },
  { chave: 'excluir_cadastros', label: 'Excluir cadastros', grupo: 'Cadastros' },
  // Combustivel
  { chave: 'ver_combustivel', label: 'Visualizar página de combustível', grupo: 'Combustível' },
  { chave: 'ver_dashboard_combustivel', label: 'Visualizar dashboard de combustível', grupo: 'Combustível' },
  { chave: 'criar_entrada_combustivel', label: 'Adicionar entrada de combustível', grupo: 'Combustível' },
  { chave: 'criar_saida_combustivel', label: 'Adicionar saída de combustível', grupo: 'Combustível' },
  { chave: 'criar_transferencia_combustivel', label: 'Adicionar transferência de combustível', grupo: 'Combustível' },
  { chave: 'editar_combustivel', label: 'Editar registros de combustível', grupo: 'Combustível' },
  { chave: 'excluir_combustivel', label: 'Excluir registros de combustível', grupo: 'Combustível' },
  { chave: 'exportar_combustivel', label: 'Exportar relatório de combustível', grupo: 'Combustível' },
  // Insumos
  { chave: 'ver_insumos', label: 'Visualizar página de insumos', grupo: 'Insumos' },
  { chave: 'ver_dashboard_insumos', label: 'Visualizar dashboard de insumos', grupo: 'Insumos' },
  { chave: 'criar_entrada_material', label: 'Adicionar entrada de material', grupo: 'Insumos' },
  { chave: 'criar_saida_material', label: 'Adicionar saída de material', grupo: 'Insumos' },
  { chave: 'criar_transferencia_material', label: 'Adicionar transferência de material', grupo: 'Insumos' },
  { chave: 'editar_insumos', label: 'Editar registros de insumos', grupo: 'Insumos' },
  { chave: 'excluir_insumos', label: 'Excluir registros de insumos', grupo: 'Insumos' },
  { chave: 'exportar_insumos', label: 'Exportar relatório de insumos', grupo: 'Insumos' },
  // Frete
  { chave: 'ver_frete', label: 'Visualizar fretes', grupo: 'Frete' },
  { chave: 'criar_frete', label: 'Criar frete', grupo: 'Frete' },
  { chave: 'editar_frete', label: 'Editar frete', grupo: 'Frete' },
  { chave: 'excluir_frete', label: 'Excluir frete', grupo: 'Frete' },
  // Compras
  { chave: 'ver_compras', label: 'Visualizar compras', grupo: 'Compras' },
  { chave: 'criar_compra', label: 'Criar pedidos/cotações/OCs', grupo: 'Compras' },
  { chave: 'editar_compra', label: 'Editar compras', grupo: 'Compras' },
  { chave: 'excluir_compra', label: 'Excluir compras', grupo: 'Compras' },
  { chave: 'aprovar_pedido', label: 'Aprovar/Reprovar pedidos', grupo: 'Compras' },
  // Funcionarios
  { chave: 'ver_funcionarios', label: 'Visualizar funcionários', grupo: 'Funcionários' },
  { chave: 'criar_funcionarios', label: 'Cadastrar funcionários', grupo: 'Funcionários' },
  { chave: 'editar_funcionarios', label: 'Editar funcionários', grupo: 'Funcionários' },
  { chave: 'excluir_funcionarios', label: 'Excluir funcionários', grupo: 'Funcionários' },
];

export const TODAS_ACOES_PLATAFORMA: string[] = ACOES_PLATAFORMA.map((a) => a.chave);

export const GRUPOS_ACOES = [...new Set(ACOES_PLATAFORMA.map((a) => a.grupo))];

export function permissoesVazias(): PermissoesFuncionario {
  return {
    dashboard: [],
    cadastros: [],
    combustivel: [],
    insumos: [],
    frete: [],
    compras: [],
    funcionarios: [],
  };
}
