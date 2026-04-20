import type { OrdemServico, ItemOS, Equipamento } from '../../../types';
import { getCorStatus, getCorPrioridade, labelStatus, labelPrioridade } from '../../../utils/manutencao';
import Button from '../../ui/Button';

interface Props {
  os: OrdemServico;
  itens: ItemOS[];
  equipamentos: Equipamento[];
  onEditar?: () => void;
  onClose: () => void;
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{valor || '—'}</p>
    </div>
  );
}

const tipoCustoLabel: Record<string, string> = {
  peca: 'Peça',
  mao_de_obra: 'Mão de Obra',
  servico_externo: 'Serviço Externo',
};

export default function DetalheOS({ os, itens, equipamentos, onEditar, onClose }: Props) {
  const equipNome = equipamentos.find((e) => e.id === os.equipamentoId)?.nome ?? os.equipamentoId;
  const totalCustos = itens.reduce((acc, item) => acc + item.quantidade * item.valorUnitario, 0);

  return (
    <div className="space-y-6">
      {/* Header badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${getCorStatus(os.status)}`}>
          {labelStatus(os.status)}
        </span>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${getCorPrioridade(os.prioridade)}`}>
          {labelPrioridade(os.prioridade)}
        </span>
        <span className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 capitalize">
          {os.tipo}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Número" valor={os.numero} />
        <Campo label="Equipamento" valor={equipNome} />
        <Campo label="Responsável" valor={os.responsavel} />
        <Campo label="Data Abertura" valor={os.dataAbertura ? new Date(os.dataAbertura).toLocaleDateString('pt-BR') : ''} />
        <Campo label="Data Prevista" valor={os.dataPrevista ? new Date(os.dataPrevista).toLocaleDateString('pt-BR') : ''} />
        <Campo label="Data Conclusão" valor={os.dataConclusao ? new Date(os.dataConclusao).toLocaleDateString('pt-BR') : ''} />
        <Campo label="Medição Abertura" valor={String(os.medicaoAbertura)} />
        <Campo label="Medição Conclusão" valor={os.medicaoConclusao != null ? String(os.medicaoConclusao) : '—'} />
      </div>

      {/* Descrição */}
      {os.descricao && (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Descrição</p>
          <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{os.descricao}</p>
        </div>
      )}

      {/* Observações */}
      {os.observacoes && (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Observações</p>
          <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{os.observacoes}</p>
        </div>
      )}

      {/* Itens / Custos */}
      {itens.length > 0 && (
        <div className="border-t dark:border-slate-600 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Itens / Custos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-slate-400 border-b dark:border-slate-600">
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2 text-right">Qtd</th>
                  <th className="pb-2 text-right">Vlr Unit.</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-b dark:border-slate-700">
                    <td className="py-2 text-gray-800 dark:text-slate-200">{item.descricao}</td>
                    <td className="py-2 text-gray-600 dark:text-slate-400">{tipoCustoLabel[item.tipo] ?? item.tipo}</td>
                    <td className="py-2 text-right text-gray-600 dark:text-slate-400">{item.quantidade}</td>
                    <td className="py-2 text-right text-gray-600 dark:text-slate-400">
                      {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-slate-200">
                      {(item.quantidade * item.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-2 text-right font-semibold text-gray-700 dark:text-slate-300">Total:</td>
                  <td className="pt-2 text-right font-bold text-gray-800 dark:text-slate-200">
                    {totalCustos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        {onEditar && <Button onClick={onEditar}>Editar</Button>}
      </div>
    </div>
  );
}
