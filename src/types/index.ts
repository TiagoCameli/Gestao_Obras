export interface Obra {
  id: string;
  nome: string;
  endereco: string;
  status: 'planejamento' | 'em_andamento' | 'concluida' | 'pausada';
  dataInicio: string;
  dataPrevisaoFim: string;
  responsavel: string;
  orcamento: number;
  criadoPor: string;
}

export interface EtapaObra {
  id: string;
  nome: string;
  obraId: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  criadoPor: string;
}

export interface Deposito {
  id: string;
  nome: string;
  obraId: string;
  capacidadeLitros: number;
  nivelAtualLitros: number;
  ativo: boolean;
  criadoPor: string;
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
  criadoPor: string;
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
  criadoPor: string;
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
  criadoPor: string;
}

export type TipoInsumo = string;

export interface TipoInsumoEntity {
  id: string;
  nome: string;
  valor: string;
  ativo: boolean;
  criadoPor: string;
}

export interface Insumo {
  id: string;
  nome: string;
  tipo: TipoInsumo;
  unidade: string;
  descricao: string;
  ativo: boolean;
  criadoPor: string;
  categoria?: CategoriaMaterialCompra;
}

export interface TransferenciaCombustivel {
  id: string;
  dataHora: string;
  depositoOrigemId: string;
  depositoDestinoId: string;
  quantidadeLitros: number;
  valorTotal: number;
  observacoes: string;
  criadoPor: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  observacoes: string;
  ativo: boolean;
  criadoPor: string;
}

export interface DepositoMaterial {
  id: string;
  nome: string;
  obraId: string;
  endereco: string;
  responsavel: string;
  ativo: boolean;
  criadoPor: string;
}

export interface UnidadeMedida {
  id: string;
  nome: string;
  sigla: string;
  ativo: boolean;
  criadoPor: string;
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
  criadoPor: string;
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
  criadoPor: string;
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
  criadoPor: string;
}

export interface FiltrosInsumos {
  obraId: string;
  insumoId: string;
  dataInicio: string;
  dataFim: string;
}

// === Auth & Funcionarios ===

export type CargoFuncionario = 'Administrador' | 'Gerente' | 'Supervisor' | 'Operador' | 'Financeiro';

export type ModuloPermissao = 'dashboard' | 'cadastros' | 'combustivel' | 'insumos' | 'frete' | 'compras' | 'funcionarios';

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

export interface Localidade {
  id: string;
  nome: string;
  endereco: string;
  ativo: boolean;
  criadoPor: string;
}

export interface Frete {
  id: string;
  data: string;
  dataChegada: string;
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
  placaCarreta: string;
  motorista: string;
  observacoes: string;
  criadoPor: string;
}

export interface FiltrosFrete {
  obraId: string;
  transportadora: string;
  motorista: string;
  insumoId: string;
  origem: string;
  dataInicio: string;
  dataFim: string;
}

export type MetodoPagamentoFrete = 'pix' | 'boleto' | 'cheque' | 'dinheiro' | 'transferencia' | 'combustivel';

export interface PagamentoFrete {
  id: string;
  data: string;
  transportadora: string;
  mesReferencia: string;
  valor: number;
  metodo: MetodoPagamentoFrete;
  quantidadeCombustivel: number;
  responsavel: string;
  notaFiscal: string;
  pagoPor: string;
  observacoes: string;
  criadoPor: string;
}

export interface AbastecimentoCarreta {
  id: string;
  data: string;
  transportadora: string;
  placaCarreta: string;
  mesReferencia: string;
  tipoCombustivel: string;
  quantidadeLitros: number;
  valorUnidade: number;
  valorTotal: number;
  observacoes: string;
  criadoPor: string;
}

export interface ItemPedidoMaterial {
  insumoId: string;
  quantidade: number;
  valorUnitario: number;
}

export interface PedidoMaterial {
  id: string;
  data: string;
  fornecedorId: string;
  itens: ItemPedidoMaterial[];
  observacoes: string;
  criadoPor: string;
}

export interface AuditLogEntry {
  id: string;
  tipo: string;
  funcionarioId: string;
  alvoId?: string;
  detalhes: string;
  dataHora: string;
}

// === Módulo de Compras ===

export type UrgenciaPedidoCompra = 'baixa' | 'normal' | 'alta' | 'critica';
export type StatusPedidoCompra = 'pendente' | 'aprovado' | 'reprovado';
export type CategoriaMaterialCompra = string;

export interface CategoriaMaterial {
  id: string;
  nome: string;
  valor: string;
  ativo: boolean;
  criadoPor: string;
}
export type UnidadeCompra = 'un' | 'kg' | 'm' | 'm2' | 'm3' | 'lt' | 'sc' | 'pc' | 'cx' | 'rl' | 'tb';

export interface ItemPedidoCompra {
  id: string;
  descricao: string;
  categoria: CategoriaMaterialCompra;
  quantidade: number;
  unidade: UnidadeCompra;
}

export interface PedidoCompra {
  id: string;
  numero: string;
  data: string;
  obraId: string;
  solicitante: string;
  urgencia: UrgenciaPedidoCompra;
  status: StatusPedidoCompra;
  observacoes: string;
  itens: ItemPedidoCompra[];
  criadoPor: string;
}

export type StatusCotacao = 'em_cotacao' | 'parcial' | 'cotado';

export interface ItemPrecoCotacao {
  itemPedidoId: string;
  precoUnitario: number;
}

export interface CotacaoFornecedor {
  id: string;
  fornecedorId: string;
  itensPrecos: ItemPrecoCotacao[];
  condicaoPagamento: string;
  prazoEntrega: string;
  total: number;
  respondido: boolean;
  vencedor: boolean;
}

export interface Cotacao {
  id: string;
  numero: string;
  data: string;
  pedidoCompraId: string;
  prazoResposta: string;
  status: StatusCotacao;
  fornecedores: CotacaoFornecedor[];
  itensPedido: ItemPedidoCompra[];
  observacoes: string;
  criadoPor: string;
}

export type StatusOrdemCompra = 'emitida' | 'entregue' | 'cancelada';

export interface ItemOrdemCompra {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;
}

export interface CustosAdicionaisOC {
  frete: number;
  outrasDespesas: number;
  impostos: number;
  desconto: number;
}

export interface OrdemCompra {
  id: string;
  numero: string;
  dataCriacao: string;
  dataEntrega: string;
  obraId: string;
  etapaObraId: string;
  fornecedorId: string;
  cotacaoId: string;
  pedidoCompraId: string;
  itens: ItemOrdemCompra[];
  custosAdicionais: CustosAdicionaisOC;
  totalMateriais: number;
  totalGeral: number;
  condicaoPagamento: string;
  prazoEntrega: string;
  status: StatusOrdemCompra;
  observacoes: string;
  entradaInsumos: boolean;
  criadoPor: string;
}
