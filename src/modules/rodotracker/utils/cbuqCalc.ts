/**
 * Memória de cálculo — CORREÇÃO DE DEFEITO (CBUQ)
 *
 * Dado um conjunto de cargas (tickets de pesagem dos caminhões de CBUQ
 * que chegam à obra), calcula as quantidades que serão acrescidas à
 * medição vigente do contrato (bloco 04.xx).
 *
 * Entrada: peso líquido do CBUQ transportado por carga, em toneladas.
 * Saída: mapa {código do contrato → quantidade}.
 */

import type { CbuqCarga } from "../types/activity";

/** Densidade efetiva do CBUQ (t/m³) — já incorpora perdas e compactação. */
export const CBUQ_DENSITY = 2.3840021874474;

/** Espessura padrão considerada na aplicação do CBUQ (m). */
export const CBUQ_THICKNESS_M = 0.05;

/** Taxa dos insumos 1 e 2 da área aplicada. */
export const AREA_INSUMO_RATE = 0.00045;

/** Teor de ligante asfáltico na mistura — usado para o Componente 2. */
export const COMPONENT2_RATE = 0.048099950495292;

/** Fator de utilização (densidade) na conversão de CBUQ → m³ transportados. */
export const CBUQ_TRANSPORT_FACTOR = 2.4;

/** DMT do caminhão basculante 10 m³ (km). */
export const DMT_10M3_KM = 22.4111290322581;

/**
 * Coeficiente consolidado de transporte 10 m³ (fator × DMT).
 * Aplica-se sobre o VOLUME de CBUQ em m³.
 */
export const K10_CBUQ = 53.7867096774194;

/**
 * Coeficiente consolidado de transporte 28 m³ (usinagem de CBUQ, agregados
 * com DMTs 140,6 km e 505,7 km). Aplica-se sobre o PESO de CBUQ em t.
 */
export const K28_CBUQ = 482.31219894408;

/** Mapa dos rótulos semânticos para códigos do contrato (bloco 04.xx). */
const CODE_MAP: Record<string, string> = {
  volCbuq:        "04.02",
  pesoCbuq:       "04.03",
  comp1:          "04.03.01",
  comp2:          "04.03.02",
  comp3:          "04.03.03",
  areaAplicada:   "04.04",
  areaIns1:       "04.04.01",
  areaIns2:       "04.04.02",
  transp10m3:     "04.05.01",
  transp28m3:     "04.05.02",
};

export const CBUQ_LABELS: Record<keyof typeof CODE_MAP, string> = {
  volCbuq:      "Volume de CBUQ aplicado",
  pesoCbuq:     "Peso de CBUQ aplicado",
  comp1:        "Componente 1 do CBUQ",
  comp2:        "Componente 2 do CBUQ",
  comp3:        "Componente 3 do CBUQ",
  areaAplicada: "Área aplicada de CBUQ",
  areaIns1:     "Insumo 1 da área aplicada",
  areaIns2:     "Insumo 2 da área aplicada",
  transp10m3:   "Transporte basculante 10 m³",
  transp28m3:   "Transporte basculante 28 m³",
};

export interface CbuqCalcResult {
  totalPesoT: number;
  totalVolumeM3: number;
  /** Mapa {código do contrato → quantidade a lançar}. */
  quantidades: Record<string, number>;
}

export function calcCbuq(cargas: CbuqCarga[] | undefined | null): CbuqCalcResult {
  const list = Array.isArray(cargas) ? cargas : [];
  const totalPeso = list.reduce((s, c) => s + (c.pesoT || 0), 0);
  const totalVolume = totalPeso / CBUQ_DENSITY;

  // Componente 2 e 1 seguem a ordem especificada (comp1 = comp2 × 0,5).
  const comp2 = totalPeso * COMPONENT2_RATE;
  const comp1 = comp2 * 0.5;
  const comp3 = comp2;

  const areaAplicada = totalVolume / CBUQ_THICKNESS_M;
  const areaIns1 = areaAplicada * AREA_INSUMO_RATE;
  const areaIns2 = areaIns1;

  const transp10m3 = totalVolume * K10_CBUQ;
  const transp28m3 = totalPeso * K28_CBUQ;

  const semantic: Record<string, number> = {
    volCbuq: totalVolume,
    pesoCbuq: totalPeso,
    comp1,
    comp2,
    comp3,
    areaAplicada,
    areaIns1,
    areaIns2,
    transp10m3,
    transp28m3,
  };

  const quantidades: Record<string, number> = {};
  for (const [key, value] of Object.entries(semantic)) {
    const code = CODE_MAP[key];
    if (!code) continue;
    if (!Number.isFinite(value) || value <= 0) continue;
    quantidades[code] = value;
  }

  return { totalPesoT: totalPeso, totalVolumeM3: totalVolume, quantidades };
}

export function getCbuqCodeMap() {
  return CODE_MAP;
}
