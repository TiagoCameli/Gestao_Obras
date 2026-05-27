/**
 * Extrai texto puro de um documento ProseMirror (Tiptap JSON).
 *
 * Regras:
 * - Texto literal (`text`) é preservado.
 * - `hardBreak` vira `\n` (sem isto, quebras inline somem).
 * - Block-level nodes (paragraph, heading, codeBlock, listItem, taskItem,
 *   blockquote, tableRow) emitem `\n` no fim para preservar o boundary
 *   entre blocos no texto plano resultante.
 * - Espaços/tab consecutivos são colapsados em um único espaço, e
 *   sequências de 3+ newlines em apenas duas (para não inflar o diff).
 */
export function extrairTextoPlain(doc: unknown): string {
  const partes: string[] = [];
  walk(doc, partes);
  return partes.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as { type?: string; text?: string; content?: unknown[] };

  if (typeof n.text === 'string') {
    out.push(n.text);
    return;
  }

  if (n.type === 'hardBreak') {
    out.push('\n');
    return;
  }

  if (Array.isArray(n.content)) {
    for (const child of n.content) walk(child, out);
  }

  // Block-level nodes append a newline boundary so paragraph/heading/codeBlock breaks
  // são preservados. NÃO incluímos listItem/taskItem aqui porque o paragraph filho
  // já emite o \n — caso contrário cada item de lista contaria duas vezes.
  if (
    n.type === 'paragraph' ||
    n.type === 'heading' ||
    n.type === 'codeBlock' ||
    n.type === 'blockquote' ||
    n.type === 'tableRow'
  ) {
    out.push('\n');
  }
}
