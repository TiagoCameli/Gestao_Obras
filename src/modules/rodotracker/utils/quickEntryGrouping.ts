import type { Activity, Obra, CbuqCarga } from "../types/activity";
import type { CbuqRow } from "./quickEntryValidators";
import { parseData, parseTrecho } from "./quickEntryParsers";
import { parseNumber } from "./parseNumber";
import { latLngFromKm } from "./latLngFromKm";
import { calcCbuq } from "./cbuqCalc";
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
