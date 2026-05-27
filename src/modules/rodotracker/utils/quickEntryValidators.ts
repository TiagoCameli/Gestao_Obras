import { parseKm, parseTrecho, parseData } from "./quickEntryParsers";
import { parseNumber } from "./parseNumber";

export interface CbuqRow {
  id: string;
  data: string;
  trecho: string;
  placa: string;
  hora: string;
  peso: string;
  descricao: string;
}

export interface TsRow {
  id: string;
  data: string;
  tipo: "TS" | "Dreno" | "";
  nomenclatura: string;
  estaca: string;
  fracao: string;
  km: string;
  lado: "D" | "E" | "PT" | "";
  comprimento: string;
  largura: string;
  espessura: string;
}

export type RowErrors = Partial<Record<string, string>>;

export function validateRowCbuq(row: CbuqRow): RowErrors {
  const errors: RowErrors = {};
  if (!parseData(row.data)) errors.data = "Data inválida (use dd/mm/aaaa).";
  if (!parseTrecho(row.trecho)) errors.trecho = "Trecho inválido (ex: 620-635).";
  if (!row.placa || row.placa.trim().length < 6) errors.placa = "Placa obrigatória (mín. 6 chars).";
  const peso = parseNumber(row.peso);
  if (!(peso > 0)) errors.peso = "Peso deve ser > 0.";
  return errors;
}

export function validateRowTs(row: TsRow): RowErrors {
  const errors: RowErrors = {};
  if (!parseData(row.data)) errors.data = "Data inválida (use dd/mm/aaaa).";
  if (row.tipo !== "TS" && row.tipo !== "Dreno") errors.tipo = "Tipo é TS ou Dreno.";
  if (!row.nomenclatura.trim()) errors.nomenclatura = "Nomenclatura obrigatória.";
  if (parseKm(row.km) == null) errors.km = "KM inválido.";
  if (row.lado !== "D" && row.lado !== "E" && row.lado !== "PT") errors.lado = "Lado é D, E ou PT.";
  if (!(parseNumber(row.comprimento) > 0)) errors.comprimento = "Comprimento > 0.";
  if (!(parseNumber(row.largura) > 0)) errors.largura = "Largura > 0.";
  if (!(parseNumber(row.espessura) > 0)) errors.espessura = "Espessura > 0.";
  return errors;
}
