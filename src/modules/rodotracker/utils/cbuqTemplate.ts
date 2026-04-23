import XLSX from "xlsx-js-style";

/** Gera e baixa um modelo de planilha com as colunas de cargas de CBUQ. */
export function downloadCbuqTemplate() {
  const headers = ["Data", "Placa", "Hora", "Peso (t)"];
  const sample: (string | number)[][] = [
    headers,
    ["15/03/2026", "ABC1D23", "07:42", 28.45],
    ["15/03/2026", "XYZ4E56", "08:15", 29.12],
    ["15/03/2026", "DEF7G89", "09:03", 27.88],
    ["", "", "", ""],
    ["", "", "", ""],
  ];

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "1E3A8A" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: {
      top: { style: "thin" as const, color: { rgb: "2E3345" } },
      bottom: { style: "thin" as const, color: { rgb: "2E3345" } },
      left: { style: "thin" as const, color: { rgb: "2E3345" } },
      right: { style: "thin" as const, color: { rgb: "2E3345" } },
    },
  };
  const cellStyle = {
    font: { color: { rgb: "1A1E2B" }, sz: 10 },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: {
      top: { style: "thin" as const, color: { rgb: "E5E7EB" } },
      bottom: { style: "thin" as const, color: { rgb: "E5E7EB" } },
      left: { style: "thin" as const, color: { rgb: "E5E7EB" } },
      right: { style: "thin" as const, color: { rgb: "E5E7EB" } },
    },
  };
  const pesoStyle = {
    ...cellStyle,
    alignment: { horizontal: "right" as const, vertical: "center" as const },
    font: { color: { rgb: "1A1E2B" }, sz: 10, name: "Consolas" },
    numFmt: "0.000",
  };

  const ws: XLSX.WorkSheet = {};
  for (let r = 0; r < sample.length; r++) {
    for (let c = 0; c < sample[r].length; c++) {
      const addr = XLSX.utils.encode_cell({ c, r });
      const v = sample[r][c];
      if (r === 0) {
        ws[addr] = { t: "s", v: String(v), s: headerStyle };
      } else if (c === 3 && typeof v === "number") {
        ws[addr] = { t: "n", v, s: pesoStyle };
      } else if (v === "") {
        ws[addr] = { t: "s", v: "", s: cellStyle };
      } else {
        ws[addr] = { t: "s", v: String(v), s: cellStyle };
      }
    }
  }
  ws["!ref"] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: 3, r: sample.length - 1 },
  });
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
  ws["!rows"] = [{ hpt: 22 }];

  // Aba de instruções
  const notes: (string | number)[][] = [
    ["INSTRUÇÕES — CARGAS DE CBUQ"],
    [],
    ["Campo", "Obrigatório", "Observação"],
    ["Data", "Não", "Formato dd/mm/aaaa ou aaaa-mm-dd"],
    ["Placa", "Sim", "Identificação do caminhão (ex: ABC1D23)"],
    ["Hora", "Não", "Formato HH:mm (ex: 08:15)"],
    ["Peso (t)", "Sim", "Peso líquido em toneladas. Valores ≥ 1000 serão interpretados em kg e convertidos."],
    [],
    ["Dicas"],
    ["• A primeira linha deve conter os títulos das colunas."],
    ["• Linhas com placa ou peso em branco serão ignoradas."],
    ["• As colunas podem estar em qualquer ordem — o sistema detecta automaticamente."],
  ];
  const titleStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
    fill: { fgColor: { rgb: "1E3A8A" } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  };
  const noteHeaderStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "0D1017" } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  };
  const noteCellStyle = {
    font: { color: { rgb: "1A1E2B" }, sz: 10 },
    alignment: { horizontal: "left" as const, vertical: "center" as const, wrapText: true },
  };

  const wsNotes: XLSX.WorkSheet = {};
  for (let r = 0; r < notes.length; r++) {
    for (let c = 0; c < notes[r].length; c++) {
      const addr = XLSX.utils.encode_cell({ c, r });
      const v = notes[r][c];
      if (v === "" || v == null) continue;
      const style =
        r === 0
          ? titleStyle
          : r === 2
          ? noteHeaderStyle
          : noteCellStyle;
      wsNotes[addr] = { t: "s", v: String(v), s: style };
    }
  }
  wsNotes["!ref"] = "A1:C13";
  wsNotes["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 70 }];
  wsNotes["!rows"] = [{ hpt: 26 }];
  wsNotes["!merges"] = [{ s: { c: 0, r: 0 }, e: { c: 2, r: 0 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cargas");
  XLSX.utils.book_append_sheet(wb, wsNotes, "Instruções");
  XLSX.writeFile(wb, "modelo_cargas_cbuq.xlsx", { compression: true });
}
