// F11 — Representação visual horizontal de um tanque de combustível.
//
// Renderiza um cilindro horizontal (pill) com fill proporcional a
// nivel/capacidade. Cor do fill varia conforme combustível corrente:
//   Diesel S10  → azul
//   Diesel S500 → amarelo
//   Gasolina    → vermelho
//   Arla        → teal
//   outros/vazio → cinza
//
// Texto overlay: combustível, nível absoluto, %, capacidade.
// Tanque externo (eh_externo) cai pra layout de lista — não passar pra cá.

import { Droplet, FuelIcon } from 'lucide-react';

interface TanqueVisualProps {
  nome: string;
  apelido?: string | null;
  capacidadeLitros: number;
  nivelAtualLitros: number;
  /** Nome do combustível corrente — derivado do mapa fora. Null = vazio. */
  combustivelNome?: string | null;
  /** Id do combustível pro mapeamento de cor. Null = cinza. */
  combustivelId?: string | null;
  /** Mapa id → cor por combustível. Default abaixo cobre os 4 do catálogo. */
  corPorCombustivel?: Record<string, string>;
  className?: string;
}

const COR_DEFAULT: Record<string, string> = {
  // Mapping por NOME (fallback caso id varie entre ambientes). Match case-insensitive.
  'diesel s10': '#3B82F6',  // azul
  'diesel s500': '#F59E0B', // amarelo
  'gasolina': '#EF4444',    // vermelho
  'arla': '#14B8A6',        // teal
  'etanol': '#10B981',      // verde (não-catálogo, reserva)
};

const COR_VAZIO = '#94A3B8'; // slate-400

export function corPorCombustivelNome(nome?: string | null): string {
  if (!nome) return COR_VAZIO;
  return COR_DEFAULT[nome.trim().toLowerCase()] ?? COR_VAZIO;
}

export default function TanqueVisual({
  nome,
  apelido,
  capacidadeLitros,
  nivelAtualLitros,
  combustivelNome,
  className = '',
}: TanqueVisualProps) {
  const cap = Math.max(capacidadeLitros, 0);
  const nivel = Math.max(0, Math.min(nivelAtualLitros, cap));
  const pct = cap > 0 ? (nivel / cap) : 0;
  const pctLabel = (pct * 100).toFixed(0);
  const cor = corPorCombustivelNome(combustivelNome);
  const vazio = nivel <= 0;

  // SVG horizontal — viewport 320x140, cilindro com cantos arredondados.
  // O tanque é horizontal (deitado), mas o LÍQUIDO se comporta como em
  // tanque real: ancorado no fundo, sobe/desce com o nível. Empty → sem
  // fluido. Full → fluido até o topo.
  const W = 320;
  const H = 140;
  const PADX = 36; // espaço pra escala vertical à esquerda
  const PADY = 18;
  const tankW = W - PADX - 14;
  const tankH = H - PADY * 2;
  const fillH = tankH * pct;
  const tankX = PADX;
  const tankY = PADY;
  const fluidY = tankY + tankH - fillH; // topo do fluido (desce do topo)
  const corId = `tank-grad-${nome.replace(/\W/g, '')}`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{nome}</h3>
          {apelido && (
            <p className="text-[11px] text-[var(--color-fg-muted)] truncate">{apelido}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {vazio ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">
              <Droplet className="w-3 h-3" />
              Vazio
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: cor }}
            >
              <FuelIcon className="w-3 h-3" />
              {combustivelNome}
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Tanque ${nome}: ${nivel.toLocaleString('pt-BR')} de ${cap.toLocaleString('pt-BR')} litros`}
      >
        <defs>
          <linearGradient id={corId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={cor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={cor} stopOpacity="1" />
          </linearGradient>
          <clipPath id={`${corId}-clip`}>
            <rect x={tankX} y={tankY} width={tankW} height={tankH} rx={tankH / 2} />
          </clipPath>
        </defs>

        {/* Casco do tanque */}
        <rect
          x={tankX}
          y={tankY}
          width={tankW}
          height={tankH}
          rx={tankH / 2}
          fill="var(--color-surface-2, #f1f5f9)"
          stroke="var(--color-border, #cbd5e1)"
          strokeWidth="1.5"
        />

        {/* Fluido (clipado pelo casco) — ancorado no fundo, sobe com nível */}
        {!vazio && (
          <g clipPath={`url(#${corId}-clip)`}>
            <rect
              x={tankX}
              y={fluidY}
              width={tankW}
              height={fillH}
              fill={`url(#${corId})`}
            />
            {/* Banda fina no topo do fluido (menisco horizontal) */}
            <rect
              x={tankX}
              y={fluidY}
              width={tankW}
              height={Math.min(3, fillH)}
              fill={cor}
              opacity="0.35"
            />
          </g>
        )}

        {/* Escala vertical à esquerda — 0 (base), 50%, capacidade (topo) */}
        <g fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--color-fg-muted, #64748b)" textAnchor="end">
          <text x={tankX - 6} y={tankY + tankH + 3}>0</text>
          <text x={tankX - 6} y={tankY + tankH / 2 + 3}>{Math.round(cap / 2).toLocaleString('pt-BR')}</text>
          <text x={tankX - 6} y={tankY + 8}>{cap.toLocaleString('pt-BR')}</text>
        </g>
        {/* Ticks discretos na lateral esquerda do casco */}
        <g stroke="var(--color-border, #cbd5e1)" strokeWidth="1">
          <line x1={tankX} y1={tankY + tankH} x2={tankX - 3} y2={tankY + tankH} />
          <line x1={tankX} y1={tankY + tankH / 2} x2={tankX - 3} y2={tankY + tankH / 2} />
          <line x1={tankX} y1={tankY} x2={tankX - 3} y2={tankY} />
        </g>

        {/* Litros + percentual no centro do fluido */}
        <g
          fontFamily="ui-sans-serif, system-ui"
          textAnchor="middle"
          style={{ paintOrder: 'stroke fill' }}
        >
          <text
            x={W / 2}
            y={tankY + tankH / 2 - 4}
            fontSize="22"
            fontWeight="700"
            fill={vazio ? 'var(--color-fg-muted, #64748b)' : '#ffffff'}
            stroke={vazio ? 'transparent' : 'rgba(0,0,0,0.25)'}
            strokeWidth="0.8"
          >
            {nivel.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
          </text>
          <text
            x={W / 2}
            y={tankY + tankH / 2 + 16}
            fontSize="12"
            fontWeight="600"
            fill={vazio ? 'var(--color-fg-muted, #64748b)' : 'rgba(255,255,255,0.9)'}
          >
            {pctLabel}% de {cap.toLocaleString('pt-BR')} L
          </text>
        </g>
      </svg>
    </div>
  );
}
