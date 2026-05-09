// Tipos do filtro global do módulo Combustível.
//
// Granularidade: filtros que afetam TODAS as abas analíticas (Visão
// Geral, Equipamentos/Carretas, Obras, Fornecedores, Anomalias).
// Filtros locais das abas operacionais (lista de Saídas, Entradas etc.)
// ficam fora daqui.
//
// Persistência: state vive em URL search params (compartilhável) +
// memória do Context. Visões nomeadas vão pra localStorage.

/** Mode de consumidor — separa abastecimentos de equipamento próprio
 *  dos de carreta de transportadora terceirizada. Mapeia 1:1 pro enum
 *  `TipoConsumidorSaida` em src/types/index.ts. */
export type ConsumidorMode = 'proprios' | 'carretas';

export type Periodo = {
  /** ISO date YYYY-MM-DD inclusive. */
  from: string;
  /** ISO date YYYY-MM-DD inclusive. */
  to: string;
};

/** Presets de período relativos ao "hoje" do usuário.
 *  custom = datas escolhidas manualmente. */
export type PeriodoPreset =
  | 'hoje'
  | 'ultimos_7'
  | 'ultimos_30'
  | 'mes_atual'
  | 'mes_anterior'
  | 'trimestre_atual'
  | 'ano_atual'
  | 'custom';

/** Eixo de cross-highlight em hover (sem confirmar clique). */
export type CrossHighlight =
  | { type: 'equipamento'; value: string }
  | { type: 'placa'; value: string }
  | { type: 'obra'; value: string }
  | { type: 'fornecedor'; value: string }
  | { type: 'tipo'; value: string }
  | { type: 'operador'; value: string }
  | null;

export interface CombustivelFilterState {
  /** Mode de consumidor — escopo macro do dashboard. 'proprios' (default)
   *  filtra tipoConsumidor='equipamento_proprio'; 'carretas' filtra
   *  'carreta_transportadora'. Tabs operacionais (Entradas/Transferências/
   *  Tanques) e Fornecedores ignoram esse mode. */
  mode: ConsumidorMode;
  preset: PeriodoPreset;
  /** Calculado a partir do preset OU custom. Sempre presente — quando
   *  preset='ultimos_30' a UI computa from/to e popula aqui. */
  periodo: Periodo;
  obraIds: string[];
  /** Aplica em mode='proprios'. */
  equipamentoIds: string[];
  /** FK soft pra insumos.id (insumos.tipo='combustivel'). */
  tipoCombustiveis: string[];
  /** Texto livre — entradas_combustivel.fornecedor é string, não FK.
   *  Comparação case-insensitive. Não respeita mode (entradas são
   *  abastecimentos do tanque, não saídas). */
  fornecedores: string[];
  /** Texto livre — saidas_combustivel.motorista é string. UI exibe
   *  como "Operador" (próprios) ou "Motorista" (carretas). */
  operadores: string[];
  /** Aplica em mode='carretas' (FK fornecedores.id ehTransportadora=true). */
  transportadoraIds: string[];
  /** Aplica em mode='carretas' — texto livre. */
  placas: string[];
  /** Tanque genérico — aplica em saídas (s.tanqueId) e entradas (e.depositoId).
   *  Visível em todas as abas, exceto Transferências (que tem origem/destino
   *  específicos). Funciona em ambos os modes. */
  tanqueIds: string[];
  /** Tanque origem — só aparece na FilterBar quando aba=Transferências. */
  tanqueOrigemIds: string[];
  /** Tanque destino — só aparece na FilterBar quando aba=Transferências. */
  tanqueDestinoIds: string[];
  /** "Apenas sem equipamento identificado" — força equipamentoId='desconhecido'.
   *  Combina com outros filtros (intersect, não substitui). Ex: ?obras=X&sentinel=1
   *  = sentinels da obra X. Ignora equipamentoIds quando true (mutuamente
   *  excludentes). Só faz sentido em mode='proprios'. */
  apenasSentinel: boolean;
}

export interface SavedView {
  id: string;
  nome: string;
  filtros: CombustivelFilterState;
  createdAt: string;
}
