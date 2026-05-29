import type { PropsForma } from '../../types/prancha';

interface Props {
  props: PropsForma;
  largura: number;
  altura: number;
}

export function ElementoForma({ props, largura, altura }: Props) {
  const { formaTipo, cor, espessura } = props;
  if (formaTipo === 'linha') {
    return (
      <svg width={largura} height={Math.max(espessura, 4)} style={{ overflow: 'visible' }} data-testid="prancha-forma">
        <line x1={0} y1={espessura} x2={largura} y2={espessura} stroke={cor} strokeWidth={espessura} />
      </svg>
    );
  }
  const raio = formaTipo === 'circulo' ? '50%' : '2px';
  return (
    <div
      data-testid="prancha-forma"
      style={{
        width: largura,
        height: altura,
        border: `${espessura}px solid ${cor}`,
        borderRadius: raio,
        boxSizing: 'border-box',
      }}
    />
  );
}
