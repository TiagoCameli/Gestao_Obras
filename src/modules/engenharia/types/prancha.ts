import type { LinhaCalculo } from './calculo';

export type FormaTipo = 'linha' | 'retangulo' | 'quadrado' | 'circulo';
export type ElementoTipo = 'texto' | 'calculo' | 'forma';

export interface PropsTexto { texto: string }
export interface PropsCalculo { linhas: LinhaCalculo[]; alertaAtivo: boolean }
export interface PropsForma { formaTipo: FormaTipo; cor: string; espessura: number }

export type ElementoProps = PropsTexto | PropsCalculo | PropsForma;

export interface ElementoPrancha {
  id: string;
  tipo: ElementoTipo;
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotacao: number;
  z: number;
  props: ElementoProps;
}

export interface Viewport { x: number; y: number; zoom: number }

export interface DocumentoPrancha {
  viewport: Viewport;
  elementos: ElementoPrancha[];
}

export interface EngenhariaPrancha {
  id: string;
  pastaId: string;
  titulo: string;
  documento: DocumentoPrancha;
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaPranchaRow {
  id: string;
  pasta_id: string;
  titulo: string;
  documento_json: DocumentoPrancha;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export const DOCUMENTO_VAZIO: DocumentoPrancha = { viewport: { x: 0, y: 0, zoom: 1 }, elementos: [] };

export function dbToEngenhariaPrancha(row: EngenhariaPranchaRow): EngenhariaPrancha {
  const doc = row.documento_json;
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    documento: doc && Array.isArray(doc.elementos) ? doc : { ...DOCUMENTO_VAZIO },
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaPranchaVersao {
  id: string;
  pranchaId: string;
  versao: number;
  documento: DocumentoPrancha;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaPranchaVersaoRow {
  id: string;
  prancha_id: string;
  versao: number;
  documento_json: DocumentoPrancha;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaPranchaVersao(row: EngenhariaPranchaVersaoRow): EngenhariaPranchaVersao {
  return {
    id: row.id,
    pranchaId: row.prancha_id,
    versao: row.versao,
    documento: row.documento_json && Array.isArray(row.documento_json.elementos) ? row.documento_json : { ...DOCUMENTO_VAZIO },
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}
