import { supabase } from '../lib/supabase';

export async function calcularEstoqueCombustivelNaData(
  depositoId: string,
  dataHora: string,
  excluirId?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('calcular_estoque_combustivel_na_data', {
    p_deposito_id: depositoId,
    p_data_hora: dataHora,
    p_excluir_id: excluirId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
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
