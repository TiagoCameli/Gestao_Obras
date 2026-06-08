import type { Activity, CbuqCarga, LadoPista, Obra, TrocaSoloData } from "../types/activity";
import { latLngFromKm } from "./latLngFromKm";
import { calcCbuq } from "./cbuqCalc";
import { calcTrocaSolo } from "./trocaSoloCalc";
import { generateId } from "./format";

type ObraGeo = Pick<Obra, "centerLat" | "centerLng" | "kmInicial" | "routeGeoJson">;

export interface CbuqActivityInput {
  data: string;        // ISO yyyy-mm-dd
  kmInicial: number;
  kmFinal: number;
  cargas: CbuqCarga[];
}

export interface TsActivityInput {
  data: string;        // ISO yyyy-mm-dd
  km: number;
  estaca?: string;
  fracao?: string;
  lado: LadoPista;
  nomenclatura: string;
  ts: Pick<TrocaSoloData, "categoria" | "comprimento" | "largura" | "espessura" | "drenos" | "capaAsfaltica">;
}

/** Monta 1 Activity de CBUQ (Correção de Defeito) a partir do cabeçalho + cargas. */
export function buildCbuqActivity(
  input: CbuqActivityInput,
  obra: ObraGeo,
  medicao: number,
  now: number = Date.now(),
): Activity {
  const startPt = latLngFromKm(input.kmInicial, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
  const endPt = latLngFromKm(input.kmFinal, obra) ?? startPt;
  const uniqueDescricoes = Array.from(
    new Set(input.cargas.map((c) => (c.descricao ?? "").trim()).filter(Boolean)),
  );
  const cargas = input.cargas.map((c) => ({
    ...c,
    placa: c.placa.trim().toUpperCase(),
    data: c.data || input.data,
  }));
  return {
    id: generateId(),
    lat: startPt.lat,
    lng: startPt.lng,
    latEnd: endPt.lat,
    lngEnd: endPt.lng,
    service: "Correção de Defeito (CBUQ)",
    date: input.data,
    medicao,
    km: String(input.kmInicial),
    kmEnd: String(input.kmFinal),
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
}

/** Monta 1 Activity de Troca de Solo a partir do cabeçalho + medidas/drenos. */
export function buildTsActivity(
  input: TsActivityInput,
  obra: ObraGeo,
  medicao: number,
  now: number = Date.now(),
): Activity {
  const pt = latLngFromKm(input.km, obra) ?? { lat: obra.centerLat, lng: obra.centerLng };
  const trocaSolo: TrocaSoloData = {
    categoria: input.ts.categoria,
    medicaoNumber: medicao,
    comprimento: input.ts.comprimento,
    largura: input.ts.largura,
    espessura: input.ts.espessura,
    capaAsfaltica: input.ts.capaAsfaltica,
    drenos: input.ts.drenos,
    contributions: calcTrocaSolo(input.ts.categoria, input.ts, input.ts.drenos).quantidades,
  };
  return {
    id: generateId(),
    lat: pt.lat,
    lng: pt.lng,
    service: "Troca de Solo",
    date: input.data,
    medicao,
    km: String(input.km),
    lado: input.lado,
    areaRect: null,
    description: "",
    quantities: [],
    photoIds: [],
    photoFolders: [],
    trocaSolo,
    estaca: input.estaca?.trim() || undefined,
    fracao: input.fracao?.trim() || undefined,
    nomenclatura: input.nomenclatura.trim(),
    createdAt: now,
    updatedAt: now,
  };
}
