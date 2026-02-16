import type { AcaoPermissao, CargoFuncionario, ModuloPermissao, PermissoesFuncionario } from '../types';

export const MODULOS: { valor: ModuloPermissao; label: string }[] = [
  { valor: 'dashboard', label: 'Dashboard' },
  { valor: 'cadastros', label: 'Cadastros' },
  { valor: 'combustivel', label: 'Combustiveis' },
  { valor: 'insumos', label: 'Insumos' },
  { valor: 'funcionarios', label: 'Funcionarios' },
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
const VCEE: AcaoPermissao[] = ['visualizar', 'criar', 'editar', 'excluir'];
const VCEEX: AcaoPermissao[] = ['visualizar', 'criar', 'editar', 'excluir', 'exportar'];
const VE: AcaoPermissao[] = ['visualizar', 'exportar'];
const NENHUMA: AcaoPermissao[] = [];

export const PERFIL_ADMINISTRADOR: PermissoesFuncionario = {
  dashboard: TODAS,
  cadastros: TODAS,
  combustivel: TODAS,
  insumos: TODAS,
  funcionarios: TODAS,
};

export const PERFIL_GERENTE: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  combustivel: VCEEX,
  insumos: VCEEX,
  funcionarios: VCE,
};

export const PERFIL_SUPERVISOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  combustivel: VCE,
  insumos: VCE,
  funcionarios: V,
};

export const PERFIL_OPERADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  combustivel: VCE,
  insumos: VCE,
  funcionarios: NENHUMA,
};

export const PERFIL_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: V,
  combustivel: VE,
  insumos: VE,
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
  { chave: 'ver_combustivel', label: 'Visualizar pagina de combustivel', grupo: 'Combustivel' },
  { chave: 'criar_entrada_combustivel', label: 'Adicionar entrada de combustivel', grupo: 'Combustivel' },
  { chave: 'criar_saida_combustivel', label: 'Adicionar saida de combustivel', grupo: 'Combustivel' },
  { chave: 'criar_transferencia_combustivel', label: 'Adicionar transferencia de combustivel', grupo: 'Combustivel' },
  { chave: 'editar_combustivel', label: 'Editar registros de combustivel', grupo: 'Combustivel' },
  { chave: 'excluir_combustivel', label: 'Excluir registros de combustivel', grupo: 'Combustivel' },
  { chave: 'exportar_combustivel', label: 'Exportar relatorio de combustivel', grupo: 'Combustivel' },
  // Insumos
  { chave: 'ver_insumos', label: 'Visualizar pagina de insumos', grupo: 'Insumos' },
  { chave: 'criar_entrada_material', label: 'Adicionar entrada de material', grupo: 'Insumos' },
  { chave: 'criar_saida_material', label: 'Adicionar saida de material', grupo: 'Insumos' },
  { chave: 'criar_transferencia_material', label: 'Adicionar transferencia de material', grupo: 'Insumos' },
  { chave: 'editar_insumos', label: 'Editar registros de insumos', grupo: 'Insumos' },
  { chave: 'excluir_insumos', label: 'Excluir registros de insumos', grupo: 'Insumos' },
  { chave: 'exportar_insumos', label: 'Exportar relatorio de insumos', grupo: 'Insumos' },
  // Funcionarios
  { chave: 'ver_funcionarios', label: 'Visualizar funcionarios', grupo: 'Funcionarios' },
  { chave: 'criar_funcionarios', label: 'Cadastrar funcionarios', grupo: 'Funcionarios' },
  { chave: 'editar_funcionarios', label: 'Editar funcionarios', grupo: 'Funcionarios' },
  { chave: 'excluir_funcionarios', label: 'Excluir funcionarios', grupo: 'Funcionarios' },
];

export const TODAS_ACOES_PLATAFORMA: string[] = ACOES_PLATAFORMA.map((a) => a.chave);

export const GRUPOS_ACOES = [...new Set(ACOES_PLATAFORMA.map((a) => a.grupo))];

export function permissoesVazias(): PermissoesFuncionario {
  return {
    dashboard: [],
    cadastros: [],
    combustivel: [],
    insumos: [],
    funcionarios: [],
  };
}
