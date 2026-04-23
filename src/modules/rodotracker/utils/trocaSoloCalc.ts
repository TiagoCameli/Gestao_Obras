/**
 * Memória de cálculo — TROCA DE SOLO
 *
 * Com base nas medidas (comprimento, largura, espessura) e nos drenos
 * associados, calcula as quantidades que serão acrescidas à medição vigente
 * do contrato, separando itens do REMENDO PROFUNDO (camada asfáltica) e
 * da TROCA DE SOLO (camadas granulares).
 *
 * A classificação por ÁREA decide quais linhas ficam zeradas:
 *   ≤ 10 m²   → RP puro
 *   10-30 m²  → RP + TS (limite de 10 m² na parcela de RP)
 *   > 30 m²   → TS puro
 */

export type TsCategoria = "passivo" | "rotineira";

export interface DrenoMedidas {
  comprimento: number;
  largura: number;
  espessura: number;
}

export interface TsMedidas {
  comprimento: number;
  largura: number;
  espessura: number;
}

export type TsTipo = "RP" | "RP+TS" | "TS";

export interface TsCalcResult {
  area: number;
  tipo: TsTipo;
  volDreno: number;
  /** Mapa {código do contrato → quantidade a lançar na medição} */
  quantidades: Record<string, number>;
}

/** Tabela que liga cada rótulo semântico ao par (código passivo / código rotineira). */
const CODE_MAP: Record<
  string,
  { passivo: string; rotineira: string }
> = {
  volCbuqRP:          { passivo: "02.03",       rotineira: "03.03"       },
  imprimacao:         { passivo: "02.04",       rotineira: "03.04"       },
  pinturaLigacao:     { passivo: "02.05",       rotineira: "03.05"       },
  pinturaComp1:       { passivo: "02.05.01",    rotineira: "03.05.01"    },
  pinturaComp2:       { passivo: "02.05.02",    rotineira: "03.05.02"    },
  pinturaComp3:       { passivo: "02.05.03",    rotineira: "03.05.03"    },
  areaAplicadaCBUQ:   { passivo: "02.06",       rotineira: "03.06"       },
  areaAplicIns1:      { passivo: "02.06.01",    rotineira: "03.06.01"    },
  areaAplicIns2:      { passivo: "02.06.02",    rotineira: "03.06.02"    },
  remocaoAsf:         { passivo: "02.07.01",    rotineira: "03.16.01"    },
  escavacao1cat:      { passivo: "02.07.02",    rotineira: "03.16.02"    },
  cargaEscavado:      { passivo: "02.07.03",    rotineira: "03.16.03"    },
  bgsReaterro:        { passivo: "02.07.04",    rotineira: "03.16.04"    },
  areaIntervencao:    { passivo: "02.07.06",    rotineira: "03.16.06"    },
  areaIntIns1:        { passivo: "02.07.06.01", rotineira: "03.16.06.01" },
  areaIntIns2:        { passivo: "02.07.06.02", rotineira: "03.16.06.02" },
  cbuqSobreTS:        { passivo: "02.07.07",    rotineira: "03.16.07"    },
  cbuqTSComp1:        { passivo: "02.07.07.01", rotineira: "03.16.07.01" },
  cbuqTSComp2:        { passivo: "02.07.07.02", rotineira: "03.16.07.02" },
  cbuqTSComp3:        { passivo: "02.07.07.03", rotineira: "03.16.07.03" },
  enrocamento:        { passivo: "02.07.08",    rotineira: "03.16.08"    },
  volumeDreno:        { passivo: "02.07.09",    rotineira: "03.16.09"    },
  transp6m3:          { passivo: "02.10.01",    rotineira: "03.17.01"    },
  transp10m3:         { passivo: "02.10.02",    rotineira: "03.17.02"    },
  transp28m3:         { passivo: "02.10.03",    rotineira: "03.17.03"    },
};

function classify(area: number): TsTipo {
  if (area <= 10) return "RP";
  if (area <= 30) return "RP+TS";
  return "TS";
}

export function calcTrocaSolo(
  categoria: TsCategoria,
  ts: TsMedidas,
  drenos: DrenoMedidas[] = []
): TsCalcResult {
  const area = (ts.comprimento || 0) * (ts.largura || 0);
  const esp = ts.espessura || 0;
  const tipo = classify(area);
  const volDreno = drenos.reduce(
    (s, d) => s + (d.comprimento || 0) * (d.largura || 0) * (d.espessura || 0),
    0
  );

  // ── Camada asfáltica (RP) ────────────────────────────────────────────
  const volCbuqRP =
    tipo === "RP" ? area * 0.25 : tipo === "RP+TS" ? 2.5 : 0;
  const imprimacao =
    tipo === "RP" ? area * 0.20 : tipo === "RP+TS" ? 2.0 : 0;
  const pinturaLigacao =
    tipo === "RP" ? area * 0.05 * 2.4 : tipo === "RP+TS" ? 1.2 : 0;
  const pinturaComp1 = pinturaLigacao * 0.0493 * 0.5;
  const pinturaComp2 = pinturaLigacao * 0.048;
  const pinturaComp3 = pinturaComp2;
  const areaAplicadaCBUQ = volCbuqRP / 0.25;
  const areaAplicIns1 = areaAplicadaCBUQ * 0.00045;
  const areaAplicIns2 = areaAplicIns1;

  // ── Camadas granulares (TS) ──────────────────────────────────────────
  const remocaoAsf =
    tipo === "RP" ? 0 : tipo === "RP+TS" ? (area - 10) * 0.05 : area * 0.05;
  const escavSemDreno =
    tipo === "RP"
      ? 0
      : tipo === "RP+TS"
      ? (area - 10) * (esp - 0.05)
      : area * (esp - 0.05);
  const escavacao1cat = escavSemDreno + volDreno;
  const cargaEscavado = escavSemDreno * 0.10; // sem incluir dreno
  const bgsReaterro =
    tipo === "RP" ? 0 : tipo === "RP+TS" ? (area - 10) * 0.20 : area * 0.20;
  const areaIntervencao = area;
  const areaIntIns1 = areaIntervencao * 0.00045;
  const areaIntIns2 = areaIntIns1;
  const cbuqSobreTS =
    tipo === "RP"
      ? 0
      : tipo === "RP+TS"
      ? (area - 10) * 0.05 * 2.4
      : area * 0.05 * 2.4;
  const cbuqTSComp1 = cbuqSobreTS * 0.0493 * 0.5;
  const cbuqTSComp2 = cbuqSobreTS * 0.048;
  const cbuqTSComp3 = cbuqTSComp2;
  const enrocamento =
    esp <= 0.25
      ? 0
      : esp <= 0.45
      ? (esp - 0.25) * area
      : 0.20 * area + (esp - 0.45) * area;
  const volumeDreno = volDreno;

  // ── Transportes (coeficientes exatos, sem arredondamento) ───────────
  // 6 m³  — DMT 0,5 km
  const K6_REMOC   = 1.2;       // 2,4     × 0,5
  const K6_ESCAV   = 1.0315;    // 2,063   × 0,5
  const K6_CBUQ_RP = 1.0652;    // 2,1304  × 0,5
  // 10 m³ — DMT 22,4111290322581 km
  const K10_CBUQ_RP = 50.2009290322581;
  const K10_BGS     = 49.3044838709678;
  const K10_CBUQ_TS = 22.4111290322581;
  // 28 m³ — DMTs 140,6 / 505,7 / 526,4 km
  const K28_IMPRIM      = 1112.5273575;
  const K28_PINTURA     = 482.31219894408;
  const K28_BGS         = 1112.5273575;
  const K28_CBUQ_TS     = 482.31219894408;
  const K28_ENROCAMENTO = 947.52;
  const K28_DRENO       = 947.52;

  const transp6m3 =
    remocaoAsf * K6_REMOC +
    escavSemDreno * K6_ESCAV +
    volCbuqRP * K6_CBUQ_RP;
  const transp10m3 =
    volCbuqRP * K10_CBUQ_RP +
    bgsReaterro * K10_BGS +
    cbuqSobreTS * K10_CBUQ_TS;
  const transp28m3 =
    imprimacao * K28_IMPRIM +
    pinturaLigacao * K28_PINTURA +
    bgsReaterro * K28_BGS +
    cbuqSobreTS * K28_CBUQ_TS +
    enrocamento * K28_ENROCAMENTO +
    volumeDreno * K28_DRENO;

  // ── Monta o dicionário {código: qtd} conforme a categoria ────────────
  const semantic: Record<string, number> = {
    volCbuqRP,
    imprimacao,
    pinturaLigacao,
    pinturaComp1,
    pinturaComp2,
    pinturaComp3,
    areaAplicadaCBUQ,
    areaAplicIns1,
    areaAplicIns2,
    remocaoAsf,
    escavacao1cat,
    cargaEscavado,
    bgsReaterro,
    areaIntervencao,
    areaIntIns1,
    areaIntIns2,
    cbuqSobreTS,
    cbuqTSComp1,
    cbuqTSComp2,
    cbuqTSComp3,
    enrocamento,
    volumeDreno,
    transp6m3,
    transp10m3,
    transp28m3,
  };

  const quantidades: Record<string, number> = {};
  for (const [key, value] of Object.entries(semantic)) {
    const map = CODE_MAP[key];
    if (!map) continue;
    if (value <= 0) continue; // ignora zeros
    const code = categoria === "passivo" ? map.passivo : map.rotineira;
    quantidades[code] = value;
  }

  return { area, tipo, volDreno, quantidades };
}

/** Rótulos de exibição pro preview. */
export const LABELS: Record<keyof typeof CODE_MAP, string> = {
  volCbuqRP:        "CBUQ aplicado no Remendo Profundo",
  imprimacao:       "Imprimação com asfalto diluído",
  pinturaLigacao:   "Pintura de ligação",
  pinturaComp1:     "Pintura de ligação — componente 1",
  pinturaComp2:     "Pintura de ligação — componente 2",
  pinturaComp3:     "Pintura de ligação — componente 3",
  areaAplicadaCBUQ: "Área aplicada de CBUQ",
  areaAplicIns1:    "Insumo 1 da área aplicada",
  areaAplicIns2:    "Insumo 2 da área aplicada",
  remocaoAsf:       "Remoção mecanizada de revestimento asfáltico",
  escavacao1cat:    "Escavação em material de 1ª categoria",
  cargaEscavado:    "Carga do material escavado",
  bgsReaterro:      "BGS para reaterro",
  areaIntervencao:  "Área de intervenção",
  areaIntIns1:      "Insumo 1 da área de intervenção",
  areaIntIns2:      "Insumo 2 da área de intervenção",
  cbuqSobreTS:      "CBUQ sobre a troca de solo",
  cbuqTSComp1:      "CBUQ TS — componente 1",
  cbuqTSComp2:      "CBUQ TS — componente 2",
  cbuqTSComp3:      "CBUQ TS — componente 3",
  enrocamento:      "Enrocamento / Pedra de mão",
  volumeDreno:      "Volume do dreno",
  transp6m3:        "Transporte basculante 6 m³ (curta distância)",
  transp10m3:       "Transporte basculante 10 m³ (média distância)",
  transp28m3:       "Transporte basculante 28 m³ (longa distância)",
};

export function getCodeMap() {
  return CODE_MAP;
}
