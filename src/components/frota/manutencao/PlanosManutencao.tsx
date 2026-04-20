import { useMemo } from 'react';
import type { PlanoManutencao, Equipamento, HistoricoMedicao } from '../../../types';
import { calcularVencimentoPlano } from '../../../utils/manutencao';
import Button from '../../ui/Button';

interface Props {
  planos: PlanoManutencao[];
  equipamentos: Equipamento[];
  medicoes: HistoricoMedicao[];
  onNovoPlano: () => void;
  onEditarPlano: (plano: PlanoManutencao) => void;
  onExcluirPlano: (id: string) => void;
  canCreate: boolean;
}

function getCorVencimento(vencido: boolean, diasRestantes: number | null, horasRestantes: number | null): string {
  if (vencido) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if ((diasRestantes != null && diasRestantes <= 7) || (horasRestantes != null && horasRestantes <= 50))
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}

export default function PlanosManutencao({ planos, equipamentos, medicoes, onNovoPlano, onEditarPlano, onExcluirPlano, canCreate }: Props) {
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e.nome])), [equipamentos]);

  const planosComStatus = useMemo(() => {
    return planos.map((plano) => {
      const medicoesEq = medicoes.filter((m) => m.equipamentoId === plano.equipamentoId);
      const ultimaMedicao = medicoesEq.length > 0 ? Math.max(...medicoesEq.map((m) => m.valor)) : 0;
      const vencimento = calcularVencimentoPlano(plano, ultimaMedicao);
      return { plano, vencimento };
    });
  }, [planos, medicoes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Planos de Manutenção Preventiva</h3>
        {canCreate && (
          <Button onClick={onNovoPlano} className="text-sm">+ Novo Plano</Button>
        )}
      </div>

      {planosComStatus.length === 0 ? (
        <p className="text-center py-8 text-gray-400 dark:text-slate-500">Nenhum plano cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {planosComStatus.map(({ plano, vencimento }) => {
            const cor = getCorVencimento(vencimento.vencido, vencimento.diasRestantes, vencimento.horasRestantes);
            return (
              <div key={plano.id} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-medium text-gray-800 dark:text-slate-200">{plano.nome}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cor}`}>
                        {vencimento.vencido ? 'Vencido' : 'Em dia'}
                      </span>
                      {!plano.ativo && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {equipMap.get(plano.equipamentoId) ?? plano.equipamentoId}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400 flex-wrap">
                      {plano.intervaloHoras != null && (
                        <span>A cada {plano.intervaloHoras}h {vencimento.horasRestantes != null && `(${vencimento.horasRestantes}h restantes)`}</span>
                      )}
                      {plano.intervaloKm != null && (
                        <span>A cada {plano.intervaloKm}km {vencimento.kmRestantes != null && `(${vencimento.kmRestantes}km restantes)`}</span>
                      )}
                      {plano.intervaloDias != null && (
                        <span>A cada {plano.intervaloDias} dias {vencimento.diasRestantes != null && `(${vencimento.diasRestantes}d restantes)`}</span>
                      )}
                    </div>
                    {plano.ultimaExecucaoData && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        Última execução: {new Date(plano.ultimaExecucaoData).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => onEditarPlano(plano)}
                      className="text-sm text-emt-verde hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onExcluirPlano(plano.id)}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
