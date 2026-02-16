import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Abastecimento, Deposito, EntradaCombustivel, EtapaObra, Obra } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';

interface DashboardProps {
  abastecimentos: Abastecimento[];
  entradas: EntradaCombustivel[];
  todasEntradas: EntradaCombustivel[];
  todosAbastecimentos: Abastecimento[];
  obras: Obra[];
  etapas: EtapaObra[];
  depositos: Deposito[];
}

export default function CombustivelDashboard({
  abastecimentos,
  entradas,
  todasEntradas,
  todosAbastecimentos,
  obras,
  etapas,
  depositos,
}: DashboardProps) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e.nome]));
  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));

  // Calcula saldo por tipo de combustivel por tanque
  // Entradas somam, saidas subtraem
  const saldoPorTanqueTipo = new Map<string, Map<string, number>>();
  todasEntradas.forEach((e) => {
    if (!e.tipoCombustivel) return;
    if (!saldoPorTanqueTipo.has(e.depositoId)) saldoPorTanqueTipo.set(e.depositoId, new Map());
    const tipos = saldoPorTanqueTipo.get(e.depositoId)!;
    tipos.set(e.tipoCombustivel, (tipos.get(e.tipoCombustivel) || 0) + e.quantidadeLitros);
  });
  todosAbastecimentos.forEach((a) => {
    if (!a.tipoCombustivel || !a.depositoId) return;
    if (!saldoPorTanqueTipo.has(a.depositoId)) saldoPorTanqueTipo.set(a.depositoId, new Map());
    const tipos = saldoPorTanqueTipo.get(a.depositoId)!;
    tipos.set(a.tipoCombustivel, (tipos.get(a.tipoCombustivel) || 0) - a.quantidadeLitros);
  });
  const totalGastoSaidas = abastecimentos.reduce((sum, a) => sum + a.valorTotal, 0);
  const totalGastoEntradas = entradas.reduce((sum, e) => sum + e.valorTotal, 0);
  const totalLitrosSaidas = abastecimentos.reduce(
    (sum, a) => sum + a.quantidadeLitros,
    0
  );
  const totalLitrosEntradas = entradas.reduce(
    (sum, e) => sum + e.quantidadeLitros,
    0
  );

  const gastoPorObra = new Map<string, number>();
  abastecimentos.forEach((a) => {
    gastoPorObra.set(a.obraId, (gastoPorObra.get(a.obraId) || 0) + a.valorTotal);
  });

  const gastoPorEtapa = new Map<string, number>();
  abastecimentos.forEach((a) => {
    gastoPorEtapa.set(
      a.etapaId,
      (gastoPorEtapa.get(a.etapaId) || 0) + a.valorTotal
    );
  });

  // Saldo global por tipo de combustivel (soma de todos os tanques)
  const saldoGlobalPorTipo = new Map<string, number>();
  saldoPorTanqueTipo.forEach((tipos) => {
    tipos.forEach((qtd, tipoId) => {
      if (qtd > 0) {
        saldoGlobalPorTipo.set(tipoId, (saldoGlobalPorTipo.get(tipoId) || 0) + qtd);
      }
    });
  });

  const consumoMensal = new Map<string, number>();
  abastecimentos.forEach((a) => {
    const date = new Date(a.dataHora);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    consumoMensal.set(key, (consumoMensal.get(key) || 0) + a.valorTotal);
  });

  const chartData = Array.from(consumoMensal.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => {
      const [ano, m] = mes.split('-');
      return {
        mes: `${m}/${ano}`,
        valor: parseFloat(valor.toFixed(2)),
      };
    });

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Entradas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(totalGastoEntradas)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalLitrosEntradas.toFixed(1)} L em {entradas.length} entrada{entradas.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Saidas</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatCurrency(totalGastoSaidas)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalLitrosSaidas.toFixed(1)} L em {abastecimentos.length} saida{abastecimentos.length !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Saldo por tipo de combustivel */}
      {saldoGlobalPorTipo.size > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Saldo por Tipo de Combustivel
          </h3>
          <div className="flex flex-wrap gap-3">
            {Array.from(saldoGlobalPorTipo.entries()).map(([tipoId, qtd]) => (
              <div
                key={tipoId}
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200"
              >
                <span className="text-sm font-medium text-blue-800">
                  {insumosMap.get(tipoId) || tipoId}
                </span>
                <span className="text-lg font-bold text-blue-900">
                  {qtd.toFixed(0)} L
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Saldo por tanque */}
      {depositos.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Saldo por Tanque
            </h3>
            <div className="space-y-3">
              {depositos.map((dep) => {
                const pct = dep.capacidadeLitros > 0
                  ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100
                  : 0;
                const cor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
                const tiposDeste = saldoPorTanqueTipo.get(dep.id);
                return (
                  <div key={dep.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{dep.nome}</span>
                      <span className="text-xs text-gray-400">
                        {obrasMap.get(dep.obraId) || 'Obra desconhecida'}
                      </span>
                    </div>
                    {tiposDeste && tiposDeste.size > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {Array.from(tiposDeste.entries())
                          .filter(([, qtd]) => qtd > 0)
                          .map(([tipoId, qtd]) => (
                          <div
                            key={tipoId}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200"
                          >
                            <span className="text-xs font-medium text-orange-800">
                              {insumosMap.get(tipoId) || tipoId}
                            </span>
                            <span className="text-xs font-bold text-orange-900">
                              {qtd.toFixed(0)} L
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-2">
                        {dep.nivelAtualLitros > 0 ? `${dep.nivelAtualLitros.toFixed(0)} L` : 'Vazio'}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${cor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {dep.nivelAtualLitros.toFixed(0)} / {dep.capacidadeLitros.toFixed(0)} L
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Grafico consumo mensal */}
      {chartData.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Consumo Mensal (R$)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="valor" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Gasto por obra e etapa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Gasto por Obra
          </h3>
          {gastoPorObra.size === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {Array.from(gastoPorObra.entries()).map(([obraId, valor]) => (
                <div
                  key={obraId}
                  className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-700">
                    {obrasMap.get(obraId) || 'Obra desconhecida'}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Gasto por Etapa
          </h3>
          {gastoPorEtapa.size === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {Array.from(gastoPorEtapa.entries()).map(([etapaId, valor]) => (
                <div
                  key={etapaId}
                  className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-700">
                    {etapasMap.get(etapaId) || 'Etapa desconhecida'}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {/* Consumo por equipamento */}
      <ConsumoPorEquipamento todosAbastecimentos={todosAbastecimentos} obras={obras} etapas={etapas} />
    </div>
  );
}

function ConsumoPorEquipamento({
  todosAbastecimentos,
  obras,
  etapas: allEtapas,
}: {
  todosAbastecimentos: Abastecimento[];
  obras: Obra[];
  etapas: EtapaObra[];
}) {
  const { data: equipamentosData } = useEquipamentos();
  const equipamentos = equipamentosData ?? [];
  const equipMap = new Map(equipamentos.map((eq) => [eq.id, eq.nome]));
  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));

  const [filtroObraId, setFiltroObraId] = useState('');
  const [filtroEtapaId, setFiltroEtapaId] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Filter etapas by obraId from props
  const etapasDisponiveis = filtroObraId ? allEtapas.filter((e) => e.obraId === filtroObraId) : [];

  const filtrados = todosAbastecimentos.filter((a) => {
    if (filtroObraId && a.obraId !== filtroObraId) return false;
    if (filtroEtapaId && a.etapaId !== filtroEtapaId) return false;
    if (filtroDataInicio && new Date(a.dataHora) < new Date(filtroDataInicio)) return false;
    if (filtroDataFim && new Date(a.dataHora) > new Date(filtroDataFim + 'T23:59:59')) return false;
    return true;
  });

  // Agrupar por equipamento
  const porEquipamento = new Map<string, { litros: number; valor: number; tipos: Map<string, number> }>();
  filtrados.forEach((a) => {
    if (!a.veiculo) return;
    if (!porEquipamento.has(a.veiculo)) {
      porEquipamento.set(a.veiculo, { litros: 0, valor: 0, tipos: new Map() });
    }
    const eq = porEquipamento.get(a.veiculo)!;
    eq.litros += a.quantidadeLitros;
    eq.valor += a.valorTotal;
    eq.tipos.set(a.tipoCombustivel, (eq.tipos.get(a.tipoCombustivel) || 0) + a.quantidadeLitros);
  });

  const lista = Array.from(porEquipamento.entries())
    .map(([eqId, dados]) => ({ eqId, nome: equipMap.get(eqId) || eqId, ...dados }))
    .sort((a, b) => b.valor - a.valor);

  const temFiltro = filtroObraId || filtroEtapaId || filtroDataInicio || filtroDataFim;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Consumo por Equipamento
      </h3>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Obra</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filtroObraId}
            onChange={(e) => {
              setFiltroObraId(e.target.value);
              setFiltroEtapaId('');
            }}
          >
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Etapa</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filtroEtapaId}
            onChange={(e) => setFiltroEtapaId(e.target.value)}
            disabled={!filtroObraId}
          >
            <option value="">Todas</option>
            {etapasDisponiveis.map((et) => (
              <option key={et.id} value={et.id}>{et.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ate</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
          />
        </div>
        {temFiltro && (
          <button
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => {
              setFiltroObraId('');
              setFiltroEtapaId('');
              setFiltroDataInicio('');
              setFiltroDataFim('');
            }}
          >
            Limpar
          </button>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="text-gray-400 text-sm">Sem dados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Equipamento</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Combustiveis</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Litros</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((item) => (
                <tr key={item.eqId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700">{item.nome}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(item.tipos.entries()).map(([tipoId, litros]) => (
                        <span
                          key={tipoId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                        >
                          {insumosMap.get(tipoId) || tipoId}: {litros.toFixed(0)} L
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-red-700">
                    {item.litros.toFixed(1)} L
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCurrency(item.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr className="font-semibold">
                <td className="px-4 py-2 text-gray-700" colSpan={2}>Total</td>
                <td className="px-4 py-2 text-right text-red-700">
                  {lista.reduce((s, i) => s + i.litros, 0).toFixed(1)} L
                </td>
                <td className="px-4 py-2 text-right">
                  {formatCurrency(lista.reduce((s, i) => s + i.valor, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
