// Import de peças (insumos de manutenção) em massa via Excel.
// Função pura de parse/validação usada pelo ImportPecasModal + ImportExcelModal genérico.

import { parseNumero, parseStr, type ParsedRow } from '../components/ui/ImportExcelModal';
import type { Insumo } from '../types';

// Ordem das colunas da planilha (índices de row[]).
const COL = {
  nome: 0, unidade: 1, sku: 2, ean: 3, fabricante: 4, partNumber: 5,
  estMin: 6, estMax: 7, leadTime: 8, equipamentos: 9, aplicacao: 10,
} as const;

export const TEMPLATE_PECAS = {
  headers: [
    'Nome', 'Unidade', 'SKU', 'EAN', 'Fabricante', 'Part number',
    'Estoque mínimo', 'Estoque máximo', 'Lead time (dias)',
    'Equipamentos compatíveis', 'Aplicação técnica',
  ],
  exemplo: [
    'Óleo Motor 15W40 SAE CJ-4', 'L', 'OL-15W40-CAT', '7891234567890', 'Caterpillar', '9X-7551',
    '4', '20', '7', 'Escavadeira Hidráulica, Caminhão Basculante', 'Intervalo 250h, cárter 13L',
  ],
  colWidths: [32, 8, 16, 16, 16, 16, 12, 12, 12, 32, 32],
};

export interface DedupCtx {
  skusExistentes: Set<string>;
  nomesExistentes: Set<string>;
  vistosNoArquivo: Set<string>;
}

export function criarDedupCtx(insumos: { codigoSku?: string | null; nome: string }[]): DedupCtx {
  const skusExistentes = new Set<string>();
  const nomesExistentes = new Set<string>();
  for (const i of insumos) {
    const sku = (i.codigoSku ?? '').trim().toLowerCase();
    if (sku) skusExistentes.add(sku);
    nomesExistentes.add((i.nome ?? '').trim().toLowerCase());
  }
  return { skusExistentes, nomesExistentes, vistosNoArquivo: new Set() };
}

function chaveDedup(nome: string, sku: string): string {
  return sku ? `sku:${sku.toLowerCase()}` : `nome:${nome.toLowerCase()}`;
}

export function parseRowPeca(row: unknown[], index: number, ctx: DedupCtx): ParsedRow {
  // Reseta o acumulador do arquivo a cada novo upload (o modal genérico
  // reindexa a partir de 0 em cada processamento de arquivo).
  if (index === 0) ctx.vistosNoArquivo.clear();

  const nome = parseStr(row[COL.nome]);
  const unidadeRaw = parseStr(row[COL.unidade]);
  const unidade = unidadeRaw || 'un';
  const codigoSku = parseStr(row[COL.sku]);
  const codigoEan = parseStr(row[COL.ean]);
  const fabricante = parseStr(row[COL.fabricante]);
  const codigoFabricante = parseStr(row[COL.partNumber]);
  const estoqueMinimo = parseNumero(row[COL.estMin]);
  const estoqueMaximo = parseNumero(row[COL.estMax]);
  const leadTimeDias = parseNumero(row[COL.leadTime]);
  const equipamentosCompativeis = parseStr(row[COL.equipamentos])
    .split(',').map((s) => s.trim()).filter(Boolean);
  const aplicacaoTecnica = parseStr(row[COL.aplicacao]);

  const erros: string[] = [];
  if (!nome) erros.push('Nome é obrigatório');

  if (nome) {
    const skuLower = codigoSku.toLowerCase();
    const nomeLower = nome.toLowerCase();
    const jaNoCatalogo = codigoSku
      ? ctx.skusExistentes.has(skuLower)
      : ctx.nomesExistentes.has(nomeLower);
    if (jaNoCatalogo) erros.push('Já existe no catálogo (SKU ou nome)');

    const chave = chaveDedup(nome, codigoSku);
    if (ctx.vistosNoArquivo.has(chave)) {
      erros.push('Linha repetida no arquivo');
    } else {
      ctx.vistosNoArquivo.add(chave);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    resumo: codigoSku ? `${nome} (${codigoSku})` : nome,
    dados: {
      nome, unidade, codigoSku, codigoEan, fabricante, codigoFabricante,
      estoqueMinimo, estoqueMaximo, leadTimeDias, equipamentosCompativeis, aplicacaoTecnica,
    },
  };
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function pecaRowToInsumo(dados: Record<string, unknown>, criadoPor: string): Insumo {
  return {
    id: gerarId(),
    nome: String(dados.nome ?? ''),
    tipo: 'peca',
    unidade: String(dados.unidade ?? 'un'),
    descricao: '',
    ativo: true,
    criadoPor,
    usadoEmManutencao: true,
    codigoSku: String(dados.codigoSku ?? ''),
    codigoEan: String(dados.codigoEan ?? ''),
    fabricante: String(dados.fabricante ?? ''),
    codigoFabricante: String(dados.codigoFabricante ?? ''),
    estoqueMinimo: (dados.estoqueMinimo as number | null) ?? null,
    estoqueMaximo: (dados.estoqueMaximo as number | null) ?? null,
    leadTimeDias: (dados.leadTimeDias as number | null) ?? null,
    equipamentosCompativeis: (dados.equipamentosCompativeis as string[]) ?? [],
    fotoUrl: '',
    aplicacaoTecnica: String(dados.aplicacaoTecnica ?? ''),
  };
}
