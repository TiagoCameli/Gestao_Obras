import type { OrdemServico, PlanoManutencao, HistoricoMedicao } from '../../../types';
import { contarAlertasEquipamento } from '../../../utils/manutencao';

interface Props {
  ordensServico: OrdemServico[];
  planos: PlanoManutencao[];
  medicoes: HistoricoMedicao[];
  equipamentoIds: string[];
}

export default function ManutencaoDashboard({ ordensServico, planos, medicoes, equipamentoIds }: Props) {
  const abertas = ordensServico.filter((os) => os.status === 'aberta' || os.status === 'em_andamento').length;
  const concluidas = ordensServico.filter((os) => os.status === 'concluida').length;
  const alertas = equipamentoIds.reduce((acc, eqId) => acc + contarAlertasEquipamento(eqId, planos, medicoes), 0);

  const cards = [
    { label: 'OS Abertas', valor: abertas, cor: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'OS Concluídas', valor: concluidas, cor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Planos Ativos', valor: planos.filter((p) => p.ativo).length, cor: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Alertas', valor: alertas, cor: alertas > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400', bg: alertas > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/20' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg p-4 ${card.bg}`}>
          <p className="text-sm text-gray-500 dark:text-slate-400">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.cor}`}>{card.valor}</p>
        </div>
      ))}
    </div>
  );
}
