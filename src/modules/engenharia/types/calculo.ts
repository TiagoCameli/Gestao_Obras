import type { AlertaLinha } from '../services/calcEngine';

export interface LinhaCalculo {
  id: string;
  /** Expressão completa digitada pelo usuário, ex: "1+1=2" ou "memória de cálculo". */
  expressao: string;
  /** Resultado calculado pela engine (stringificado). Null se LHS vazio/erro/sem `=`. */
  resultado: string | null;
  /** Estado atual da linha (recalculado on-render por parseLinha; persistido pra reabrir histórico). */
  alerta: AlertaLinha;
  /** Posição na lista. Inteiro 0-based; reordenar regenera. */
  ordem: number;
}

export interface DocumentoCalculo {
  linhas: LinhaCalculo[];
}

export interface EngenhariaCalculo {
  id: string;
  pastaId: string;
  titulo: string;
  documento: DocumentoCalculo;
  alertaAtivo: boolean;
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaCalculoRow {
  id: string;
  pasta_id: string;
  titulo: string;
  documento_json: DocumentoCalculo;
  alerta_ativo: boolean;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaCalculo(row: EngenhariaCalculoRow): EngenhariaCalculo {
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    documento: row.documento_json ?? { linhas: [] },
    alertaAtivo: row.alerta_ativo,
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaCalculoVersao {
  id: string;
  calculoId: string;
  versao: number;
  documento: DocumentoCalculo;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaCalculoVersaoRow {
  id: string;
  calculo_id: string;
  versao: number;
  documento_json: DocumentoCalculo;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaCalculoVersao(row: EngenhariaCalculoVersaoRow): EngenhariaCalculoVersao {
  return {
    id: row.id,
    calculoId: row.calculo_id,
    versao: row.versao,
    documento: row.documento_json ?? { linhas: [] },
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}

/** Linha vazia recém-criada (usado ao adicionar nova linha no canvas). */
export function novaLinhaVazia(ordem: number): LinhaCalculo {
  return {
    id: crypto.randomUUID(),
    expressao: '',
    resultado: null,
    alerta: 'vazio',
    ordem,
  };
}
