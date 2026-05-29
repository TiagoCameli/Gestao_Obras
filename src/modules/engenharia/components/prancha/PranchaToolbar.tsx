import { MousePointer2, Hand, Type, Calculator, Minus, Square, Circle, Trash2 } from 'lucide-react';

export type Ferramenta =
  | 'selecionar' | 'mao' | 'texto' | 'calculo'
  | 'linha' | 'retangulo' | 'quadrado' | 'circulo';

const TOOLS: { id: Ferramenta; label: string; Icon: typeof Type }[] = [
  { id: 'selecionar', label: 'Selecionar', Icon: MousePointer2 },
  { id: 'mao', label: 'Mão', Icon: Hand },
  { id: 'texto', label: 'Texto', Icon: Type },
  { id: 'calculo', label: 'Cálculo', Icon: Calculator },
  { id: 'linha', label: 'Linha', Icon: Minus },
  { id: 'retangulo', label: 'Retângulo', Icon: Square },
  { id: 'quadrado', label: 'Quadrado', Icon: Square },
  { id: 'circulo', label: 'Círculo', Icon: Circle },
];

interface Props {
  ativa: Ferramenta;
  onSelecionar: (f: Ferramenta) => void;
  onApagar: () => void;
  podeApagar: boolean;
  disabled: boolean;
}

export function PranchaToolbar({ ativa, onSelecionar, onApagar, podeApagar, disabled }: Props) {
  return (
    <div className="w-[88px] shrink-0 border-r border-border bg-card flex flex-col gap-1 p-2">
      <span className="text-[10px] uppercase text-muted-foreground text-center mb-1">Ferramentas</span>
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          disabled={disabled}
          data-testid={`tool-${id}`}
          onClick={() => onSelecionar(id)}
          className={`flex flex-col items-center gap-1 rounded-md py-2 text-[11px] ${
            ativa === id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
          } disabled:opacity-40`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
      <div className="mt-auto pt-2 border-t border-border">
        <button
          disabled={disabled || !podeApagar}
          data-testid="tool-apagar"
          onClick={onApagar}
          className="w-full flex flex-col items-center gap-1 rounded-md py-2 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Apagar
        </button>
      </div>
    </div>
  );
}
