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
  capacidadeLitros: number;
  nivelAtualLitros: number;
  ativo: boolean;
  criadoPor: string;
  /** FK para fornecedores (nullable). NULL = tanque "da casa" (EMT).
   *  Preenchido = empresa terceira que controla este tanque (ex: Areacre/Transterra). */
  transportadoraProprietariaId: string | null;
  /** Display curto opcional. Se preenchido, UIs podem usar em vez do nome canônico. */
  apelido: string | null;
  /** true = depósito controlado por terceiro, sem estoque interno. Triggers no DB
   *  bloqueiam entradas_combustivel e transferencias_combustivel envolvendo ele. */
  ehExterno: boolean;
}

export type OrigemCombustivel = 'tanque' | 'dinheiro' | 'requisicao';

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
  /** ID do equipamento associado (FK pra tabela equipamentos). Pode ser
   *  vazio para lançamentos legados ou quando não há equipamento. */
  equipamentoId: string;
  /** Texto livre do veículo. Mantido para auditoria de lançamentos antigos
   *  e como fallback quando equipamentoId está vazio. */
  veiculo: string;
  /** URLs assinadas das fotos do abastecimento (bucket abastecimento-fotos). */
  fotosUrls: string[];
  observacoes: string;
  criadoPor: string;
  origemCombustivel: OrigemCombustivel;
  fornecedor: string;
  pago: boolean;
  dataPagamento: string;
  pagoPor: string;
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

export type TipoEquipamento = string;

export interface TipoEquipamentoEntity {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  criadoPor: string;
}

export type PropriedadeEquipamento = 'propria' | 'alugada';

export type StatusEquipamento =
  | 'ativa'
  | 'manutencao_corretiva'
  | 'manutencao_preventiva'
  | 'fora_funcionamento';

export const STATUS_EQUIPAMENTO_LABEL: Record<StatusEquipamento, string> = {
  ativa: 'Ativa',
  manutencao_corretiva: 'Em manutenção corretiva',
  manutencao_preventiva: 'Em manutenção preventiva',
  fora_funcionamento: 'Fora de funcionamento',
};

export interface Equipamento {
  id: string;
  nome: string;
  tipo: TipoEquipamento | '';
  empresaId: string;
  codigoPatrimonio: string;
  numeroSerie: string;
  ano: string;
  marca: string;
  modelo: string;
  propriedade: PropriedadeEquipamento;
  status: StatusEquipamento;
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
  /** Marca o fornecedor como transportadora (aparece no select de transp
   *  em fretes/pagamentos/saídas de carreta). Coluna adicionada na Fase 1a. */
  ehTransportadora: boolean;
  /** Taxa R$/litro sugerida em saídas de combustível tipo carreta.
   *  Pode ser sobrescrita no form. Default 0. */
  taxaLitroPadrao: number;
  /** Marca empresa que controla um tanque externo (ex: Areacre = Transterra).
   *  Quando carretas abastecem nesse tanque, gera crédito pra ela. */
  ehDonaDeTanque: boolean;
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

export type CargoFuncionario = 'Administrador' | 'Gerente' | 'Gerente Financeiro' | 'Gerente de Compras' | 'Supervisor' | 'Operador' | 'Financeiro' | 'Apontador' | 'Engenheiro Civil Sênior' | 'Engenheiro Civil';

export type ModuloPermissao = 'dashboard' | 'cadastros' | 'frete' | 'frota' | 'funcionarios' | 'apontamentos';

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
  notaFiscal2: string;
  placaCarreta: string;
  motorista: string;
  valorMaterial: number;
  observacoes: string;
  criadoPor: string;
}

export interface FiltrosFrete {
  obraId: string;
  transportadora: string;
  motorista: string;
  insumoId: string;
  origem: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  notaFiscal: string;
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

export type CategoriaAbastecimentoCarreta = 'transterra' | 'emt';

// === Saidas de Combustível (modelo unificado pós-Fase 1c/2) ===
//
// Substitui Abastecimento + AbastecimentoCarreta após backfill da Fase 2.
// Tipos legados ficam vivos durante Fase 3-4 via compat shim em
// useAbastecimentos/useAbastecimentosCarreta. Drop dos legados na Fase 5.

export type TipoConsumidorSaida = 'equipamento_proprio' | 'carreta_transportadora';

export interface SaidaCombustivel {
  id: string;
  data: string;                                    // ISO timestamptz
  origem: OrigemCombustivel;
  tipoConsumidor: TipoConsumidorSaida;

  /** FK depositos.id. NULL quando origem != 'tanque'. */
  tanqueId: string | null;
  /** FK equipamentos.id. NOT NULL quando tipoConsumidor='equipamento_proprio'.
   *  Sentinel 'desconhecido' usado pra abast legados sem identificação
   *  (ver tech-debt #8). */
  equipamentoId: string | null;
  /** FK fornecedores.id. NOT NULL quando tipoConsumidor='carreta_transportadora'. */
  transportadoraId: string | null;
  placa: string | null;
  motoristaId: string | null;

  obraId: string | null;
  etapaId: string | null;
  alocacoes: AlocacaoEtapa[] | null;

  tipoCombustivel: string;                         // FK soft pra insumos.id
  litros: number;
  precoMedioTanqueSnapshot: number | null;
  taxaLitro: number;
  precoUnitario: number;
  valorTotal: number;

  fotoUrls: string[] | null;
  observacoes: string | null;

  pago: boolean | null;
  pagoEm: string | null;                           // ISO timestamptz

  /** FK transportadora_movimentos.id criado pela trigger (rastro).
   *  NULL quando tipoConsumidor='equipamento_proprio'. */
  movimentoId: string | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

// === Conta-corrente das Transportadoras ===

export type TipoMovimentoTransportadora =
  | 'credito_frete'
  | 'debito_pagamento_frete'
  | 'credito_abastecimento_transterra'
  | 'debito_abastecimento_transterra'
  | 'debito_abastecimento_emt'
  | 'ajuste_manual_credito'
  | 'ajuste_manual_debito';

export type OrigemTabelaMovimento =
  | 'fretes'
  | 'pagamentos_frete'
  | 'saidas_combustivel'
  | 'ajuste_manual';

export interface TransportadoraMovimento {
  id: string;
  transportadoraId: string;                        // FK fornecedores.id
  data: string;                                    // ISO timestamptz
  tipo: TipoMovimentoTransportadora;
  /** Sempre positivo. Sinal vem do tipo (credito_* soma, debito_* subtrai). */
  valor: number;
  origemTabela: OrigemTabelaMovimento;
  origemId: string;
  descricao: string | null;
  obraId: string | null;
  /** ISO date YYYY-MM-DD (truncado pro 1º dia do mês). */
  mesReferencia: string | null;
  /** FK pagamentos_frete.id quando este débito for abatido em pagamento (Fase 4). */
  abatidoEmPagamentoId: string | null;

  createdAt: string;
  createdBy: string | null;
}

/** Output da view transportadora_saldos. Read-only — saldo é agregado. */
export interface TransportadoraSaldo {
  transportadoraId: string;
  nome: string;
  ehDonaDeTanque: boolean;
  /** Crédito − débito agregado. Sinal natural. */
  saldo: number;
  debitoCombustivelTotal: number;
  creditoFreteTotal: number;
  pagoFreteTotal: number;
  qtdMovimentos: number;
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
  /** Distingue Transterra (terceirizado) vs EMT (frota própria). */
  categoria: CategoriaAbastecimentoCarreta;
  /** Taxa adicional por litro (R$/L). Aplicável apenas em categoria='emt'. */
  taxaLitro: number;
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

// === Empresas ===

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  areaAtuacao: string;
  ativo: boolean;
  criadoPor: string;
}

// === Colaboradores ===

export interface Colaborador {
  id: string;
  nome: string;
  empresaId: string;
  dataNascimento: string;
  dataIngresso: string;
  telefone: string;
  email: string;
  altura: string;
  tamanhoCamisa: string;
  tamanhoCalca: string;
  tamanhoSapato: string;
  endereco: string;
  cpf: string;
  rg: string;
  observacoes: string;
  ativo: boolean;
  criadoPor: string;
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
  descricao: string;
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
  obraId: string;
  etapaObraId: string;
}

export interface CustosAdicionaisOC {
  frete: number;
  outrasDespesas: number;
  impostos: number;
  desconto: number;
}

export interface ParcelaPagamento {
  numero: number;
  data: string;
  valor: number;
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
  formaPagamento: string;
  parcelas: ParcelaPagamento[];
  prazoEntrega: string;
  status: StatusOrdemCompra;
  observacoes: string;
  entradaInsumos: boolean;
  entradaGerada: boolean;
  empresaFaturamento: string;
  aprovada: boolean;
  criadoPor: string;
}

// === Apontamentos ===

export type TipoApontamento = 'equipamento' | 'colaborador';
export type StatusApontamento = 'aberto' | 'encerrado' | 'falta' | 'licenca_medica' | 'ferias' | 'manutencao' | 'ocioso';

export interface Apontamento {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  obraId: string;
  etapaObraId: string;
  equipamentoId: string;
  colaboradorId: string;
  tipo: TipoApontamento;
  horasTrabalhadas: number;
  observacoes: string;
  status: StatusApontamento;
  criadoPor: string;
}

// === Diaristas ===

export type StatusSequenciaDiaria = 'aberta' | 'fechada';

export interface SequenciaDiaria {
  id: string;
  obraId: string;
  nomeDiarista: string;
  telefone: string;
  valorDiaria: number;
  detalhesServico: string;
  observacoes: string;
  status: StatusSequenciaDiaria;
  dataAbertura: string;
  dataFechamento: string;
  pago: boolean;
  dataPagamento: string;
  createdAt: string;
}

export interface RegistroHorasDiarista {
  id: string;
  sequenciaId: string;
  obraId: string;
  etapaId: string;
  data: string;
  horas: number;
  descricao: string;
  createdAt: string;
}

// === Manutenção ===

export type StatusOS = 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada';
export type TipoOS = 'preventiva' | 'corretiva';
export type PrioridadeOS = 'baixa' | 'normal' | 'alta' | 'critica';
export type TipoCustoOS = 'peca' | 'mao_de_obra' | 'servico_externo';

export interface OrdemServico {
  id: string;
  numero: string;
  equipamentoId: string;
  tipo: TipoOS;
  prioridade: PrioridadeOS;
  status: StatusOS;
  descricao: string;
  dataAbertura: string;
  dataPrevista: string;
  dataConclusao: string;
  medicaoAbertura: number;
  medicaoConclusao: number | null;
  responsavel: string;
  observacoes: string;
  criadoPor: string;
}

export interface ItemOS {
  id: string;
  ordemServicoId: string;
  descricao: string;
  tipo: TipoCustoOS;
  quantidade: number;
  valorUnitario: number;
  criadoPor: string;
}

export interface PlanoManutencao {
  id: string;
  equipamentoId: string;
  nome: string;
  descricao: string;
  intervaloHoras: number | null;
  intervaloKm: number | null;
  intervaloDias: number | null;
  ultimaExecucaoMedicao: number;
  ultimaExecucaoData: string;
  ativo: boolean;
  criadoPor: string;
  createdAt: string;
}

export interface HistoricoMedicao {
  id: string;
  equipamentoId: string;
  tipoMedicao: string;
  valor: number;
  dataRegistro: string;
  observacoes: string;
  criadoPor: string;
}

// === Checklist de Equipamentos ===

export type RespostaChecklist = 'sim' | 'nao' | 'na' | '';

export interface TurnoChecklist {
  turno: 1 | 2 | 3;
  horimetroInicial: string;
  horimetroFinal: string;
  tipoManutencao: 'preventiva' | 'corretiva';
  parouManutencao: boolean;
  horaParada: string;
  horaRetorno: string;
  nomeOperador: string;
  cs: string;
}

export interface ChecklistEquipamento {
  id: string;
  equipamentoId: string;
  data: string;
  unidade: string;
  areaInspecao: string;
  turnos: TurnoChecklist[];
  respostas: Record<string, { turno1: RespostaChecklist; turno2: RespostaChecklist; turno3: RespostaChecklist }>;
  observacoes: string;
  criadoPor: string;
  createdAt: string;
}

// === Histórico de Inspeção ===

export interface HistoricoInspecao {
  id: string;
  equipamentoId: string;
  data: string;
  horario: string;
  descricao: string;
  providencia: string;
  operador: string;
  encarregado: string;
  criadoPor: string;
  createdAt: string;
}
