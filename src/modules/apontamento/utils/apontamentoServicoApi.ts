import { supabase } from "../../../lib/supabase";
import {
  montarRowsApontamentoPorPct,
  type LinhaServicoPct,
} from "./apontamentoServicoPct";

export type { LinhaServicoPct } from "./apontamentoServicoPct";

/**
 * "Serviço" agora é um item de contrato da obra (rodotracker_contract_items).
 * Mantemos a interface mínima usada pela tela de Apontamento por Serviço.
 */
export interface Servico {
  id: string;
  nome: string;
  codigo: string | null;
  unidade: string | null;
  obraId: string | null;
}

export type LadoServico = "direito" | "esquerdo" | "ambos";
export type TipoApontamento = "produtivo" | "improdutivo";

export interface ApontamentoServico {
  id: string;
  funcionarioId: string;
  data: string;
  servicoId: string | null;
  estacaInicial: string | null;
  estacaFinal: string | null;
  lado: LadoServico | null;
  horas: number;
  tipo: TipoApontamento;
  motivoImprodutivo: string | null;
  observacao: string | null;
  registradoPorId: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  funcionario_id: string;
  data: string;
  servico_id: string | null;
  estaca_inicial: string | null;
  estaca_final: string | null;
  lado: string | null;
  horas: number;
  tipo: string;
  motivo_improdutivo: string | null;
  observacao: string | null;
  registrado_por_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToApont(r: Row): ApontamentoServico {
  return {
    id: r.id,
    funcionarioId: r.funcionario_id,
    data: r.data,
    servicoId: r.servico_id,
    estacaInicial: r.estaca_inicial,
    estacaFinal: r.estaca_final,
    lado: (r.lado ?? null) as LadoServico | null,
    horas: Number(r.horas),
    tipo: r.tipo as TipoApontamento,
    motivoImprodutivo: r.motivo_improdutivo,
    observacao: r.observacao,
    registradoPorId: r.registrado_por_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function throwIfError(error: unknown, ctx: string) {
  if (error) {
    const m = (error as { message?: string }).message ?? String(error);
    throw new Error(`[apont-servico:${ctx}] ${m}`);
  }
}

/* ─── Serviços = itens de contrato da obra ─── */

export async function listServicosDaObra(
  obraId: string
): Promise<Servico[]> {
  if (!obraId) return [];
  const { data, error } = await supabase
    .from("rodotracker_contract_items")
    .select("id, code, name, unit, obra_id")
    .eq("obra_id", obraId)
    .order("code", { ascending: true });
  throwIfError(error, "listServicosDaObra");
  return ((data ?? []) as { id: string; code: string | null; name: string; unit: string | null; obra_id: string | null }[]).map(
    (r) => ({ id: r.id, nome: r.name, codigo: r.code, unidade: r.unit, obraId: r.obra_id })
  );
}

/* ─── Apontamentos do dia (para uma equipe) ─── */

export async function listApontamentosDoDia(
  funcionarioIds: string[],
  data: string
): Promise<ApontamentoServico[]> {
  if (funcionarioIds.length === 0) return [];
  const { data: rows, error } = await supabase
    .from("apont_apontamentos_servico")
    .select("*")
    .in("funcionario_id", funcionarioIds)
    .eq("data", data)
    .order("created_at", { ascending: true });
  throwIfError(error, "listApontamentos");
  return ((rows ?? []) as Row[]).map(rowToApont);
}

/**
 * Lista apontamentos num intervalo, opcionalmente filtrando por
 * obra/equipe/funcionário. Usado pelo Dashboard e pela aba Histórico.
 */
export interface FiltrosApontamentoServico {
  dataInicio: string;
  dataFim: string;
  obraId?: string;
  equipeId?: string;
  funcionarioId?: string;
  tipo?: TipoApontamento;
}

export async function listApontamentosServicoRange(
  filtros: FiltrosApontamentoServico
): Promise<ApontamentoServico[]> {
  const semFiltrosDeFuncionario =
    !filtros.funcionarioId && !filtros.equipeId && !filtros.obraId;

  // Caminho rápido: só período → busca direta, todos os apontamentos do range.
  if (semFiltrosDeFuncionario) {
    let q = supabase
      .from("apont_apontamentos_servico")
      .select("*")
      .gte("data", filtros.dataInicio)
      .lte("data", filtros.dataFim);
    if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
    q = q.order("data", { ascending: false }).order("created_at", { ascending: true });
    const { data: rows, error } = await q;
    throwIfError(error, "listApontamentosRange:all");
    return ((rows ?? []) as Row[]).map(rowToApont);
  }

  // Com filtros de obra/equipe/funcionário: resolve lista de funcionários antes.
  let funcsQuery = supabase
    .from("apont_funcionarios")
    .select("id, obra_id, equipe_id");
  if (filtros.funcionarioId) {
    funcsQuery = funcsQuery.eq("id", filtros.funcionarioId);
  } else {
    if (filtros.equipeId) funcsQuery = funcsQuery.eq("equipe_id", filtros.equipeId);
    if (filtros.obraId) funcsQuery = funcsQuery.eq("obra_id", filtros.obraId);
  }
  const { data: funcs, error: fe } = await funcsQuery;
  throwIfError(fe, "listApontamentosRange:funcs");
  const ids = (funcs ?? []).map((f) => (f as { id: string }).id);
  if (ids.length === 0) return [];

  let q = supabase
    .from("apont_apontamentos_servico")
    .select("*")
    .in("funcionario_id", ids)
    .gte("data", filtros.dataInicio)
    .lte("data", filtros.dataFim);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  q = q.order("data", { ascending: false }).order("created_at", { ascending: true });
  const { data: rows, error } = await q;
  throwIfError(error, "listApontamentosRange");
  return ((rows ?? []) as Row[]).map(rowToApont);
}

/** Lista todos os serviços (independente de obra) — usado p/ rótulos no histórico. */
export async function listTodosServicos(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("rodotracker_contract_items")
    .select("id, code, name, unit, obra_id");
  throwIfError(error, "listTodosServicos");
  return ((data ?? []) as { id: string; code: string | null; name: string; unit: string | null; obra_id: string | null }[]).map(
    (r) => ({ id: r.id, nome: r.name, codigo: r.code, unidade: r.unit, obraId: r.obra_id })
  );
}

/* ─── CRUD ─── */

/** Uma linha de serviço no lançamento (1 serviço + horas). */
export interface LinhaServico {
  servicoId: string | null;
  horas: number;
  tipo: TipoApontamento;
  motivoImprodutivo?: string | null;
  observacao?: string | null;
}

/**
 * Substitui todos os apontamentos do(s) funcionário(s) na data por um novo
 * conjunto de linhas. Garante "1 lançamento por pessoa por dia": cada pessoa
 * fica com exatamente as linhas passadas (apaga o resto).
 */
export async function replaceApontamentosDoDia(input: {
  funcionarioIds: string[];
  data: string;
  linhas: LinhaServico[];
}): Promise<void> {
  if (input.funcionarioIds.length === 0) return;

  // 1) apaga existentes
  const { error: delErr } = await supabase
    .from("apont_apontamentos_servico")
    .delete()
    .in("funcionario_id", input.funcionarioIds)
    .eq("data", input.data);
  throwIfError(delErr, "replace:delete");

  if (input.linhas.length === 0) return;

  // 2) insere as novas linhas (uma por funcionário × por linha)
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const rows: Record<string, unknown>[] = [];
  for (const fid of input.funcionarioIds) {
    for (const l of input.linhas) {
      rows.push({
        funcionario_id: fid,
        data: input.data,
        servico_id: l.tipo === "improdutivo" ? null : l.servicoId,
        estaca_inicial: null,
        estaca_final: null,
        lado: null,
        horas: l.horas,
        tipo: l.tipo,
        motivo_improdutivo:
          l.tipo === "improdutivo" ? l.motivoImprodutivo ?? null : null,
        observacao: l.observacao ?? null,
        registrado_por_id: userId,
      });
    }
  }
  const { error: insErr } = await supabase
    .from("apont_apontamentos_servico")
    .insert(rows);
  throwIfError(insErr, "replace:insert");
}

/**
 * Versão em lote por porcentagem: cada funcionário recebe a % de cada linha
 * aplicada sobre as horas reais DELE (horasPorFunc). Cada dia fecha 100%.
 * Substitui os apontamentos do dia (apaga e reinsere), igual replaceApontamentosDoDia.
 */
export async function replaceApontamentosDoDiaPorPct(input: {
  funcionarioIds: string[];
  data: string;
  linhas: LinhaServicoPct[];
  horasPorFunc: Record<string, number>;
}): Promise<void> {
  if (input.funcionarioIds.length === 0) return;

  const { error: delErr } = await supabase
    .from("apont_apontamentos_servico")
    .delete()
    .in("funcionario_id", input.funcionarioIds)
    .eq("data", input.data);
  throwIfError(delErr, "replacePct:delete");

  if (input.linhas.length === 0) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const rows = montarRowsApontamentoPorPct({
    funcionarioIds: input.funcionarioIds,
    data: input.data,
    linhas: input.linhas,
    horasPorFunc: input.horasPorFunc,
    registradoPorId: userId,
  });
  if (rows.length === 0) return;

  const { error: insErr } = await supabase
    .from("apont_apontamentos_servico")
    .insert(rows);
  throwIfError(insErr, "replacePct:insert");
}

export async function excluirLancamentoDoDia(
  funcionarioId: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from("apont_apontamentos_servico")
    .delete()
    .eq("funcionario_id", funcionarioId)
    .eq("data", data);
  throwIfError(error, "excluirLancamentoDoDia");
}

/** Apaga uma linha específica de apontamento de serviço (usado no Histórico). */
export async function excluirApontamentoServico(id: string): Promise<void> {
  const { error } = await supabase
    .from("apont_apontamentos_servico")
    .delete()
    .eq("id", id);
  throwIfError(error, "excluirApontamentoServico");
}

