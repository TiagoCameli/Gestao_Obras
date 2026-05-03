import { Fragment, type ReactNode } from 'react';

export interface MarkdownDisplayProps {
  markdown: string;
  className?: string;
}

type Bloco =
  | { tipo: 'h2'; texto: string }
  | { tipo: 'h3'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; itens: string[] }
  | { tipo: 'paragrafo'; linhas: string[] };

function parseMarkdown(md: string): Bloco[] {
  const linhas = md.replace(/\r\n/g, '\n').split('\n');
  const blocos: Bloco[] = [];
  let buffer: string[] = [];
  let listaAtual: { ordenada: boolean; itens: string[] } | null = null;

  const flushParagrafo = () => {
    if (buffer.length > 0) {
      blocos.push({ tipo: 'paragrafo', linhas: buffer });
      buffer = [];
    }
  };

  const flushLista = () => {
    if (listaAtual && listaAtual.itens.length > 0) {
      blocos.push({ tipo: 'lista', ordenada: listaAtual.ordenada, itens: listaAtual.itens });
    }
    listaAtual = null;
  };

  for (const raw of linhas) {
    const linha = raw.trimEnd();

    if (linha.trim() === '') {
      flushParagrafo();
      flushLista();
      continue;
    }

    if (linha.startsWith('### ')) {
      flushParagrafo();
      flushLista();
      blocos.push({ tipo: 'h3', texto: linha.slice(4).trim() });
      continue;
    }

    if (linha.startsWith('## ')) {
      flushParagrafo();
      flushLista();
      blocos.push({ tipo: 'h2', texto: linha.slice(3).trim() });
      continue;
    }

    const itemNumerado = linha.match(/^\s*\d+\.\s+(.*)$/);
    if (itemNumerado) {
      flushParagrafo();
      if (!listaAtual || !listaAtual.ordenada) {
        flushLista();
        listaAtual = { ordenada: true, itens: [] };
      }
      listaAtual.itens.push(itemNumerado[1]);
      continue;
    }

    const itemBullet = linha.match(/^\s*[-*]\s+(.*)$/);
    if (itemBullet) {
      flushParagrafo();
      if (!listaAtual || listaAtual.ordenada) {
        flushLista();
        listaAtual = { ordenada: false, itens: [] };
      }
      listaAtual.itens.push(itemBullet[1]);
      continue;
    }

    flushLista();
    buffer.push(linha);
  }

  flushParagrafo();
  flushLista();

  return blocos;
}

/**
 * Aplica inlines de markdown — **bold**, *italic*, `code` — em uma string,
 * preservando ordem. Retorna ReactNode pronto pra render.
 *
 * Implementação simples: tokeniza por marcadores e monta árvore.
 */
function renderInline(texto: string): ReactNode {
  const out: ReactNode[] = [];
  // Padrão: bold (**...**), italic (*...*), code (`...`).
  // Bold antes de italic pra não capturar ** como dois italics.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > lastIndex) {
      out.push(texto.slice(lastIndex, m.index));
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      out.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded text-[0.85em] bg-[var(--color-surface-2)] font-mono"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < texto.length) {
    out.push(texto.slice(lastIndex));
  }
  return out.length === 1 ? out[0] : out;
}

export function MarkdownDisplay({ markdown, className = '' }: MarkdownDisplayProps) {
  if (!markdown.trim()) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Sem conteúdo.
      </p>
    );
  }

  const blocos = parseMarkdown(markdown);

  return (
    <div className={'flex flex-col gap-3 text-sm text-[var(--color-fg)] ' + className}>
      {blocos.map((b, i) => (
        <Fragment key={i}>
          {b.tipo === 'h2' && (
            <h3 className="text-base font-semibold text-[var(--color-fg)] mt-2">
              {renderInline(b.texto)}
            </h3>
          )}
          {b.tipo === 'h3' && (
            <h4 className="text-sm font-semibold text-[var(--color-fg-muted)] mt-1">
              {renderInline(b.texto)}
            </h4>
          )}
          {b.tipo === 'paragrafo' && (
            <p className="text-[var(--color-fg-muted)] leading-relaxed">
              {b.linhas.map((linha, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(linha)}
                </Fragment>
              ))}
            </p>
          )}
          {b.tipo === 'lista' && b.ordenada && (
            <ol className="list-decimal pl-5 space-y-1 text-[var(--color-fg-muted)]">
              {b.itens.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          )}
          {b.tipo === 'lista' && !b.ordenada && (
            <ul className="list-disc pl-5 space-y-1 text-[var(--color-fg-muted)]">
              {b.itens.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}

export default MarkdownDisplay;
