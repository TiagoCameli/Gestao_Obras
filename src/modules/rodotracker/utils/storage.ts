/**
 * Camada de storage do tracker — agora 100% Supabase.
 *
 * Mantém os mesmos nomes de funções que o código legado chamava (só que
 * todas são async). Os consumidores foram refatorados pra await.
 */
import type { Activity, ContractItem, Obra, PlanItem } from "../types/activity";
import * as api from "./rodotrackerApi";

/* ─── Obras ─────────────────────────────────────────────────────────────── */

export async function loadObras(): Promise<Obra[]> {
  return api.listObras();
}

export async function saveObra(obra: Obra): Promise<void> {
  await api.upsertObra(obra);
}

export async function deleteObra(id: string): Promise<void> {
  await api.deleteObra(id);
}

/* ─── Activities ────────────────────────────────────────────────────────── */

export async function loadActivities(obraId: string): Promise<Activity[]> {
  return api.listActivities(obraId);
}

export async function saveActivity(activity: Activity, obraId: string): Promise<void> {
  await api.upsertActivity(activity, obraId);
}

export async function deleteActivity(id: string): Promise<void> {
  await api.deleteActivity(id);
}

/* ─── Plan items ────────────────────────────────────────────────────────── */

export async function loadPlanItems(obraId: string): Promise<PlanItem[]> {
  return api.listPlanItems(obraId);
}

export async function savePlanItems(obraId: string, items: PlanItem[]): Promise<void> {
  await api.replacePlanItems(obraId, items);
}

/* ─── Contract items ────────────────────────────────────────────────────── */

export async function loadContractItems(obraId: string): Promise<ContractItem[]> {
  return api.listContractItems(obraId);
}

export async function saveContractItems(obraId: string, items: ContractItem[]): Promise<void> {
  await api.replaceContractItems(obraId, items);
}

/* ─── Medição vigente ───────────────────────────────────────────────────── */

export async function loadCurrentMedicao(obraId: string): Promise<number> {
  return api.getCurrentMedicao(obraId);
}

export async function saveCurrentMedicao(obraId: string, n: number): Promise<void> {
  await api.setCurrentMedicao(obraId, n);
}
