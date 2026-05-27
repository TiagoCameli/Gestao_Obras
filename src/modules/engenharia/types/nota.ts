export interface EngenhariaNota {
  id: string;
  pastaId: string;
  titulo: string;
  conteudoJson: unknown;  // Documento Tiptap (JSONContent do ProseMirror)
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaNotaRow {
  id: string;
  pasta_id: string;
  titulo: string;
  conteudo_json: unknown;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaNota(row: EngenhariaNotaRow): EngenhariaNota {
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    conteudoJson: row.conteudo_json,
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaNotaVersao {
  id: string;
  notaId: string;
  versao: number;
  conteudoJson: unknown;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaNotaVersaoRow {
  id: string;
  nota_id: string;
  versao: number;
  conteudo_json: unknown;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaNotaVersao(row: EngenhariaNotaVersaoRow): EngenhariaNotaVersao {
  return {
    id: row.id,
    notaId: row.nota_id,
    versao: row.versao,
    conteudoJson: row.conteudo_json,
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}
