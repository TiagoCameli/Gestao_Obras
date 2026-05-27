/** Engenharia: tipo de pasta hierárquica (camelCase para o frontend). */
export type EngenhariaPastaTipo = 'obra' | 'avulsa' | 'subpasta';

export interface EngenhariaPasta {
  id: string;
  parentId: string | null;
  obraId: string | null;
  nome: string;
  tipo: EngenhariaPastaTipo;
  caminho: string;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

/** Row crua do Supabase (snake_case). */
export interface EngenhariaPastaRow {
  id: string;
  parent_id: string | null;
  obra_id: string | null;
  nome: string;
  tipo: EngenhariaPastaTipo;
  caminho: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaPasta(row: EngenhariaPastaRow): EngenhariaPasta {
  return {
    id: row.id,
    parentId: row.parent_id,
    obraId: row.obra_id,
    nome: row.nome,
    tipo: row.tipo,
    caminho: row.caminho,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}
