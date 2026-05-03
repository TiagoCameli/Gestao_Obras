import { supabase } from '../../../lib/supabase';
import { dbToEquipamento } from '../../../lib/mappers';
import type { Equipamento } from '../../../types';
import type { EquipamentoManutencaoFields } from '../types';
import { addLeituraHorimetro } from './horimetroApi';

const TABELA = 'equipamentos';

/**
 * Composição: Equipamento legado + os campos novos de manutenção.
 * Não duplica/substitui o tipo Equipamento existente — apenas estende.
 */
export type EquipamentoComManutencao = Equipamento & EquipamentoManutencaoFields;

interface EquipamentoRow {
  id: string;
  nome: string;
  tipo: string | null;
  empresa_id: string | null;
  codigo_patrimonio: string;
  numero_serie: string;
  ano: string;
  marca: string;
  tipo_medicao: string | null;
  medicao_inicial: number;
  ativo: boolean;
  data_aquisicao: string | null;
  data_venda: string | null;
  criado_por: string | null;
  modelo_id: string | null;
  prefixo_serie: string | null;
  horimetro_funcional: boolean;
  horimetro_atual: number | null;
  notas_unidade: string | null;
  alertas_criticos: string[] | null;
}

function rowToEquipamentoComManutencao(r: EquipamentoRow): EquipamentoComManutencao {
  const base = dbToEquipamento(r);
  return {
    ...base,
    modeloId: r.modelo_id ?? undefined,
    prefixoSerie: r.prefixo_serie ?? undefined,
    horimetroFuncional: r.horimetro_funcional,
    horimetroAtual: r.horimetro_atual ?? undefined,
    notasUnidade: r.notas_unidade ?? undefined,
    alertasCriticos: r.alertas_criticos ?? undefined,
  };
}

export async function getEquipamentoComManutencao(
  id: string
): Promise<EquipamentoComManutencao | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToEquipamentoComManutencao(data as EquipamentoRow) : null;
}

export async function listEquipamentosComManutencao(opts?: {
  ativo?: boolean;
}): Promise<EquipamentoComManutencao[]> {
  let query = supabase.from(TABELA).select('*');
  if (opts?.ativo !== undefined) query = query.eq('ativo', opts.ativo);
  const { data, error } = await query.order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToEquipamentoComManutencao(r as EquipamentoRow));
}

/**
 * Associa o equipamento a um modelo do catálogo. Opcionalmente grava o
 * prefixo da série para que o sistema escolha corretamente part numbers
 * de filtros que variam por prefixo.
 */
export async function updateModeloEquipamento(
  equipamentoId: string,
  modeloId: string,
  prefixoSerie?: string
): Promise<void> {
  const update: Record<string, unknown> = { modelo_id: modeloId };
  if (prefixoSerie !== undefined) update.prefixo_serie = prefixoSerie;

  const { error } = await supabase.from(TABELA).update(update).eq('id', equipamentoId);
  if (error) throw error;
}

/**
 * Atualiza a coluna `horimetro_atual` no equipamento E grava uma leitura
 * no histórico (`manutencao_horimetro_leituras`).
 */
export async function updateHorimetroAtual(
  equipamentoId: string,
  valor: number,
  criadoPor: string,
  observacao?: string
): Promise<void> {
  const { error: errEq } = await supabase
    .from(TABELA)
    .update({ horimetro_atual: valor })
    .eq('id', equipamentoId);
  if (errEq) throw errEq;

  await addLeituraHorimetro({
    equipamentoId,
    valor,
    origem: 'manual',
    observacao,
    criadoPor,
  });
}

/**
 * Marca o horímetro como não-funcional. Esse equipamento passa a ter
 * cronograma baseado em datas (intervalo_dias) ao invés de horas.
 */
export async function marcarHorimetroNaoFuncional(
  equipamentoId: string,
  motivo: string
): Promise<void> {
  const notas = motivo ? `Horímetro inoperante: ${motivo}` : 'Horímetro inoperante';
  const { error } = await supabase
    .from(TABELA)
    .update({
      horimetro_funcional: false,
      notas_unidade: notas,
    })
    .eq('id', equipamentoId);
  if (error) throw error;
}
