import type { Equipamento } from '../../types';
import Card from '../ui/Card';

interface FrotaStatsProps {
  equipamentos: Equipamento[];
}

export default function FrotaStats({ equipamentos }: FrotaStatsProps) {
  const total = equipamentos.length;
  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = total - ativos;
  const categorias = new Set(equipamentos.map((e) => e.tipo).filter(Boolean)).size;

  const stats = [
    { label: 'Total', valor: total, cor: 'text-gray-800 dark:text-slate-200' },
    { label: 'Ativos', valor: ativos, cor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Inativos', valor: inativos, cor: 'text-red-500 dark:text-red-400' },
    { label: 'Categorias', valor: categorias, cor: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="text-center !p-4">
          <p className="text-sm text-gray-500 dark:text-slate-400">{s.label}</p>
          <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
        </Card>
      ))}
    </div>
  );
}
