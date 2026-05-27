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

export interface CrossRowError {
  rowIds: string[];
  field?: string;
  message: string;
}

/**
 * Valida regras cross-row do TS:
 *  - cada nomenclatura deve ter exatamente 1 linha TS principal
 *  - nomenclatura não pode conflitar com Activity já existente na medição
 *    (passar Set de nomenclaturas existentes)
 */
export function validateCrossRowTs(
  rows: TsRow[],
  existingNomenclaturas: Set<string>
): CrossRowError[] {
  const errors: CrossRowError[] = [];
  const byNomenclatura = new Map<string, TsRow[]>();
  for (const r of rows) {
    const n = r.nomenclatura.trim();
    if (!n) continue;
    if (!byNomenclatura.has(n)) byNomenclatura.set(n, []);
    byNomenclatura.get(n)!.push(r);
  }
  for (const [n, group] of byNomenclatura) {
    if (existingNomenclaturas.has(n)) {
      errors.push({
        rowIds: group.map((r) => r.id),
        field: "nomenclatura",
        message: `Nomenclatura "${n}" já existe na medição — use o formulário rico pra editar.`,
      });
      continue;
    }
    const tsCount = group.filter((r) => r.tipo === "TS").length;
    if (tsCount === 0) {
      errors.push({
        rowIds: group.map((r) => r.id),
        field: "tipo",
        message: `Nomenclatura "${n}" não tem trecho TS principal — adicione uma linha com Tipo=TS.`,
      });
    } else if (tsCount > 1) {
      errors.push({
        rowIds: group.filter((r) => r.tipo === "TS").map((r) => r.id),
        field: "tipo",
        message: `Duas ou mais linhas TS com nomenclatura "${n}" — só pode ter 1 trecho principal.`,
      });
    }
  }
  return errors;
}
