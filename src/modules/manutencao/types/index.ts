// ============================================================================
// Módulo de Manutenção — Types
// src/modules/manutencao/types/index.ts
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Enums e tipos básicos
// ----------------------------------------------------------------------------

export type ManutencaoCategoria =
  | 'diaria'
  | 'h_50'
  | 'h_250'
  | 'h_500'
  | 'h_1000'
  | 'h_2000'
  | 'h_3000'
  | 'h_5000'
  | 'anual'
  | 'sob_demanda';

export type ManutencaoPrioridade = 'critica' | 'alta' | 'media' | 'baixa';

export type ExecutorPapel =
  | 'operador'
  | 'mecanico_propio'
  | 'mecanico_especialista'
  | 'concessionaria_cat'
  | 'laboratorio_terceiro';

export type FluidoTipo =
  | 'oleo_motor'
  | 'oleo_hidraulico'
  | 'oleo_transmissao'
  | 'oleo_swing_drive'
  | 'oleo_comando_final'
  | 'oleo_diferencial'
  | 'oleo_eixo'
  | 'oleo_caixa_redutora'
  | 'liquido_arrefecimento'
  | 'fluido_freio'
  | 'graxa'
  | 'combustivel_diesel'
  | 'agua_destilada_bateria';

export type FiltroTipo =
  | 'oleo_motor'
  | 'combustivel_primario'
  | 'combustivel_secundario'
  | 'separador_agua'
  | 'ar_primario'
  | 'ar_secundario'
  | 'pre_filtro_ar'
  | 'cabine_recirculacao'
  | 'cabine_ar_fresco'
  | 'hidraulico_retorno'
  | 'hidraulico_piloto'
  | 'hidraulico_case_drain'
  | 'hidraulico_pressao'
  | 'transmissao'
  | 'respiro_carter'
  | 'respiro_tanque_hidraulico';

export type ManutencaoAgendamentoStatus =
  | 'agendada'
  | 'atrasada'
  | 'concluida'
  | 'cancelada';

export type ManutencaoRegistroStatus =
  | 'concluida'
  | 'pendente'
  | 'parcial'
  | 'cancelada';

export type AlertaTipo =
  | 'manutencao_atrasada'
  | 'horimetro_proximo'
  | 'filtro_indicador'
  | 'consumo_oleo_alto'
  | 'falha_eletronica'
  | 'analise_oleo_critica';

export type AlertaSeveridade = 'info' | 'warning' | 'critical';

// ----------------------------------------------------------------------------
// 2. Catálogos
// ----------------------------------------------------------------------------

export interface Fluido {
  id: string;
  tipo: FluidoTipo;
  catProductName?: string;
  apiSpecification?: string;
  viscosity?: string;
  description: string;
  ambientTempMinC?: number;
  ambientTempMaxC?: number;
  packageSizes?: string[];
  custoMedioLitroBrl?: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

export interface Peca {
  partNumber: string;
  description: string;
  manufacturer: string;
  tipo: FiltroTipo | FluidoTipo | 'componente_mecanico' | 'componente_eletrico' | 'mangueira';
  alternativePartNumbers?: string[];
  custoMedioBrl?: number;
  fornecedorPrincipal?: string;
  observacoes?: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

// ----------------------------------------------------------------------------
// 3. Modelo de equipamento (catálogo)
// ----------------------------------------------------------------------------

export interface MotorSpec {
  catModel?: string;
  displacementL?: number;
  netPowerKW?: number;
  netPowerHP?: number;
  cylinders?: number;
  configuration?: string;
  injectionType?: string;
}

export interface CapacidadesSpec {
  fuelTankL?: number;
  engineCrankcaseL?: number;
  hydraulicSystemTotalL?: number;
  hydraulicTankL?: number;
  swingDriveL?: number;
  finalDriveEachL?: number;
  finalDriveCount?: number;
  transmissionL?: number;
  axleFrontL?: number;
  axleRearL?: number;
  coolantSystemL?: number;
  differentialL?: number;
}

export interface FluidoRecomendado {
  system:
    | 'motor'
    | 'hidraulico'
    | 'transmissao'
    | 'swing_drive'
    | 'comando_final'
    | 'eixo_dianteiro'
    | 'eixo_traseiro'
    | 'arrefecimento'
    | 'graxa_geral';
  fluidoId: string;
  notes?: string;
}

export interface FiltroRef {
  filterType: FiltroTipo;
  partNumber: string;
  alternativePartNumbers?: string[];
  quantity: number;
  notes?: string;
  serialPrefixApplicability?: string[];
}

export interface EquipamentoModelo {
  id: string;
  fabricante: string;
  modeloNome: string;
  familia: string;
  tipoEquipamentoCodigo?: string;
  anoInicioProducao?: number;
  anoFimProducao?: number;
  prefixosSerie?: string[];

  motor: MotorSpec;
  capacidades: CapacidadesSpec;
  fluidosRecomendados: FluidoRecomendado[];
  filtros: FiltroRef[];

  problemasConhecidos?: string;
  manualUrl?: string;
  manualReferencia?: string;

  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

// ----------------------------------------------------------------------------
// 4. Tarefa de manutenção
// ----------------------------------------------------------------------------

export interface TorqueSpec {
  componentName: string;
  torqueNm: number;
  torqueLbFt?: number;
  threadLockerRequired?: boolean;
}

export interface FerramentaRef {
  name: string;
  size?: string;
  catSpecialToolNumber?: string;
}

export interface PecaConsumo {
  partNumber: string;
  quantity: number;
  notes?: string;
}

export interface FluidoConsumo {
  fluidoId: string;
  quantityLiters: number;
  notes?: string;
}

export interface ProcedimentoStep {
  order: number;
  title: string;
  description: string;
  estimatedMinutes?: number;
  warningNotes?: string;
  imageUrl?: string;
}

/**
 * Spec técnica detalhada com thresholds e tolerâncias (folgas, pressões, gaps).
 * Diferente do TorqueSpec.
 */
export interface SpecTecnica {
  parametro: string;              // "Folga das válvulas — admissão"
  valorNominal: string;           // "0,38 mm"
  valorMinimo?: string;           // "0,33 mm"
  valorMaximo?: string;           // "0,43 mm"
  unidade?: string;               // "mm", "bar", "Nm", "kPa"
  condicaoMedicao?: string;       // "Motor frio (≤30°C)"
  metodoMedicao?: string;         // "Calibrador de lâminas"
  observacao?: string;
}

/**
 * Critério de aceite — o que indica que o serviço foi feito corretamente.
 */
export interface CriterioAceite {
  ordem: number;
  descricao: string;
  comoVerificar?: string;
  acaoSeReprovar?: string;
}

/**
 * Sinal de alerta — quando o mecânico DEVE parar e investigar.
 */
export interface SinalAlerta {
  sinal: string;
  significado: string;
  acao: string;
  severidade: 'info' | 'atencao' | 'critico';
}

export interface ManutencaoTarefa {
  id: string;
  modeloId: string;
  titulo: string;
  categoria: ManutencaoCategoria;
  intervaloHoras?: number;
  intervaloDias?: number;
  prioridade: ManutencaoPrioridade;
  executorPapel: ExecutorPapel;
  duracaoEstimadaMin?: number;

  // Recursos
  pecasNecessarias: PecaConsumo[];
  fluidosNecessarios: FluidoConsumo[];
  ferramentasNecessarias: FerramentaRef[];

  // Descrição técnica e contexto
  descricaoTecnica: string;
  sistemasAfetados: string[];

  // Procedimento e specs
  procedimento: ProcedimentoStep[];
  torques: TorqueSpec[];
  specsTecnicas: SpecTecnica[];

  // Critérios e sinais
  criteriosAceite: CriterioAceite[];
  sinaisAlerta: SinalAlerta[];

  // Segurança e referência
  notasSeguranca?: string;
  epi?: string[];
  notasTecnicas?: string;
  manualReferencia?: string;
  preRequisitos?: string[];

  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

// ----------------------------------------------------------------------------
// 5. Equipamento (extensão do existente — campos adicionados pela migration)
// ----------------------------------------------------------------------------

/**
 * Campos NOVOS adicionados à tabela equipamentos pela migration de manutenção.
 * O tipo Equipamento original do projeto deve ser estendido com estes campos.
 */
export interface EquipamentoManutencaoFields {
  modeloId?: string;
  prefixoSerie?: string;
  horimetroFuncional: boolean;
  horimetroAtual?: number;
  notasUnidade?: string;
  alertasCriticos?: string[];
}

// ----------------------------------------------------------------------------
// 6. Operacional
// ----------------------------------------------------------------------------

export interface HorimetroLeitura {
  id: string;
  equipamentoId: string;
  dataLeitura: string;        // YYYY-MM-DD
  valor: number;
  origem: 'manual' | 'manutencao' | 'apontamento';
  observacao?: string;
  registradoPor?: string;
  criadoEm: string;
  criadoPor: string;
}

export interface ManutencaoAgendamento {
  id: string;
  equipamentoId: string;
  tarefaId: string;
  dataPrevista: string;       // YYYY-MM-DD
  horimetroPrevisto?: number;
  custoEstimadoBrl?: number;
  status: ManutencaoAgendamentoStatus;
  alertaDiasAntes?: number;
  origem: 'auto' | 'manual';
  baseadoEmRegistroId?: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

export interface ManutencaoRegistro {
  id: string;
  equipamentoId: string;
  tarefaId: string;
  agendamentoId?: string;

  executadoEm: string;        // ISO
  executadoPorFuncionarioId?: string;
  executorPapel: ExecutorPapel;

  horimetroNoMomento?: number;
  status: ManutencaoRegistroStatus;

  pecasUsadas: PecaConsumo[];
  fluidosUsados: FluidoConsumo[];
  custoTotalBrl?: number;

  fotosUrls?: string[];
  observacoes?: string;
  problemasEncontrados?: string;
  acoesRecomendadas?: string;

  // Reservado para Fase 2 — Análise de óleo S.O.S Cat
  oleoAmostraColetada?: boolean;
  oleoAmostraResultado?: 'normal' | 'atencao' | 'acao_imediata';
  oleoAmostraPdfUrl?: string;
  oleoAmostraDataEnvio?: string;
  oleoAmostraDataResultado?: string;

  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
}

export interface ManutencaoAlerta {
  id: string;
  equipamentoId: string;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  mensagem: string;
  agendamentoId?: string;
  registroId?: string;
  reconhecidoEm?: string;
  reconhecidoPorFuncionarioId?: string;
  criadoEm: string;
  criadoPor: string;
}

// ----------------------------------------------------------------------------
// 7. View-models combinados (úteis no front)
// ----------------------------------------------------------------------------

/**
 * Status de manutenção agregado de um equipamento — para exibição em cards/listas.
 */
export interface EquipamentoComStatusManutencao {
  equipamentoId: string;
  patrimony: string;
  nome: string;
  modeloId?: string;
  modeloNome?: string;
  ativo: boolean;
  horimetroAtual?: number;
  horimetroFuncional: boolean;

  proximaManutencao?: {
    agendamentoId: string;
    tarefaId: string;
    tarefaTitulo: string;
    categoria: ManutencaoCategoria;
    dataPrevista: string;
    diasRestantes: number;     // negativo = atrasado
    prioridade: ManutencaoPrioridade;
  };

  manutencoesAtrasadas: number;
  alertasAtivos: number;
  alertasCriticos: number;

  ultimaManutencao?: {
    registroId: string;
    tarefaTitulo: string;
    executadoEm: string;
  };
}

/**
 * Linha de catálogo de modelo + contagem de tarefas (para tela de catálogo).
 */
export interface ModeloComContagem extends EquipamentoModelo {
  totalTarefas: number;
  totalEquipamentosNaFrota: number;
}

// ----------------------------------------------------------------------------
// 8. Row types (formato direto do Postgres — snake_case)
// ----------------------------------------------------------------------------

export interface FluidoRow {
  id: string;
  tipo: string;
  cat_product_name: string | null;
  api_specification: string | null;
  viscosity: string | null;
  description: string;
  ambient_temp_min_c: number | null;
  ambient_temp_max_c: number | null;
  package_sizes: string[] | null;
  custo_medio_litro_brl: number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface PecaRow {
  part_number: string;
  description: string;
  manufacturer: string;
  tipo: string;
  alternative_part_numbers: string[] | null;
  custo_medio_brl: number | null;
  fornecedor_principal: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface EquipamentoModeloRow {
  id: string;
  fabricante: string;
  modelo_nome: string;
  familia: string;
  tipo_equipamento_codigo: string | null;
  ano_inicio_producao: number | null;
  ano_fim_producao: number | null;
  prefixos_serie: string[] | null;
  motor: MotorSpec;
  capacidades: CapacidadesSpec;
  fluidos_recomendados: FluidoRecomendado[];
  filtros: FiltroRef[];
  problemas_conhecidos: string | null;
  manual_url: string | null;
  manual_referencia: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface ManutencaoTarefaRow {
  id: string;
  modelo_id: string;
  titulo: string;
  categoria: string;
  intervalo_horas: number | null;
  intervalo_dias: number | null;
  prioridade: string;
  executor_papel: string;
  duracao_estimada_min: number | null;
  pecas_necessarias: PecaConsumo[];
  fluidos_necessarios: FluidoConsumo[];
  ferramentas_necessarias: FerramentaRef[];
  procedimento: ProcedimentoStep[];
  descricao_tecnica: string;
  sistemas_afetados: string[] | null;
  torques: TorqueSpec[];
  specs_tecnicas: SpecTecnica[];
  criterios_aceite: CriterioAceite[];
  sinais_alerta: SinalAlerta[];
  notas_seguranca: string | null;
  epi: string[] | null;
  notas_tecnicas: string | null;
  manual_referencia: string | null;
  pre_requisitos: string[] | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface HorimetroLeituraRow {
  id: string;
  equipamento_id: string;
  data_leitura: string;
  valor: number;
  origem: string;
  observacao: string | null;
  registrado_por: string | null;
  criado_em: string;
  criado_por: string;
}

export interface ManutencaoAgendamentoRow {
  id: string;
  equipamento_id: string;
  tarefa_id: string;
  data_prevista: string;
  horimetro_previsto: number | null;
  custo_estimado_brl: number | null;
  status: string;
  alerta_dias_antes: number | null;
  origem: string;
  baseado_em_registro_id: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface ManutencaoRegistroRow {
  id: string;
  equipamento_id: string;
  tarefa_id: string;
  agendamento_id: string | null;
  executado_em: string;
  executado_por_funcionario_id: string | null;
  executor_papel: string;
  horimetro_no_momento: number | null;
  status: string;
  pecas_usadas: PecaConsumo[];
  fluidos_usados: FluidoConsumo[];
  custo_total_brl: number | null;
  fotos_urls: string[] | null;
  observacoes: string | null;
  problemas_encontrados: string | null;
  acoes_recomendadas: string | null;
  oleo_amostra_coletada: boolean | null;
  oleo_amostra_resultado: string | null;
  oleo_amostra_pdf_url: string | null;
  oleo_amostra_data_envio: string | null;
  oleo_amostra_data_resultado: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

export interface ManutencaoAlertaRow {
  id: string;
  equipamento_id: string;
  tipo: string;
  severidade: string;
  mensagem: string;
  agendamento_id: string | null;
  registro_id: string | null;
  reconhecido_em: string | null;
  reconhecido_por_funcionario_id: string | null;
  criado_em: string;
  criado_por: string;
}

// ----------------------------------------------------------------------------
// 9. Constantes úteis
// ----------------------------------------------------------------------------

export const CATEGORIA_LABELS: Record<ManutencaoCategoria, string> = {
  diaria: 'Diária',
  h_50: 'Semanal (50h)',
  h_250: 'Mensal (250h)',
  h_500: '500 horas',
  h_1000: '1000 horas',
  h_2000: '2000 horas',
  h_3000: '3000 horas',
  h_5000: '5000 horas',
  anual: 'Anual',
  sob_demanda: 'Sob demanda',
};

export const PRIORIDADE_LABELS: Record<ManutencaoPrioridade, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const PRIORIDADE_CORES: Record<ManutencaoPrioridade, string> = {
  critica: 'var(--color-danger-soft, #fee2e2)',
  alta: 'var(--color-warning-soft, #fef3c7)',
  media: 'var(--color-info-soft, #dbeafe)',
  baixa: 'var(--color-surface-2)',
};

export const EXECUTOR_LABELS: Record<ExecutorPapel, string> = {
  operador: 'Operador',
  mecanico_propio: 'Mecânico próprio',
  mecanico_especialista: 'Mecânico especialista',
  concessionaria_cat: 'Concessionária Cat (Sotreq)',
  laboratorio_terceiro: 'Laboratório terceiro',
};

export const SEVERIDADE_LABELS: Record<AlertaSeveridade, string> = {
  info: 'Informação',
  warning: 'Atenção',
  critical: 'Crítico',
};

// ----------------------------------------------------------------------------
// 10. Permissões (chaves para temAcao — alinhadas com src/utils/permissions.ts)
// ----------------------------------------------------------------------------

/**
 * Chaves flat usadas pelo `temAcao(...)`. Refletem o que está cadastrado em
 * src/utils/permissions.ts no grupo "Manutenção".
 */
export const ACOES_MANUTENCAO = {
  visualizar: 'ver_manutencao',
  executar: 'executar_manutencao',
  editar: 'editar_manutencao',
  gerenciar: 'gerenciar_catalogo_manutencao',
  verCustos: 'ver_custos',
  // Workflow de Ordem de Serviço (já existentes)
  criarOs: 'criar_os',
  editarOs: 'editar_os',
  excluirOs: 'excluir_os',
  aprovarOs: 'aprovar_os',
} as const;

export type AcaoManutencao = (typeof ACOES_MANUTENCAO)[keyof typeof ACOES_MANUTENCAO];
