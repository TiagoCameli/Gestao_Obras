import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import SeveridadeAlertaBadge from '../badges/SeveridadeAlertaBadge';
import type {
  ManutencaoAlerta,
  AlertaTipo,
  EquipamentoComStatusManutencao,
} from '../../types';

export interface AlertaCardProps {
  alerta: ManutencaoAlerta;
  equipamento?: EquipamentoComStatusManutencao;
  onReconhecer?: (id: string) => void;
  className?: string;
}

const TIPO_LABEL: Record<AlertaTipo, string> = {
  manutencao_atrasada: 'Manutenção atrasada',
  horimetro_proximo: 'Horímetro próximo',
  filtro_indicador: 'Indicador de filtro',
  consumo_oleo_alto: 'Consumo de óleo alto',
  falha_eletronica: 'Falha eletrônica',
  analise_oleo_critica: 'Análise de óleo crítica',
};

function relativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
}

export function AlertaCard({
  alerta,
  equipamento,
  onReconhecer,
  className = '',
}: AlertaCardProps) {
  const reconhecido = !!alerta.reconhecidoEm;
  return (
    <Card className={'!p-4 ' + className}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <SeveridadeAlertaBadge severidade={alerta.severidade} />
            <span className="text-sm font-semibold text-[var(--color-fg)] truncate">
              {TIPO_LABEL[alerta.tipo as AlertaTipo] ?? alerta.tipo}
            </span>
          </div>
          <span className="text-xs text-[var(--color-fg-subtle)] shrink-0">
            {relativo(alerta.criadoEm)}
          </span>
        </div>

        <p className="text-sm text-[var(--color-fg)] whitespace-pre-wrap">{alerta.mensagem}</p>

        {equipamento && (
          <div className="text-xs text-[var(--color-fg-muted)]">
            <span className="font-medium text-[var(--color-fg)]">{equipamento.patrimony}</span>
            {' · '}
            {equipamento.nome}
          </div>
        )}

        {onReconhecer && !reconhecido && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onReconhecer(alerta.id)}
              aria-label="Reconhecer alerta"
            >
              Reconhecer
            </Button>
          </div>
        )}

        {reconhecido && (
          <div className="text-xs text-[var(--color-fg-subtle)] italic">
            Reconhecido {relativo(alerta.reconhecidoEm!)}
          </div>
        )}
      </div>
    </Card>
  );
}

export default AlertaCard;
