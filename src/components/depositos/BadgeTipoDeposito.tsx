/**
 * Chip pequeno indicando o tipo de depósito (Material vs Combustível).
 */
import { Package, Fuel } from 'lucide-react';

interface Props {
  tipo: 'material' | 'combustivel';
  size?: 'xs' | 'sm';
}

export default function BadgeTipoDeposito({ tipo, size = 'sm' }: Props) {
  const Icon = tipo === 'material' ? Package : Fuel;
  const label = tipo === 'material' ? 'Material' : 'Combustível';
  const cores = tipo === 'material'
    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
    : 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60';
  const sizes = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium border ${cores} ${sizes}`}>
      <Icon className={iconSize} />
      {label}
    </span>
  );
}
