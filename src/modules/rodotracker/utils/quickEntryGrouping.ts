import type { Activity, Obra, CbuqCarga, LadoPista, TrocaSoloData } from "../types/activity";
import type { CbuqRow, TsRow } from "./quickEntryValidators";
import { parseData, parseTrecho, parseKm } from "./quickEntryParsers";
import { parseNumber } from "./parseNumber";
import { latLngFromKm } from "./latLngFromKm";
import { calcCbuq } from "./cbuqCalc";
import { calcTrocaSolo } from "./trocaSoloCalc";
import { generateId } from "./format";

function isBlankCbuq(r: CbuqRow): boolean {
  return !r.data.trim() && !r.trecho.trim() && !r.placa.trim() && !r.peso.trim();
}

export function groupCbuqRowsToActivities(
  rows: CbuqRow[],
  obra: Obra,
  medicao: number
): Activity[] {
  const groups = new Map<string, CbuqRow[]>();
  for (const r of rows) {
    if (isBlankCbuq(r)) continue;
    const data = parseData(r.data);
    const trecho = parseTrecho(r.trecho);
    if (!data || !trecho) continue;
    const key = `${data}|${trecho.kmInicial}-${trecho.kmFinal}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const now = Date.now();
  const activities: Activity[] = [];
  for (const group of groups.values()) {
    const firstRow = group[0];
    const data = parseData(firstRow.data)!;
    const trecho = parseTrecho(firstRow.trecho)!;
    const startPt = latLngFromKm(trecho.kmInicial, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
    const endPt = latLngFromKm(trecho.kmFinal, obra) ?? startPt;
    const cargas: CbuqCarga[] = group.map((r) => ({
      id: generateId(),
      data,
      placa: r.placa.trim().toUpperCase(),
      hora: r.hora.trim() || undefined,
      pesoT: parseNumber(r.peso),
      descricao: r.descricao.trim() || undefined,
    }));
    const uniqueDescricoes = Array.from(
      new Set(group.map((r) => r.descricao.trim()).filter(Boolean))
    );
    const activity: Activity = {
      id: generateId(),
      lat: startPt.lat,
      lng: startPt.lng,
      latEnd: endPt.lat,
      lngEnd: endPt.lng,
      service: "Correção de Defeito (CBUQ)",
      date: data,
      medicao,
      km: String(trecho.kmInicial),
      kmEnd: String(trecho.kmFinal),
      lado: "Pista Toda",
      areaRect: null,
      description: uniqueDescricoes.join("\n"),
      quantities: [],
      photoIds: [],
      photoFolders: [],
      cbuq: {
        medicaoNumber: medicao,
        cargas,
        contributions: calcCbuq(cargas).quantidades,
      },
      createdAt: now,
      updatedAt: now,
    };
    activities.push(activity);
  }
  return activities;
}

function ladoFromCode(code: TsRow["lado"]): LadoPista {
  if (code === "D") return "Direito";
  if (code === "E") return "Esquerdo";
  return "Pista Toda";
}

export function groupTsRowsToActivities(
  rows: TsRow[],
  obra: Obra,
  medicao: number,
  categoria: "rotineira" | "passivo"
): Activity[] {
  const byNomenclatura = new Map<string, TsRow[]>();
  for (const r of rows) {
    const n = r.nomenclatura.trim();
    if (!n) continue;
    if (!byNomenclatura.has(n)) byNomenclatura.set(n, []);
    byNomenclatura.get(n)!.push(r);
  }
  const now = Date.now();
  const activities: Activity[] = [];
  for (const [nomenclatura, group] of byNomenclatura) {
    const tsRow = group.find((r) => r.tipo === "TS");
    if (!tsRow) continue; // grupos só com drenos são ignorados
    const drenoRows = group.filter((r) => r.tipo === "Dreno");
    const data = parseData(tsRow.data);
    const km = parseKm(tsRow.km);
    if (!data || km == null) continue;
    const pt = latLngFromKm(km, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
    const drenos = drenoRows.map((d) => ({
      comprimento: parseNumber(d.comprimento),
      largura: parseNumber(d.largura),
      espessura: parseNumber(d.espessura),
    }));
    const tsMedidas = {
      comprimento: parseNumber(tsRow.comprimento),
      largura: parseNumber(tsRow.largura),
      espessura: parseNumber(tsRow.espessura),
    };
    const trocaSolo: TrocaSoloData = {
      categoria,
      medicaoNumber: medicao,
      comprimento: tsMedidas.comprimento,
      largura: tsMedidas.largura,
      espessura: tsMedidas.espessura,
      drenos,
      contributions: calcTrocaSolo(categoria, tsMedidas, drenos).quantidades,
    };
    const activity: Activity = {
      id: generateId(),
      lat: pt.lat,
      lng: pt.lng,
      service: "Troca de Solo",
      date: data,
      medicao,
      km: String(km),
      lado: ladoFromCode(tsRow.lado),
      areaRect: null,
      description: "",
      quantities: [],
      photoIds: [],
      photoFolders: [],
      trocaSolo,
      estaca: tsRow.estaca.trim() || undefined,
      fracao: tsRow.fracao.trim() || undefined,
      nomenclatura,
      createdAt: now,
      updatedAt: now,
    };
    activities.push(activity);
  }
  return activities;
}
