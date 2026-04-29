import { supabase } from "../../../lib/supabase";
import type { Equipe, Funcionario, Obra } from "../types/funcionario";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function throwIfError(error: unknown, ctx: string): void {
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    throw new Error(`[apontamento:${ctx}] ${msg}`);
  }
}

type FuncionarioRow = {
  id: string;
  nome: string;
  cpf: string;
  rg: string | null;
  pis: string | null;
  ctps: string | null;
  data_nascimento: string;
  foto_perfil: string | null;
  fotos_referencia_facial: string[];
  funcao: string;
  tipo_vinculo: string;
  salario_base: number | null;
  valor_diaria: number | null;
  valor_hora: number | null;
  obra_id: string | null;
  equipe_id: string | null;
  encarregado_id: string | null;
  data_admissao: string;
  data_demissao: string | null;
  status: string;
  contato_emergencia: string | null;
  permite_horas_extras: boolean;
  created_at: string;
  updated_at: string;
};

function rowToFuncionario(r: FuncionarioRow): Funcionario {
  return {
    id: r.id,
    nome: r.nome,
    cpf: r.cpf,
    rg: r.rg,
    pis: r.pis,
    ctps: r.ctps,
    dataNascimento: r.data_nascimento,
    fotoPerfil: r.foto_perfil,
    fotosReferenciaFacial: r.fotos_referencia_facial ?? [],
    funcao: r.funcao as Funcionario["funcao"],
    tipoVinculo: r.tipo_vinculo as Funcionario["tipoVinculo"],
    salarioBase: r.salario_base,
    valorDiaria: r.valor_diaria,
    valorHora: r.valor_hora,
    obraId: r.obra_id,
    equipeId: r.equipe_id,
    encarregadoId: r.encarregado_id,
    dataAdmissao: r.data_admissao,
    dataDemissao: r.data_demissao,
    status: r.status as Funcionario["status"],
    contatoEmergencia: r.contato_emergencia,
    permiteHorasExtras: r.permite_horas_extras,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function funcionarioToRow(
  f: Omit<Funcionario, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  }
): Partial<FuncionarioRow> {
  // Datas e CPF agora são opcionais no formulário — convertemos string vazia
  // para null pra não barrar inserts em colunas DATE.
  const emptyToNull = (s: string | null | undefined): string | null =>
    s && s.trim() !== "" ? s : null;
  return {
    id: f.id || undefined,
    nome: f.nome,
    cpf: emptyToNull(f.cpf) ?? "",
    rg: f.rg ?? null,
    pis: f.pis ?? null,
    ctps: f.ctps ?? null,
    data_nascimento: emptyToNull(f.dataNascimento) as string,
    foto_perfil: f.fotoPerfil ?? null,
    fotos_referencia_facial: f.fotosReferenciaFacial ?? [],
    funcao: f.funcao,
    tipo_vinculo: f.tipoVinculo,
    salario_base: f.salarioBase ?? null,
    valor_diaria: f.valorDiaria ?? null,
    valor_hora: f.valorHora ?? null,
    obra_id: f.obraId ?? null,
    equipe_id: f.equipeId ?? null,
    encarregado_id: f.encarregadoId ?? null,
    data_admissao: emptyToNull(f.dataAdmissao) as string,
    data_demissao: f.dataDemissao ?? null,
    status: f.status,
    contato_emergencia: f.contatoEmergencia ?? null,
    permite_horas_extras: f.permiteHorasExtras,
  };
}

/* ─── Funcionarios ────────────────────────────────────────────────────── */

export async function listFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase
    .from("apont_funcionarios")
    .select("*")
    .order("nome", { ascending: true });
  throwIfError(error, "listFuncionarios");
  return ((data ?? []) as FuncionarioRow[]).map(rowToFuncionario);
}

export async function getFuncionario(id: string): Promise<Funcionario | null> {
  const { data, error } = await supabase
    .from("apont_funcionarios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getFuncionario");
  return data ? rowToFuncionario(data as FuncionarioRow) : null;
}

export async function createFuncionario(
  f: Omit<Funcionario, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<Funcionario> {
  const row = funcionarioToRow(f as Funcionario);
  if (!f.id) delete row.id; // só strippa quando o caller deixou pro DB gerar
  const { data, error } = await supabase
    .from("apont_funcionarios")
    .insert(row)
    .select("*")
    .single();
  throwIfError(error, "createFuncionario");
  return rowToFuncionario(data as FuncionarioRow);
}

export async function updateFuncionario(f: Funcionario): Promise<Funcionario> {
  const row = funcionarioToRow(f);
  const { data, error } = await supabase
    .from("apont_funcionarios")
    .update(row)
    .eq("id", f.id)
    .select("*")
    .single();
  throwIfError(error, "updateFuncionario");
  return rowToFuncionario(data as FuncionarioRow);
}

export async function deleteFuncionario(id: string): Promise<void> {
  const { error } = await supabase
    .from("apont_funcionarios")
    .delete()
    .eq("id", id);
  throwIfError(error, "deleteFuncionario");
}

export async function existeCpf(
  cpf: string,
  excluirId?: string
): Promise<boolean> {
  let q = supabase
    .from("apont_funcionarios")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);
  if (excluirId) q = q.neq("id", excluirId);
  const { count, error } = await q;
  throwIfError(error, "existeCpf");
  return (count ?? 0) > 0;
}

/* ─── Obras (do módulo Medição: rodotracker_obras) ────────────────────── */

export async function listObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("rodotracker_obras")
    .select("id, name, lote, rodovia")
    .order("name");
  throwIfError(error, "listObras");
  return ((data ?? []) as { id: string; name: string; lote: string | null; rodovia: string | null }[]).map(
    (r) => ({ id: r.id, nome: r.name, lote: r.lote, rodovia: r.rodovia })
  );
}

/* ─── Equipes ─────────────────────────────────────────────────────────── */

type EquipeRow = {
  id: string;
  nome: string;
  obra_id: string;
  encarregado_id: string | null;
  ativo: boolean;
};

function rowToEquipe(r: EquipeRow): Equipe {
  return {
    id: r.id,
    nome: r.nome,
    obraId: r.obra_id,
    encarregadoId: r.encarregado_id,
    ativo: r.ativo,
  };
}

export async function listEquipes(obraId?: string): Promise<Equipe[]> {
  let q = supabase
    .from("apont_equipes")
    .select("id, nome, obra_id, encarregado_id, ativo")
    .order("nome");
  if (obraId) q = q.eq("obra_id", obraId);
  const { data, error } = await q;
  throwIfError(error, "listEquipes");
  return ((data ?? []) as EquipeRow[]).map(rowToEquipe);
}

export async function createEquipe(
  e: Omit<Equipe, "id" | "ativo"> & { ativo?: boolean }
): Promise<Equipe> {
  const { data, error } = await supabase
    .from("apont_equipes")
    .insert({
      nome: e.nome,
      obra_id: e.obraId,
      encarregado_id: e.encarregadoId ?? null,
      ativo: e.ativo ?? true,
    })
    .select("id, nome, obra_id, encarregado_id, ativo")
    .single();
  throwIfError(error, "createEquipe");
  return rowToEquipe(data as EquipeRow);
}

export async function updateEquipe(e: Equipe): Promise<Equipe> {
  const { data, error } = await supabase
    .from("apont_equipes")
    .update({
      nome: e.nome,
      obra_id: e.obraId,
      encarregado_id: e.encarregadoId ?? null,
      ativo: e.ativo,
    })
    .eq("id", e.id)
    .select("id, nome, obra_id, encarregado_id, ativo")
    .single();
  throwIfError(error, "updateEquipe");
  return rowToEquipe(data as EquipeRow);
}

export async function deleteEquipe(id: string): Promise<void> {
  const { error } = await supabase.from("apont_equipes").delete().eq("id", id);
  throwIfError(error, "deleteEquipe");
}

/* ─── Alocação de funcionários a equipe ──────────────────────────────── */

export async function alocarFuncionarios(
  funcionarioIds: string[],
  equipeId: string | null,
  obraId: string | null,
  encarregadoId: string | null = null
): Promise<void> {
  if (funcionarioIds.length === 0) return;
  const { error } = await supabase
    .from("apont_funcionarios")
    .update({
      equipe_id: equipeId,
      obra_id: obraId,
      encarregado_id: encarregadoId,
    })
    .in("id", funcionarioIds);
  throwIfError(error, "alocarFuncionarios");
}

/* ─── Storage de fotos ────────────────────────────────────────────────── */

const FOTO_BUCKET = "apontamento-fotos";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const ua = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) ua[i] = binary.charCodeAt(i);
  return new Blob([ua], { type: mime });
}

export async function uploadFoto(
  funcionarioId: string,
  kind: "perfil" | "referencia" | "rosto",
  index: number,
  dataUrl: string
): Promise<string> {
  const path = `${funcionarioId}/${kind}-${index}-${Date.now()}.jpg`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(FOTO_BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });
  throwIfError(error, `uploadFoto:${kind}`);
  return path;
}

export async function getFotoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(FOTO_BUCKET)
    .createSignedUrls(paths, 3600);
  throwIfError(error, "getFotoUrls");
  const out: Record<string, string> = {};
  (data ?? []).forEach((d, i) => {
    if (d?.signedUrl) out[paths[i]] = d.signedUrl;
  });
  return out;
}

export async function deleteFotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(FOTO_BUCKET).remove(paths);
  throwIfError(error, "deleteFotos");
}
