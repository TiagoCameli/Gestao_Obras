import { useMemo } from 'react';
import type { PlanoManutencao, Equipamento, HistoricoMedicao } from '../../../types';
import { calcularVencimentoPlano } from '../../../utils/manutencao';

interface Props {
  planos: PlanoManutencao[];
  equipamentos: Equipamento[];
  medicoes: HistoricoMedicao[];
  onCriarOS: (equipamentoId: string) => void;
}

interface AlertaItem {
  plano: PlanoManutencao;
  equipNome: string;
  vencido: boolean;
  diasRestantes: number | null;
  horasRestantes: number | null;
  kmRestantes: number | null;
}

export default function AlertasManutencao({ planos, equipamentos, medicoes, onCriarOS }: Props) {
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e.nome])), [equipamentos]);

  const alertas: AlertaItem[] = useMemo(() => {
    const items: AlertaItem[] = [];
    for (const plano of planos.filter((p) => p.ativo)) {
      const medicoesEq = medicoes.filter((m) => m.equipamentoId === plano.equipamentoId);
      const ultimaMedicao = medicoesEq.length > 0 ? Math.max(...medicoesEq.map((m) => m.valor)) : 0;
      const v = calcularVencimentoPlano(plano, ultimaMedicao);
      if (v.vencido || (v.diasRestantes != null && v.diasRestantes <= 7) || (v.horasRestantes != null && v.horasRestantes <= 50) || (v.kmRestantes != null && v.kmRestantes <= 500)) {
        items.push({
          plano,
          equipNome: equipMap.get(plano.equipamentoId) ?? plano.equipamentoId,
          ...v,
        });
      }
    }
    // Vencidos primeiro
    items.sort((a, b) => (a.vencido === b.vencido ? 0 : a.vencido ? -1 : 1));
    return items;
  }, [planos, medicoes, equipMap]);

  // Agrupar por equipamento
  const grupos = useMemo(() => {
    const map = new Map<string, AlertaItem[]>();
    for (const a of alertas) {
      const key = a.plano.equipamentoId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [alertas]);

  if (alertas.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-slate-500">
        Nenhum alerta de manutenção no momento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map(([eqId, items]) => (
        <div key={eqId} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800 dark:text-slate-200">{items[0].equipNome}</h4>
            <button
              onClick={() => onCriarOS(eqId)}
              className="text-sm text-emt-verde hover:underline font-medium"
            >
              Criar OS
            </button>
          </div>
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.plano.id} className="flex items-center gap-2 text-sm">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  a.vencido
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                }`}>
                  {a.vencido ? 'Vencido' : 'Próximo'}
                </span>
                <span className="text-gray-700 dark:text-slate-300">{a.plano.nome}</span>
                <span className="text-gray-400 dark:text-slate-500 text-xs">
                  {a.diasRestantes != null && `${a.diasRestantes}d`}
                  {a.horasRestantes != null && ` ${a.horasRestantes}h`}
                  {a.kmRestantes != null && ` ${a.kmRestantes}km`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
