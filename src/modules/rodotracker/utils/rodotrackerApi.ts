/**
 * API do RodoTracker sobre o Supabase. Cada função assume o usuário
 * logado (a RLS filtra tudo por auth.uid()).
 *
 * O código antigo do tracker usava localStorage + Dexie; este módulo
 * substitui tudo por chamadas async ao Postgres e ao Storage.
 */
import { supabase } from "../../../lib/supabase";
import type {
  Activity,
  ContractItem,
  Obra,
  PlanItem,
} from "../types/activity";

/* ─── helpers ───────────────────────────────────────────────────────────── */

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sem usuário logado — Trechos exige auth.");
  return id;
}

function unreachable(msg: string): never {
  throw new Error(msg);
}

function throwIfError(error: unknown, ctx: string): void {
  if (error) {
    console.error(`[rodotrackerApi:${ctx}]`, error);
    unreachable(`Falha em ${ctx}: ${(error as { message?: string }).message ?? error}`);
  }
}

/* ─── mapping: Row ↔ tipo do tracker ────────────────────────────────────── */

type ObraRow = {
  id: string;
  name: string;
  tipo_obra: string | null;
  rodovia: string | null;
  lote: string | null;
  trecho: string | null;
  contrato: string | null;
  km_inicial: number | null;
  km_final: number | null;
  center_lat: number;
  center_lng: number;
  zoom: number;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  route_geojson: [number, number][] | null;
  extension_km: number | null;
  created_at: number;
  updated_at: number;
};

function rowToObra(r: ObraRow): Obra {
  return {
    id: r.id,
    name: r.name,
    tipoObra: (r.tipo_obra as Obra["tipoObra"]) ?? "Manutenção de Rodovia",
    rodovia: r.rodovia ?? "",
    lote: r.lote ?? "",
    trecho: r.trecho ?? "",
    contrato: r.contrato ?? "",
    kmInicial: r.km_inicial,
    kmFinal: r.km_final,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    zoom: r.zoom,
    startLat: r.start_lat,
    startLng: r.start_lng,
    endLat: r.end_lat,
    endLng: r.end_lng,
    routeGeoJson: r.route_geojson,
    extensionKm: r.extension_km,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function obraToRow(o: Obra, userId: string): ObraRow & { user_id: string } {
  return {
    id: o.id,
    user_id: userId,
    name: o.name,
    tipo_obra: o.tipoObra,
    rodovia: o.rodovia,
    lote: o.lote,
    trecho: o.trecho,
    contrato: o.contrato,
    km_inicial: o.kmInicial,
    km_final: o.kmFinal,
    center_lat: o.centerLat,
    center_lng: o.centerLng,
    zoom: o.zoom,
    start_lat: o.startLat,
    start_lng: o.startLng,
    end_lat: o.endLat,
    end_lng: o.endLng,
    route_geojson: o.routeGeoJson,
    extension_km: o.extensionKm,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

type ActivityRow = {
  id: string;
  obra_id: string;
  lat: number;
  lng: number;
  lat_end: number | null;
  lng_end: number | null;
  service: string;
  service_name: string | null;
  troca_solo: Activity["trocaSolo"] | null;
  cbuq: Activity["cbuq"] | null;
  date: string;
  date_end: string | null;
  medicao: number | null;
  km: string | null;
  km_end: string | null;
  lado: string | null;
  area_rect: Activity["areaRect"] | null;
  description: string | null;
  quantities: Activity["quantities"] | null;
  photo_ids: string[] | null;
  photo_folders: Activity["photoFolders"] | null;
  pdfs: Activity["pdfs"] | null;
  created_at: number;
  updated_at: number;
};

function rowToActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    latEnd: r.lat_end ?? undefined,
    lngEnd: r.lng_end ?? undefined,
    service: r.service as Activity["service"],
    serviceName: r.service_name ?? undefined,
    trocaSolo: r.troca_solo ?? undefined,
    cbuq: r.cbuq ?? undefined,
    date: r.date,
    dateEnd: r.date_end ?? undefined,
    medicao: r.medicao,
    km: r.km ?? "",
    kmEnd: r.km_end ?? undefined,
    lado: (r.lado as Activity["lado"]) ?? "Pista Toda",
    areaRect: r.area_rect ?? null,
    description: r.description ?? "",
    quantities: r.quantities ?? [],
    photoIds: r.photo_ids ?? [],
    photoFolders: r.photo_folders ?? [],
    pdfs: r.pdfs ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function activityToRow(
  a: Activity,
  obraId: string,
  userId: string
): ActivityRow & { user_id: string } {
  return {
    id: a.id,
    obra_id: obraId,
    user_id: userId,
    lat: a.lat,
    lng: a.lng,
    lat_end: a.latEnd ?? null,
    lng_end: a.lngEnd ?? null,
    service: a.service,
    service_name: a.serviceName ?? null,
    troca_solo: a.trocaSolo ?? null,
    cbuq: a.cbuq ?? null,
    date: a.date,
    date_end: a.dateEnd ?? null,
    medicao: a.medicao,
    km: a.km || null,
    km_end: a.kmEnd ?? null,
    lado: a.lado,
    area_rect: a.areaRect ?? null,
    description: a.description || null,
    quantities: a.quantities ?? [],
    photo_ids: a.photoIds ?? [],
    photo_folders: a.photoFolders ?? [],
    pdfs: a.pdfs ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

type PlanRow = {
  id: string;
  obra_id: string;
  name: string;
  service: string | null;
  start_date: string;
  end_date: string;
  progress: number;
  status: string;
  notes: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
};

function rowToPlan(r: PlanRow): PlanItem {
  return {
    id: r.id,
    obraId: r.obra_id,
    name: r.name,
    service: r.service as PlanItem["service"],
    startDate: r.start_date,
    endDate: r.end_date,
    progress: r.progress,
    status: r.status as PlanItem["status"],
    notes: r.notes ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function planToRow(p: PlanItem, userId: string): PlanRow & { user_id: string } {
  return {
    id: p.id,
    obra_id: p.obraId,
    user_id: userId,
    name: p.name,
    service: p.service ?? null,
    start_date: p.startDate,
    end_date: p.endDate,
    progress: p.progress,
    status: p.status,
    notes: p.notes ?? null,
    color: p.color ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

type ContractRow = {
  id: string;
  obra_id: string;
  code: string | null;
  name: string;
  unit: string | null;
  contracted_qty: number;
  unit_price: number;
  current_qty: number | null;
  measured_qty: number | null;
  type: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

function rowToContract(r: ContractRow): ContractItem {
  return {
    id: r.id,
    obraId: r.obra_id,
    code: r.code ?? undefined,
    name: r.name,
    unit: r.unit ?? "",
    contractedQty: r.contracted_qty,
    unitPrice: r.unit_price,
    currentQty: r.current_qty ?? undefined,
    measuredQty: r.measured_qty ?? undefined,
    type: r.type as ContractItem["type"],
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function contractToRow(
  c: ContractItem,
  userId: string
): ContractRow & { user_id: string } {
  return {
    id: c.id,
    obra_id: c.obraId,
    user_id: userId,
    code: c.code ?? null,
    name: c.name,
    unit: c.unit || null,
    contracted_qty: c.contractedQty,
    unit_price: c.unitPrice,
    current_qty: c.currentQty ?? null,
    measured_qty: c.measuredQty ?? null,
    type: c.type ?? null,
    notes: c.notes ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/* ─── Obras ─────────────────────────────────────────────────────────────── */

export async function listObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("rodotracker_obras")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error, "listObras");
  return (data ?? []).map(rowToObra);
}

export async function upsertObra(o: Obra): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("rodotracker_obras")
    .upsert(obraToRow(o, userId));
  throwIfError(error, "upsertObra");
}

export async function deleteObra(id: string): Promise<void> {
  const { error } = await supabase
    .from("rodotracker_obras")
    .delete()
    .eq("id", id);
  throwIfError(error, "deleteObra");
}

/* ─── Atividades ────────────────────────────────────────────────────────── */

/**
 * Conta atividades agrupadas por obra_id — usado pra exibir o badge de
 * "N atividades" nos cards da HomePage sem baixar todas as linhas.
 */
export async function countActivitiesByObra(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("rodotracker_activities")
    .select("obra_id");
  throwIfError(error, "countActivitiesByObra");
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { obra_id: string }[]) {
    out[row.obra_id] = (out[row.obra_id] ?? 0) + 1;
  }
  return out;
}

export async function listActivities(obraId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("rodotracker_activities")
    .select("*")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });
  throwIfError(error, "listActivities");
  return (data ?? []).map(rowToActivity);
}

export async function upsertActivity(a: Activity, obraId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("rodotracker_activities")
    .upsert(activityToRow(a, obraId, userId));
  throwIfError(error, "upsertActivity");
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from("rodotracker_activities")
    .delete()
    .eq("id", id);
  throwIfError(error, "deleteActivity");
}

/* ─── Plan items ────────────────────────────────────────────────────────── */

export async function listPlanItems(obraId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from("rodotracker_plan_items")
    .select("*")
    .eq("obra_id", obraId)
    .order("start_date", { ascending: true });
  throwIfError(error, "listPlanItems");
  return (data ?? []).map(rowToPlan);
}

export async function replacePlanItems(
  obraId: string,
  items: PlanItem[]
): Promise<void> {
  const userId = await currentUserId();
  const del = await supabase
    .from("rodotracker_plan_items")
    .delete()
    .eq("obra_id", obraId);
  throwIfError(del.error, "replacePlanItems:delete");
  if (items.length === 0) return;
  const ins = await supabase
    .from("rodotracker_plan_items")
    .insert(items.map((p) => planToRow(p, userId)));
  throwIfError(ins.error, "replacePlanItems:insert");
}

/* ─── Contract items ────────────────────────────────────────────────────── */

export async function listContractItems(obraId: string): Promise<ContractItem[]> {
  const { data, error } = await supabase
    .from("rodotracker_contract_items")
    .select("*")
    .eq("obra_id", obraId);
  throwIfError(error, "listContractItems");
  return (data ?? []).map(rowToContract);
}

export async function insertContractItem(item: ContractItem): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("rodotracker_contract_items")
    .insert(contractToRow(item, userId));
  throwIfError(error, "insertContractItem");
}

export async function updateContractItem(item: ContractItem): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("rodotracker_contract_items")
    .update(contractToRow(item, userId))
    .eq("id", item.id);
  throwIfError(error, "updateContractItem");
}

export async function deleteContractItem(id: string): Promise<void> {
  await currentUserId();
  const { error } = await supabase
    .from("rodotracker_contract_items")
    .delete()
    .eq("id", id);
  throwIfError(error, "deleteContractItem");
}

export async function replaceContractItems(
  obraId: string,
  items: ContractItem[]
): Promise<void> {
  const userId = await currentUserId();
  const del = await supabase
    .from("rodotracker_contract_items")
    .delete()
    .eq("obra_id", obraId);
  throwIfError(del.error, "replaceContractItems:delete");
  if (items.length === 0) return;
  // Upsert em lotes pra evitar payloads gigantes em contratos grandes.
  const batchSize = 500;
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const ins = await supabase
      .from("rodotracker_contract_items")
      .insert(slice.map((c) => contractToRow(c, userId)));
    throwIfError(ins.error, "replaceContractItems:insert");
  }
}

/* ─── Medição vigente ───────────────────────────────────────────────────── */

export async function getCurrentMedicao(obraId: string): Promise<number> {
  const { data, error } = await supabase
    .from("rodotracker_medicao")
    .select("current")
    .eq("obra_id", obraId)
    .maybeSingle();
  throwIfError(error, "getCurrentMedicao");
  return data?.current ?? 1;
}

export async function setCurrentMedicao(obraId: string, n: number): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("rodotracker_medicao")
    .upsert({
      obra_id: obraId,
      user_id: userId,
      current: n,
      updated_at: Date.now(),
    });
  throwIfError(error, "setCurrentMedicao");
}

/* ─── Storage helpers ──────────────────────────────────────────────────── */

const PHOTO_BUCKET = "rodotracker-photos";
const PDF_BUCKET = "rodotracker-pdfs";
// Pasta compartilhada: todos os usuários autenticados leem/escrevem no
// mesmo caminho pra que as fotos cadastradas por um sejam visíveis pros
// outros. (A RLS do bucket já é `authenticated = all`.)
const SHARED_FOLDER = "shared";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const len = binary.length;
  const ua = new Uint8Array(len);
  for (let i = 0; i < len; i++) ua[i] = binary.charCodeAt(i);
  return new Blob([ua], { type: mime });
}

async function uploadToBucket(
  bucket: string,
  id: string,
  dataUrl: string
): Promise<void> {
  await currentUserId(); // garante auth
  const path = `${SHARED_FOLDER}/${id}`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type });
  throwIfError(error, `upload:${bucket}`);
}

async function signedUrlsFrom(
  bucket: string,
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  await currentUserId();
  const paths = ids.map((id) => `${SHARED_FOLDER}/${id}`);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, 3600);
  throwIfError(error, `signedUrls:${bucket}`);
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i++) {
    const d = (data ?? [])[i];
    if (d?.signedUrl) out[ids[i]] = d.signedUrl;
  }
  return out;
}

async function deleteFromBucket(bucket: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await currentUserId();
  const paths = ids.map((id) => `${SHARED_FOLDER}/${id}`);
  const { error } = await supabase.storage.from(bucket).remove(paths);
  throwIfError(error, `delete:${bucket}`);
}

export const photoStorage = {
  upload: (id: string, dataUrl: string) => uploadToBucket(PHOTO_BUCKET, id, dataUrl),
  getUrls: (ids: string[]) => signedUrlsFrom(PHOTO_BUCKET, ids),
  delete: (ids: string[]) => deleteFromBucket(PHOTO_BUCKET, ids),
};

export const pdfStorage = {
  upload: (id: string, dataUrl: string) => uploadToBucket(PDF_BUCKET, id, dataUrl),
  getUrls: (ids: string[]) => signedUrlsFrom(PDF_BUCKET, ids),
  delete: (ids: string[]) => deleteFromBucket(PDF_BUCKET, ids),
};
