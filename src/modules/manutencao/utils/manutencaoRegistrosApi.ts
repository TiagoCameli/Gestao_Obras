import { supabase } from '../../../lib/supabase';
import type {
  ExecutorPapel,
  FluidoConsumo,
  ManutencaoRegistro,
  ManutencaoRegistroRow,
  ManutencaoRegistroStatus,
  PecaConsumo,
} from '../types';
import { recalcularAgendamentoAposExecucao } from './manutencaoAgendamentosApi';

const TABELA = 'manutencao_registros';
const BUCKET = 'manutencao-fotos';
const SIGNED_URL_TTL_SECS = 60 * 60 * 24 * 365; // ~1 ano

export function rowToRegistro(r: ManutencaoRegistroRow): ManutencaoRegistro {
  return {
    id: r.id,
    equipamentoId: r.equipamento_id,
    tarefaId: r.tarefa_id,
    agendamentoId: r.agendamento_id ?? undefined,
    executadoEm: r.executado_em,
    executadoPorFuncionarioId: r.executado_por_funcionario_id ?? undefined,
    executorPapel: r.executor_papel as ExecutorPapel,
    horimetroNoMomento: r.horimetro_no_momento ?? undefined,
    status: r.status as ManutencaoRegistroStatus,
    pecasUsadas: (r.pecas_usadas ?? []) as PecaConsumo[],
    fluidosUsados: (r.fluidos_usados ?? []) as FluidoConsumo[],
    custoTotalBrl: r.custo_total_brl ?? undefined,
    fotosUrls: r.fotos_urls ?? undefined,
    observacoes: r.observacoes ?? undefined,
    problemasEncontrados: r.problemas_encontrados ?? undefined,
    acoesRecomendadas: r.acoes_recomendadas ?? undefined,
    oleoAmostraColetada: r.oleo_amostra_coletada ?? undefined,
    oleoAmostraResultado:
      (r.oleo_amostra_resultado as ManutencaoRegistro['oleoAmostraResultado']) ?? undefined,
    oleoAmostraPdfUrl: r.oleo_amostra_pdf_url ?? undefined,
    oleoAmostraDataEnvio: r.oleo_amostra_data_envio ?? undefined,
    oleoAmostraDataResultado: r.oleo_amostra_data_resultado ?? undefined,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function registroToInsert(r: Partial<ManutencaoRegistro>): Record<string, unknown> {
  return {
    ...(r.id !== undefined ? { id: r.id } : {}),
    equipamento_id: r.equipamentoId,
    tarefa_id: r.tarefaId,
    agendamento_id: r.agendamentoId ?? null,
    executado_em: r.executadoEm,
    executado_por_funcionario_id: r.executadoPorFuncionarioId ?? null,
    executor_papel: r.executorPapel,
    horimetro_no_momento: r.horimetroNoMomento ?? null,
    status: r.status ?? 'concluida',
    pecas_usadas: r.pecasUsadas ?? [],
    fluidos_usados: r.fluidosUsados ?? [],
    custo_total_brl: r.custoTotalBrl ?? null,
    fotos_urls: r.fotosUrls ?? null,
    observacoes: r.observacoes ?? null,
    problemas_encontrados: r.problemasEncontrados ?? null,
    acoes_recomendadas: r.acoesRecomendadas ?? null,
    oleo_amostra_coletada: r.oleoAmostraColetada ?? false,
    oleo_amostra_resultado: r.oleoAmostraResultado ?? null,
    oleo_amostra_pdf_url: r.oleoAmostraPdfUrl ?? null,
    oleo_amostra_data_envio: r.oleoAmostraDataEnvio ?? null,
    oleo_amostra_data_resultado: r.oleoAmostraDataResultado ?? null,
    criado_por: r.criadoPor ?? '',
  };
}

export interface FiltrosRegistro {
  equipamentoId?: string;
  tarefaId?: string;
  desde?: string; // ISO completo
  ate?: string;   // ISO completo
}

export async function listRegistros(filtros?: FiltrosRegistro): Promise<ManutencaoRegistro[]> {
  let query = supabase.from(TABELA).select('*');
  if (filtros?.equipamentoId) query = query.eq('equipamento_id', filtros.equipamentoId);
  if (filtros?.tarefaId) query = query.eq('tarefa_id', filtros.tarefaId);
  if (filtros?.desde) query = query.gte('executado_em', filtros.desde);
  if (filtros?.ate) query = query.lte('executado_em', filtros.ate);
  const { data, error } = await query.order('executado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToRegistro(r as ManutencaoRegistroRow));
}

export async function getRegistro(id: string): Promise<ManutencaoRegistro | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToRegistro(data as ManutencaoRegistroRow) : null;
}

export async function createRegistro(
  registro: Partial<ManutencaoRegistro> & {
    equipamentoId: string;
    tarefaId: string;
    executadoEm: string;
    executorPapel: ExecutorPapel;
    criadoPor: string;
  }
): Promise<ManutencaoRegistro> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(registroToInsert(registro))
    .select('*')
    .single();
  if (error) throw error;
  const novo = rowToRegistro(data as ManutencaoRegistroRow);
  if (novo.status === 'concluida') {
    try {
      await recalcularAgendamentoAposExecucao(novo.id);
    } catch (e) {
      // Falha de cálculo de próxima manutenção não deve invalidar o registro
      console.error('Falha ao recalcular agendamento:', e);
    }
  }
  return novo;
}

export async function updateRegistro(
  id: string,
  patch: Partial<ManutencaoRegistro>
): Promise<ManutencaoRegistro> {
  const update: Record<string, unknown> = {};
  const map: Array<[keyof ManutencaoRegistro, string]> = [
    ['equipamentoId', 'equipamento_id'],
    ['tarefaId', 'tarefa_id'],
    ['agendamentoId', 'agendamento_id'],
    ['executadoEm', 'executado_em'],
    ['executadoPorFuncionarioId', 'executado_por_funcionario_id'],
    ['executorPapel', 'executor_papel'],
    ['horimetroNoMomento', 'horimetro_no_momento'],
    ['status', 'status'],
    ['pecasUsadas', 'pecas_usadas'],
    ['fluidosUsados', 'fluidos_usados'],
    ['custoTotalBrl', 'custo_total_brl'],
    ['fotosUrls', 'fotos_urls'],
    ['observacoes', 'observacoes'],
    ['problemasEncontrados', 'problemas_encontrados'],
    ['acoesRecomendadas', 'acoes_recomendadas'],
    ['oleoAmostraColetada', 'oleo_amostra_coletada'],
    ['oleoAmostraResultado', 'oleo_amostra_resultado'],
    ['oleoAmostraPdfUrl', 'oleo_amostra_pdf_url'],
    ['oleoAmostraDataEnvio', 'oleo_amostra_data_envio'],
    ['oleoAmostraDataResultado', 'oleo_amostra_data_resultado'],
  ];
  for (const [camel, snake] of map) {
    if (patch[camel] !== undefined) update[snake] = patch[camel];
  }

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToRegistro(data as ManutencaoRegistroRow);
}

/**
 * Deleta um registro e tenta remover as fotos associadas do bucket
 * (best-effort — falhas de storage são logadas mas não bloqueiam o delete
 * do row). Comportamento intencional: editar/deletar registro concluído
 * NÃO reverte o agendamento futuro gerado pelo recálculo; o usuário deve
 * ajustar manualmente se necessário.
 */
export async function deleteRegistro(id: string): Promise<void> {
  const { data: regRow } = await supabase
    .from(TABELA)
    .select('fotos_urls')
    .eq('id', id)
    .maybeSingle();
  const fotosUrls: string[] = (regRow as { fotos_urls: string[] | null } | null)?.fotos_urls ?? [];

  if (fotosUrls.length > 0) {
    // Cada signed URL contém o path como segmento `.../object/sign/<bucket>/<path>?token=...`
    const paths: string[] = [];
    for (const url of fotosUrls) {
      const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
      if (m) paths.push(decodeURIComponent(m[1]));
    }
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageErr) {
        console.warn('Falha ao remover fotos do bucket:', storageErr.message);
      }
    }
  }

  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}

/* ─── Storage de fotos ───────────────────────────────────────────────── */

function sanitizeNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Sobe uma foto pro bucket `manutencao-fotos` em
 * `{registroId}/{timestamp}-{nome}` e devolve a signed URL.
 */
export async function uploadFotoRegistro(file: File, registroId: string): Promise<string> {
  const timestamp = Date.now();
  const path = `${registroId}/${timestamp}-${sanitizeNome(file.name)}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECS);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Cria registro + sobe fotos. Se qualquer upload falhar, deleta o
 * registro e re-lança o erro (transação lógica).
 */
export async function createRegistroComFotos(
  registro: Partial<ManutencaoRegistro> & {
    equipamentoId: string;
    tarefaId: string;
    executadoEm: string;
    executorPapel: ExecutorPapel;
    criadoPor: string;
  },
  files: File[]
): Promise<ManutencaoRegistro> {
  const novo = await createRegistro(registro);
  if (files.length === 0) return novo;

  try {
    const urls = await Promise.all(files.map((f) => uploadFotoRegistro(f, novo.id)));
    return await updateRegistro(novo.id, { fotosUrls: urls });
  } catch (e) {
    // Rollback: deletar o registro recém-criado para evitar dados inconsistentes
    try {
      await deleteRegistro(novo.id);
    } catch {
      // se a deleção falhar, ainda re-lança o erro original
    }
    throw e;
  }
}
