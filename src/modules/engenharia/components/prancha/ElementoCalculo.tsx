import { useMemo } from 'react';
import { LinhaCalculo as LinhaCalculoComp } from '../LinhaCalculo';
import { recalcularDocumento } from '../../services/calcDocumento';
import { novaLinhaVazia, type LinhaCalculo } from '../../types/calculo';
import type { PropsCalculo } from '../../types/prancha';

interface Props {
  props: PropsCalculo;
  readOnly: boolean;
  onChange: (props: PropsCalculo) => void;
}

export function ElementoCalculo({ props, readOnly, onChange }: Props) {
  const avaliadas = useMemo(() => recalcularDocumento(props.linhas), [props.linhas]);
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
      {props.linhas.map((l) => (
        <LinhaCalculoComp
          key={l.id}
          linha={l}
          avaliada={avaliadaPorId.get(l.id)!}
          alertaAtivo={props.alertaAtivo}
          readOnly={readOnly}
          onChange={handleLinhaChange}
          onRevisado={handleRevisado}
          marcadaRevisada={l.alerta === 'revisado'}
        />
      ))}
      {!readOnly && (
        <button onClick={adicionarLinha} className="text-xs text-muted-foreground hover:text-foreground px-1">
          + linha
        </button>
      )}
    </div>
  );
}
