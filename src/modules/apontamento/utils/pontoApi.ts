import { supabase } from "../../../lib/supabase";

export type TipoBatida =
  | "entrada"
  | "saida_almoco"
  | "retorno_almoco"
  | "saida_final";

export type StatusAprovacao =
  | "aprovado"
  | "pendente_aprovacao"
  | "rejeitado";

export interface RegistroPonto {
  id: string;
  funcionarioId: string;
  data: string; // YYYY-MM-DD
  tipoBatida: TipoBatida;
  hora: string; // ISO
  latitude: number | null;
  longitude: number | null;
  foto: string | null;
  origem: "automatico" | "manual";
  registradoPorId: string | null;
  aprovadoPorId: string | null;
  statusAprovacao: StatusAprovacao;
  motivoManual: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AprovacaoDia {
  id: string;
  equipeId: string;
  data: string;
  engenheiroId: string | null;
  aprovadoEm: string;
  observacao: string | null;
}

type Row = {
  id: string;
  funcionario_id: string;
  data: string;
  tipo_batida: string;
  hora: string;
  latitude: number | null;
  longitude: number | null;
  foto: string | null;
  origem: string;
  registrado_por_id: string | null;
  aprovado_por_id: string | null;
  status_aprovacao: string;
  motivo_manual: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRegistro(r: Row): RegistroPonto {
  return {
    id: r.id,
    funcionarioId: r.funcionario_id,
    data: r.data,
    tipoBatida: r.tipo_batida as TipoBatida,
    hora: r.hora,
    latitude: r.latitude,
    longitude: r.longitude,
    foto: r.foto,
    origem: r.origem as RegistroPonto["origem"],
    registradoPorId: r.registrado_por_id,
    aprovadoPorId: r.aprovado_por_id,
    statusAprovacao: r.status_aprovacao as StatusAprovacao,
    motivoManual: r.motivo_manual,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Erro elevado pelo trigger `fn_apont_validar_batida` no banco quando
 * uma das regras de negócio é violada (entrada duplicada, saída final
 * sem entrada, etc.). Usado pra UI mostrar a mensagem em português sem
 * prefixos técnicos.
 */
export class BatidaRegraError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BatidaRegraError';
    this.code = code;
  }
}

function throwIfError(error: unknown, ctx: string) {
  if (error) {
    // Erros do Postgres vêm com `code` (SQLState). Os códigos 23P01 e
    // 23P02 são os que definimos no trigger de validação de batida.
    const errObj = error as { code?: string; message?: string };
    const code = errObj.code ?? '';
    const m = errObj.message ?? String(error);
    if (code === '23P01' || code === '23P02') {
      throw new BatidaRegraError(code, m);
    }
    throw new Error(`[ponto:${ctx}] ${m}`);
  }
}

/**
 * Extrai mensagem amigável de qualquer erro vindo das funções deste
 * módulo. Para regras de negócio (BatidaRegraError ou mensagens que
 * sabidamente vêm do trigger), retorna a mensagem direta em português.
 * Para outros erros (rede, etc.), retorna "Falha ao registrar: <msg>".
 */
export function mensagemErroBatida(err: unknown): string {
  if (err instanceof BatidaRegraError) return err.message;
  const m = err instanceof Error ? err.message : String(err);
  // Fallback heurístico: se o servidor retornou a mensagem em texto sem
  // preservar o code (ex: PostgrestError sem `.code`), detecta nossa
  // assinatura em português pra evitar o prefixo técnico.
  if (/Já existe uma entrada|Já existe uma saída final|Não dá pra registrar saída final|Hora da saída final/i.test(m)) {
    return m.replace(/^\[ponto:[^\]]+\]\s*/, '');
  }
  return 'Falha ao registrar: ' + m;
}

/* ─── Storage ─── */

const BUCKET = "apontamento-fotos";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const ua = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) ua[i] = bin.charCodeAt(i);
  return new Blob([ua], { type: mime });
}

async function uploadFotoPonto(
  funcionarioId: string,
  registroId: string,
  dataUrl: string
): Promise<string> {
  const path = `ponto/${funcionarioId}/${registroId}.jpg`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });
  throwIfError(error, "uploadFotoPonto");
  return path;
}

export async function getFotoPontoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600);
  throwIfError(error, "getFotoPontoUrls");
  const out: Record<string, string> = {};
  (data ?? []).forEach((d, i) => {
    if (d?.signedUrl) out[paths[i]] = d.signedUrl;
  });
  return out;
}

/* ─── Registros ─── */

export async function listRegistrosDoDia(
  equipeId: string,
  data: string
): Promise<RegistroPonto[]> {
  // pega ids dos funcionários da equipe e busca as batidas do dia
  const { data: funcs, error: fe } = await supabase
    .from("apont_funcionarios")
    .select("id")
    .eq("equipe_id", equipeId);
  throwIfError(fe, "listRegistros:funcs");
  const ids = (funcs ?? []).map((f) => (f as { id: string }).id);
  if (ids.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("apont_registros_ponto")
    .select("*")
    .in("funcionario_id", ids)
    .eq("data", data)
    .order("hora", { ascending: true });
  throwIfError(error, "listRegistros:batidas");
  return ((rows ?? []) as Row[]).map(rowToRegistro);
}

/**
 * Lista batidas dentro de um intervalo, com filtros opcionais por obra/equipe/funcionário.
 * Usado pelo Dashboard e pela aba Histórico.
 */
export interface FiltrosPonto {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
  obraId?: string;
  equipeId?: string;
  funcionarioId?: string;
}

export async function listRegistrosPontoRange(
  filtros: FiltrosPonto
): Promise<RegistroPonto[]> {
  // Caminho rápido: nenhum filtro de obra/equipe/funcionário → busca direta
  // na tabela de batidas pelo período. Garante que TODOS os registros
  // existentes apareçam, mesmo de funcionários que foram realocados ou
  // não constam mais na lista filtrada de apont_funcionarios.
  const semFiltrosDeFuncionario =
    !filtros.funcionarioId && !filtros.equipeId && !filtros.obraId;

  if (semFiltrosDeFuncionario) {
    const { data: rows, error } = await supabase
      .from("apont_registros_ponto")
      .select("*")
      .gte("data", filtros.dataInicio)
      .lte("data", filtros.dataFim)
      .order("data", { ascending: false })
      .order("hora", { ascending: true });
    throwIfError(error, "listRegistrosRange:all");
    return ((rows ?? []) as Row[]).map(rowToRegistro);
  }

  // Caminho com filtros: resolve a lista de funcionários e busca por id.
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
  throwIfError(fe, "listRegistrosRange:funcs");
  const ids = (funcs ?? []).map((f) => (f as { id: string }).id);
  if (ids.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("apont_registros_ponto")
    .select("*")
    .in("funcionario_id", ids)
    .gte("data", filtros.dataInicio)
    .lte("data", filtros.dataFim)
    .order("data", { ascending: false })
    .order("hora", { ascending: true });
  throwIfError(error, "listRegistrosRange:batidas");
  return ((rows ?? []) as Row[]).map(rowToRegistro);
}

interface NovaBatidaInput {
  funcionarioId: string;
  tipoBatida: TipoBatida;
  data: string;
  hora?: string; // ISO; default = now
  latitude: number | null;
  longitude: number | null;
  fotoDataUrl?: string;
  origem?: "automatico" | "manual";
  motivoManual?: string;
  statusAprovacao?: StatusAprovacao;
}

export async function registrarBatida(
  input: NovaBatidaInput
): Promise<RegistroPonto> {
  const id = crypto.randomUUID();
  let fotoPath: string | null = null;
  if (input.fotoDataUrl) {
    fotoPath = await uploadFotoPonto(input.funcionarioId, id, input.fotoDataUrl);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from("apont_registros_ponto")
    .insert({
      id,
      funcionario_id: input.funcionarioId,
      data: input.data,
      tipo_batida: input.tipoBatida,
      hora: input.hora ?? new Date().toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      foto: fotoPath,
      origem: input.origem ?? "automatico",
      motivo_manual: input.motivoManual ?? null,
      status_aprovacao:
        input.statusAprovacao ??
        (input.origem === "manual" ? "pendente_aprovacao" : "aprovado"),
      registrado_por_id: userId,
    })
    .select("*")
    .single();
  throwIfError(error, "registrarBatida");
  return rowToRegistro(data as Row);
}

export async function aprovarBatidaManual(
  registroId: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const { error } = await supabase
    .from("apont_registros_ponto")
    .update({
      status_aprovacao: "aprovado",
      aprovado_por_id: userId,
    })
    .eq("id", registroId);
  throwIfError(error, "aprovarBatidaManual");
}

export async function rejeitarBatidaManual(
  registroId: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const { error } = await supabase
    .from("apont_registros_ponto")
    .update({
      status_aprovacao: "rejeitado",
      aprovado_por_id: userId,
    })
    .eq("id", registroId);
  throwIfError(error, "rejeitarBatidaManual");
}

export async function excluirBatida(registroId: string): Promise<void> {
  // tenta apagar foto vinculada (best-effort)
  const { data: row } = await supabase
    .from("apont_registros_ponto")
    .select("foto")
    .eq("id", registroId)
    .maybeSingle();
  const foto = (row as { foto: string | null } | null)?.foto;
  if (foto) {
    await supabase.storage.from(BUCKET).remove([foto]);
  }
  const { error } = await supabase
    .from("apont_registros_ponto")
    .delete()
    .eq("id", registroId);
  throwIfError(error, "excluirBatida");
}

export async function atualizarHoraBatida(
  registroId: string,
  novaHoraIso: string
): Promise<void> {
  const { error } = await supabase
    .from("apont_registros_ponto")
    .update({ hora: novaHoraIso })
    .eq("id", registroId);
  throwIfError(error, "atualizarHoraBatida");
}

/* ─── Aprovação de dia ─── */

export async function getAprovacaoDia(
  equipeId: string,
  data: string
): Promise<AprovacaoDia | null> {
  const { data: row, error } = await supabase
    .from("apont_aprovacoes_ponto_dia")
    .select("id, equipe_id, data, engenheiro_id, aprovado_em, observacao")
    .eq("equipe_id", equipeId)
    .eq("data", data)
    .maybeSingle();
  throwIfError(error, "getAprovacaoDia");
  if (!row) return null;
  const r = row as {
    id: string;
    equipe_id: string;
    data: string;
    engenheiro_id: string | null;
    aprovado_em: string;
    observacao: string | null;
  };
  return {
    id: r.id,
    equipeId: r.equipe_id,
    data: r.data,
    engenheiroId: r.engenheiro_id,
    aprovadoEm: r.aprovado_em,
    observacao: r.observacao,
  };
}

export async function aprovarPontoDia(
  equipeId: string,
  data: string,
  observacao?: string
): Promise<AprovacaoDia> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const { data: row, error } = await supabase
    .from("apont_aprovacoes_ponto_dia")
    .upsert(
      {
        equipe_id: equipeId,
        data,
        engenheiro_id: userId,
        aprovado_em: new Date().toISOString(),
        observacao: observacao ?? null,
      },
      { onConflict: "equipe_id,data" }
    )
    .select("id, equipe_id, data, engenheiro_id, aprovado_em, observacao")
    .single();
  throwIfError(error, "aprovarPontoDia");
  const r = row as {
    id: string;
    equipe_id: string;
    data: string;
    engenheiro_id: string | null;
    aprovado_em: string;
    observacao: string | null;
  };
  return {
    id: r.id,
    equipeId: r.equipe_id,
    data: r.data,
    engenheiroId: r.engenheiro_id,
    aprovadoEm: r.aprovado_em,
    observacao: r.observacao,
  };
}

export async function reabrirPontoDia(
  equipeId: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from("apont_aprovacoes_ponto_dia")
    .delete()
    .eq("equipe_id", equipeId)
    .eq("data", data);
  throwIfError(error, "reabrirPontoDia");
}

/* ─── Pendências de saída ─── */

export interface PendenciaSaida {
  funcionarioId: string;
  data: string;
  entradaHora: string; // ISO
}

/**
 * Lista funcionários da equipe que registraram entrada mas não registraram
 * saída final, dentro dos últimos `dias` dias. Útil pra detectar pontos em
 * aberto / esquecidos.
 */
export async function listPendenciasSaida(
  equipeId: string,
  dias = 30
): Promise<PendenciaSaida[]> {
  const { data: funcs, error: fe } = await supabase
    .from("apont_funcionarios")
    .select("id")
    .eq("equipe_id", equipeId);
  throwIfError(fe, "listPendencias:funcs");
  const ids = (funcs ?? []).map((f) => (f as { id: string }).id);
  if (ids.length === 0) return [];

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeIso = desde.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("apont_registros_ponto")
    .select("funcionario_id, data, tipo_batida, hora, status_aprovacao")
    .in("funcionario_id", ids)
    .gte("data", desdeIso)
    .neq("status_aprovacao", "rejeitado")
    .order("hora", { ascending: true });
  throwIfError(error, "listPendencias:registros");

  const porChave = new Map<
    string,
    { entrada?: string; saida?: boolean; funcionarioId: string; data: string }
  >();
  for (const r of (rows ?? []) as {
    funcionario_id: string;
    data: string;
    tipo_batida: string;
    hora: string;
  }[]) {
    const key = `${r.funcionario_id}:${r.data}`;
    let cur = porChave.get(key);
    if (!cur) {
      cur = { funcionarioId: r.funcionario_id, data: r.data };
      porChave.set(key, cur);
    }
    if (r.tipo_batida === "entrada" && !cur.entrada) cur.entrada = r.hora;
    if (r.tipo_batida === "saida_final") cur.saida = true;
  }

  return [...porChave.values()]
    .filter((c) => c.entrada && !c.saida)
    .map((c) => ({
      funcionarioId: c.funcionarioId,
      data: c.data,
      entradaHora: c.entrada!,
    }))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
