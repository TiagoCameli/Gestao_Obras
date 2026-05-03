import { Clock } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import CategoriaBadge from '../badges/CategoriaBadge';
import PrioridadeBadge from '../badges/PrioridadeBadge';
import type { ManutencaoTarefa } from '../../types';

export interface TarefaCardProps {
  tarefa: ManutencaoTarefa;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

function intervaloLabel(t: ManutencaoTarefa): string | null {
  if (t.intervaloHoras && t.intervaloDias) {
    return `a cada ${t.intervaloHoras}h ou ${t.intervaloDias}d`;
  }
  if (t.intervaloHoras) return `a cada ${t.intervaloHoras}h`;
  if (t.intervaloDias) return `a cada ${t.intervaloDias}d`;
  return null;
}

/**
 * Extrai um preview legível da descrição (markdown), pulando headings e
 * limpando sintaxe inline. Pega o primeiro parágrafo de texto.
 */
function previewDescricao(s: string, max = 150): string {
  const linhas = s.replace(/\r\n/g, '\n').split('\n');
  const buffer: string[] = [];
  for (const raw of linhas) {
    const linha = raw.trim();
    if (linha === '') {
      if (buffer.length > 0) break;
      continue;
    }
    if (linha.startsWith('#')) continue;
    if (/^\s*[-*]\s+/.test(linha) || /^\s*\d+\.\s+/.test(linha)) continue;
    buffer.push(linha);
  }
  let texto = buffer.join(' ');
  texto = texto
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (texto.length > max) texto = texto.slice(0, max - 1).trimEnd() + '…';
  return texto;
}

export function TarefaCard({ tarefa, onClick, compact = false, className = '' }: TarefaCardProps) {
  const isInteractive = !!onClick;
  const intervalo = intervaloLabel(tarefa);

  const interactiveCls = isInteractive
    ? 'cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 ' +
      'hover:shadow-[var(--shadow-md)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]'
    : '';

  return (
    <div
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `Abrir tarefa ${tarefa.titulo}` : undefined}
      className={interactiveCls + ' ' + className}
    >
      <Card className={(compact ? '!p-3' : '!p-4') + ' h-full'}>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-fg)] leading-snug">
              {tarefa.titulo}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CategoriaBadge categoria={tarefa.categoria} />
            <PrioridadeBadge prioridade={tarefa.prioridade} />
            {intervalo && (
              <span className="text-xs text-[var(--color-fg-subtle)]">{intervalo}</span>
            )}
          </div>

          {!compact && tarefa.descricaoTecnica && (() => {
            const preview = previewDescricao(tarefa.descricaoTecnica);
            if (!preview) return null;
            return (
              <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2">
                {preview}
              </p>
            );
          })()}

          {tarefa.duracaoEstimadaMin !== undefined && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-fg-subtle)]">
              <Clock aria-hidden className="w-3.5 h-3.5" />
              {tarefa.duracaoEstimadaMin} min
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default TarefaCard;
