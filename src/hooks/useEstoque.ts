import { supabase } from '../lib/supabase';

/** HF.12 — Normaliza um datetime-local ("YYYY-MM-DDTHH:MM" sem TZ, hora local
 *  do navegador) pra ISO 8601 UTC explícito ("YYYY-MM-DDTHH:MM:SS.sssZ").
 *  Sem isso, o Postgres ao castar `::timestamptz` assume UTC e ignora o TZ
 *  do usuário, devolvendo saldos em janela errada. */
function toIsoUtc(dataHoraLocal: string): string {
  // Se já vem em formato com TZ (ex: "Z" final ou "+/-HH:MM"), passa direto.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(dataHoraLocal)) return dataHoraLocal;
  // Constrói Date considerando TZ local do navegador, retorna ISO UTC.
  const d = new Date(dataHoraLocal);
  if (isNaN(d.getTime())) return dataHoraLocal; // fallback se input inválido
  return d.toISOString();
}

export async function calcularEstoqueCombustivelNaData(
  depositoId: string,
  dataHora: string,
  excluirId?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('calcular_estoque_combustivel_na_data', {
    p_deposito_id: depositoId,
    p_data_hora: toIsoUtc(dataHora),
    p_excluir_id: excluirId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** HF.4 — Tipo de combustível que estava no tanque na data informada
 *  (id de `insumos`). NULL se nada se aplicar (tanque sem fonte até a data). */
export async function calcularCombustivelTanqueNaData(
  depositoId: string,
  dataHora: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('calcular_combustivel_tanque_na_data', {
    p_deposito_id: depositoId,
    p_data_hora: toIsoUtc(dataHora),
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function calcularEstoqueMaterial(
  depositoMaterialId: string,
  insumoId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('calcular_estoque_material', {
    p_deposito_material_id: depositoMaterialId,
    p_insumo_id: insumoId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function calcularEstoqueMaterialNaData(
  depositoMaterialId: string,
  insumoId: string,
  dataHora: string,
  excluirId?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('calcular_estoque_material_na_data', {
    p_deposito_material_id: depositoMaterialId,
    p_insumo_id: insumoId,
    p_data_hora: dataHora,
    p_excluir_id: excluirId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function calcularTodoEstoqueMaterial(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('calcular_todo_estoque_material');
  if (error) throw error;
  const mapa = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data ?? []).forEach((row: any) => {
    const key = `${row.deposito_material_id}|${row.insumo_id}`;
    mapa.set(key, Number(row.quantidade));
  });
  return mapa;
}
