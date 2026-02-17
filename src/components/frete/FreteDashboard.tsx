import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Frete, PagamentoFrete, AbastecimentoCarreta, Obra, PedidoMaterial, Fornecedor } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';

const METODO_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferencia',
  combustivel: 'Combustivel',
};

function formatMesRef(mesRef: string): string {
  if (!mesRef) return '-';
  const [ano, mes] = mesRef.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
}

interface FreteDashboardProps {
  fretes: Frete[];
  pagamentos: PagamentoFrete[];
  abastecimentosCarreta: AbastecimentoCarreta[];
  obras: Obra[];
  pedidosMaterial: PedidoMaterial[];
  fornecedores: Fornecedor[];
}

export default function FreteDashboard({
  fretes,
  pagamentos,
  abastecimentosCarreta,
  obras,
  pedidosMaterial,
  fornecedores,
}: FreteDashboardProps) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));

  // ── Totais ──
  const totalFretes = fretes.reduce((sum, f) => sum + f.valorTotal, 0);
  const totalPagamentos = pagamentos.reduce((sum, p) => sum + p.valor, 0);
  const saldo = totalFretes - totalPagamentos;

  // ── Gasto mensal em fretes (chart) ──
  const gastoMensal = new Map<string, number>();
  fretes.forEach((f) => {
    if (!f.data) return;
    const key = f.data.slice(0, 7); // "YYYY-MM"
    gastoMensal.set(key, (gastoMensal.get(key) || 0) + f.valorTotal);
  });

  // ── Pagamentos mensais (chart) ──
  const pagMensal = new Map<string, number>();
  pagamentos.forEach((p) => {
    if (!p.mesReferencia) return;
    pagMensal.set(p.mesReferencia, (pagMensal.get(p.mesReferencia) || 0) + p.valor);
  });

  // ── Chart combinado: fretes vs pagamentos por mes ──
  const allMonths = new Set<string>();
  gastoMensal.forEach((_, k) => allMonths.add(k));
  pagMensal.forEach((_, k) => allMonths.add(k));

  const chartComparado = Array.from(allMonths)
    .sort()
    .map((mes) => ({
      mes: formatMesRef(mes),
      fretes: parseFloat((gastoMensal.get(mes) || 0).toFixed(2)),
      pagamentos: parseFloat((pagMensal.get(mes) || 0).toFixed(2)),
    }));

  // ── Gasto por transportadora ──
  const gastoPorTransportadora = new Map<string, number>();
  fretes.forEach((f) => {
    if (!f.transportadora) return;
    gastoPorTransportadora.set(
      f.transportadora,
      (gastoPorTransportadora.get(f.transportadora) || 0) + f.valorTotal
    );
  });
  const listaTransportadoras = Array.from(gastoPorTransportadora.entries())
    .sort((a, b) => b[1] - a[1]);

  // ── Pagamentos por transportadora ──
  const pagPorTransportadora = new Map<string, number>();
  pagamentos.forEach((p) => {
    if (!p.transportadora) return;
    pagPorTransportadora.set(
      p.transportadora,
      (pagPorTransportadora.get(p.transportadora) || 0) + p.valor
    );
  });

  // ── Gasto por obra ──
  const gastoPorObra = new Map<string, number>();
  fretes.forEach((f) => {
    if (!f.obraId) return;
    gastoPorObra.set(f.obraId, (gastoPorObra.get(f.obraId) || 0) + f.valorTotal);
  });

  // ── Gasto por material ──
  const gastoPorMaterial = new Map<string, number>();
  fretes.forEach((f) => {
    if (!f.insumoId) return;
    gastoPorMaterial.set(f.insumoId, (gastoPorMaterial.get(f.insumoId) || 0) + f.valorTotal);
  });

  // ── Quantidade de material transportado / em transito ──
  const materialTransporte = new Map<string, { entregue: number; transito: number; pesoEntregue: number; pesoTransito: number }>();
  fretes.forEach((f) => {
    if (!f.insumoId) return;
    const prev = materialTransporte.get(f.insumoId) || { entregue: 0, transito: 0, pesoEntregue: 0, pesoTransito: 0 };
    if (f.dataChegada) {
      materialTransporte.set(f.insumoId, {
        ...prev,
        entregue: prev.entregue + 1,
        pesoEntregue: prev.pesoEntregue + f.pesoToneladas,
      });
    } else {
      materialTransporte.set(f.insumoId, {
        ...prev,
        transito: prev.transito + 1,
        pesoTransito: prev.pesoTransito + f.pesoToneladas,
      });
    }
  });
  const listaMaterialTransporte = Array.from(materialTransporte.entries())
    .sort((a, b) => (b[1].pesoEntregue + b[1].pesoTransito) - (a[1].pesoEntregue + a[1].pesoTransito));

  // ── Abastecimentos carreta por transportadora ──
  const abastPorTransportadora = new Map<string, { valor: number; litros: number; count: number }>();
  abastecimentosCarreta.forEach((a) => {
    if (!a.transportadora) return;
    const prev = abastPorTransportadora.get(a.transportadora) || { valor: 0, litros: 0, count: 0 };
    abastPorTransportadora.set(a.transportadora, {
      valor: prev.valor + a.valorTotal,
      litros: prev.litros + a.quantidadeLitros,
      count: prev.count + 1,
    });
  });
  const totalAbastCarreta = abastecimentosCarreta.reduce((s, a) => s + a.valorTotal, 0);

  // ── Pagamentos por metodo ──
  const pagPorMetodo = new Map<string, number>();
  pagamentos.forEach((p) => {
    pagPorMetodo.set(p.metodo, (pagPorMetodo.get(p.metodo) || 0) + p.valor);
  });

  // ── Pagamentos por empresa (pagoPor) + abastecimentos como Areacre ──
  const pagPorPessoa = new Map<string, { valor: number; count: number }>();
  pagamentos.forEach((p) => {
    const nome = p.pagoPor?.trim() || '';
    if (!nome) return;
    const prev = pagPorPessoa.get(nome) || { valor: 0, count: 0 };
    pagPorPessoa.set(nome, { valor: prev.valor + p.valor, count: prev.count + 1 });
  });
  // Abastecimentos contam como pagos pela Areacre
  if (totalAbastCarreta > 0) {
    const prevAreacre = pagPorPessoa.get('Areacre') || { valor: 0, count: 0 };
    pagPorPessoa.set('Areacre', {
      valor: prevAreacre.valor + totalAbastCarreta,
      count: prevAreacre.count + abastecimentosCarreta.length,
    });
  }
  const listaPagPorPessoa = Array.from(pagPorPessoa.entries())
    .sort((a, b) => b[1].valor - a[1].valor);
  const totalPagoPorPessoa = listaPagPorPessoa.reduce((s, [, d]) => s + d.valor, 0);

  // ── Pedidos de Material por Fornecedor ──
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f.nome]));
  // Agregar: fornecedorId -> material (insumoId) -> { qtd, valor }
  const pedidosPorFornecedor = new Map<string, Map<string, { qtd: number; valor: number }>>();
  pedidosMaterial.forEach((p) => {
    if (!p.fornecedorId) return;
    let materiaisMap = pedidosPorFornecedor.get(p.fornecedorId);
    if (!materiaisMap) {
      materiaisMap = new Map();
      pedidosPorFornecedor.set(p.fornecedorId, materiaisMap);
    }
    (p.itens || []).forEach((item) => {
      const prev = materiaisMap!.get(item.insumoId) || { qtd: 0, valor: 0 };
      materiaisMap!.set(item.insumoId, {
        qtd: prev.qtd + item.quantidade,
        valor: prev.valor + item.quantidade * item.valorUnitario,
      });
    });
  });
  // Flatten para lista de linhas agrupadas por fornecedor
  const pedidosFornecedorRows: { fornecedorId: string; fornecedorNome: string; insumoId: string; qtd: number; valor: number; vlrMedio: number }[] = [];
  let totalGeralPedidos = 0;
  const totaisPorFornecedor: { fornecedorId: string; fornecedorNome: string; total: number }[] = [];
  Array.from(pedidosPorFornecedor.entries())
    .sort((a, b) => {
      const nomeA = fornecedoresMap.get(a[0]) || '';
      const nomeB = fornecedoresMap.get(b[0]) || '';
      return nomeA.localeCompare(nomeB);
    })
    .forEach(([fornecedorId, materiaisMap]) => {
      let totalFornecedor = 0;
      const fornecedorNome = fornecedoresMap.get(fornecedorId) || fornecedorId;
      Array.from(materiaisMap.entries())
        .sort((a, b) => b[1].valor - a[1].valor)
        .forEach(([insumoId, dados]) => {
          const vlrMedio = dados.qtd > 0 ? dados.valor / dados.qtd : 0;
          pedidosFornecedorRows.push({ fornecedorId, fornecedorNome, insumoId, qtd: dados.qtd, valor: dados.valor, vlrMedio });
          totalFornecedor += dados.valor;
        });
      totaisPorFornecedor.push({ fornecedorId, fornecedorNome, total: totalFornecedor });
      totalGeralPedidos += totalFornecedor;
    });

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Fretes</p>
          <p className="text-2xl font-bold text-emt-verde mt-1">
            {formatCurrency(totalFretes)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {fretes.length} frete{fretes.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Pagamentos</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(totalPagamentos)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {pagamentos.length} pagamento{pagamentos.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Saldo (Fretes - Pagamentos)</p>
          <p className={`text-2xl font-bold mt-1 ${saldo >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(saldo)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {saldo > 0 ? 'A pagar' : saldo < 0 ? 'Pago a mais' : 'Quitado'}
          </p>
        </Card>
      </div>

      {/* Grafico comparado: fretes vs pagamentos por mes */}
      {chartComparado.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Fretes x Pagamentos por Mes (R$)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartComparado}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="fretes" fill="#16a34a" radius={[4, 4, 0, 0]} name="Fretes" />
                <Bar dataKey="pagamentos" fill="#2563eb" radius={[4, 4, 0, 0]} name="Pagamentos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Gasto por transportadora com saldo */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Resumo por Transportadora
        </h3>
        {listaTransportadoras.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Transportadora</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Fretes</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Pagamentos</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Abastecimentos</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Pago</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaTransportadoras.map(([nome, valorFretes]) => {
                  const valorPagamentos = pagPorTransportadora.get(nome) || 0;
                  const valorAbast = abastPorTransportadora.get(nome)?.valor || 0;
                  const valorPago = valorPagamentos + valorAbast;
                  const saldoT = valorFretes - valorPago;
                  return (
                    <tr key={nome} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{nome}</td>
                      <td className="px-4 py-2 text-right text-emt-verde">{formatCurrency(valorFretes)}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(valorPagamentos)}</td>
                      <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(valorAbast)}</td>
                      <td className="px-4 py-2 text-right text-purple-600">{formatCurrency(valorPago)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${saldoT > 0 ? 'text-red-600' : saldoT < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {formatCurrency(saldoT)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right text-emt-verde">{formatCurrency(totalFretes)}</td>
                  <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(totalPagamentos)}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(totalAbastCarreta)}</td>
                  <td className="px-4 py-2 text-right text-purple-600">{formatCurrency(totalPagamentos + totalAbastCarreta)}</td>
                  <td className={`px-4 py-2 text-right ${(totalFretes - totalPagamentos - totalAbastCarreta) > 0 ? 'text-red-600' : (totalFretes - totalPagamentos - totalAbastCarreta) < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {formatCurrency(totalFretes - totalPagamentos - totalAbastCarreta)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Pedidos de Material por Fornecedor */}
      {pedidosFornecedorRows.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Pedidos de Material por Fornecedor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Fornecedor</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Material</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Qtd Total</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Vlr Medio Unit (R$)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Valor Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {totaisPorFornecedor.map((forn) => {
                  const rows = pedidosFornecedorRows.filter((r) => r.fornecedorId === forn.fornecedorId);
                  return (
                    <>{/* Fragment per fornecedor */}
                      <tr key={`header-${forn.fornecedorId}`} className="bg-gray-50">
                        <td colSpan={4} className="px-4 py-2 font-semibold text-gray-700">{forn.fornecedorNome}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-700">{formatCurrency(forn.total)}</td>
                      </tr>
                      {rows.map((r) => (
                        <tr key={`${r.fornecedorId}-${r.insumoId}`} className="hover:bg-gray-50">
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2 text-gray-700">{insumosMap.get(r.insumoId) || r.insumoId}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{r.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.vlrMedio)}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.valor)}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-gray-700">Total Geral</td>
                  <td className="px-4 py-2 text-right text-gray-800">{formatCurrency(totalGeralPedidos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Gasto por Obra e por Material */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Gasto por Obra
          </h3>
          {gastoPorObra.size === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {Array.from(gastoPorObra.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([obraId, valor]) => (
                  <div
                    key={obraId}
                    className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-gray-700">
                      {obrasMap.get(obraId) || 'Sem obra'}
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
            Gasto por Material
          </h3>
          {gastoPorMaterial.size === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados</p>
          ) : (
            <div className="space-y-2">
              {Array.from(gastoPorMaterial.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([insumoId, valor]) => (
                  <div
                    key={insumoId}
                    className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-gray-700">
                      {insumosMap.get(insumoId) || insumoId}
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

      {/* Material transportado / em transito */}
      {listaMaterialTransporte.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Material Transportado
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Material</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Viagens Entregues</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Peso Entregue (t)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Em Transito</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Peso em Transito (t)</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Total (t)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaMaterialTransporte.map(([insumoId, dados]) => (
                  <tr key={insumoId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{insumosMap.get(insumoId) || insumoId}</td>
                    <td className="px-4 py-2 text-right text-green-600">{dados.entregue}</td>
                    <td className="px-4 py-2 text-right text-green-600">{dados.pesoEntregue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-semibold">{dados.transito || '-'}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-semibold">{dados.transito > 0 ? dados.pesoTransito.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-800">{(dados.pesoEntregue + dados.pesoTransito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right text-green-600">{listaMaterialTransporte.reduce((s, [, d]) => s + d.entregue, 0)}</td>
                  <td className="px-4 py-2 text-right text-green-600">{listaMaterialTransporte.reduce((s, [, d]) => s + d.pesoEntregue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{listaMaterialTransporte.reduce((s, [, d]) => s + d.transito, 0) || '-'}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{listaMaterialTransporte.reduce((s, [, d]) => s + d.pesoTransito, 0) > 0 ? listaMaterialTransporte.reduce((s, [, d]) => s + d.pesoTransito, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-800">{listaMaterialTransporte.reduce((s, [, d]) => s + d.pesoEntregue + d.pesoTransito, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Pagamentos por pessoa */}
      {listaPagPorPessoa.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Pagamentos por Empresa
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Empresa</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Pagamentos</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaPagPorPessoa.map(([nome, dados]) => (
                  <tr key={nome} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{nome}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{dados.count}</td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-600">{formatCurrency(dados.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right text-gray-600">{listaPagPorPessoa.reduce((s, [, d]) => s + d.count, 0)}</td>
                  <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(totalPagoPorPessoa)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Pagamentos por metodo */}
      {pagPorMetodo.size > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Pagamentos por Metodo
          </h3>
          <div className="flex flex-wrap gap-3">
            {Array.from(pagPorMetodo.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([metodo, valor]) => (
                <div
                  key={metodo}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <span className="text-sm font-medium text-blue-800">
                    {METODO_LABELS[metodo] || metodo}
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(valor)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
