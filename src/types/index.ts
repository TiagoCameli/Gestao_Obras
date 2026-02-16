export interface Obra {
  id: string;
  nome: string;
  endereco: string;
  status: 'planejamento' | 'em_andamento' | 'concluida' | 'pausada';
  dataInicio: string;
  dataPrevisaoFim: string;
  responsavel: string;
  orcamento: number;
}

export interface EtapaObra {
  id: string;
  nome: string;
  obraId: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
}

export interface Deposito {
  id: string;
  nome: string;
  obraId: string;
  capacidadeLitros: number;
  nivelAtualLitros: number;
  ativo: boolean;
}

export interface Abastecimento {
  id: string;
  dataHora: string;
  tipoCombustivel: string;
  quantidadeLitros: number;
  valorTotal: number;
  obraId: string;
  etapaId: string;
  alocacoes?: AlocacaoEtapa[];
  depositoId: string;
  veiculo: string;
  observacoes: string;
}

export interface EntradaCombustivel {
  id: string;
  dataHora: string;
  depositoId: string;
  tipoCombustivel: string;
  obraId: string;
  quantidadeLitros: number;
  valorTotal: number;
  fornecedor: string;
  notaFiscal: string;
  observacoes: string;
}

export type TipoMedicao = 'horimetro' | 'odometro' | 'km';

export interface Equipamento {
  id: string;
  nome: string;
  codigoPatrimonio: string;
  numeroSerie: string;
  ano: string;
  marca: string;
  tipoMedicao: TipoMedicao;
  medicaoInicial: number;
  ativo: boolean;
  dataAquisicao: string;
  dataVenda: string;
}

export type TipoInsumo = 'combustivel' | 'material';

export interface Insumo {
  id: string;
  nome: string;
  tipo: TipoInsumo;
  unidade: string;
  descricao: string;
  ativo: boolean;
}

export interface TransferenciaCombustivel {
  id: string;
  dataHora: string;
  depositoOrigemId: string;
  depositoDestinoId: string;
  quantidadeLitros: number;
  valorTotal: number;
  observacoes: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  observacoes: string;
  ativo: boolean;
}

export interface DepositoMaterial {
  id: string;
  nome: string;
  obraId: string;
  endereco: string;
  responsavel: string;
  ativo: boolean;
}

export interface UnidadeMedida {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
}

export interface FiltrosAbastecimento {
  obraId: string;
  tipoCombustivel: string;
  dataInicio: string;
  dataFim: string;
}

export interface EntradaMaterial {
  id: string;
  dataHora: string;
  depositoMaterialId: string;
  insumoId: string;
  obraId: string;
  quantidade: number;
  valorTotal: number;
  fornecedorId: string;
  notaFiscal: string;
  observacoes: string;
}

export interface AlocacaoEtapa {
  etapaId: string;
  percentual: number;
}

export interface SaidaMaterial {
  id: string;
  dataHora: string;
  depositoMaterialId: string;
  insumoId: string;
  obraId: string;
  quantidade: number;
  valorTotal: number;
  alocacoes: AlocacaoEtapa[];
  observacoes: string;
}

export interface TransferenciaMaterial {
  id: string;
  dataHora: string;
  depositoOrigemId: string;
  depositoDestinoId: string;
  insumoId: string;
  quantidade: number;
  valorTotal: number;
  observacoes: string;
}

export interface FiltrosInsumos {
  obraId: string;
  insumoId: string;
  dataInicio: string;
  dataFim: string;
}

// === Auth & Funcionarios ===

export type CargoFuncionario = 'Administrador' | 'Gerente' | 'Supervisor' | 'Operador' | 'Financeiro';

export type ModuloPermissao = 'dashboard' | 'cadastros' | 'combustivel' | 'insumos' | 'frete' | 'funcionarios';

export type AcaoPermissao = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'exportar' | 'ajustar_filtros';

export interface EnderecoFuncionario {
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  dataNascimento: string;
  endereco: EnderecoFuncionario;
  senha: string; // legacy — empty string when loaded from Supabase
  authUserId?: string;
  status: 'ativo' | 'inativo';
  cargo: CargoFuncionario;
  dataAdmissao: string;
  observacoes: string;
  dataCriacao: string;
  dataAtualizacao: string;
  acoesPermitidas?: string[];
}

export type PermissoesFuncionario = Record<ModuloPermissao, AcaoPermissao[]>;

export interface PerfilPermissao {
  id: string;
  funcionarioId: string;
  permissoes: PermissoesFuncionario;
}

export interface SessaoUsuario {
  funcionarioId: string;
  nome: string;
  email: string;
  cargo: CargoFuncionario;
  permissoes: PermissoesFuncionario;
  loginAt: number;
  expiresAt: number;
  lembrarMe: boolean;
  acoesPermitidas?: string[];
}

export interface LoginAttemptTracker {
  tentativas: number;
  ultimaTentativa: number;
  bloqueadoAte: number;
}

export interface Frete {
  id: string;
  data: string;
  obraId: string;
  origem: string;
  destino: string;
  transportadora: string;
  insumoId: string;
  pesoToneladas: number;
  kmRodados: number;
  valorTkm: number;
  valorTotal: number;
  notaFiscal: string;
  observacoes: string;
}

export interface FiltrosFrete {
  obraId: string;
  transportadora: string;
  dataInicio: string;
  dataFim: string;
}

export interface AuditLogEntry {
  id: string;
  tipo: string;
  funcionarioId: string;
  alvoId?: string;
  detalhes: string;
  dataHora: string;
}
