import { AlertTriangle, Bell, Calendar, Wrench } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import StatusManutencaoBadge, {
  type StatusManutencao,
} from '../badges/StatusManutencaoBadge';
import type { EquipamentoComStatusManutencao } from '../../types';

export interface EquipamentoCardProps {
  equipamento: EquipamentoComStatusManutencao;
  onClick?: () => void;
  className?: string;
}

function calcularStatus(eq: EquipamentoComStatusManutencao): StatusManutencao {
  if (!eq.horimetroFuncional && eq.horimetroAtual === undefined) return 'sem_dados';
  if (eq.manutencoesAtrasadas > 0 || eq.alertasCriticos > 0) return 'atrasada';
  const dias = eq.proximaManutencao?.diasRestantes;
  if (dias !== undefined && dias <= 7 && dias >= 0) return 'atencao';
  return 'em_dia';
}

function corDiasRestantes(dias: number): string {
  if (dias < 0) return 'var(--color-danger-fg)';
  if (dias <= 7) return 'var(--color-warning-fg)';
  return 'var(--color-success-fg)';
}

function formatarDiasRestantes(dias: number): string {
  if (dias < 0) return `Atrasada ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return `Em ${dias} dias`;
}

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function EquipamentoCard({ equipamento, onClick, className = '' }: EquipamentoCardProps) {
  const status = calcularStatus(equipamento);
  const isInteractive = !!onClick;

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
      aria-label={isInteractive ? `Abrir equipamento ${equipamento.patrimony}` : undefined}
      className={interactiveCls + ' ' + className}
    >
      <Card className="!p-4 h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xl font-bold text-[var(--color-fg)] leading-tight">
              {equipamento.patrimony}
            </div>
            <div className="text-sm text-[var(--color-fg-muted)] truncate">
              {equipamento.modeloNome ?? equipamento.nome}
            </div>
            {!equipamento.horimetroFuncional && (
              <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)] italic">
                Sem horímetro
              </div>
            )}
            {equipamento.horimetroFuncional && equipamento.horimetroAtual !== undefined && (
              <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">
                {equipamento.horimetroAtual.toLocaleString('pt-BR')} h
              </div>
            )}
          </div>
          <StatusManutencaoBadge status={status} />
        </div>

        {equipamento.proximaManutencao && (
          <div className="flex items-start gap-2 text-sm">
            <Calendar
              aria-hidden
              className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-fg-subtle)]"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[var(--color-fg)] truncate">
                {equipamento.proximaManutencao.tarefaTitulo}
              </div>
              <div
                className="text-xs font-medium"
                style={{ color: corDiasRestantes(equipamento.proximaManutencao.diasRestantes) }}
              >
                {formatarDiasRestantes(equipamento.proximaManutencao.diasRestantes)}
                <span className="text-[var(--color-fg-subtle)] font-normal">
                  {' · '}
                  {equipamento.proximaManutencao.dataPrevista}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1"
              title={`${equipamento.alertasCriticos} alerta(s) crítico(s)`}
            >
              <AlertTriangle
                aria-hidden
                className="w-3.5 h-3.5"
                style={{
                  color:
                    equipamento.alertasCriticos > 0
                      ? 'var(--color-danger-fg)'
                      : 'var(--color-fg-subtle)',
                }}
              />
              {equipamento.alertasCriticos}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`${equipamento.alertasAtivos} alerta(s) ativo(s)`}
            >
              <Bell aria-hidden className="w-3.5 h-3.5" />
              {equipamento.alertasAtivos}
            </span>
          </div>
          {equipamento.ultimaManutencao && (
            <span className="inline-flex items-center gap-1 truncate">
              <Wrench aria-hidden className="w-3.5 h-3.5" />
              há {diasDesde(equipamento.ultimaManutencao.executadoEm)} dia(s)
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

export default EquipamentoCard;
