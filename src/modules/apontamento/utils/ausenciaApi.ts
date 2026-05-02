import { supabase } from "../../../lib/supabase";

export type TipoAusencia =
  | "falta_injustificada"
  | "falta_justificada"
  | "atestado"
  | "ferias"
  | "licenca"
  | "folga"
  | "abono";

export const TIPO_AUSENCIA_LABEL: Record<TipoAusencia, string> = {
  falta_injustificada: "Falta injustificada",
  falta_justificada:   "Falta justificada",
  atestado:            "Atestado médico",
  ferias:              "Férias",
  licenca:             "Licença",
  folga:               "Folga",
  abono:               "Abono",
};

export interface Ausencia {
  id: string;
  funcionarioId: string;
  dataInicio: string;   // YYYY-MM-DD
  dataFim: string;      // YYYY-MM-DD
  tipo: TipoAusencia;
  observacao: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  observacao: string | null;
  created_at: string;
};

function rowToAusencia(r: Row): Ausencia {
  return {
    id: r.id,
    funcionarioId: r.funcionario_id,
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    tipo: (r.tipo as TipoAusencia) ?? "falta_injustificada",
    observacao: r.observacao ?? null,
    createdAt: r.created_at,
  };
}

export async function listAusencias(filtros?: {
  funcionarioId?: string;
  inicio?: string;
  fim?: string;
}): Promise<Ausencia[]> {
  let q = supabase
    .from("apont_ausencias")
    .select("id, funcionario_id, data_inicio, data_fim, tipo, observacao, created_at")
    .order("data_inicio", { ascending: false });
  if (filtros?.funcionarioId) q = q.eq("funcionario_id", filtros.funcionarioId);
  if (filtros?.inicio) q = q.gte("data_fim", filtros.inicio);
  if (filtros?.fim) q = q.lte("data_inicio", filtros.fim);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAusencia);
}

export async function criarAusencia(input: {
  funcionarioId: string;
  dataInicio: string;
  dataFim: string;
  tipo: TipoAusencia;
  observacao?: string | null;
}): Promise<Ausencia> {
  const { data, error } = await supabase
    .from("apont_ausencias")
    .insert({
      funcionario_id: input.funcionarioId,
      data_inicio: input.dataInicio,
      data_fim: input.dataFim,
      tipo: input.tipo,
      observacao: input.observacao ?? null,
    })
    .select("id, funcionario_id, data_inicio, data_fim, tipo, observacao, created_at")
    .single();
  if (error) throw new Error(error.message);
  return rowToAusencia(data as Row);
}

export async function removerAusencia(id: string): Promise<void> {
  const { error } = await supabase
    .from("apont_ausencias")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
