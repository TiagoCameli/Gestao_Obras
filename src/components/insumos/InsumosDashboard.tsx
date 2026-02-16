import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  DepositoMaterial,
  EntradaMaterial,
  EtapaObra,
  Obra,
  SaidaMaterial,
} from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { calcularTodoEstoqueMaterial } from '../../hooks/useEstoque';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';

interface InsumosDashboardProps {
  entradas: EntradaMaterial[];
  saidas: SaidaMaterial[];
  todasEntradas: EntradaMaterial[];
  todasSaidas: SaidaMaterial[];
  obras: Obra[];
  etapas: EtapaObra[];
  depositosMaterial: DepositoMaterial[];
}

export default function InsumosDashboard({
  entradas,
  saidas,
  todasEntradas,
  todasSaidas,
  obras,
  etapas,
  depositosMaterial,
}: InsumosDashboardProps) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e]));
  const { data: insumosData } = useInsumos();
  const insumos = (insumosData ?? []).filter((i) => i.tipo === 'material');
  const insumosMap = new Map(insumos.map((i) => [i.id, i]));
  const depositosMap = new Map(depositosMaterial.map((d) => [d.id, d]));

  // Cards resumo (filtrados)
  const totalGastoEntradas = entradas.reduce(
    (sum, e) => sum + e.valorTotal,
    0
  );
  const totalGastoSaidas = saidas.reduce((sum, s) => sum + s.valorTotal, 0);

  // Saldo de insumos (global, nao filtrado) — async
  const [estoqueMap, setEstoqueMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    calcularTodoEstoqueMaterial().then(setEstoqueMap).catch(() => {});
  }, [todasEntradas, todasSaidas]);

  // Agrupa estoque por insumo (soma de todos os depositos)
  const estoquePorInsumo = new Map<string, number>();
  estoqueMap.forEach((qtd, key) => {
    const insumoId = key.split('|')[1];
    if (qtd > 0) {
      estoquePorInsumo.set(
        insumoId,
        (estoquePorInsumo.get(insumoId) || 0) + qtd
      );
    }
  });

  // Saldo por deposito
  const estoquePorDeposito = new Map<string, Map<string, number>>();
  estoqueMap.forEach((qtd, key) => {
    if (qtd <= 0) return;
    const [depId, insId] = key.split('|');
    if (!estoquePorDeposito.has(depId))
      estoquePorDeposito.set(depId, new Map());
    estoquePorDeposito.get(depId)!.set(insId, qtd);
  });

  // Consumo mensal (valor das saidas por mes) - filtrado
  const consumoMensal = new Map<string, number>();
  saidas.forEach((s) => {
    const date = new Date(s.dataHora);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    consumoMensal.set(key, (consumoMensal.get(key) || 0) + s.valorTotal);
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

  // Gasto por obra (filtrado)
  const gastoPorObra = new Map<string, number>();
  saidas.forEach((s) => {
    gastoPorObra.set(
      s.obraId,
      (gastoPorObra.get(s.obraId) || 0) + s.valorTotal
    );
  });

  // Gasto por etapa (filtrado) - distribui proporcional pelas alocacoes
  const gastoPorEtapa = new Map<string, number>();
  saidas.forEach((s) => {
    s.alocacoes.forEach((a) => {
      const valorProporcional = s.valorTotal * (a.percentual / 100);
      gastoPorEtapa.set(
        a.etapaId,
        (gastoPorEtapa.get(a.etapaId) || 0) + valorProporcional
      );
    });
  });

  // Agrupa etapas por obra para exibicao
  const gastoEtapaPorObra = new Map<string, { etapaNome: string; valor: number }[]>();
  gastoPorEtapa.forEach((valor, etapaId) => {
    const etapa = etapasMap.get(etapaId);
    if (!etapa) return;
    const obraNome = obrasMap.get(etapa.obraId) || 'Obra desconhecida';
    if (!gastoEtapaPorObra.has(obraNome))
      gastoEtapaPorObra.set(obraNome, []);
    gastoEtapaPorObra
      .get(obraNome)!
      .push({ etapaNome: etapa.nome, valor });
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
            {entradas.length} entrada{entradas.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Saidas</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatCurrency(totalGastoSaidas)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {saidas.length} saida{saidas.length !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Saldo de Insumos */}
      {estoquePorInsumo.size > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Saldo de Insumos
          </h3>
          <div className="flex flex-wrap gap-3">
            {Array.from(estoquePorInsumo.entries()).map(([insumoId, qtd]) => {
              const insumo = insumosMap.get(insumoId);
              return (
                <div
                  key={insumoId}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <span className="text-sm font-medium text-blue-800">
                    {insumo?.nome || insumoId}
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {qtd.toFixed(qtd % 1 === 0 ? 0 : 2)} {insumo?.unidade || ''}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Saldo por Deposito */}
      {estoquePorDeposito.size > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Saldo por Deposito
          </h3>
          <div className="space-y-3">
            {Array.from(estoquePorDeposito.entries()).map(
              ([depId, materiais]) => {
                const dep = depositosMap.get(depId);
                return (
                  <div
                    key={depId}
                    className="border border-gray-100 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {dep?.nome || depId}
                      </span>
                      <span className="text-xs text-gray-400">
                        {dep ? obrasMap.get(dep.obraId) || '' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(materiais.entries()).map(
                        ([insId, qtd]) => {
                          const insumo = insumosMap.get(insId);
                          return (
                            <div
                              key={insId}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200"
                            >
                              <span className="text-xs font-medium text-orange-800">
                                {insumo?.nome || insId}
                              </span>
                              <span className="text-xs font-bold text-orange-900">
                                {qtd.toFixed(qtd % 1 === 0 ? 0 : 2)}{' '}
                                {insumo?.unidade || ''}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </Card>
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

      {/* Gasto por Material */}
      {(() => {
        const gastoPorMaterial = new Map<string, number>();
        saidas.forEach((s) => {
          gastoPorMaterial.set(
            s.insumoId,
            (gastoPorMaterial.get(s.insumoId) || 0) + s.valorTotal
          );
        });
        const chartDataMaterial = Array.from(gastoPorMaterial.entries())
          .map(([insumoId, valor]) => ({
            nome: insumosMap.get(insumoId)?.nome || insumoId,
            valor: parseFloat(valor.toFixed(2)),
          }))
          .sort((a, b) => b.valor - a.valor);

        if (chartDataMaterial.length === 0) return null;

        return (
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Gasto por Material (R$)
            </h3>
            <div style={{ height: Math.max(200, chartDataMaterial.length * 40 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataMaterial} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    fontSize={12}
                    width={120}
                    tick={{ fill: '#374151' }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="valor" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })()}

      {/* Gasto por Obra e Etapa */}
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
          {gastoEtapaPorObra.size === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados</p>
          ) : (
            <div className="space-y-4">
              {Array.from(gastoEtapaPorObra.entries()).map(
                ([obraNome, items]) => (
                  <div key={obraNome}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      {obraNome}
                    </p>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
                        >
                          <span className="text-sm text-gray-700">
                            {item.etapaNome}
                          </span>
                          <span className="text-sm font-medium">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
