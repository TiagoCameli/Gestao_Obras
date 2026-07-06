// Import de entradas de peças em estoque via Excel (várias NFs num arquivo).
// Funções puras de parse/validação usadas pelo ImportEntradasModal +
// ImportExcelModal genérico. Espelha o padrão do importPecasAlmoxarifado.ts.

import { parseData, parseNumero, parseStr, type ParsedRow } from '../components/ui/ImportExcelModal';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo } from '../types';

// Ordem das colunas da planilha (índices de row[]).
const COL = {
  deposito: 0, fornecedor: 1, notaFiscal: 2, data: 3,
  sku: 4, nome: 5, quantidade: 6, valorUnitario: 7,
} as const;

export const TEMPLATE_ENTRADAS_PECAS = {
  headers: [
    'Depósito', 'Fornecedor', 'Nota fiscal', 'Data',
    'SKU', 'Peça (nome)', 'Quantidade', 'Valor unitário',
  ],
  exemplo: [
    'Almoxarifado Central', 'Auto Peças Acre', '123456', '06/07/2026',
    'OL-15W40-CAT', 'Óleo Motor 15W40 SAE CJ-4', '20', '38,50',
  ],
  colWidths: [24, 24, 12, 12, 16, 32, 12, 14],
};

export interface EntradasImportCtx {
  depositosPorNome: Map<string, DepositoMaterial>;
  fornecedoresPorNome: Map<string, Fornecedor>;
  insumosPorSku: Map<string, Insumo>;
  insumosPorNome: Map<string, Insumo>;
  /** `${fornecedorId}|${nf lower}` das entradas já no banco (sem soft-deleted). */
  nfsLancadas: Set<string>;
  /** `${fornecedorId}|${nf lower}|${insumoId}` já vistos no arquivo atual. */
  vistosNoArquivo: Set<string>;
}

function chave(...partes: string[]): string {
  return partes.map((p) => p.trim().toLowerCase()).join('|');
}

export function criarEntradasCtx(
  insumos: Insumo[],
  depositos: DepositoMaterial[],
  fornecedores: Fornecedor[],
  entradas: EntradaMaterial[]
): EntradasImportCtx {
  const depositosPorNome = new Map<string, DepositoMaterial>();
  for (const d of depositos) {
    if (d.ativo) depositosPorNome.set(d.nome.trim().toLowerCase(), d);
  }

  const fornecedoresPorNome = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    if (f.ativo !== false) fornecedoresPorNome.set(f.nome.trim().toLowerCase(), f);
  }

  // Mesmo filtro do NovaEntradaModal: só peças ativas usadas em manutenção.
  const insumosPorSku = new Map<string, Insumo>();
  const insumosPorNome = new Map<string, Insumo>();
  for (const i of insumos) {
    if (!i.ativo || !i.usadoEmManutencao) continue;
    const sku = (i.codigoSku ?? '').trim().toLowerCase();
    if (sku) insumosPorSku.set(sku, i);
    insumosPorNome.set(i.nome.trim().toLowerCase(), i);
  }

  const nfsLancadas = new Set<string>();
  for (const e of entradas) {
    if (e.deletadoEm) continue;
    const nf = (e.notaFiscal ?? '').trim();
    if (nf) nfsLancadas.add(chave(e.fornecedorId, nf));
  }

  return {
    depositosPorNome, fornecedoresPorNome, insumosPorSku, insumosPorNome,
    nfsLancadas, vistosNoArquivo: new Set(),
  };
}

export function parseRowEntrada(row: unknown[], index: number, ctx: EntradasImportCtx): ParsedRow {
  // Reseta o acumulador do arquivo a cada novo upload (o modal genérico
  // reindexa a partir de 0 em cada processamento de arquivo).
  if (index === 0) ctx.vistosNoArquivo.clear();

  const depositoNome = parseStr(row[COL.deposito]);
  const fornecedorNome = parseStr(row[COL.fornecedor]);
  const notaFiscal = parseStr(row[COL.notaFiscal]);
  const data = parseData(row[COL.data]);
  const sku = parseStr(row[COL.sku]);
  const nome = parseStr(row[COL.nome]);
  const quantidade = parseNumero(row[COL.quantidade]);
  const valorUnitario = parseNumero(row[COL.valorUnitario]);

  const erros: string[] = [];

  const deposito = ctx.depositosPorNome.get(depositoNome.toLowerCase());
  if (!deposito) erros.push(`Depósito "${depositoNome}" não encontrado ou inativo`);

  const fornecedor = ctx.fornecedoresPorNome.get(fornecedorNome.toLowerCase());
  if (!fornecedor) erros.push(`Fornecedor "${fornecedorNome}" não encontrado ou inativo`);

  if (!notaFiscal) erros.push('Nota fiscal é obrigatória');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erros.push('Data inválida (use dd/mm/aaaa)');

  let insumo: Insumo | undefined;
  if (sku) {
    insumo = ctx.insumosPorSku.get(sku.toLowerCase());
    if (!insumo) erros.push(`SKU "${sku}" não encontrado no catálogo de peças`);
  } else if (nome) {
    insumo = ctx.insumosPorNome.get(nome.toLowerCase());
    if (!insumo) erros.push(`Peça "${nome}" não encontrada no catálogo`);
  } else {
    erros.push('Informe SKU ou nome da peça');
  }

  if (quantidade === null || quantidade <= 0) erros.push('Quantidade deve ser maior que zero');
  if (valorUnitario === null || valorUnitario < 0) erros.push('Valor unitário inválido');

  if (fornecedor && notaFiscal) {
    if (ctx.nfsLancadas.has(chave(fornecedor.id, notaFiscal))) {
      erros.push('NF já lançada para esse fornecedor');
    }
    if (insumo) {
      const k = chave(fornecedor.id, notaFiscal, insumo.id);
      if (ctx.vistosNoArquivo.has(k)) {
        erros.push('Peça repetida na mesma NF dentro do arquivo');
      } else {
        ctx.vistosNoArquivo.add(k);
      }
    }
  }

  const pecaLabel = insumo
    ? (insumo.codigoSku ? `${insumo.codigoSku} — ${insumo.nome}` : insumo.nome)
    : (sku || nome || '(sem peça)');

  return {
    valido: erros.length === 0,
    erros,
    resumo: `NF ${notaFiscal || '?'} · ${pecaLabel} · qtd ${quantidade ?? '?'}`,
    dados: {
      depositoId: deposito?.id ?? '',
      obraId: deposito?.obraId ?? '',
      fornecedorId: fornecedor?.id ?? '',
      notaFiscal,
      data,
      insumoId: insumo?.id ?? '',
      quantidade,
      valorUnitario,
    },
  };
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function entradaRowToEntradaMaterial(dados: Record<string, unknown>, criadoPor: string): EntradaMaterial {
  const quantidade = (dados.quantidade as number | null) ?? 0;
  const valorUnitario = (dados.valorUnitario as number | null) ?? 0;
  // Meio-dia local: o dia da planilha é o dia gravado/exibido (wall-clock),
  // serializado do mesmo jeito que o NovaEntradaModal (toISOString).
  const dataHora = new Date(`${String(dados.data)}T12:00:00`).toISOString();
  return {
    id: gerarId(),
    dataHora,
    depositoMaterialId: String(dados.depositoId ?? ''),
    insumoId: String(dados.insumoId ?? ''),
    obraId: String(dados.obraId ?? ''),
    quantidade,
    valorUnitario,
    valorTotal: quantidade * valorUnitario,
    fornecedorId: String(dados.fornecedorId ?? ''),
    notaFiscal: String(dados.notaFiscal ?? ''),
    observacoes: '',
    criadoPor,
  };
}
