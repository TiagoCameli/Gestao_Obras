/**
 * Exporta uma planilha Excel com design premium do contrato de medição
 * referente à medição selecionada. Cada linha carrega estilos (cor, peso,
 * borda, alinhamento) conforme o nível (etapa / subetapa / item) e as
 * colunas de valores ficam com formatação de moeda BR.
 */
import XLSX from "xlsx-js-style";
import type { Activity, ContractItem, Obra } from "../types/activity";
import {
  getLevel,
  isAggregating,
  itemTotal,
  sortByCode,
  grandTotal,
} from "./contractTree";
import {
  buildContribsByCodeAndMedicao,
  itemQtyForMedicao,
  itemAccumulatedQty,
  aggregatedCurrentValue,
  aggregatedAccumulatedValue,
} from "./medicaoAggregates";

type CellStyle = NonNullable<XLSX.CellObject["s"]>;
type Cell = XLSX.CellObject;

const HEX = {
  bg: "0D1017",
  sunken: "070A10",
  panel: "1A1E2B",
  accent: "F59E0B",
  accentDark: "B45309",
  purple: "C084FC",
  purpleDark: "7E22CE",
  info: "5AA7FF",
  success: "2FD3A6",
  textPrimary: "E8EAF0",
  textSecondary: "9198AD",
  textMuted: "5C6380",
  border: "2E3345",
  white: "FFFFFF",
};

const BRL_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const QTY_FORMAT = "#,##0.0000";
const PCT_FORMAT = "0.00%";

const thinBorder = { style: "thin", color: { rgb: HEX.border } } as const;
const BORDER_ALL = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

function cell(v: string | number | null, style?: CellStyle): Cell {
  const isNumber = typeof v === "number" && Number.isFinite(v);
  if (v === null || v === "") return { t: "s", v: "", s: style };
  if (isNumber) return { t: "n", v, s: style };
  return { t: "s", v: String(v), s: style };
}

function headerTitleStyle(color = HEX.accent): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 18 },
    fill: { fgColor: { rgb: color } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDER_ALL,
  };
}

function subtitleStyle(): CellStyle {
  return {
    font: { italic: true, color: { rgb: HEX.textSecondary }, sz: 11 },
    fill: { fgColor: { rgb: HEX.panel } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDER_ALL,
  };
}

function infoKeyStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.textMuted }, sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { fgColor: { rgb: HEX.sunken } },
    border: BORDER_ALL,
  };
}

function infoValueStyle(): CellStyle {
  return {
    font: { color: { rgb: HEX.textPrimary }, sz: 11, bold: true },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { fgColor: { rgb: HEX.bg } },
    border: BORDER_ALL,
  };
}

function colHeaderStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 10 },
    fill: { fgColor: { rgb: HEX.bg } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER_ALL,
  };
}

function rowStyle(level: "etapa" | "subetapa" | "item", align: "left" | "right" | "center", fmt?: string, mono = false): CellStyle {
  if (level === "etapa") {
    return {
      font: {
        bold: true,
        color: { rgb: HEX.accentDark },
        sz: 11,
        name: mono ? "Consolas" : undefined,
      },
      fill: { fgColor: { rgb: "FDF3D4" } },
      alignment: { horizontal: align, vertical: "center" },
      border: BORDER_ALL,
      numFmt: fmt,
    };
  }
  if (level === "subetapa") {
    return {
      font: {
        bold: true,
        color: { rgb: HEX.purpleDark },
        sz: 10.5,
        name: mono ? "Consolas" : undefined,
      },
      fill: { fgColor: { rgb: "F3E8FF" } },
      alignment: { horizontal: align, vertical: "center" },
      border: BORDER_ALL,
      numFmt: fmt,
    };
  }
  return {
    font: {
      color: { rgb: "1A1E2B" },
      sz: 10,
      name: mono ? "Consolas" : undefined,
    },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: align, vertical: "center" },
    border: BORDER_ALL,
    numFmt: fmt,
  };
}

function totalsStyle(align: "left" | "right" | "center", fmt?: string, accent = HEX.success): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 12 },
    fill: { fgColor: { rgb: accent } },
    alignment: { horizontal: align, vertical: "center" },
    border: BORDER_ALL,
    numFmt: fmt,
  };
}

function sectionHeaderStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 12 },
    fill: { fgColor: { rgb: HEX.bg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
    border: BORDER_ALL,
  };
}

function kpiLabelStyle(color: string): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 9 },
    fill: { fgColor: { rgb: color } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_ALL,
  };
}

function kpiValueStyle(color: string, fmt: string): CellStyle {
  return {
    font: { bold: true, color: { rgb: color }, sz: 16, name: "Consolas" },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_ALL,
    numFmt: fmt,
  };
}

function indValueStyle(fmt: string): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.textPrimary }, sz: 12, name: "Consolas" },
    fill: { fgColor: { rgb: HEX.bg } },
    alignment: { horizontal: "right", vertical: "center" },
    border: BORDER_ALL,
    numFmt: fmt,
  };
}

function rankStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: HEX.white }, sz: 11, name: "Consolas" },
    fill: { fgColor: { rgb: HEX.textMuted } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_ALL,
  };
}

interface ExportArgs {
  obra: Obra;
  items: ContractItem[];
  activities: Activity[];
  medicao: number;
}

export function exportMedicaoExcel({ obra, items, activities, medicao }: ExportArgs) {
  const sorted = sortByCode(items);
  const contribsMap = buildContribsByCodeAndMedicao(activities);

  const headerLabels = [
    "Tipo",
    "Código",
    "Descrição",
    "Unid.",
    "Qtd Contratada",
    "R$ Unitário",
    "R$ Total Contrato",
    `Qtd ${medicao}ª Medição`,
    `R$ ${medicao}ª Medição`,
    "Qtd Total Acumulada",
    "R$ Total Medido",
    "% Executado",
  ];

  // Monta a AOA (array de arrays) com objetos de célula {v, s, t, z}
  const aoa: Cell[][] = [];

  // Cabeçalho principal
  aoa.push([
    cell(`CONTRATO DE MEDIÇÃO · ${medicao}ª MEDIÇÃO`, headerTitleStyle()),
    ...Array(11).fill(cell("", headerTitleStyle())),
  ]);
  aoa.push([
    cell(obra.name, subtitleStyle()),
    ...Array(11).fill(cell("", subtitleStyle())),
  ]);
  aoa.push(Array(12).fill(cell("", {})));

  // Bloco de informações da obra (2 colunas de chave/valor)
  const infoRows: [string, string][] = [
    ["Obra", obra.name || "—"],
    ["Tipo de obra", obra.tipoObra || "—"],
    ["Rodovia", obra.rodovia || "—"],
    ["Contrato", obra.contrato || "—"],
    ["Lote", obra.lote || "—"],
    ["Trecho", obra.trecho || "—"],
    [
      "KM",
      obra.kmInicial != null && obra.kmFinal != null
        ? `${obra.kmInicial.toFixed(3)} → ${obra.kmFinal.toFixed(3)}`
        : "—",
    ],
    [
      "Extensão",
      obra.extensionKm != null ? `${obra.extensionKm.toFixed(3)} km` : "—",
    ],
    ["Medição", `${medicao}ª`],
    ["Emitido em", new Date().toLocaleDateString("pt-BR")],
  ];

  for (const [k, v] of infoRows) {
    const row: Cell[] = [
      cell(k, infoKeyStyle()),
      cell(v, infoValueStyle()),
      cell(v, infoValueStyle()),
      cell(v, infoValueStyle()),
    ];
    while (row.length < 12) row.push(cell("", {}));
    aoa.push(row);
  }

  aoa.push(Array(12).fill(cell("", {})));

  // Cabeçalho da tabela
  aoa.push(headerLabels.map((h) => cell(h, colHeaderStyle())));

  // Linhas do contrato
  for (const it of sorted) {
    const level = getLevel(it);
    const normLevel: "etapa" | "subetapa" | "item" =
      level === "etapa" || level === "subetapa" ? level : "item";
    const agg = isAggregating(it, sorted);
    const total = itemTotal(it, sorted);
    const curVal = aggregatedCurrentValue(it, sorted, contribsMap, medicao);
    const totVal = aggregatedAccumulatedValue(it, sorted, contribsMap);
    const curQty = agg ? null : itemQtyForMedicao(it, sorted, contribsMap, medicao, medicao);
    const totQty = agg ? null : itemAccumulatedQty(it, sorted, contribsMap);
    const pct = total > 0 ? totVal / total : 0;

    const typeLabel =
      normLevel === "etapa"
        ? "ETAPA"
        : normLevel === "subetapa"
        ? "SUBETAPA"
        : "ITEM";

    const row: Cell[] = [
      cell(typeLabel, rowStyle(normLevel, "center")),
      cell(it.code ?? "", rowStyle(normLevel, "left", undefined, true)),
      cell(it.name || "", rowStyle(normLevel, "left")),
      cell(agg ? "" : it.unit || "", rowStyle(normLevel, "center")),
      cell(
        agg ? null : it.contractedQty ?? 0,
        rowStyle(normLevel, "right", QTY_FORMAT, true)
      ),
      cell(
        agg ? null : it.unitPrice ?? 0,
        rowStyle(normLevel, "right", BRL_FORMAT, true)
      ),
      cell(total, rowStyle(normLevel, "right", BRL_FORMAT, true)),
      cell(curQty, rowStyle(normLevel, "right", QTY_FORMAT, true)),
      cell(curVal, rowStyle(normLevel, "right", BRL_FORMAT, true)),
      cell(totQty, rowStyle(normLevel, "right", QTY_FORMAT, true)),
      cell(totVal, rowStyle(normLevel, "right", BRL_FORMAT, true)),
      cell(pct, rowStyle(normLevel, "right", PCT_FORMAT, true)),
    ];
    aoa.push(row);
  }

  // Linha separadora + totais
  aoa.push(Array(12).fill(cell("", {})));

  const gTotal = grandTotal(sorted);
  const gCurrent = sorted
    .filter((i) => !isAggregating(i, sorted))
    .reduce((s, i) => s + aggregatedCurrentValue(i, sorted, contribsMap, medicao), 0);
  const gMeasured = sorted
    .filter((i) => !isAggregating(i, sorted))
    .reduce((s, i) => s + aggregatedAccumulatedValue(i, sorted, contribsMap), 0);
  const gPct = gTotal > 0 ? gMeasured / gTotal : 0;

  const totalsRow: Cell[] = [
    cell("TOTAIS", totalsStyle("center", undefined, HEX.bg)),
    cell("", totalsStyle("left", undefined, HEX.bg)),
    cell("", totalsStyle("left", undefined, HEX.bg)),
    cell("", totalsStyle("center", undefined, HEX.bg)),
    cell("", totalsStyle("right", QTY_FORMAT, HEX.bg)),
    cell("", totalsStyle("right", BRL_FORMAT, HEX.bg)),
    cell(gTotal, totalsStyle("right", BRL_FORMAT, HEX.accent)),
    cell("", totalsStyle("right", QTY_FORMAT, HEX.bg)),
    cell(gCurrent, totalsStyle("right", BRL_FORMAT, HEX.info)),
    cell("", totalsStyle("right", QTY_FORMAT, HEX.bg)),
    cell(gMeasured, totalsStyle("right", BRL_FORMAT, HEX.success)),
    cell(gPct, totalsStyle("right", PCT_FORMAT, HEX.success)),
  ];
  aoa.push(totalsRow);

  // Monta worksheet a partir da AOA com estilo por célula
  const ws: XLSX.WorkSheet = {};
  const range = { s: { c: 0, r: 0 }, e: { c: 11, r: aoa.length - 1 } };
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      const src = aoa[r][c];
      if (!src) continue;
      const addr = XLSX.utils.encode_cell({ c, r });
      ws[addr] = src;
    }
  }
  ws["!ref"] = XLSX.utils.encode_range(range);

  // Larguras das colunas
  ws["!cols"] = [
    { wch: 10 }, // Tipo
    { wch: 14 }, // Código
    { wch: 56 }, // Descrição
    { wch: 8 }, // Unid.
    { wch: 14 }, // Qtd Contr.
    { wch: 14 }, // R$ Unit
    { wch: 16 }, // R$ Total Contr.
    { wch: 16 }, // Qtd atual
    { wch: 16 }, // R$ atual
    { wch: 16 }, // Qtd total
    { wch: 16 }, // R$ total
    { wch: 12 }, // %
  ];

  // Alturas específicas + merges para o cabeçalho
  ws["!rows"] = [];
  ws["!rows"][0] = { hpt: 32 };
  ws["!rows"][1] = { hpt: 20 };

  ws["!merges"] = [
    { s: { c: 0, r: 0 }, e: { c: 11, r: 0 } }, // Título
    { s: { c: 0, r: 1 }, e: { c: 11, r: 1 } }, // Obra subtitle
    // Merges de info (value ocupa colunas 2-4, e depois 5-11 linha seguinte extra)
  ];

  // Merge para cada linha de info: colunas 1..11 (valor ocupa o resto)
  const infoStartRow = 3;
  for (let i = 0; i < infoRows.length; i++) {
    const r = infoStartRow + i;
    ws["!merges"].push({ s: { c: 1, r }, e: { c: 11, r } });
  }

  // Congela o cabeçalho (tudo acima da tabela de itens)
  const tableHeaderRow = infoStartRow + infoRows.length + 1;
  ws["!freeze"] = { xSplit: 0, ySplit: tableHeaderRow + 1 };

  // Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${medicao}ª Medição`);

  // ─── Ficha resumo (aba "Resumo") ───────────────────────────────────────
  const saldo = Math.max(0, gTotal - gMeasured);
  const pctRestante = gTotal > 0 ? saldo / gTotal : 0;
  const pctMedicao = gTotal > 0 ? gCurrent / gTotal : 0;

  const leaves = sorted.filter((i) => !isAggregating(i, sorted));
  const accQtyOf = (i: ContractItem) => itemAccumulatedQty(i, sorted, contribsMap);
  const medQtyOf = (i: ContractItem) =>
    itemQtyForMedicao(i, sorted, contribsMap, medicao, medicao);
  const itensIniciados = leaves.filter((i) => accQtyOf(i) > 0).length;
  const itensNaMedicao = leaves.filter((i) => medQtyOf(i) > 0).length;
  const itens100 = leaves.filter(
    (i) => (i.contractedQty ?? 0) > 0 && accQtyOf(i) >= (i.contractedQty ?? 0)
  ).length;

  const etapas = sorted.filter((i) => getLevel(i) === "etapa");
  const etapaRows = etapas.map((et) => {
    const t = itemTotal(et, sorted);
    const cur = aggregatedCurrentValue(et, sorted, contribsMap, medicao);
    const med = aggregatedAccumulatedValue(et, sorted, contribsMap);
    return {
      code: et.code ?? "",
      name: et.name || "",
      total: t,
      current: cur,
      measured: med,
      pct: t > 0 ? med / t : 0,
      saldo: Math.max(0, t - med),
    };
  }).sort((a, b) => b.total - a.total);

  const topMedicao = leaves
    .map((i) => ({
      code: i.code ?? "",
      name: i.name || "",
      unit: i.unit || "",
      qty: medQtyOf(i),
      val: aggregatedCurrentValue(i, sorted, contribsMap, medicao),
      contracted: (i.contractedQty ?? 0) * (i.unitPrice ?? 0),
    }))
    .filter((r) => r.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);

  const topSaldo = leaves
    .map((i) => {
      const total = (i.contractedQty ?? 0) * (i.unitPrice ?? 0);
      const executed = aggregatedAccumulatedValue(i, sorted, contribsMap);
      return {
        code: i.code ?? "",
        name: i.name || "",
        unit: i.unit || "",
        contracted: total,
        executed,
        saldo: Math.max(0, total - executed),
        pct: total > 0 ? executed / total : 0,
      };
    })
    .filter((r) => r.contracted > 0 && r.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 10);

  const COLS = 6;
  const summary: Cell[][] = [];
  const merges: { s: { c: number; r: number }; e: { c: number; r: number } }[] = [];
  const rowHeights: Record<number, number> = {};

  const padRow = (row: Cell[]): Cell[] => {
    const filled = row.slice();
    while (filled.length < COLS) filled.push(cell("", {}));
    return filled;
  };
  const mergeFullRow = (r: number) =>
    merges.push({ s: { c: 0, r }, e: { c: COLS - 1, r } });

  // Header principal
  rowHeights[0] = 34;
  summary.push(padRow([cell(`RESUMO EXECUTIVO · ${medicao}ª MEDIÇÃO`, headerTitleStyle(HEX.info))]));
  mergeFullRow(0);
  rowHeights[1] = 22;
  summary.push(padRow([cell(obra.name, subtitleStyle())]));
  mergeFullRow(1);
  summary.push(padRow([]));

  // ─── Seção: Identificação ─────────────────────────────────────────────
  summary.push(padRow([cell("IDENTIFICAÇÃO DA OBRA", sectionHeaderStyle())]));
  mergeFullRow(summary.length - 1);
  rowHeights[summary.length - 1] = 24;

  const pairs: [string, string, string, string][] = [
    ["Obra", obra.name || "—", "Contrato", obra.contrato || "—"],
    ["Rodovia", obra.rodovia || "—", "Lote", obra.lote || "—"],
    ["Trecho", obra.trecho || "—", "Tipo de obra", obra.tipoObra || "—"],
    [
      "KM inicial",
      obra.kmInicial != null ? obra.kmInicial.toFixed(3) : "—",
      "KM final",
      obra.kmFinal != null ? obra.kmFinal.toFixed(3) : "—",
    ],
    [
      "Extensão",
      obra.extensionKm != null ? `${obra.extensionKm.toFixed(3)} km` : "—",
      "Emitido em",
      new Date().toLocaleDateString("pt-BR"),
    ],
  ];
  for (const [k1, v1, k2, v2] of pairs) {
    const rIdx = summary.length;
    summary.push([
      cell(k1, infoKeyStyle()),
      cell(v1, infoValueStyle()),
      cell(v1, infoValueStyle()),
      cell(k2, infoKeyStyle()),
      cell(v2, infoValueStyle()),
      cell(v2, infoValueStyle()),
    ]);
    merges.push({ s: { c: 1, r: rIdx }, e: { c: 2, r: rIdx } });
    merges.push({ s: { c: 4, r: rIdx }, e: { c: 5, r: rIdx } });
  }
  summary.push(padRow([]));

  // ─── Seção: Resumo Financeiro (KPI cards) ─────────────────────────────
  summary.push(padRow([cell("RESUMO FINANCEIRO", sectionHeaderStyle())]));
  mergeFullRow(summary.length - 1);
  rowHeights[summary.length - 1] = 24;

  // Linha 1: 3 KPI cards lado a lado (cada card = 2 colunas)
  const kpiLabelRow = summary.length;
  rowHeights[kpiLabelRow] = 20;
  summary.push([
    cell("CONTRATO TOTAL", kpiLabelStyle(HEX.accent)),
    cell("", kpiLabelStyle(HEX.accent)),
    cell(`${medicao}ª MEDIÇÃO VIGENTE`, kpiLabelStyle(HEX.info)),
    cell("", kpiLabelStyle(HEX.info)),
    cell("TOTAL ACUMULADO MEDIDO", kpiLabelStyle(HEX.success)),
    cell("", kpiLabelStyle(HEX.success)),
  ]);
  merges.push({ s: { c: 0, r: kpiLabelRow }, e: { c: 1, r: kpiLabelRow } });
  merges.push({ s: { c: 2, r: kpiLabelRow }, e: { c: 3, r: kpiLabelRow } });
  merges.push({ s: { c: 4, r: kpiLabelRow }, e: { c: 5, r: kpiLabelRow } });

  const kpiValueRow = summary.length;
  rowHeights[kpiValueRow] = 36;
  summary.push([
    cell(gTotal, kpiValueStyle(HEX.accent, BRL_FORMAT)),
    cell("", kpiValueStyle(HEX.accent, BRL_FORMAT)),
    cell(gCurrent, kpiValueStyle(HEX.info, BRL_FORMAT)),
    cell("", kpiValueStyle(HEX.info, BRL_FORMAT)),
    cell(gMeasured, kpiValueStyle(HEX.success, BRL_FORMAT)),
    cell("", kpiValueStyle(HEX.success, BRL_FORMAT)),
  ]);
  merges.push({ s: { c: 0, r: kpiValueRow }, e: { c: 1, r: kpiValueRow } });
  merges.push({ s: { c: 2, r: kpiValueRow }, e: { c: 3, r: kpiValueRow } });
  merges.push({ s: { c: 4, r: kpiValueRow }, e: { c: 5, r: kpiValueRow } });

  // Linha 2: 3 KPI cards — % executado, saldo, % medição
  const kpi2LabelRow = summary.length;
  rowHeights[kpi2LabelRow] = 20;
  summary.push([
    cell("% EXECUTADO", kpiLabelStyle(HEX.success)),
    cell("", kpiLabelStyle(HEX.success)),
    cell("SALDO A EXECUTAR", kpiLabelStyle(HEX.accent)),
    cell("", kpiLabelStyle(HEX.accent)),
    cell(`% DA ${medicao}ª MEDIÇÃO`, kpiLabelStyle(HEX.info)),
    cell("", kpiLabelStyle(HEX.info)),
  ]);
  merges.push({ s: { c: 0, r: kpi2LabelRow }, e: { c: 1, r: kpi2LabelRow } });
  merges.push({ s: { c: 2, r: kpi2LabelRow }, e: { c: 3, r: kpi2LabelRow } });
  merges.push({ s: { c: 4, r: kpi2LabelRow }, e: { c: 5, r: kpi2LabelRow } });

  const kpi2ValueRow = summary.length;
  rowHeights[kpi2ValueRow] = 36;
  summary.push([
    cell(gPct, kpiValueStyle(HEX.success, PCT_FORMAT)),
    cell("", kpiValueStyle(HEX.success, PCT_FORMAT)),
    cell(saldo, kpiValueStyle(HEX.accent, BRL_FORMAT)),
    cell("", kpiValueStyle(HEX.accent, BRL_FORMAT)),
    cell(pctMedicao, kpiValueStyle(HEX.info, PCT_FORMAT)),
    cell("", kpiValueStyle(HEX.info, PCT_FORMAT)),
  ]);
  merges.push({ s: { c: 0, r: kpi2ValueRow }, e: { c: 1, r: kpi2ValueRow } });
  merges.push({ s: { c: 2, r: kpi2ValueRow }, e: { c: 3, r: kpi2ValueRow } });
  merges.push({ s: { c: 4, r: kpi2ValueRow }, e: { c: 5, r: kpi2ValueRow } });
  summary.push(padRow([]));

  // ─── Seção: Indicadores ───────────────────────────────────────────────
  summary.push(padRow([cell("INDICADORES", sectionHeaderStyle())]));
  mergeFullRow(summary.length - 1);
  rowHeights[summary.length - 1] = 24;

  const indRows: [string, number | string][] = [
    ["Itens do contrato (total)", leaves.length],
    ["Itens já iniciados", itensIniciados],
    [`Itens com medição na ${medicao}ª`, itensNaMedicao],
    ["Itens 100% executados", itens100],
    ["% restante do contrato", pctRestante],
  ];
  for (const [k, v] of indRows) {
    const rIdx = summary.length;
    const isNumber = typeof v === "number";
    const isPct = k === "% restante do contrato";
    summary.push([
      cell(k, infoKeyStyle()),
      cell(v, isNumber ? indValueStyle(isPct ? PCT_FORMAT : "0") : infoValueStyle()),
      cell(v, isNumber ? indValueStyle(isPct ? PCT_FORMAT : "0") : infoValueStyle()),
      cell(v, isNumber ? indValueStyle(isPct ? PCT_FORMAT : "0") : infoValueStyle()),
      cell(v, isNumber ? indValueStyle(isPct ? PCT_FORMAT : "0") : infoValueStyle()),
      cell(v, isNumber ? indValueStyle(isPct ? PCT_FORMAT : "0") : infoValueStyle()),
    ]);
    merges.push({ s: { c: 1, r: rIdx }, e: { c: 5, r: rIdx } });
  }
  summary.push(padRow([]));

  // ─── Seção: Medição por Etapa ─────────────────────────────────────────
  if (etapaRows.length > 0) {
    summary.push(padRow([cell("MEDIÇÃO POR ETAPA", sectionHeaderStyle())]));
    mergeFullRow(summary.length - 1);
    rowHeights[summary.length - 1] = 24;

    // header da sub-tabela
    summary.push([
      cell("Etapa", colHeaderStyle()),
      cell("Contratado", colHeaderStyle()),
      cell(`${medicao}ª Medição`, colHeaderStyle()),
      cell("Acumulado", colHeaderStyle()),
      cell("% Exec", colHeaderStyle()),
      cell("Saldo", colHeaderStyle()),
    ]);

    for (const et of etapaRows) {
      summary.push([
        cell(
          `${et.code}  ${et.name}`.trim(),
          { ...rowStyle("etapa", "left"), numFmt: undefined }
        ),
        cell(et.total, rowStyle("etapa", "right", BRL_FORMAT, true)),
        cell(et.current, rowStyle("etapa", "right", BRL_FORMAT, true)),
        cell(et.measured, rowStyle("etapa", "right", BRL_FORMAT, true)),
        cell(et.pct, rowStyle("etapa", "right", PCT_FORMAT, true)),
        cell(et.saldo, rowStyle("etapa", "right", BRL_FORMAT, true)),
      ]);
    }
    summary.push(padRow([]));
  }

  // ─── Seção: Top 10 itens da Xª medição ────────────────────────────────
  if (topMedicao.length > 0) {
    summary.push(padRow([cell(`TOP 10 ITENS DA ${medicao}ª MEDIÇÃO`, sectionHeaderStyle())]));
    mergeFullRow(summary.length - 1);
    rowHeights[summary.length - 1] = 24;

    summary.push([
      cell("#", colHeaderStyle()),
      cell("Código", colHeaderStyle()),
      cell("Descrição", colHeaderStyle()),
      cell("Qtd", colHeaderStyle()),
      cell("R$ Medido", colHeaderStyle()),
      cell("% sobre item", colHeaderStyle()),
    ]);

    topMedicao.forEach((it, i) => {
      const pctItem = it.contracted > 0 ? it.val / it.contracted : 0;
      const rIdx = summary.length;
      summary.push([
        cell(i + 1, rankStyle()),
        cell(it.code, rowStyle("item", "left", undefined, true)),
        cell(it.name, rowStyle("item", "left")),
        cell(it.qty, rowStyle("item", "right", QTY_FORMAT, true)),
        cell(it.val, rowStyle("item", "right", BRL_FORMAT, true)),
        cell(pctItem, rowStyle("item", "right", PCT_FORMAT, true)),
      ]);
      // Sem unidade ou merge necessário
      void rIdx;
    });
    summary.push(padRow([]));
  }

  // ─── Seção: Top 10 saldos a executar ──────────────────────────────────
  if (topSaldo.length > 0) {
    summary.push(padRow([cell("TOP 10 SALDOS A EXECUTAR", sectionHeaderStyle())]));
    mergeFullRow(summary.length - 1);
    rowHeights[summary.length - 1] = 24;

    summary.push([
      cell("#", colHeaderStyle()),
      cell("Código", colHeaderStyle()),
      cell("Descrição", colHeaderStyle()),
      cell("Contratado", colHeaderStyle()),
      cell("Executado", colHeaderStyle()),
      cell("Saldo R$", colHeaderStyle()),
    ]);

    topSaldo.forEach((it, i) => {
      summary.push([
        cell(i + 1, rankStyle()),
        cell(it.code, rowStyle("item", "left", undefined, true)),
        cell(it.name, rowStyle("item", "left")),
        cell(it.contracted, rowStyle("item", "right", BRL_FORMAT, true)),
        cell(it.executed, rowStyle("item", "right", BRL_FORMAT, true)),
        cell(it.saldo, rowStyle("item", "right", BRL_FORMAT, true)),
      ]);
    });
    summary.push(padRow([]));
  }

  // Rodapé
  const footerRow = summary.length;
  rowHeights[footerRow] = 18;
  summary.push(padRow([
    cell(
      `Gerado em ${new Date().toLocaleString("pt-BR")} · Trechos`,
      {
        font: { italic: true, color: { rgb: HEX.textMuted }, sz: 9 },
        alignment: { horizontal: "center", vertical: "center" },
      }
    ),
  ]));
  mergeFullRow(footerRow);

  // Monta worksheet
  const wsSummary: XLSX.WorkSheet = {};
  for (let r = 0; r < summary.length; r++) {
    for (let c = 0; c < summary[r].length; c++) {
      const src = summary[r][c];
      if (!src) continue;
      const addr = XLSX.utils.encode_cell({ c, r });
      wsSummary[addr] = src;
    }
  }
  wsSummary["!ref"] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: COLS - 1, r: summary.length - 1 },
  });
  wsSummary["!cols"] = [
    { wch: 8 },  // #
    { wch: 18 }, // Código / key1
    { wch: 42 }, // Descrição / val1
    { wch: 16 }, // Contratado
    { wch: 16 }, // Executado
    { wch: 16 }, // Saldo
  ];
  wsSummary["!merges"] = merges;
  wsSummary["!rows"] = [];
  for (const [r, h] of Object.entries(rowHeights)) {
    wsSummary["!rows"][Number(r)] = { hpt: h };
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // Gera o arquivo
  const safeObra = (obra.name || "contrato")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 40);
  const filename = `medicao_${medicao}_${safeObra}.xlsx`;
  XLSX.writeFile(wb, filename, { compression: true });
}
