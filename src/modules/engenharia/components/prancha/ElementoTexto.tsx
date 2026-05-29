import type { PropsTexto } from '../../types/prancha';

interface Props {
  props: PropsTexto;
  readOnly: boolean;
  onChange: (props: PropsTexto) => void;
}

export function ElementoTexto({ props, readOnly, onChange }: Props) {
  return (
    <textarea
      value={props.texto}
      readOnly={readOnly}
      onChange={(e) => onChange({ texto: e.target.value })}
      placeholder="Texto…"
      className="w-full h-full resize-none bg-transparent text-sm text-foreground outline-none p-1"
      data-testid="prancha-texto"
      onPointerDown={(e) => { if (!readOnly) e.stopPropagation(); }}
    />
  );
}
