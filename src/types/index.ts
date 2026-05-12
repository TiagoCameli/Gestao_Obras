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
  /** F9 — Anexos. Fotos do tanque + arquivos (manual técnico, certificado de calibração). */
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
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
  quantidadeLitros: number;
  valorTotal: number;
  fornecedor: string;
  notaFiscal: string;
  observacoes: string;
  criadoPor: string;
  /** F9 — Anexos. Fotos (tanque pós-abastecimento, ticket) + arquivos (NF-e PDF, comprovante). */
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
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
  /** Fotos do equipamento (frente, lateral, painel, plaqueta, chassi).
   *  Diferente de fotos de OS/documentos — são as fotos "do equipamento". */
  fotoUrls: string[];
  /** Arquivos vinculados (manual técnico, ficha do fabricante). */
  arquivoUrls: string[];
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
  /** F9 — Anexos. Comprovante de transferência interna + foto do nível antes/depois. */
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
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

export type ModuloPermissao = 'dashboard' | 'cadastros' | 'frete' | 'frota' | 'funcionarios';

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
  // FF.3 — Anexos universais + foto destacada de chegada da carga.
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
  fotoChegadaUrl?: string | null;
  // FF.1 — Audit fields (preenchidos por triggers no DB).
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
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
  // FF.3 — Anexos universais (comprovantes de pagamento).
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
  // FF.1 — Audit fields.
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
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
  /** Texto livre. Motorista nem sempre é funcionário cadastrado (terceirizado). */
  motorista: string;

  obraId: string | null;
  etapaId: string | null;
  alocacoes: AlocacaoEtapa[] | null;

  tipoCombustivel: string;                         // FK soft pra insumos.id
  litros: number;
  precoMedioTanqueSnapshot: number | null;
  taxaLitro: number;
  /** Preço/litro do combustível (sem taxa). NULL só por compat — backfill garante populado.
   *  Em tanque externo: preço cobrado da TRANSPORTADORA consumidora. */
  precoCombustivel: number | null;
  /** Preço/L cobrado pela proprietária do tanque externo (Areacre na Transterra).
   *  NULL pra tanque interno. Diferença pra precoCombustivel = margem EMT. */
  precoCombustivelAreacre: number | null;
  precoUnitario: number;
  valorTotal: number;

  fotoUrls: string[] | null;
  /** F9 — Arquivos (PDF/xlsx/docx). Complementa fotoUrls (imagens). */
  arquivoUrls?: string[] | null;
  observacoes: string | null;

  pago: boolean | null;
  pagoEm: string | null;                           // ISO timestamptz

  /** FK transportadora_movimentos.id criado pela trigger (rastro).
   *  NULL quando tipoConsumidor='equipamento_proprio'. */
  movimentoId: string | null;

  /** Leitura do horímetro/odômetro/km do equipamento no momento do abastecimento.
   *  Trigger no DB sincroniza em medicoes_equipamento (origem='abastecimento').
   *  NULL quando: tipoConsumidor='carreta_transportadora' ou operador não informou. */
  medicaoNoAbastecimento: number | null;
  /** Snapshot do tipo no momento da saída. Independente de mudanças posteriores
   *  em equipamentos.tipo_medicao. */
  tipoMedicaoSnapshot: TipoMedicao | null;

  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  /** Quem alterou por último — populado em UPDATEs (atribuição retroativa,
   *  edição manual). NULL em saídas legadas e inserts. Adicionado em F5.A.0
   *  (executado adiantado pra desbloquear F2.B.2 atribuição em batch). */
  updatedBy: string | null;
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

  // Campos opcionais vindos da view transportadora_movimentos_detalhe.
  // Populados via LEFT JOIN nas tabelas de origem; ficam undefined quando
  // a origem não bate (ex: ajuste manual). Usados pra mostrar o cálculo
  // que gerou o valor (peso × km × tkm pra fretes, litros × preço pra
  // saídas de combustível).
  fretePesoToneladas?: number | null;
  freteKmRodados?: number | null;
  freteValorTkm?: number | null;
  freteOrigem?: string | null;
  freteDestino?: string | null;
  freteInsumoId?: string | null;
  freteNotaFiscal?: string | null;
  freteNotaFiscal2?: string | null;
  fretePlacaCarreta?: string | null;
  freteMotorista?: string | null;
  saidaLitros?: number | null;
  saidaPrecoCombustivel?: number | null;
  saidaPrecoCombustivelAreacre?: number | null;
  saidaTaxaLitro?: number | null;
  saidaPrecoMedioTanque?: number | null;
  saidaTipoCombustivel?: string | null;
  saidaTipoConsumidor?: TipoConsumidorSaida | null;
  saidaPlaca?: string | null;
  saidaMotorista?: string | null;
  saidaObservacoes?: string | null;
  pagamentoMetodo?: string | null;
  pagamentoNotaFiscal?: string | null;
  pagamentoResponsavel?: string | null;
  pagamentoPagoPor?: string | null;
  pagamentoObservacoes?: string | null;
  pagamentoQuantidadeCombustivel?: number | null;
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
  // FF.3 — Anexos universais (cotação, NF do fornecedor).
  fotoUrls?: string[] | null;
  arquivoUrls?: string[] | null;
  // FF.1 — Audit fields.
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
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

// === Ordens de Serviço (PR9 - Marco 2) ===

export type TipoOS = 'preventiva' | 'corretiva' | 'preditiva' | 'melhoria' | 'garantia' | 'recall';
export type PrioridadeOS = 'baixa' | 'media' | 'alta' | 'critica';
export type StatusOS =
  | 'rascunho' | 'aberta' | 'aguardando_pecas' | 'em_execucao'
  | 'aguardando_aprovacao' | 'concluida' | 'cancelada';
export type OrigemOS =
  | 'plano_preventivo' | 'checklist' | 'anomalia_combustivel' | 'manual' | 'recall';

export const TIPO_OS_LABEL: Record<TipoOS, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  preditiva: 'Preditiva',
  melhoria: 'Melhoria',
  garantia: 'Garantia',
  recall: 'Recall',
};

export const PRIORIDADE_OS_LABEL: Record<PrioridadeOS, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  rascunho: 'Rascunho',
  aberta: 'Aberta',
  aguardando_pecas: 'Aguardando peças',
  em_execucao: 'Em execução',
  aguardando_aprovacao: 'Aguardando aprovação',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export interface OrdemServico {
  id: string;
  numero: string;
  equipamentoId: string;
  tipo: TipoOS;
  prioridade: PrioridadeOS;
  status: StatusOS;
  origem: OrigemOS | null;
  origemId: string | null;
  atividadeId: string | null;
  obraId: string | null;
  solicitanteId: string;
  responsavelId: string;
  fornecedorServicoId: string | null;
  dataAbertura: string;
  dataPrevistaInicio: string | null;
  dataInicioExecucao: string | null;
  dataConclusao: string | null;
  prazoAtendimento: string | null;
  medicaoAbertura: number | null;
  medicaoConclusao: number | null;
  paradaInicio: string | null;
  paradaFim: string | null;
  defeitoReportado: string;
  sintomas: string[];
  sistemasAfetados: string[];
  causaRaiz: string;
  solucaoAplicada: string;
  recomendacoes: string;
  custoPecas: number;
  custoServicoTerceiro: number;
  custoMaoObraPropria: number;
  custoTotal: number;
  aprovadoPor: string;
  aprovadoEm: string | null;
  garantiaAcionada: boolean;
  fotoUrls: string[];
  arquivoUrls: string[];
  observacoes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface OSPeca {
  id: string;
  osId: string;
  insumoId: string;
  depositoId: string | null;
  quantidade: number;
  unidadeMedidaId: string | null;
  custoUnitario: number;
  custoTotal: number;
  status: 'reservada' | 'consumida' | 'devolvida';
  saidaMaterialId: string | null;
  observacoes: string;
  createdAt: string;
  createdBy: string;
}

export interface OSMaoObra {
  id: string;
  osId: string;
  colaboradorId: string;
  data: string;
  horas: number;
  custoHora: number | null;
  custoTotal: number;
  observacoes: string;
  createdAt: string;
  createdBy: string;
}

export interface OSTransicao {
  id: string;
  osId: string;
  statusDe: StatusOS | null;
  statusPara: StatusOS;
  motivo: string;
  createdAt: string;
  createdBy: string;
}

// === Financeiro do Equipamento (PR7 - Marco 1) ===

export type FormaAquisicao = 'a_vista' | 'financiado' | 'consorcio' | 'leasing' | 'outro';
export type IndexadorContrato = 'IPCA' | 'IGPM' | 'INPC' | 'prefixado' | 'outro';

export interface FinanceiroEquipamento {
  equipamentoId: string;
  // Próprios
  valorAquisicao: number | null;
  fornecedorAquisicaoId: string | null;
  nfAquisicao: string;
  formaAquisicao: FormaAquisicao | null;
  bancoFinanciador: string;
  valorParcela: number | null;
  prestacoesTotal: number | null;
  prestacoesPagas: number | null;
  valorMercadoAtual: number | null;
  vidaUtilMeses: number | null;
  valorResidualEstimado: number | null;
  // Alugados
  locadoraId: string | null;
  contratoNumero: string;
  valorMensal: number | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  indexador: IndexadorContrato | null;
  manutencaoInclusa: boolean;
  combustivelIncluso: boolean;
  operadorIncluso: boolean;
  horasMinimasMensais: number | null;
  // Comum
  observacoes: string;
  arquivoUrls: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// === Especificações Técnicas do Equipamento (PR6 - Marco 1) ===

/** Códigos OEM dos filtros do equipamento. Chaves convencionadas:
 *  oleo, ar, combustivel, hidraulico, cabine, separador. Outras chaves
 *  são aceitas para casos especiais (ureia, transmissao, etc.). */
export type FiltrosEquipamento = Record<string, string>;

export interface EspecificacoesEquipamento {
  equipamentoId: string;
  capacidadeTanqueL: number | null;
  capacidadeOleoMotorL: number | null;
  tipoOleoMotor: string;
  capacidadeOleoHidraulicoL: number | null;
  tipoOleoHidraulico: string;
  capacidadeOleoTransmissaoL: number | null;
  tipoOleoTransmissao: string;
  capacidadeOleoDiferencialL: number | null;
  capacidadeArrefecedorL: number | null;
  pneuMedida: string;
  pneuQtd: number | null;
  bateriaEspecificacao: string;
  bateriaQtd: number | null;
  filtros: FiltrosEquipamento;
  consumoEsperadoLH: number | null;
  consumoEsperadoKmL: number | null;
  garantiaFimData: string | null;
  garantiaFimMedicao: number | null;
  observacoesTecnicas: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// === Histórico de Status de Equipamento (PR4 - Marco 0) ===

export interface HistoricoStatusEquipamento {
  id: string;
  equipamentoId: string;
  statusDe: StatusEquipamento | null;
  statusPara: StatusEquipamento;
  motivo: string;
  observacoes: string;
  osId: string | null;
  createdAt: string;
  createdBy: string;
}

// === Documentos de Equipamento (PR3 - Marco 0) ===

export type TipoDocumentoEquipamento =
  | 'crlv'
  | 'ipva'
  | 'seguro'
  | 'antt'
  | 'rntrc'
  | 'nr11'
  | 'nr12'
  | 'manual'
  | 'nf_aquisicao'
  | 'contrato_locacao'
  | 'certificacao'
  | 'vistoria'
  | 'recall'
  | 'outro';

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoEquipamento, string> = {
  crlv: 'CRLV',
  ipva: 'IPVA',
  seguro: 'Seguro',
  antt: 'ANTT',
  rntrc: 'RNTRC',
  nr11: 'NR-11',
  nr12: 'NR-12',
  manual: 'Manual',
  nf_aquisicao: 'NF de Aquisição',
  contrato_locacao: 'Contrato de Locação',
  certificacao: 'Certificação',
  vistoria: 'Vistoria',
  recall: 'Recall',
  outro: 'Outro',
};

export interface DocumentoEquipamento {
  id: string;
  equipamentoId: string;
  tipo: TipoDocumentoEquipamento;
  numero: string;
  emissao: string | null;       // 'YYYY-MM-DD' ou null
  vencimento: string | null;    // 'YYYY-MM-DD' ou null
  valor: number;
  fornecedorId: string | null;
  observacoes: string;
  fotoUrls: string[];
  arquivoUrls: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type NivelVencimentoDocumento = 'vencido' | 'critico' | 'alerta' | 'atencao';

export interface DocumentoVencendo {
  id: string;
  equipamentoId: string;
  equipamentoNome: string;
  codigoPatrimonio: string;
  tipo: TipoDocumentoEquipamento;
  numero: string;
  vencimento: string;
  diasParaVencer: number;
  nivel: NivelVencimentoDocumento;
}

// === Medições de Equipamento (PR1 - Marco 0) ===

export type OrigemMedicao =
  | 'abastecimento'
  | 'checklist'
  | 'ordem_servico'
  | 'apontamento'
  | 'manual'
  | 'import';

export interface MedicaoEquipamento {
  id: string;
  equipamentoId: string;
  data: string;
  tipoMedicao: TipoMedicao;
  valor: number;
  origem: OrigemMedicao;
  origemId: string | null;
  observacoes: string;
  fotoUrls: string[];
  arquivoUrls: string[];
  createdAt: string;
  createdBy: string;
}

export interface MedicaoAtualEquipamento {
  equipamentoId: string;
  medicaoAtual: number;
  tipoMedicao: TipoMedicao;
  dataUltimaLeitura: string;
  origemUltimaLeitura: OrigemMedicao;
  origemIdUltimaLeitura: string | null;
}
