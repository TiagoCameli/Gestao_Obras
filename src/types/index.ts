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
  /** F11 — Combustível corrente no tanque (FK insumos). Null = vazio ou nunca recebeu.
   *  Trigger no DB bloqueia entradas/transferências de outro tipo enquanto não-null. */
  combustivelAtualId?: string | null;
}

/** F11 — Esvaziamento de tanque (descarte explícito pra trocar de combustível). */
export interface EsvaziamentoTanque {
  id: string;
  depositoId: string;
  dataHora: string;
  litrosDescartados: number;
  motivo: string;
  criadoPor: string;
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
  // PR18 — extensões pra peças de manutenção
  usadoEmManutencao?: boolean;
  codigoSku?: string;
  codigoEan?: string;
  fabricante?: string;
  codigoFabricante?: string;
  estoqueMinimo?: number | null;
  estoqueMaximo?: number | null;
  leadTimeDias?: number | null;
  equipamentosCompativeis?: string[];
  fotoUrl?: string;
  aplicacaoTecnica?: string;
}

// View v_saldo_estoque_total: snapshot atual de estoque + custo médio.
export type StatusEstoque = 'zerada' | 'abaixo_minimo' | 'atencao' | 'ok';

export interface SaldoEstoque {
  insumoId: string;
  insumoNome: string;
  unidade: string;
  codigoSku: string | null;
  codigoEan: string | null;
  fabricante: string | null;
  codigoFabricante: string | null;
  categoria: string | null;
  tipo: string | null;
  estoqueMinimo: number | null;
  estoqueMaximo: number | null;
  usadoEmManutencao: boolean;
  fotoUrl: string | null;
  equipamentosCompativeis: string[];
  saldoTotal: number;
  custoMedio: number | null;
  statusEstoque: StatusEstoque;
}

export interface SaldoEstoquePorDeposito {
  insumoId: string;
  insumoNome: string;
  unidade: string;
  codigoSku: string | null;
  fabricante: string | null;
  estoqueMinimo: number | null;
  depositoId: string;
  depositoNome: string;
  saldo: number;
  custoMedio: number | null;
  totalEntradas: number;
  valorTotalEntradas: number;
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
  /** HF.7 — Tipo de combustível congelado no momento da transferência.
   *  Auto-stampado por trigger no DB (fn_stamp_transferencia_tipo_combustivel).
   *  Frontend não precisa enviar — o valor é sempre derivado do estado do
   *  tanque origem na data da transferência. */
  tipoCombustivel?: string | null;
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
  /** @deprecated em v2 — agora é N:N via `obrasIds`. Mantido pra compatibilidade legada (1ª obra). */
  obraId: string;
  endereco: string;
  responsavel: string;
  ativo: boolean;
  criadoPor: string;
  // Depósitos v2 — N:N com obras + auditoria + soft delete
  /** Lista de obras vinculadas (vazia = depósito central/avulso) */
  obrasIds?: string[];
  /** true = almoxarifado de peças (manutenção). Aparece em OCs com destino "manutenção_equipamento". */
  ehAlmoxarifadoPecas?: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
}

export interface SaldoDepositoInsumo {
  depositoId: string;
  insumoId: string;
  saldo: number;
  valorTotalEntradas: number;
  ultimaMovimentacao?: string;
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
  /** Valor unitário (R$/unidade) — calculado ou informado */
  valorUnitario?: number;
  valorTotal: number;
  fornecedorId: string;
  notaFiscal: string;
  observacoes: string;
  criadoPor: string;
  // Depósitos v2
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
}

export type TipoSaidaMaterial = 'consumo' | 'perda';
export type MotivoPerda = 'chuva' | 'quebra' | 'vencimento' | 'roubo' | 'outros';

export interface AlocacaoEtapa {
  etapaId: string;
  /** v1 (legado) — usado em saídas antigas */
  percentual?: number;
  /** v2 — quantidade alocada por etapa (decisão 3-a) */
  quantidade?: number;
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
  // Depósitos v2 — tipo de saída + motivo de perda
  tipoSaida?: TipoSaidaMaterial;
  motivoPerda?: MotivoPerda | string;
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
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
  // Depósitos v2
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
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

/** Vínculo trabalhista do colaborador. */
export type TipoVinculoColaborador = 'clt' | 'prestador_servico' | 'terceirizado' | 'mei';

/** Status estendido do colaborador (compatível com Funcionários do Apontamento RH). */
export type StatusColaborador = 'ativo' | 'inativo' | 'afastado' | 'demitido';

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
  /** PIS/PASEP (opcional). Adicionado para alinhamento com Funcionários. */
  pis?: string;
  /** CTPS — número e série (opcional). */
  ctps?: string;
  /** Função / cargo (texto livre por ora; lista igual à de Funcionários). */
  funcao?: string;
  /** Tipo de vínculo trabalhista (opcional). */
  tipoVinculo?: TipoVinculoColaborador;
  /** Status estendido (opcional). Quando ausente, usa o boolean `ativo`. */
  status?: StatusColaborador;
  /** Contato de emergência (Nome + telefone, texto livre). */
  contatoEmergencia?: string;
  /**
   * PR28 — Unificação progressiva: quando preenchido, indica que este
   * colaborador é a mesma pessoa que o funcionário do Apontamento RH
   * (apont_funcionarios) referenciado.
   * Vínculo opcional — quando NULL, ainda não foi unificado.
   */
  apontFuncionarioId?: string;
  observacoes: string;
  ativo: boolean;
  criadoPor: string;
}

// === Módulo de Compras (v2 — premium SaaS) ===

export type UrgenciaPedidoCompra = 'baixa' | 'normal' | 'alta' | 'critica';
export type StatusPedidoCompra =
  | 'pendente' | 'aprovado' | 'reprovado'
  | 'em_cotacao' | 'cotado' | 'comprado' | 'cancelado';
export type CategoriaMaterialCompra = string;
export type TipoItemCompra = 'material' | 'servico';

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
  /** material ou servico — default 'material' para compatibilidade */
  tipo?: TipoItemCompra;
  /** se já existe na base de Insumos, referência aqui (vazio = item livre) */
  insumoId?: string;
  /** flag transitória: solicitante marcou "salvar este item na base" */
  criarNaBase?: boolean;

  /** ── DESTINO POR ITEM (v2.5+) — TODOS OPCIONAIS ─────────────────────
   *  O solicitante PODE definir o destino do item já no pedido. Esses
   *  campos sobem pela cadeia (Pedido → Cotação → OC), permitindo que
   *  uma única OC tenha múltiplos destinos (blocos) gerados a partir
   *  de um pedido onde o solicitante deixou tudo organizado.
   *  Quando vazios, o comprador define os destinos no momento da OC. */
  tipoDestino?: TipoDestinoOC;
  /** Etapa específica (quando tipoDestino=obra_etapa). A obra usada é
   *  a do header do pedido (PedidoCompra.obraId), mas o solicitante
   *  pode misturar destinos diferentes nos itens. */
  etapaObraId?: string;
  /** ID do depósito/almoxarifado/tanque destino (opcional) */
  depositoDestinoId?: string;
  /** Equipamento (apenas pra manutencao_equipamento) */
  equipamentoId?: string;
  /** OS vinculada (apenas pra item serviço em manutenção) */
  osId?: string;
  /** Obra específica do item — quando o pedido cobre obras diferentes
   *  (raro mas possível). Default é PedidoCompra.obraId. */
  obraId?: string;
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
  /** texto livre opcional (modelo híbrido — pode ter itens E descrição) */
  descricaoLivre?: string;
  /** valor estimado opcional (preenchido por quem aprova quando pertinente) */
  valorEstimado?: number;
  itens: ItemPedidoCompra[];
  criadoPor: string;
  // Auditoria
  aprovadoPor?: string;
  aprovadoEm?: string;
  reprovadoPor?: string;
  reprovadoEm?: string;
  motivoReprovacao?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  // Soft delete
  deletadoEm?: string;
  deletadoPor?: string;
}

export type StatusCotacao = 'em_cotacao' | 'parcial' | 'cotado' | 'cancelada';

export interface ItemPrecoCotacao {
  itemPedidoId: string;
  precoUnitario: number;
  /** marca/modelo informada pelo fornecedor (preenchido via portal ou manual) */
  marca?: string;
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
  /** mesma data, formato timestamptz — para alertas */
  prazoRespostaAt?: string;
  /** texto livre opcional (vem do pedido quando pedido é em texto livre) */
  descricaoLivre?: string;
  status: StatusCotacao;
  fornecedores: CotacaoFornecedor[];
  itensPedido: ItemPedidoCompra[];
  observacoes: string;
  criadoPor: string;
  // Auditoria
  canceladaPor?: string;
  canceladaEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  // Soft delete
  deletadoEm?: string;
  deletadoPor?: string;
}

export type StatusOrdemCompra = 'emitida' | 'aprovada' | 'entregue' | 'cancelada' | 'recebida';
export type TipoDestinoOC =
  | 'obra_etapa'
  | 'obra_deposito'
  | 'deposito_central'
  | 'sede'
  | 'manutencao_equipamento'
  | 'tanque_combustivel';
export type StatusLancamentoFinanceiro =
  | 'nao_aplicavel' | 'pendente' | 'lancada' | 'cancelada';

export interface ItemOrdemCompra {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;

  /** OBSOLETOS no nível-OC global, mas mantidos pra retrocompat. A partir
   *  da v2.5 (arquitetura de blocos) o destino é POR ITEM — os campos
   *  abaixo (tipoDestino, obraId, etapaObraId, depositoDestinoId,
   *  equipamentoId) carregam o destino daquele item específico. */
  obraId: string;
  etapaObraId: string;

  /** material ou servico — default 'material' para compatibilidade */
  tipo?: TipoItemCompra;
  /** marca/modelo */
  marca?: string;

  /** ── DESTINO POR ITEM (v2.5+) ─────────────────────────────────────
   *  Cada item de uma OC pode ir pra um destino diferente. A OC agrupa
   *  itens em "blocos" no formulário, mas no banco cada item carrega
   *  seu próprio destino. Quando todos os itens têm o mesmo destino, a
   *  OC inteira herda esse destino nos campos OC-level (compat com
   *  visualizações antigas). */
  tipoDestino?: TipoDestinoOC;
  /** Depósito de material/almoxarifado/tanque destino (depende do tipoDestino) */
  depositoDestinoId?: string;
  /** Equipamento (apenas pra manutencao_equipamento — opcional, herdado da OS) */
  equipamentoId?: string;

  /** ref ao insumo cadastrado (opcional para outros destinos; OBRIGATÓRIO
   * para itens material em qualquer destino — garante que todo material
   * tem cadastro prévio. Em manutenção exige insumo com
   * usadoEmManutencao=true; em tanque exige tipo=combustivel). */
  insumoId?: string;
  /** OBRIGATÓRIO para itens servico em destino "manutencao_equipamento":
   * vincula o serviço (mão de obra) a uma Ordem de Serviço de equipamento. */
  osId?: string;
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
  // Destinos múltiplos
  tipoDestino?: TipoDestinoOC;
  equipamentoId?: string;
  depositoDestinoId?: string;
  // Auditoria
  aprovadaPor?: string;
  aprovadaEm?: string;
  canceladaPor?: string;
  canceladaEm?: string;
  recebidaPor?: string;
  recebidaEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  // Lançamento financeiro pendente (consumido pelo módulo Financeiro futuramente)
  lancamentoFinanceiroStatus?: StatusLancamentoFinanceiro;
  lancadoFinanceiroEm?: string;
  lancadoFinanceiroPor?: string;
  lancamentoFinanceiroId?: string;
  // Soft delete
  deletadoEm?: string;
  deletadoPor?: string;
}

// ── Recebimento de Ordem de Compra (v2.7+) ──────────────────────────
// Uma OC pode ser recebida em MÚLTIPLAS entregas (parcial → completa).
// Cada recebimento é uma "remessa" com seus itens, datas e fornecedores
// específicos. Quando a soma das quantidades recebidas iguala a OC, o
// status vira 'recebida'. Antes disso, fica 'aprovada' com badge "X de Y".
//
// O recebimento também é o momento em que o destino físico ESPECÍFICO
// (almoxarifado, tanque, depósito) é amarrado — pode vir vazio da OC.
// Ao confirmar, geram-se EntradaMaterial/EntradaCombustivel automáticas.
export interface RecebimentoOC {
  id: string;
  /** OC origem (FK para ordens_compra). */
  ordemCompraId: string;
  /** Número sequencial dentro da OC (1, 2, 3…). Útil pra exibir "Recebimento #2". */
  numeroRemessa: number;
  /** Data/hora em que o material foi recebido fisicamente. */
  dataRecebimento: string;
  /** Nota fiscal de entrega (opcional na primeira remessa). */
  notaFiscalEntrega?: string;
  /** Observação livre sobre a entrega (atrasos, avarias, observações do recebedor). */
  observacoes?: string;
  /** Itens recebidos NESTA remessa. */
  itens: ItemRecebimentoOC[];
  /** Usuário que registrou o recebimento. */
  recebidoPor: string;
  recebidoEm: string;
  // Auditoria
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
}

export interface ItemRecebimentoOC {
  id: string;
  /** Item da OC que foi recebido (FK pra ItemOrdemCompra.id). */
  itemOrdemCompraId: string;
  /** Quantidade recebida nesta remessa (pode ser menor que a qtd da OC). */
  quantidadeRecebida: number;
  /** Destino físico FINAL resolvido aqui (almoxarifado, tanque, depósito).
   *  Se a OC já tinha depositoDestinoId, esse valor é herdado; caso contrário,
   *  o recebedor escolhe. Pra serviço em manutenção, fica vazio (não estoca). */
  depositoDestinoId?: string;
  /** Lote/série pra rastreabilidade (opcional). */
  lote?: string;
  /** Validade do lote (opcional — útil pra graxa, óleo, alguns químicos). */
  validade?: string;
  /** EntradaMaterial gerada (FK) — pra estoque material e peças. */
  entradaMaterialId?: string;
  /** EntradaCombustivel gerada (FK) — pra tanque. */
  entradaCombustivelId?: string;
  /** Observação por item (avaria, divergência de descrição, etc.). */
  observacoes?: string;
}

// ── Financeiro (v1 — Contas a Pagar) ────────────────────────────────
// Lançamento financeiro = compromisso financeiro (a pagar/a receber) com
// origem em uma OC aprovada OU lançamento avulso. Não tem ITENS — só tem
// VALORES por DESTINO (rateio). É a ponte contábil entre Compras e o
// custo real das obras / equipamentos / sede.

export type OrigemLancamento = 'oc' | 'avulso' | 'folha' | 'frete';

export type StatusLancamento =
  | 'em_aberto'      // ainda não pago (nenhuma parcela quitada)
  | 'pago_parcial'   // algumas parcelas pagas, outras não
  | 'pago'           // todas as parcelas pagas
  | 'cancelado';

export type StatusParcelaLancamento = 'em_aberto' | 'pago' | 'cancelado';

export type FormaPagamentoLancamento =
  | 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cartao_credito'
  | 'cartao_debito' | 'cheque' | 'deposito' | 'outros';

/** Plano de contas simples: lista plana, com tipo despesa/receita. */
export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  ordem: number;
  ativo: boolean;
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
}

/** Tipo de destino do rateio. Mesma taxonomia que `TipoDestinoOC` pra que
 *  o rateio puxado da OC seja uma cópia 1:1 dos blocos. */
export type TipoDestinoRateio = TipoDestinoOC;

/** Linha do rateio: pra ONDE vai uma fatia do valor do lançamento. */
export interface RateioLancamento {
  id: string;
  lancamentoId: string;
  tipoDestino: TipoDestinoRateio;
  /** Campos contextuais por tipo. Só preenche o que se aplica ao tipoDestino. */
  obraId?: string;
  etapaObraId?: string;
  ordemServicoId?: string;
  equipamentoId?: string;
  depositoMaterialId?: string;
  /** Tanque de combustível (entidade `Deposito`). */
  depositoId?: string;
  /** Valor sempre em R$ (absoluto). Se input foi por %, o app converte
   *  e guarda também `percentual`. */
  valor: number;
  /** % do total — nullable, só preenchido quando input foi por percentual. */
  percentual?: number;
  observacoes?: string;
}

/** Parcela do lançamento: cronograma de pagamento. 1 parcela = 1 pagamento
 *  (regra de negócio v1). Status segue ciclo em_aberto → pago. */
export interface ParcelaLancamento {
  id: string;
  lancamentoId: string;
  numero: number;
  dataVencimento: string;
  valor: number;
  /** Preenchido quando a parcela é paga. */
  dataPagamento?: string;
  valorPago?: number;
  status: StatusParcelaLancamento;
}

/** Registro de pagamento de uma parcela. Hard-delete = estorno (parcela
 *  volta pra em_aberto). */
export interface PagamentoLancamento {
  id: string;
  parcelaId: string;
  dataPagamento: string;
  valor: number;
  formaPagamento?: FormaPagamentoLancamento | string;
  /** URL pública do comprovante (Supabase Storage). */
  comprovanteUrl?: string;
  observacoes?: string;
  criadoPor?: string;
  criadoEm?: string;
}

export interface LancamentoFinanceiro {
  id: string;
  numero: string;
  origem: OrigemLancamento;
  /** Vinculação com a OC (quando origem = 'oc'). */
  ordemCompraId?: string;
  dataEmissao: string;
  /** Vencimento da 1ª parcela (resumo pra ordenação/filtros). */
  dataVencimento: string;
  fornecedorId?: string;
  /** Nome do favorecido quando não existe fornecedor cadastrado. */
  favorecidoNome?: string;
  empresaPagadoraId?: string;
  categoriaId?: string;
  descricao: string;
  valorTotal: number;
  formaPagamento?: FormaPagamentoLancamento | string;
  observacoes?: string;
  /** URLs públicas dos anexos (NF, boleto, etc.) no Supabase Storage. */
  anexosUrls?: string[];
  status: StatusLancamento;
  /** Quando `true`, edição (descrição, valor, parcelas, rateio, fornecedor)
   *  fica travada. Pagamentos ainda podem ser registrados/estornados —
   *  fechar não interfere no fluxo financeiro. Pra desfazer use "Reabrir". */
  fechado?: boolean;
  fechadoEm?: string;
  fechadoPor?: string;
  reabertoEm?: string;
  reabertoPor?: string;
  /** Filhos carregados via join (preenchidos no hook de leitura). */
  parcelas: ParcelaLancamento[];
  rateios: RateioLancamento[];
  /** Auditoria padrão Compras v2. */
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  deletadoEm?: string;
  deletadoPor?: string;
}

// ── Anexos / Auditoria / Lixeira / Notificações / Portal Fornecedor ──

export type EntidadeCompra = 'pedido' | 'cotacao' | 'oc';

export interface ComprasAnexo {
  id: string;
  entidade: EntidadeCompra;
  entidadeId: string;
  nomeArquivo: string;
  tipoMime: string;
  tamanhoBytes: number;
  storagePath: string;
  enviadoPor: string;
  enviadoEm: string;
}

export type AcaoAuditoriaCompras =
  | 'created' | 'updated' | 'approved' | 'rejected' | 'cancelled'
  | 'deleted' | 'restored' | 'received' | 'sent_to_supplier'
  | 'quote_received' | 'financial_posted' | 'financial_cancelled';

export interface ComprasAuditoria {
  id: number;
  entidade: EntidadeCompra;
  entidadeId: string;
  acao: AcaoAuditoriaCompras;
  usuarioId?: string;
  usuarioNome: string;
  diffAntes?: Record<string, unknown>;
  diffDepois?: Record<string, unknown>;
  observacao?: string;
  criadoEm: string;
}

export interface ComprasLixeiraItem {
  id: string;
  entidade: EntidadeCompra;
  entidadeId: string;
  payload: Record<string, unknown>;
  deletadoPor: string;
  deletadoEm: string;
  retencaoAte: string;
  restauradoEm?: string;
  restauradoPor?: string;
}

export interface ComprasNotificacao {
  id: string;
  destinatarioId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  lida: boolean;
  lidaEm?: string;
  enviadoWhatsapp: boolean;
  enviadoWhatsappEm?: string;
  criadoEm: string;
}

export type CanalEnvioCotacao = 'whatsapp' | 'email' | 'link';

export interface CotacaoLinkPublico {
  id: string;
  cotacaoId: string;
  fornecedorId: string;
  token: string;
  canalEnvio?: CanalEnvioCotacao;
  expiresAt: string;
  respondido: boolean;
  respondidoEm?: string;
  criadoPor: string;
  criadoEm: string;
}

export interface CotacaoRespostaItem {
  itemPedidoId: string;
  precoUnitario: number;
  marca?: string;
}

export interface CotacaoRespostaFornecedor {
  id: string;
  linkPublicoId: string;
  cotacaoId: string;
  fornecedorId: string;
  itensResposta: CotacaoRespostaItem[];
  condicaoPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  assinaturaBase64?: string;
  respondidoEm: string;
  ipOrigem?: string;
}

// === Ordens de Serviço (PR9 - Marco 2) ===

export type TipoOS = 'preventiva' | 'corretiva' | 'preditiva' | 'melhoria' | 'garantia' | 'recall' | 'troca_oleo' | 'lubrificacao' | 'pneu' | 'solda' | 'eletrica' | 'revisao_geral' | 'outro';
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
  troca_oleo: 'Troca de óleo',
  lubrificacao: 'Lubrificação',
  pneu: 'Pneu',
  solda: 'Solda',
  eletrica: 'Elétrica',
  revisao_geral: 'Revisão geral',
  outro: 'Outro',
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
  custoTerceiros: number;
  custoOleos: number;
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
  | 'catalogo_pecas'
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
  catalogo_pecas: 'Catálogo de peças',
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

// === Manutenção — Óleos, Serviços Terceiros (Task 2.1) ===

export interface TipoOleo {
  id: string;
  nome: string;
  aplicacao: 'motor' | 'hidraulico' | 'transmissao' | 'diferencial' | 'graxa' | 'outro';
  intervaloMeses: number | null;
  ativo: boolean;
  createdAt: string;
  createdBy: string;
}

export interface OSTerceiro {
  id: string;
  osId: string;
  prestador: string;
  descricao: string;
  valor: number;
  notaFiscal: string | null;
  createdAt: string;
  createdBy: string;
}

export interface OSOleo {
  id: string;
  osId: string;
  tipoOleoId: string;
  quantidade: number;
  unidade: 'L' | 'kg';
  valorUnitario: number;
  valorTotal: number;
  createdAt: string;
  createdBy: string;
}

export interface OleoVencendo {
  equipamentoId: string;
  equipamentoNome: string;
  tipoOleoId: string;
  tipoOleoNome: string;
  aplicacao: string;
  ultimaTroca: string;
  intervaloMeses: number;
  dataVencimento: string;
  diasParaVencer: number;
  situacao: 'vencido' | 'a_vencer' | 'ok';
}
