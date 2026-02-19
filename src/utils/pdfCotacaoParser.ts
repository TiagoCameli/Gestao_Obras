import * as pdfjsLib from 'pdfjs-dist';
import type { ItemPedidoCompra } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfItemResult {
  precoUnitario: number;
  matched: boolean;
  confidence: 'alta' | 'media' | 'baixa' | 'nenhuma';
}

export interface PdfParseResult {
  precos: PdfItemResult[];
  condicaoPagamento: string;
  prazoEntrega: string;
  textoExtraido: boolean;
}

/** Extract all text from a PDF file */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n');
}

/** Strip accents only (keep case and length intact for position mapping) */
function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Get significant words (length >= 2) from a description */
function getSearchWords(descricao: string): string[] {
  return stripAccents(descricao)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 2);
}

/** Find all positions of a word in text (case/accent insensitive) */
function findWordPositions(text: string, word: string): number[] {
  const lowerText = stripAccents(text).toLowerCase();
  const positions: number[] = [];
  let idx = lowerText.indexOf(word);
  while (idx !== -1) {
    positions.push(idx);
    idx = lowerText.indexOf(word, idx + 1);
  }
  return positions;
}

/**
 * For a given item, find the best cluster position in the text
 * where the item's words appear close together.
 * Returns { position, recall } or null.
 */
function findBestCluster(
  text: string,
  words: string[]
): { position: number; recall: number } | null {
  if (words.length === 0) return null;

  // Find positions of each word in the text
  const wordPositionsMap = new Map<string, number[]>();
  for (const word of words) {
    const positions = findWordPositions(text, word);
    if (positions.length > 0) {
      wordPositionsMap.set(word, positions);
    }
  }

  const matchedCount = wordPositionsMap.size;
  if (matchedCount === 0) return null;

  const recall = matchedCount / words.length;

  // If only one word matched, return its first position
  if (wordPositionsMap.size === 1) {
    const pos = [...wordPositionsMap.values()][0][0];
    return { position: pos, recall };
  }

  // Find the cluster: for each occurrence of the first matched word,
  // count how many other words appear within 200 chars
  let bestPos = 0;
  let bestNearby = 0;

  for (const [, positions] of wordPositionsMap) {
    for (const anchorPos of positions) {
      let nearby = 0;
      for (const [otherWord, otherPositions] of wordPositionsMap) {
        if (otherPositions === positions && otherWord === [...wordPositionsMap.keys()][0]) {
          nearby++; // count anchor word itself
          continue;
        }
        for (const op of otherPositions) {
          if (Math.abs(op - anchorPos) < 200) {
            nearby++;
            break;
          }
        }
      }
      if (nearby > bestNearby) {
        bestNearby = nearby;
        bestPos = anchorPos;
      }
    }
  }

  return { position: bestPos, recall };
}

/** Extract BR prices from a text region */
function extractPrices(region: string): number[] {
  const priceRegex = /R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  const prices: number[] = [];
  let match;
  while ((match = priceRegex.exec(region)) !== null) {
    const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    if (value > 0) prices.push(value);
  }
  return prices;
}

function getConfidence(recall: number): PdfItemResult['confidence'] {
  if (recall >= 0.8) return 'alta';
  if (recall >= 0.5) return 'media';
  if (recall > 0) return 'baixa';
  return 'nenhuma';
}

/** Search for a field value using lowercase search (preserves position mapping) */
function findFieldValue(text: string, keywords: string[]): string {
  const lowerText = stripAccents(text).toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = stripAccents(keyword).toLowerCase();
    const idx = lowerText.indexOf(lowerKeyword);
    if (idx === -1) continue;

    // Extract from original text after the keyword
    const afterStart = idx + lowerKeyword.length;
    const afterEnd = Math.min(text.length, afterStart + 120);
    const after = text.substring(afterStart, afterEnd).trim();

    // Clean: remove leading colons/dashes, take until next field boundary
    const cleaned = after
      .replace(/^[:\s\-–]+/, '')
      .split(/[;\n]|\s{2,}|\b(?:prazo|condi[çc][ãa]o|forma|validade|itens|obs|total|fone|email|cnpj)/i)[0]
      ?.trim();

    if (cleaned && cleaned.length > 1 && cleaned.length < 80) {
      return cleaned;
    }
  }

  return '';
}

/** Main: parse a PDF and match against cotacao items */
export async function parsePdfForCotacao(
  file: File,
  itens: ItemPedidoCompra[]
): Promise<PdfParseResult> {
  const fullText = await extractTextFromPdf(file);

  if (!fullText.trim()) {
    return {
      precos: itens.map(() => ({ precoUnitario: 0, matched: false, confidence: 'nenhuma' })),
      condicaoPagamento: '',
      prazoEntrega: '',
      textoExtraido: false,
    };
  }

  const precos: PdfItemResult[] = itens.map((item) => {
    const words = getSearchWords(item.descricao);
    if (words.length === 0) {
      return { precoUnitario: 0, matched: false, confidence: 'nenhuma' as const };
    }

    const cluster = findBestCluster(fullText, words);
    if (!cluster) {
      return { precoUnitario: 0, matched: false, confidence: 'nenhuma' as const };
    }

    const confidence = getConfidence(cluster.recall);

    // Search for prices AFTER the cluster position (price follows description)
    const searchStart = cluster.position;
    const searchEnd = Math.min(fullText.length, cluster.position + 250);
    const region = fullText.substring(searchStart, searchEnd);
    const prices = extractPrices(region);

    if (prices.length > 0) {
      return { precoUnitario: prices[0], matched: true, confidence };
    }

    return { precoUnitario: 0, matched: false, confidence };
  });

  const condicaoPagamento = findFieldValue(fullText, [
    'condição de pagamento',
    'condicao de pagamento',
    'condição pagamento',
    'cond. pagamento',
    'cond. pgto',
    'forma de pagamento',
  ]);

  const prazoEntrega = findFieldValue(fullText, [
    'prazo de entrega',
    'prazo entrega',
    'prazo',
  ]);

  return {
    precos,
    condicaoPagamento,
    prazoEntrega,
    textoExtraido: true,
  };
}
