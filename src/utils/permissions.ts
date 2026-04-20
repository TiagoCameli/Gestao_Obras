import type { AcaoPermissao, CargoFuncionario, ModuloPermissao, PermissoesFuncionario } from '../types';

export const MODULOS: { valor: ModuloPermissao; label: string }[] = [
  { valor: 'dashboard', label: 'Dashboard' },
  { valor: 'cadastros', label: 'Cadastros' },
  { valor: 'frete', label: 'Frete' },
  { valor: 'frota', label: 'Frota' },
  { valor: 'funcionarios', label: 'Usuários' },
  { valor: 'apontamentos', label: 'Apontamentos' },
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
};

export const PERFIL_GERENTE: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: VCE,
  apontamentos: VCEEX,
};

export const PERFIL_SUPERVISOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
  apontamentos: VCE,
};

export const PERFIL_OPERADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: V,
};

export const PERFIL_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: V,
  frete: VE,
  frota: V,
  funcionarios: V,
  apontamentos: V,
};

export const PERFIL_APONTADOR: PermissoesFuncionario = {
  dashboard: V,
  cadastros: V,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: VCEEX,
};

export const PERFIL_GERENTE_FINANCEIRO: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
  apontamentos: V,
};

export const PERFIL_GERENTE_COMPRAS: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCEEX,
  frete: VCEEX,
  frota: V,
  funcionarios: V,
  apontamentos: V,
};

export const PERFIL_ENGENHEIRO_CIVIL_SENIOR: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: V,
  apontamentos: VCE,
};

export const PERFIL_ENGENHEIRO_CIVIL: PermissoesFuncionario = {
  dashboard: VF,
  cadastros: VCE,
  frete: VCE,
  frota: V,
  funcionarios: NENHUMA,
  apontamentos: VCE,
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
  // Obras
  { chave: 'ver_obras', label: 'Visualizar obras', grupo: 'Obras' },
  { chave: 'criar_obras', label: 'Criar obras', grupo: 'Obras' },
  { chave: 'editar_obras', label: 'Editar obras', grupo: 'Obras' },
  { chave: 'excluir_obras', label: 'Excluir obras', grupo: 'Obras' },
  // Cadastros
  { chave: 'ver_cadastros', label: 'Visualizar cadastros', grupo: 'Cadastros' },
  { chave: 'criar_cadastros', label: 'Criar novos cadastros', grupo: 'Cadastros' },
  { chave: 'editar_cadastros', label: 'Editar cadastros', grupo: 'Cadastros' },
  { chave: 'excluir_cadastros', label: 'Excluir cadastros', grupo: 'Cadastros' },
  // Frete
  { chave: 'ver_frete', label: 'Visualizar fretes', grupo: 'Frete' },
  { chave: 'criar_frete', label: 'Criar frete', grupo: 'Frete' },
  { chave: 'editar_frete', label: 'Editar frete', grupo: 'Frete' },
  { chave: 'excluir_frete', label: 'Excluir frete', grupo: 'Frete' },
  // Usuarios
  { chave: 'ver_funcionarios', label: 'Visualizar usuários', grupo: 'Usuários' },
  { chave: 'criar_funcionarios', label: 'Cadastrar usuários', grupo: 'Usuários' },
  { chave: 'editar_funcionarios', label: 'Editar usuários', grupo: 'Usuários' },
  { chave: 'excluir_funcionarios', label: 'Excluir usuários', grupo: 'Usuários' },
  // Frota
  { chave: 'ver_frota', label: 'Visualizar frota', grupo: 'Frota' },
  // Manutenção
  { chave: 'ver_manutencao', label: 'Visualizar manutenção', grupo: 'Manutenção' },
  { chave: 'criar_os', label: 'Criar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'editar_os', label: 'Editar Ordem de Serviço', grupo: 'Manutenção' },
  { chave: 'ver_custos', label: 'Visualizar custos de manutenção', grupo: 'Manutenção' },
  // Apontamentos
  { chave: 'ver_apontamentos', label: 'Visualizar apontamentos', grupo: 'Apontamentos' },
  { chave: 'criar_apontamentos', label: 'Criar apontamentos', grupo: 'Apontamentos' },
  { chave: 'editar_apontamentos', label: 'Editar apontamentos', grupo: 'Apontamentos' },
  { chave: 'excluir_apontamentos', label: 'Excluir apontamentos', grupo: 'Apontamentos' },
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
  };
}
