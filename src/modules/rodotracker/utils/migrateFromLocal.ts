/**
 * Migração one-shot do storage antigo (localStorage + Dexie) pra Supabase.
 * Lê as chaves `rodotracker-*` do localStorage e os IndexedDBs
 * `rodotracker-photos` / `rodotracker-pdfs`, depois sobe tudo pela API.
 */
import type { Activity, ContractItem, Obra, PlanItem } from "../types/activity";
import * as api from "./rodotrackerApi";

type Progress = (msg: string) => void;

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function getAllFromStore<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((res, rej) => {
    if (!db.objectStoreNames.contains(store)) { res([]); return; }
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => res(req.result as T[]);
    req.onerror = () => rej(req.error);
  });
}

interface MigrationSummary {
  obras: number;
  activities: number;
  planItems: number;
  contractItems: number;
  medicao: number;
  photos: number;
  pdfs: number;
}

export async function migrateLocalDataToSupabase(
  onProgress: Progress = () => {}
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    obras: 0, activities: 0, planItems: 0, contractItems: 0,
    medicao: 0, photos: 0, pdfs: 0,
  };

  // ─── Obras ───────────────────────────────────────────────────────────
  onProgress("Lendo obras do localStorage...");
  const obras = parseJSON<Obra[]>(localStorage.getItem("rodotracker-obras"), []);
  for (const o of obras) {
    await api.upsertObra(o);
    summary.obras++;
    onProgress(`Obras: ${summary.obras}/${obras.length}`);
  }

  // ─── Para cada obra: atividades, plan items, contract items, medição ──
  for (const o of obras) {
    onProgress(`Migrando dados da obra "${o.name}"...`);

    const acts = parseJSON<Activity[]>(
      localStorage.getItem(`rodotracker-activities-${o.id}`),
      []
    );
    for (const a of acts) {
      await api.upsertActivity(a, o.id);
      summary.activities++;
    }

    const plan = parseJSON<PlanItem[]>(
      localStorage.getItem(`rodotracker-plan-${o.id}`),
      []
    );
    if (plan.length > 0) {
      await api.replacePlanItems(o.id, plan);
      summary.planItems += plan.length;
    }

    const contract = parseJSON<ContractItem[]>(
      localStorage.getItem(`rodotracker-contract-${o.id}`),
      []
    );
    if (contract.length > 0) {
      await api.replaceContractItems(o.id, contract);
      summary.contractItems += contract.length;
    }

    const medicaoRaw = localStorage.getItem(`rodotracker-medicao-current-${o.id}`);
    const medicao = medicaoRaw ? parseInt(medicaoRaw, 10) : NaN;
    if (Number.isFinite(medicao) && medicao > 0) {
      await api.setCurrentMedicao(o.id, medicao);
      summary.medicao++;
    }

    onProgress(
      `${o.name}: ${acts.length} ativ, ${plan.length} plano, ${contract.length} contrato`
    );
  }

  // ─── Fotos ───────────────────────────────────────────────────────────
  onProgress("Lendo fotos do IndexedDB...");
  try {
    const photoDb = await openDB("rodotracker-photos");
    const photoRecords = await getAllFromStore<{ id: string; data: string }>(
      photoDb,
      "photos"
    );
    photoDb.close();
    for (let i = 0; i < photoRecords.length; i++) {
      const rec = photoRecords[i];
      await api.photoStorage.upload(rec.id, rec.data);
      summary.photos++;
      if (summary.photos % 10 === 0) {
        onProgress(`Fotos: ${summary.photos}/${photoRecords.length}`);
      }
    }
  } catch (e) {
    console.warn("Sem DB de fotos local:", e);
  }

  // ─── PDFs ────────────────────────────────────────────────────────────
  onProgress("Lendo PDFs do IndexedDB...");
  try {
    const pdfDb = await openDB("rodotracker-pdfs");
    const pdfRecords = await getAllFromStore<{ id: string; data: string }>(
      pdfDb,
      "pdfs"
    );
    pdfDb.close();
    for (const rec of pdfRecords) {
      await api.pdfStorage.upload(rec.id, rec.data);
      summary.pdfs++;
      onProgress(`PDFs: ${summary.pdfs}/${pdfRecords.length}`);
    }
  } catch (e) {
    console.warn("Sem DB de PDFs local:", e);
  }

  onProgress(
    `Concluído: ${summary.obras} obras, ${summary.activities} atividades, ` +
    `${summary.contractItems} itens do contrato, ${summary.photos} fotos, ${summary.pdfs} PDFs.`
  );
  return summary;
}
