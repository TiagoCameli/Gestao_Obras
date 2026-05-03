import { supabase } from '../../../lib/supabase';
import type { Peca, PecaRow } from '../types';

const TABELA = 'manutencao_pecas';

export function rowToPeca(r: PecaRow): Peca {
  return {
    partNumber: r.part_number,
    description: r.description,
    manufacturer: r.manufacturer,
    tipo: r.tipo as Peca['tipo'],
    alternativePartNumbers: r.alternative_part_numbers ?? undefined,
    custoMedioBrl: r.custo_medio_brl ?? undefined,
    fornecedorPrincipal: r.fornecedor_principal ?? undefined,
    observacoes: r.observacoes ?? undefined,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function pecaToInsert(p: Peca): Record<string, unknown> {
  return {
    part_number: p.partNumber,
    description: p.description,
    manufacturer: p.manufacturer,
    tipo: p.tipo,
    alternative_part_numbers: p.alternativePartNumbers ?? null,
    custo_medio_brl: p.custoMedioBrl ?? null,
    fornecedor_principal: p.fornecedorPrincipal ?? null,
    observacoes: p.observacoes ?? null,
    ativo: p.ativo,
    criado_por: p.criadoPor,
  };
}

export async function listPecas(opts?: { ativo?: boolean; tipo?: string }): Promise<Peca[]> {
  let query = supabase.from(TABELA).select('*');
  if (opts?.ativo !== undefined) query = query.eq('ativo', opts.ativo);
  if (opts?.tipo) query = query.eq('tipo', opts.tipo);
  const { data, error } = await query.order('description', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToPeca(r as PecaRow));
}

export async function getPeca(partNumber: string): Promise<Peca | null> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('part_number', partNumber)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPeca(data as PecaRow) : null;
}

export async function createPeca(peca: Peca): Promise<Peca> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(pecaToInsert(peca))
    .select('*')
    .single();
  if (error) throw error;
  return rowToPeca(data as PecaRow);
}

export async function updatePeca(partNumber: string, patch: Partial<Peca>): Promise<Peca> {
  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.manufacturer !== undefined) update.manufacturer = patch.manufacturer;
  if (patch.tipo !== undefined) update.tipo = patch.tipo;
  if (patch.alternativePartNumbers !== undefined)
    update.alternative_part_numbers = patch.alternativePartNumbers;
  if (patch.custoMedioBrl !== undefined) update.custo_medio_brl = patch.custoMedioBrl;
  if (patch.fornecedorPrincipal !== undefined)
    update.fornecedor_principal = patch.fornecedorPrincipal;
  if (patch.observacoes !== undefined) update.observacoes = patch.observacoes;
  if (patch.ativo !== undefined) update.ativo = patch.ativo;

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('part_number', partNumber)
    .select('*')
    .single();
  if (error) throw error;
  return rowToPeca(data as PecaRow);
}

export async function deletePeca(partNumber: string): Promise<void> {
  const { error } = await supabase
    .from(TABELA)
    .update({ ativo: false })
    .eq('part_number', partNumber);
  if (error) throw error;
}
