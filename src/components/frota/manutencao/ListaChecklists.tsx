import { useState, useMemo } from 'react';
import type { ChecklistEquipamento, Equipamento } from '../../../types';
import { CHECKLIST_ITENS } from './checklistItens';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

interface Props {
  checklists: ChecklistEquipamento[];
  equipamentos: Equipamento[];
  onNovoChecklist: () => void;
  onImportar: () => void;
  onExcluir: (id: string) => void;
  canCreate: boolean;
}

export default function ListaChecklists({ checklists, equipamentos, onNovoChecklist, onImportar, onExcluir, canCreate }: Props) {
  const [filtroEquip, setFiltroEquip] = useState('');
  const [detalhe, setDetalhe] = useState<ChecklistEquipamento | null>(null);

  const equipMap = useMemo(() => {
    const m = new Map<string, Equipamento>();
    for (const e of equipamentos) m.set(e.id, e);
    return m;
  }, [equipamentos]);

  const filtrados = useMemo(() => {
    if (!filtroEquip) return checklists;
    return checklists.filter((c) => c.equipamentoId === filtroEquip);
  }, [checklists, filtroEquip]);

  function contarRespostas(c: ChecklistEquipamento) {
    let sim = 0, nao = 0, na = 0, vazio = 0;
    for (const resp of Object.values(c.respostas)) {
      for (const val of [resp.turno1, resp.turno2, resp.turno3]) {
        if (val === 'sim') sim++;
        else if (val === 'nao') nao++;
        else if (val === 'na') na++;
        else vazio++;
      }
    }
    return { sim, nao, na, vazio };
  }

  const inputClass = 'w-full h-[44px] border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white dark:bg-slate-700 dark:text-slate-200';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="w-full sm:w-64">
          <select value={filtroEquip} onChange={(e) => setFiltroEquip(e.target.value)} className={inputClass}>
            <option value="">Todos os equipamentos</option>
            {equipamentos
              .filter((e) => e.ativo)
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
          </select>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onImportar} className="text-sm">
              Importar Excel
            </Button>
            <Button onClick={onNovoChecklist} className="text-sm">
              + Novo Checklist
            </Button>
          </div>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          Nenhum checklist encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">Equipamento</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-300">Unidade</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-slate-300">Conformes</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-slate-300">Não Conformes</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtrados.map((c) => {
                const eq = equipMap.get(c.equipamentoId);
                const { sim, nao } = contarRespostas(c);
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                      {c.data ? new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                      {eq?.nome ?? 'Equipamento removido'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{c.unidade || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded">
                        {sim}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${nao > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-slate-400'}`}>
                        {nao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDetalhe(c)}
                          className="text-emt-verde dark:text-emerald-400 hover:underline text-sm"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => { if (confirm('Excluir este checklist?')) onExcluir(c.id); }}
                          className="text-red-500 hover:underline text-sm"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhe */}
      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Detalhe do Checklist" size="xl">
        {detalhe && <DetalheChecklist checklist={detalhe} equipamentos={equipamentos} />}
      </Modal>
    </div>
  );
}

function DetalheChecklist({ checklist, equipamentos }: { checklist: ChecklistEquipamento; equipamentos: Equipamento[] }) {
  const eq = equipamentos.find((e) => e.id === checklist.equipamentoId);

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-slate-400 block">Equipamento</span>
          <span className="font-medium text-gray-800 dark:text-slate-200">{eq?.nome ?? '-'}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-slate-400 block">Data</span>
          <span className="font-medium text-gray-800 dark:text-slate-200">
            {checklist.data ? new Date(checklist.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-slate-400 block">Unidade</span>
          <span className="font-medium text-gray-800 dark:text-slate-200">{checklist.unidade || '-'}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-slate-400 block">Área</span>
          <span className="font-medium text-gray-800 dark:text-slate-200">{checklist.areaInspecao || '-'}</span>
        </div>
      </div>

      {/* Turnos */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Turnos</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {checklist.turnos.map((t) => (
            <div key={t.turno} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
              <span className="font-medium text-gray-700 dark:text-slate-300">{t.turno}o Turno</span>
              <div className="text-gray-500 dark:text-slate-400">
                <div>Horímetro: {t.horimetroInicial || '-'} / {t.horimetroFinal || '-'}</div>
                <div>Tipo: {t.tipoManutencao === 'preventiva' ? 'Preventiva' : 'Corretiva'}</div>
                <div>Parou: {t.parouManutencao ? `Sim (${t.horaParada} - ${t.horaRetorno})` : 'Não'}</div>
                <div>Operador: {t.nomeOperador || '-'}</div>
                {t.cs && <div>CS: {t.cs}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Respostas */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Itens de Verificação</h4>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-300">#</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-300">Descrição</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-slate-300">1o</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-slate-300">2o</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-slate-300">3o</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {CHECKLIST_ITENS.map((item) => {
                const r = checklist.respostas[item.numero];
                return (
                  <tr key={item.numero}>
                    <td className="px-3 py-1.5 font-mono text-gray-400">{item.numero}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{item.descricao}</td>
                    {[r?.turno1, r?.turno2, r?.turno3].map((val, i) => (
                      <td key={i} className="px-3 py-1.5 text-center">
                        <RespostaBadge valor={val || ''} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {checklist.observacoes && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">Observações</h4>
          <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">{checklist.observacoes}</p>
        </div>
      )}
    </div>
  );
}

function RespostaBadge({ valor }: { valor: string }) {
  if (!valor) return <span className="text-gray-300 dark:text-slate-600">-</span>;
  const cls =
    valor === 'sim'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : valor === 'nao'
        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        : 'bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-slate-400';
  const label = valor === 'sim' ? 'S' : valor === 'nao' ? 'N' : 'NA';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}
