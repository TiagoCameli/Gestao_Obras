// Theme dos gráficos — paleta categórica, cores semânticas, e config
// padrão de eixo/grid pra todos os Recharts ficarem coerentes.
//
// Cores via CSS vars — todas resolvidas em runtime, então funcionam
// em light/dark sem trocar componente.

/** Paleta categórica neutra+marca (10 cores). Verde EMT como primeira. */
export const CHART_PALETTE = [
  'var(--color-accent)',           // verde EMT
  '#2563EB',                       // azul info
  '#E89B17',                       // âmbar (accent secundário do projeto)
  '#9333EA',                       // roxo
  '#DC2626',                       // vermelho
  '#0891B2',                       // ciano
  '#65A30D',                       // verde lima
  '#DB2777',                       // rosa
  '#7C3AED',                       // violeta
  '#EA580C',                       // laranja
] as const;

/** Cores semânticas pra tipos de combustível (estável entre gráficos). */
export const COMBUSTIVEL_PALETTE: Record<string, string> = {
  // chave por nome do insumo (lowercase) — match parcial
  'diesel s10': '#2563EB',
  'diesel s500': '#1E40AF',
  'diesel': '#2563EB',
  'gasolina': '#FDB933',
  'gasolina comum': '#FDB933',
  'arla 32': '#9333EA',
  'arla': '#9333EA',
  'etanol': '#65A30D',
};

/** Resolve cor de combustível por nome (fallback paleta categórica). */
export function corCombustivel(nome: string, fallbackIndex = 0): string {
  const key = (nome ?? '').toLowerCase().trim();
  if (COMBUSTIVEL_PALETTE[key]) return COMBUSTIVEL_PALETTE[key]!;
  // Match parcial pra "Diesel S10 (BR)" etc.
  for (const k of Object.keys(COMBUSTIVEL_PALETTE)) {
    if (key.includes(k)) return COMBUSTIVEL_PALETTE[k]!;
  }
  return CHART_PALETTE[fallbackIndex % CHART_PALETTE.length]!;
}

/** Eixo/grid padrão pros Recharts. */
export const AXIS_STYLE = {
  fontSize: 11,
  fill: 'var(--color-fg-muted)',
  fontFamily: 'var(--font-sans)',
};

export const GRID_STROKE = 'var(--color-border)';
export const TICK_LINE_STROKE = 'var(--color-border-strong)';
