import { supabase } from '../../../lib/supabase';
import type { HorimetroLeitura, HorimetroLeituraRow } from '../types';

const TABELA = 'manutencao_horimetro_leituras';

export function rowToLeitura(r: HorimetroLeituraRow): HorimetroLeitura {
  return {
    id: r.id,
    equipamentoId: r.equipamento_id,
    dataLeitura: r.data_leitura,
    valor: Number(r.valor),
    origem: r.origem as HorimetroLeitura['origem'],
    observacao: r.observacao ?? undefined,
    registradoPor: r.registrado_por ?? undefined,
    criadoEm: r.criado_em,
    criadoPor: r.criado_por,
  };
}

export interface AddLeituraInput {
  equipamentoId: string;
  valor: number;
  dataLeitura?: string; // YYYY-MM-DD — default hoje
  origem?: HorimetroLeitura['origem'];
  observacao?: string;
  criadoPor: string;
  registradoPor?: string;
}

export async function addLeituraHorimetro(input: AddLeituraInput): Promise<HorimetroLeitura> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from(TABELA)
    .insert({
      equipamento_id: input.equipamentoId,
      data_leitura: input.dataLeitura ?? hoje,
      valor: input.valor,
      origem: input.origem ?? 'manual',
      observacao: input.observacao ?? null,
      registrado_por: input.registradoPor ?? input.criadoPor ?? null,
      criado_por: input.criadoPor,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToLeitura(data as HorimetroLeituraRow);
}

export async function getUltimaLeitura(equipamentoId: string): Promise<HorimetroLeitura | null> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('equipamento_id', equipamentoId)
    .order('data_leitura', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLeitura(data as HorimetroLeituraRow) : null;
}

export async function getHistoricoLeituras(
  equipamentoId: string,
  dataInicio?: string,
  dataFim?: string
): Promise<HorimetroLeitura[]> {
  let query = supabase.from(TABELA).select('*').eq('equipamento_id', equipamentoId);
  if (dataInicio) query = query.gte('data_leitura', dataInicio);
  if (dataFim) query = query.lte('data_leitura', dataFim);
  const { data, error } = await query.order('data_leitura', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToLeitura(r as HorimetroLeituraRow));
}
