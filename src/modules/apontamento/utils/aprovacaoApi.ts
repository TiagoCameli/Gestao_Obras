import { supabase } from "../../../lib/supabase";

function throwIfError(error: unknown, ctx: string) {
  if (error) {
    const m = (error as { message?: string }).message ?? String(error);
    throw new Error(`[aprovacao:${ctx}] ${m}`);
  }
}

export interface AprovacaoFuncDia {
  funcionarioId: string;
  data: string;
  aprovadoEm: string;
  aprovadoPorId: string | null;
}

type Row = {
  funcionario_id: string;
  data: string;
  aprovado_em: string;
  aprovado_por_id: string | null;
};

function rowToAprov(r: Row): AprovacaoFuncDia {
  return {
    funcionarioId: r.funcionario_id,
    data: r.data,
    aprovadoEm: r.aprovado_em,
    aprovadoPorId: r.aprovado_por_id,
  };
}

/**
 * Lista todas as aprovações no intervalo. Usado pelo calendário pra
 * pintar dias com aprovação total/parcial/nenhuma.
 */
export async function listAprovacoesRange(
  dataInicio: string,
  dataFim: string
): Promise<AprovacaoFuncDia[]> {
  const { data, error } = await supabase
    .from("apont_aprovacao_funcionario_dia")
    .select("funcionario_id, data, aprovado_em, aprovado_por_id")
    .gte("data", dataInicio)
    .lte("data", dataFim);
  throwIfError(error, "listRange");
  return ((data ?? []) as Row[]).map(rowToAprov);
}

/** Aprova um funcionário em um dia específico (idempotente via upsert). */
export async function aprovarFuncionarioDia(
  funcionarioId: string,
  data: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const { error } = await supabase
    .from("apont_aprovacao_funcionario_dia")
    .upsert(
      {
        funcionario_id: funcionarioId,
        data,
        aprovado_em: new Date().toISOString(),
        aprovado_por_id: userId,
      },
      { onConflict: "funcionario_id,data" }
    );
  throwIfError(error, "aprovar");
}

/** Reverte aprovação. */
export async function desaprovarFuncionarioDia(
  funcionarioId: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from("apont_aprovacao_funcionario_dia")
    .delete()
    .eq("funcionario_id", funcionarioId)
    .eq("data", data);
  throwIfError(error, "desaprovar");
}

/**
 * Lista funcionários ativos opcionalmente filtrados por obra (via equipe ↔
 * obra através da junção apont_equipe_obras).
 *
 * Quando `obraId` é passado: traz só funcionários cuja equipe atende essa
 * obra (ou cujo `obra_id` direto coincide com a obra, retro-compat).
 */
export async function listFuncionariosParaAprovacao(
  obraId?: string
): Promise<{ id: string; nome: string; equipeId: string | null }[]> {
  if (!obraId) {
    const { data, error } = await supabase
      .from("apont_funcionarios")
      .select("id, nome, equipe_id")
      .eq("status", "ativo")
      .order("nome");
    throwIfError(error, "listFuncs:all");
    return (data ?? []).map(
      (r) =>
        ({
          id: (r as { id: string }).id,
          nome: (r as { nome: string }).nome,
          equipeId: (r as { equipe_id: string | null }).equipe_id,
        })
    );
  }

  // Equipes que atendem a obra (via junção)
  const { data: vinc, error: errV } = await supabase
    .from("apont_equipe_obras")
    .select("equipe_id")
    .eq("obra_id", obraId);
  throwIfError(errV, "listFuncs:vinc");
  const equipeIds = ((vinc ?? []) as { equipe_id: string }[]).map(
    (r) => r.equipe_id
  );

  // Funcionários ativos com equipe ∈ equipeIds OU obra_id direto = obraId
  let q = supabase
    .from("apont_funcionarios")
    .select("id, nome, equipe_id")
    .eq("status", "ativo")
    .order("nome");
  if (equipeIds.length > 0) {
    q = q.or(
      `equipe_id.in.(${equipeIds.join(",")}),obra_id.eq.${obraId}`
    );
  } else {
    q = q.eq("obra_id", obraId);
  }
  const { data, error } = await q;
  throwIfError(error, "listFuncs:byObra");
  return (data ?? []).map(
    (r) =>
      ({
        id: (r as { id: string }).id,
        nome: (r as { nome: string }).nome,
        equipeId: (r as { equipe_id: string | null }).equipe_id,
      })
  );
}
