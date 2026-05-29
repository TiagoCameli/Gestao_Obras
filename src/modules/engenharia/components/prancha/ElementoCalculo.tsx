import { useMemo } from 'react';
import { LinhaCalculo as LinhaCalculoComp } from '../LinhaCalculo';
import { novaLinhaVazia, type LinhaCalculo } from '../../types/calculo';
import type { PropsCalculo } from '../../types/prancha';
import type { LinhaAvaliada } from '../../services/calcDocumento';

interface Props {
  props: PropsCalculo;
  avaliadas: LinhaAvaliada[];
  readOnly: boolean;
  onChange: (props: PropsCalculo) => void;
}

export function ElementoCalculo({ props, avaliadas, readOnly, onChange }: Props) {
  const avaliadaPorId = useMemo(() => new Map(avaliadas.map((a) => [a.id, a])), [avaliadas]);

  function handleLinhaChange(atualizada: LinhaCalculo) {
    onChange({ ...props, linhas: props.linhas.map((l) => (l.id === atualizada.id ? atualizada : l)) });
  }
  function handleRevisado(linhaId: string) {
    onChange({ ...props, linhas: props.linhas.map((l) => (l.id === linhaId ? { ...l, alerta: 'revisado' } : l)) });
  }
  function adicionarLinha() {
    onChange({ ...props, linhas: [...props.linhas, novaLinhaVazia(props.linhas.length)] });
  }

  return (
    <div
      className="w-full h-full overflow-auto rounded-md border border-border bg-card p-1 space-y-1"
      data-testid="prancha-calculo"
      onPointerDown={(e) => { if (!readOnly) e.stopPropagation(); }}
    >
      {props.linhas.map((l) => {
        const avaliada = avaliadaPorId.get(l.id);
        // Fallback defensivo: se (por algum motivo) não veio avaliada para esta
        // linha, trata como vazia pra não quebrar a renderização.
        const av: LinhaAvaliada = avaliada ?? {
          id: l.id, expressao: l.expressao, tipo: 'vazio', lhs: l.expressao,
          rhsUsuario: null, resultado: null, alerta: 'vazio',
        };
        return (
          <LinhaCalculoComp
            key={l.id}
            linha={l}
            avaliada={av}
            alertaAtivo={props.alertaAtivo}
            readOnly={readOnly}
            onChange={handleLinhaChange}
            onRevisado={handleRevisado}
            marcadaRevisada={l.alerta === 'revisado'}
            empilhado
          />
        );
      })}
      {!readOnly && (
        <button onClick={adicionarLinha} className="text-xs text-muted-foreground hover:text-foreground px-1">
          + linha
        </button>
      )}
    </div>
  );
}
