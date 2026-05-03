import { supabase } from '../../../lib/supabase';
import type {
  EquipamentoModelo,
  EquipamentoModeloRow,
  CapacidadesSpec,
  FiltroRef,
  FluidoRecomendado,
  MotorSpec,
} from '../types';

const TABELA = 'equipamento_modelos';

export interface FiltrosEquipamentoModelos {
  fabricante?: string;
  tipoEquipamentoCodigo?: string;
  ativo?: boolean;
  search?: string; // busca em modelo_nome / familia
}

export function rowToEquipamentoModelo(r: EquipamentoModeloRow): EquipamentoModelo {
  return {
    id: r.id,
    fabricante: r.fabricante,
    modeloNome: r.modelo_nome,
    familia: r.familia,
    tipoEquipamentoCodigo: r.tipo_equipamento_codigo ?? undefined,
    anoInicioProducao: r.ano_inicio_producao ?? undefined,
    anoFimProducao: r.ano_fim_producao ?? undefined,
    prefixosSerie: r.prefixos_serie ?? undefined,
    motor: (r.motor ?? {}) as MotorSpec,
    capacidades: (r.capacidades ?? {}) as CapacidadesSpec,
    fluidosRecomendados: (r.fluidos_recomendados ?? []) as FluidoRecomendado[],
    filtros: (r.filtros ?? []) as FiltroRef[],
    problemasConhecidos: r.problemas_conhecidos ?? undefined,
    manualUrl: r.manual_url ?? undefined,
    manualReferencia: r.manual_referencia ?? undefined,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    criadoPor: r.criado_por,
  };
}

export function equipamentoModeloToInsert(m: EquipamentoModelo): Record<string, unknown> {
  return {
    id: m.id,
    fabricante: m.fabricante,
    modelo_nome: m.modeloNome,
    familia: m.familia,
    tipo_equipamento_codigo: m.tipoEquipamentoCodigo ?? null,
    ano_inicio_producao: m.anoInicioProducao ?? null,
    ano_fim_producao: m.anoFimProducao ?? null,
    prefixos_serie: m.prefixosSerie ?? null,
    motor: m.motor ?? {},
    capacidades: m.capacidades ?? {},
    fluidos_recomendados: m.fluidosRecomendados ?? [],
    filtros: m.filtros ?? [],
    problemas_conhecidos: m.problemasConhecidos ?? null,
    manual_url: m.manualUrl ?? null,
    manual_referencia: m.manualReferencia ?? null,
    ativo: m.ativo,
    criado_por: m.criadoPor,
  };
}

export async function listEquipamentoModelos(
  filtros?: FiltrosEquipamentoModelos
): Promise<EquipamentoModelo[]> {
  let query = supabase.from(TABELA).select('*');
  if (filtros?.fabricante) query = query.eq('fabricante', filtros.fabricante);
  if (filtros?.tipoEquipamentoCodigo)
    query = query.eq('tipo_equipamento_codigo', filtros.tipoEquipamentoCodigo);
  if (filtros?.ativo !== undefined) query = query.eq('ativo', filtros.ativo);
  if (filtros?.search) {
    const s = filtros.search.replace(/[,%]/g, '');
    query = query.or(`modelo_nome.ilike.%${s}%,familia.ilike.%${s}%`);
  }
  const { data, error } = await query.order('modelo_nome', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToEquipamentoModelo(r as EquipamentoModeloRow));
}

export async function getEquipamentoModelo(id: string): Promise<EquipamentoModelo | null> {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToEquipamentoModelo(data as EquipamentoModeloRow) : null;
}

export async function createEquipamentoModelo(
  modelo: EquipamentoModelo
): Promise<EquipamentoModelo> {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(equipamentoModeloToInsert(modelo))
    .select('*')
    .single();
  if (error) throw error;
  return rowToEquipamentoModelo(data as EquipamentoModeloRow);
}

export async function updateEquipamentoModelo(
  id: string,
  patch: Partial<EquipamentoModelo>
): Promise<EquipamentoModelo> {
  const update: Record<string, unknown> = {};
  if (patch.fabricante !== undefined) update.fabricante = patch.fabricante;
  if (patch.modeloNome !== undefined) update.modelo_nome = patch.modeloNome;
  if (patch.familia !== undefined) update.familia = patch.familia;
  if (patch.tipoEquipamentoCodigo !== undefined)
    update.tipo_equipamento_codigo = patch.tipoEquipamentoCodigo;
  if (patch.anoInicioProducao !== undefined) update.ano_inicio_producao = patch.anoInicioProducao;
  if (patch.anoFimProducao !== undefined) update.ano_fim_producao = patch.anoFimProducao;
  if (patch.prefixosSerie !== undefined) update.prefixos_serie = patch.prefixosSerie;
  if (patch.motor !== undefined) update.motor = patch.motor;
  if (patch.capacidades !== undefined) update.capacidades = patch.capacidades;
  if (patch.fluidosRecomendados !== undefined)
    update.fluidos_recomendados = patch.fluidosRecomendados;
  if (patch.filtros !== undefined) update.filtros = patch.filtros;
  if (patch.problemasConhecidos !== undefined)
    update.problemas_conhecidos = patch.problemasConhecidos;
  if (patch.manualUrl !== undefined) update.manual_url = patch.manualUrl;
  if (patch.manualReferencia !== undefined) update.manual_referencia = patch.manualReferencia;
  if (patch.ativo !== undefined) update.ativo = patch.ativo;

  const { data, error } = await supabase
    .from(TABELA)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToEquipamentoModelo(data as EquipamentoModeloRow);
}

/** Soft delete — mantém registros históricos referenciando o modelo. */
export async function deleteEquipamentoModelo(id: string): Promise<void> {
  const { error } = await supabase.from(TABELA).update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

/**
 * Mapa modeloId → quantidade de equipamentos ATIVOS associados.
 * Modelos sem equipamentos não aparecem no resultado.
 */
export async function countEquipamentosPorModelo(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('equipamentos')
    .select('modelo_id')
    .eq('ativo', true)
    .not('modelo_id', 'is', null);
  if (error) throw error;
  const out: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    const id = (row as { modelo_id: string | null }).modelo_id;
    if (!id) return;
    out[id] = (out[id] ?? 0) + 1;
  });
  return out;
}

/**
 * Slugifica uma string: lowercase, sem acentos, apenas a-z/0-9/hífen.
 * Usado como fallback quando o id da tarefa original não segue a convenção
 * `${idOriginal}-${suffixo}`.
 */
export function slugifyTitulo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Deriva o sufixo de uma tarefa para uso no clone: se o id começa com
 * `${idOriginal}-`, usa o que vem depois; senão, cai no slug do título.
 */
export function suffixoTarefaParaClone(
  tarefaId: string,
  tituloTarefa: string,
  idModeloOriginal: string
): string {
  const prefix = `${idModeloOriginal}-`;
  if (tarefaId.startsWith(prefix) && tarefaId.length > prefix.length) {
    return tarefaId.slice(prefix.length);
  }
  return slugifyTitulo(tituloTarefa) || 'tarefa';
}

/**
 * Calcula os ids finais para um conjunto de tarefas a clonar, evitando
 * colisão com ids já existentes (recebidos em `idsExistentes`) e entre si.
 * Para colisões, anexa `-2`, `-3`, ... até encontrar id livre.
 */
export function calcularIdsClone(
  tarefasOriginais: Array<{ id: string; titulo: string }>,
  idModeloOriginal: string,
  novoModeloId: string,
  idsExistentes: Set<string>
): string[] {
  const usados = new Set<string>(idsExistentes);
  return tarefasOriginais.map((t) => {
    const suffix = suffixoTarefaParaClone(t.id, t.titulo, idModeloOriginal);
    const base = `${novoModeloId}-${suffix}`;
    if (!usados.has(base)) {
      usados.add(base);
      return base;
    }
    let n = 2;
    let candidato = `${base}-${n}`;
    while (usados.has(candidato)) {
      n += 1;
      candidato = `${base}-${n}`;
    }
    usados.add(candidato);
    return candidato;
  });
}

/**
 * Clona um modelo existente (todos os campos + tarefas associadas) sob um
 * novo `id` e `modeloNome`. Útil para criar variante de uma máquina (ex.:
 * 320C-S a partir de 320C base).
 *
 * Para os ids das tarefas clonadas:
 *  1. Tenta derivar o sufixo a partir do id original (se segue a convenção
 *     `${idOriginal}-...`).
 *  2. Caso contrário, usa o slug do título da tarefa.
 *  3. Antes de inserir, faz UMA query batch (`SELECT id ... WHERE id IN (...)`)
 *     com todos os ids candidatos, e resolve colisões em memória anexando
 *     `-2`, `-3`, etc.
 */
export async function cloneEquipamentoModelo(
  id: string,
  novoId: string,
  novoNome: string,
  criadoPor: string
): Promise<EquipamentoModelo> {
  const original = await getEquipamentoModelo(id);
  if (!original) throw new Error(`Modelo ${id} não encontrado`);

  const clone: EquipamentoModelo = {
    ...original,
    id: novoId,
    modeloNome: novoNome,
    ativo: true,
    criadoPor,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  const novo = await createEquipamentoModelo(clone);

  const { data: tarefasOriginais, error: errTarefas } = await supabase
    .from('manutencao_tarefas')
    .select('*')
    .eq('modelo_id', id)
    .eq('ativo', true);
  if (errTarefas) throw errTarefas;

  const tarefas = (tarefasOriginais ?? []) as Array<Record<string, unknown> & {
    id: string;
    titulo: string;
  }>;
  if (tarefas.length === 0) return novo;

  // Calcula ids candidatos (base) — `${novoId}-${suffix}` por tarefa.
  const candidatos = tarefas.map((t) => {
    const suffix = suffixoTarefaParaClone(t.id, t.titulo, id);
    return `${novoId}-${suffix}`;
  });

  // 1 query batch: SELECT IN (todos os ids candidatos).
  const { data: existentesRaw, error: errEx } = await supabase
    .from('manutencao_tarefas')
    .select('id')
    .in('id', candidatos);
  if (errEx) throw errEx;
  const idsExistentes = new Set(
    (existentesRaw ?? []).map((r) => (r as { id: string }).id)
  );

  const novosIds = calcularIdsClone(
    tarefas.map((t) => ({ id: t.id, titulo: t.titulo })),
    id,
    novoId,
    idsExistentes
  );

  const agora = new Date().toISOString();
  const novasTarefas = tarefas.map((t, i) => ({
    ...t,
    id: novosIds[i],
    modelo_id: novoId,
    criado_em: agora,
    atualizado_em: agora,
    criado_por: criadoPor,
  }));

  const { error: insErr } = await supabase.from('manutencao_tarefas').insert(novasTarefas);
  if (insErr) throw insErr;

  return novo;
}
