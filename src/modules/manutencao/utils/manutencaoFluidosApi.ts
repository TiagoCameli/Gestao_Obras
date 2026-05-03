import { supabase } from '../../../lib/supabase';
import type {
  Fluido,
  FluidoRow,
  FluidoTipo,
} from '../types';

const TABELA = 'manutencao_fluidos';

export function rowToFluido(r: FluidoRow): Fluido {
  return {
    id: r.id,
    tipo: r.tipo as FluidoTipo,
    catProductName: r.cat_product_name ?? undefined,
    apiSpecification: r.api_specification ?? undefined,
    viscosity: r.viscosity ?? undefined,
    description: r.description,
    ambientTempMinC: r.ambient_temp_min_c ?? undefined,
    ambientTempMaxC: r.ambient_temp_max_c ?? undefined,
    packageSizes: r.package_sizes ?? undefined,
    custoMedioLitroBrl: r.custo_medio_litro_brl ?? undefined,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function fluidoToInsert(f: Fluido): Record<string, unknown> {
  return {
    id: f.id,
    tipo: f.tipo,
    cat_product_name: f.catProductName ?? null,
    api_specification: f.apiSpecification ?? null,
    viscosity: f.viscosity ?? null,
    description: f.description,
    ambient_temp_min_c: f.ambientTempMinC ?? null,
    ambient_temp_max_c: f.ambientTempMaxC ?? null,
    package_sizes: f.packageSizes ?? null,
    custo_medio_litro_brl: f.custoMedioLitroBrl ?? null,
    ativo: f.ativo,
    criado_por: f.criadoPor,
  };
}

export async function listFluidos(opts?: { ativo?: boolean }): Promise<Fluido[]> {
  let query = supabase.from(TABELA).select('*');
  if (opts?.ativo !== undefined) query = query.eq('ativo', opts.ativo);
  const { data, error } = await query.order('description', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToFluido(r as FluidoRow));
}

export async function getFluido(id: string): Promise<Fluido | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToFluido(data as FluidoRow) : null;
}

export async function createFluido(fluido: Fluido): Promise<Fluido> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(fluidoToInsert(fluido))
    .select('*')
    .single();
  if (error) throw error;
  return rowToFluido(data as FluidoRow);
}

export async function updateFluido(id: string, patch: Partial<Fluido>): Promise<Fluido> {
  const update: Record<string, unknown> = {};
  if (patch.tipo !== undefined) update.tipo = patch.tipo;
  if (patch.catProductName !== undefined) update.cat_product_name = patch.catProductName;
  if (patch.apiSpecification !== undefined) update.api_specification = patch.apiSpecification;
  if (patch.viscosity !== undefined) update.viscosity = patch.viscosity;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.ambientTempMinC !== undefined) update.ambient_temp_min_c = patch.ambientTempMinC;
  if (patch.ambientTempMaxC !== undefined) update.ambient_temp_max_c = patch.ambientTempMaxC;
  if (patch.packageSizes !== undefined) update.package_sizes = patch.packageSizes;
  if (patch.custoMedioLitroBrl !== undefined) update.custo_medio_litro_brl = patch.custoMedioLitroBrl;
  if (patch.ativo !== undefined) update.ativo = patch.ativo;

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToFluido(data as FluidoRow);
}

export async function deleteFluido(id: string): Promise<void> {
  const { error } = await supabase.from(TABELA).update({ ativo: false }).eq('id', id);
  if (error) throw error;
}
