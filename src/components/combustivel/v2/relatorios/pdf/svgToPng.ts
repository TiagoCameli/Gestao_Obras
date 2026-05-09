// Converte um <svg> live (Recharts) num PNG dataURL pra embed em PDF.
//
// Por que não capturar o DOM via html2canvas? Charts são SVG puro; o caminho
// SVG → Image → Canvas é nativo, sem deps extras e mais rápido.
//
// Armadilhas que esta função resolve:
//   1) Recharts usa fill="var(--color-accent)" como atributo SVG. Quando o
//      SVG é serializado e carregado num <img>, ele roda em contexto isolado
//      sem acesso às CSS vars da página. Solução: snapshot das CSS vars
//      relevantes do :root e injeção como <style>:root{...}</style> dentro
//      do SVG clonado.
//   2) Fontes web (Inter) podem não estar disponíveis no contexto do <img>;
//      `await document.fonts.ready` antes do clone garante que o estado
//      computado da fonte na página esteja final, e fallback pra system fonts
//      no SVG via font-family explícito mantém legibilidade.
//   3) PDF a 1x fica borrado no zoom; canvas em 2x DPI (via ctx.scale)
//      gera PNG nítido. Penalty de tamanho de arquivo é aceitável.

const CSS_VARS_TO_INLINE = [
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-soft',
  '--color-accent-fg',
  '--color-fg',
  '--color-fg-muted',
  '--color-fg-subtle',
  '--color-surface-1',
  '--color-surface-2',
  '--color-border',
  '--color-border-strong',
  '--color-success',
  '--color-success-fg',
  '--color-danger',
  '--color-warning',
  '--color-info',
  '--font-sans',
];

// Fallback "system stack" pro SVG quando Inter não está disponível no
// contexto isolado do <img>. Linha 1 vem antes pra cobrir macOS/iOS bonito.
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface Options {
  /** DPI multiplier (2 = retina). Default 2 — 1x fica borrado em PDF. */
  dpi?: number;
  /** Cor de fundo do canvas. Default branco — sem isso PDF mostra preto. */
  backgroundColor?: string;
}

/**
 * Captura um elemento SVG da página e devolve um PNG dataURL pronto pra
 * `doc.addImage(...)` do jsPDF.
 *
 * IMPORTANTE: o SVG precisa estar montado no DOM (visível ou off-screen) —
 * não funciona com elementos detached, porque `getComputedStyle` vai retornar
 * vazios e as CSS vars não vão resolver.
 */
export async function svgElementToPngDataUrl(
  svg: SVGElement,
  widthOpt: number | 'auto',
  heightOpt: number | 'auto',
  options: Options = {},
): Promise<string> {
  // Auto-detect dims via getBoundingClientRect quando 'auto' — útil pra
  // capturar SVG dentro de ChartCard (que adiciona padding/header) sem
  // precisar saber o resultado final na chamada.
  const rect = svg.getBoundingClientRect();
  const width = widthOpt === 'auto' ? Math.round(rect.width) : widthOpt;
  const height = heightOpt === 'auto' ? Math.round(rect.height) : heightOpt;
  if (width <= 0 || height <= 0) {
    throw new Error(`SVG capture: dimensões inválidas (${width}×${height})`);
  }
  const dpi = options.dpi ?? 2;
  const bg = options.backgroundColor ?? '#ffffff';

  // 1) Aguarda fontes prontas — caso contrário SVG renderiza com fallback.
  if (typeof document.fonts?.ready === 'object' && 'then' in document.fonts.ready) {
    await document.fonts.ready;
  }

  // 2) Snapshot das CSS vars relevantes do :root.
  const rootStyle = window.getComputedStyle(document.documentElement);
  const inlinedVars: string[] = [];
  for (const v of CSS_VARS_TO_INLINE) {
    const val = rootStyle.getPropertyValue(v).trim();
    if (val) inlinedVars.push(`${v}: ${val}`);
  }

  // 3) Clone + size explícito + xmlns garantido.
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // Recharts pode emitir width/height inline em px no <svg>; sobrescreve.
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  // 4) Injeta <style>:root{...}</style> com vars resolvidas e font fallback.
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    :root { ${inlinedVars.join('; ')} }
    text, tspan { font-family: ${SYSTEM_FONT_STACK}; }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  // 5) Serializa e carrega via blob URL (mais robusto que data:base64).
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.decoding = 'async';
    // Timeout de safety: regressões silenciosas no Recharts/browser podem
    // fazer img.onload nunca disparar (e onerror também não em alguns
    // casos), travando o modal indefinidamente. 5s é generoso pra um
    // SVG inline.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SVG load timeout (5s)')), 5000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('SVG image load failed')); };
      img.src = url;
    });

    // 6) Render no canvas em 2x DPI (logical w/h × dpi pra physical pixels).
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpi);
    canvas.height = Math.round(height * dpi);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.scale(dpi, dpi);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
