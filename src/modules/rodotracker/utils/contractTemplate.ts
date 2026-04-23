import * as XLSX from "xlsx";

/** Generate and trigger download of a blank contract-import template .xlsx */
export function downloadContractTemplate(obraName?: string) {
  const headers = [
    "Tipo",
    "Código",
    "Descrição",
    "Unidade",
    "Qtd. contratada",
    "Valor unitário (R$)",
  ];

  const rows: (string | number | "")[][] = [
    headers,
    // Etapa: agrupador topo — soma das subetapas e itens dentro dela
    ["Etapa", "1", "INFRAESTRUTURA", "", "", ""],
    // Itens podem ser filhos diretos de uma etapa
    ["Item", "1.1", "Drenagem profunda DP-02", "m", 250, 85.5],
    ["Item", "1.2", "Boca de lobo simples", "un", 12, 820],
    ["Etapa", "2", "PAVIMENTAÇÃO", "", "", ""],
    // Subetapa: agrupador intermediário — soma dos itens abaixo dela
    ["Subetapa", "2.1", "Reparo profundo do pavimento", "", "", ""],
    ["Item", "2.1.1", "Remoção mecanizada de revestimento", "m³", 1500, 14.46],
    ["Item", "2.1.2", "Base de brita graduada", "m³", 6000, 580.86],
    ["Item", "2.1.3", "CBUQ — Concreto asfáltico C-12,5", "t", 3635, 338.29],
    ["Subetapa", "2.2", "Recomposição de plataforma", "", "", ""],
    ["Item", "2.2.1", "Escavação em solo 1ª categoria", "m³", 11022, 3.40],
    ["Item", "2.2.2", "Compactação a 100% Proctor", "m³", 15746, 7.01],
    // Item direto da etapa (sem subetapa intermediária)
    ["Item", "2.3", "Sinalização horizontal", "km", 62, 4500],
    ["Etapa", "3", "OBRAS COMPLEMENTARES", "", "", ""],
    ["Item", "3.1", "Roçada mecanizada em margens", "km", 62, 310.75],
    ["", "", "", "", "", ""],
    ["", "", "", "", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Column widths
  ws["!cols"] = [
    { wch: 10 }, // Tipo
    { wch: 10 }, // Código
    { wch: 48 }, // Descrição
    { wch: 10 }, // Unidade
    { wch: 18 }, // Qtd
    { wch: 20 }, // Valor unitário
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contrato");

  // Triggers browser download via SheetJS
  const safeName = (obraName ?? "contrato")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 40);
  XLSX.writeFile(wb, `modelo_${safeName}.xlsx`, { compression: true });
}
