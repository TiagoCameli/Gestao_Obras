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
  cpf: string | null;
  rg: string | null;
  pis: string | null;
  ctps: string | null;
  data_nascimento: string | null;
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
  data_admissao: string | null;
  data_demissao: string | null;
  status: string;
  contato_emergencia: string | null;
  permite_horas_extras: boolean;
  documentos: Funcionario["documentos"] | null;
  created_at: string;
  updated_at: string;
};

function rowToFuncionario(r: FuncionarioRow): Funcionario {
  return {
    id: r.id,
    nome: r.nome,
    cpf: r.cpf ?? "",
    rg: r.rg,
    pis: r.pis,
    ctps: r.ctps,
    dataNascimento: r.data_nascimento ?? "",
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
    dataAdmissao: r.data_admissao ?? "",
    dataDemissao: r.data_demissao,
    status: r.status as Funcionario["status"],
    contatoEmergencia: r.contato_emergencia,
    permiteHorasExtras: r.permite_horas_extras,
    documentos: r.documentos ?? [],
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
    cpf: emptyToNull(f.cpf),
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
    documentos: (f.documentos ?? []) as unknown as Funcionario["documentos"] | null,
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

/**
 * Lista obras do cadastros (master `obras`) que estão em andamento
 * ou em planejamento. Faz LEFT JOIN com `rodotracker_obras` para
 * trazer lote/rodovia quando disponíveis.
 */
export async function listObras(): Promise<Obra[]> {
  const { data: master, error: errM } = await supabase
    .from("obras")
    .select("id, nome, status")
    .in("status", ["planejamento", "em_andamento"])
    .order("nome");
  throwIfError(errM, "listObras:master");

  // Carrega geo das que tiverem extensão (todas, em batch)
  const { data: ext, error: errE } = await supabase
    .from("rodotracker_obras")
    .select("id, lote, rodovia");
  throwIfError(errE, "listObras:ext");

  const extById = new Map<string, { lote: string | null; rodovia: string | null }>();
  for (const r of (ext ?? []) as { id: string; lote: string | null; rodovia: string | null }[]) {
    extById.set(r.id, { lote: r.lote, rodovia: r.rodovia });
  }

  return ((master ?? []) as { id: string; nome: string; status: string }[]).map((m) => {
    const e = extById.get(m.id);
    return {
      id: m.id,
      nome: m.nome,
      lote: e?.lote ?? null,
      rodovia: e?.rodovia ?? null,
    };
  });
}

/* ─── Equipes ─────────────────────────────────────────────────────────── */

type EquipeRow = {
  id: string;
  nome: string;
  obra_id: string | null;
  encarregado_id: string | null;
  ativo: boolean;
};

type EquipeObraRow = { equipe_id: string; obra_id: string };

/** Lista equipes; quando `obraId` é passado, devolve só as que servem essa obra. */
export async function listEquipes(obraId?: string): Promise<Equipe[]> {
  // 1) Carrega todas as equipes (master)
  const { data: equipes, error: errE } = await supabase
    .from("apont_equipes")
    .select("id, nome, obra_id, encarregado_id, ativo")
    .order("nome");
  throwIfError(errE, "listEquipes:master");

  // 2) Carrega o vínculo equipe ↔ obras
  const { data: vinc, error: errV } = await supabase
    .from("apont_equipe_obras")
    .select("equipe_id, obra_id");
  throwIfError(errV, "listEquipes:obras");

  const obrasPorEquipe = new Map<string, string[]>();
  for (const v of (vinc ?? []) as EquipeObraRow[]) {
    const arr = obrasPorEquipe.get(v.equipe_id) ?? [];
    arr.push(v.obra_id);
    obrasPorEquipe.set(v.equipe_id, arr);
  }

  // 3) Compõe + filtra
  return ((equipes ?? []) as EquipeRow[])
    .map((r): Equipe => {
      const obraIds = obrasPorEquipe.get(r.id) ?? (r.obra_id ? [r.obra_id] : []);
      return {
        id: r.id,
        nome: r.nome,
        obraIds,
        obraId: obraIds[0] ?? r.obra_id ?? null,
        encarregadoId: r.encarregado_id,
        ativo: r.ativo,
      };
    })
    .filter((e) => !obraId || e.obraIds.includes(obraId));
}

async function syncEquipeObras(equipeId: string, obraIds: string[]): Promise<void> {
  // Remove tudo e re-insere — payload é pequeno (poucas obras por equipe).
  const { error: delErr } = await supabase
    .from("apont_equipe_obras")
    .delete()
    .eq("equipe_id", equipeId);
  throwIfError(delErr, "syncEquipeObras:delete");
  if (obraIds.length === 0) return;
  const rows = obraIds.map((oid) => ({ equipe_id: equipeId, obra_id: oid }));
  const { error: insErr } = await supabase.from("apont_equipe_obras").insert(rows);
  throwIfError(insErr, "syncEquipeObras:insert");
}

export async function createEquipe(
  e: Omit<Equipe, "id" | "ativo" | "obraId"> & { ativo?: boolean }
): Promise<Equipe> {
  const obraIds = e.obraIds ?? [];
  const obraPrincipal = obraIds[0] ?? null;
  const { data, error } = await supabase
    .from("apont_equipes")
    .insert({
      nome: e.nome,
      obra_id: obraPrincipal,
      encarregado_id: e.encarregadoId ?? null,
      ativo: e.ativo ?? true,
    })
    .select("id, nome, obra_id, encarregado_id, ativo")
    .single();
  throwIfError(error, "createEquipe");
  const row = data as EquipeRow;
  await syncEquipeObras(row.id, obraIds);
  return {
    id: row.id,
    nome: row.nome,
    obraIds,
    obraId: obraPrincipal,
    encarregadoId: row.encarregado_id,
    ativo: row.ativo,
  };
}

export async function updateEquipe(e: Equipe): Promise<Equipe> {
  const obraIds = e.obraIds ?? [];
  const obraPrincipal = obraIds[0] ?? null;
  const { data, error } = await supabase
    .from("apont_equipes")
    .update({
      nome: e.nome,
      obra_id: obraPrincipal,
      encarregado_id: e.encarregadoId ?? null,
      ativo: e.ativo,
    })
    .eq("id", e.id)
    .select("id, nome, obra_id, encarregado_id, ativo")
    .single();
  throwIfError(error, "updateEquipe");
  const row = data as EquipeRow;
  await syncEquipeObras(row.id, obraIds);
  return {
    id: row.id,
    nome: row.nome,
    obraIds,
    obraId: obraPrincipal,
    encarregadoId: row.encarregado_id,
    ativo: row.ativo,
  };
}

export async function deleteEquipe(id: string): Promise<void> {
  // CASCADE de apont_equipe_obras já apaga os vínculos automaticamente.
  const { error } = await supabase.from("apont_equipes").delete().eq("id", id);
  throwIfError(error, "deleteEquipe");
}

/**
 * Transfere uma equipe de uma obra para outra.
 *  - Se a equipe não estiver na origem, retorna sem alterar nada.
 *  - Adiciona a obra de destino ao conjunto se ainda não estiver.
 *  - Quando `removerOrigem` (default: true), remove a obra de origem.
 *  - Atualiza também os funcionários da equipe que estão alocados na origem.
 */
export async function transferirEquipeObra(
  equipeId: string,
  obraOrigemId: string,
  obraDestinoId: string,
  removerOrigem: boolean = true
): Promise<void> {
  // Adiciona destino (idempotente)
  const { error: insErr } = await supabase
    .from("apont_equipe_obras")
    .upsert({ equipe_id: equipeId, obra_id: obraDestinoId }, { onConflict: "equipe_id,obra_id" });
  throwIfError(insErr, "transferirEquipeObra:insert");

  if (removerOrigem) {
    const { error: delErr } = await supabase
      .from("apont_equipe_obras")
      .delete()
      .eq("equipe_id", equipeId)
      .eq("obra_id", obraOrigemId);
    throwIfError(delErr, "transferirEquipeObra:delete");
  }

  // Atualiza obra "principal" da equipe = destino
  const { error: updEqErr } = await supabase
    .from("apont_equipes")
    .update({ obra_id: obraDestinoId })
    .eq("id", equipeId);
  throwIfError(updEqErr, "transferirEquipeObra:equipe");

  // Move funcionários alocados na obra de origem para a obra de destino.
  const { error: updFuncErr } = await supabase
    .from("apont_funcionarios")
    .update({ obra_id: obraDestinoId })
    .eq("equipe_id", equipeId)
    .eq("obra_id", obraOrigemId);
  throwIfError(updFuncErr, "transferirEquipeObra:funcionarios");
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

/* ─── Storage de documentos do funcionário ──────────────────────────── */
/* Aceita qualquer extensão. Reaproveita o bucket `apontamento-fotos` numa
 * pasta `documentos/<funcionarioId>/...`. Mantém os metadados (nome, MIME,
 * tamanho) na coluna `documentos` (jsonb) do banco. */

export async function uploadDocumento(
  funcionarioId: string,
  file: File
): Promise<string> {
  // Sanitiza o nome para o path: remove acentos e caracteres especiais.
  const safeName = file.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
  const path = `documentos/${funcionarioId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(FOTO_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  throwIfError(error, "uploadDocumento");
  return path;
}

export async function getDocumentoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(FOTO_BUCKET)
    .createSignedUrls(paths, 3600);
  throwIfError(error, "getDocumentoUrls");
  const out: Record<string, string> = {};
  (data ?? []).forEach((d, i) => {
    if (d?.signedUrl) out[paths[i]] = d.signedUrl;
  });
  return out;
}

export async function deleteDocumentos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(FOTO_BUCKET).remove(paths);
  throwIfError(error, "deleteDocumentos");
}
