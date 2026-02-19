import { Fragment, useState } from 'react';
import type { Frete, PagamentoFrete, AbastecimentoCarreta, Obra, PedidoMaterial, Fornecedor } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';

const METODO_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

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
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [obraIdFiltro, setObraIdFiltro] = useState('');

  // ── Filtrar por período ──
  const inRange = (d: string) => {
    if (!d) return true;
    if (dataInicio && d < dataInicio) return false;
    if (dataFim && d > dataFim) return false;
    return true;
  };
  const fretesF = fretes.filter((f) => {
    if (!inRange(f.data)) return false;
    if (obraIdFiltro && f.obraId !== obraIdFiltro) return false;
    return true;
  });
  const pagamentosF = pagamentos.filter((p) => {
    const mr = p.mesReferencia; // "YYYY-MM"
    if (!mr) return true;
    if (dataInicio && mr < dataInicio.slice(0, 7)) return false;
    if (dataFim && mr > dataFim.slice(0, 7)) return false;
    return true;
  });
  const abastCarretaF = abastecimentosCarreta.filter((a) => inRange(a.data));
  const pedidosF = pedidosMaterial.filter((p) => inRange(p.data));

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));

  // ── Totais ──
  const totalFretes = fretesF.reduce((sum, f) => sum + f.valorTotal, 0);

  // ── Saldo Areacre ──
  const totalAbastCarreta = abastCarretaF.reduce((s, a) => s + a.valorTotal, 0);
  const fretesAreacre = fretesF.filter((f) => f.transportadora === 'Areacre').reduce((s, f) => s + f.valorTotal, 0);
  const pagosParaAreacre = pagamentosF.filter((p) => p.transportadora === 'Areacre' && p.pagoPor?.trim() !== 'Areacre').reduce((s, p) => s + p.valor, 0);
  const saldoAreacre = fretesAreacre - pagosParaAreacre + totalAbastCarreta;

  // ── Saldo Amazonia Agroindustria ──
  const AMAZONIA = 'Amazonia Agroindustria';
  const fretesAmazonia = fretesF.filter((f) => f.transportadora === AMAZONIA).reduce((s, f) => s + f.valorTotal, 0);
  const abastAmazonia = abastCarretaF.filter((a) => a.transportadora === AMAZONIA).reduce((s, a) => s + a.valorTotal, 0);
  const pagosParaAmazonia = pagamentosF.filter((p) => p.transportadora === AMAZONIA).reduce((s, p) => s + p.valor, 0);
  const pagosPelaAmazonia = pagamentosF.filter((p) => p.pagoPor?.trim() === AMAZONIA).reduce((s, p) => s + p.valor, 0);
  const saldoAmazonia = fretesAmazonia - abastAmazonia - pagosParaAmazonia + pagosPelaAmazonia;

  // ── Saldo Triunfo ──
  const TRIUNFO = 'Transportadora Triunfo';
  const fretesTriunfo = fretesF.filter((f) => f.transportadora === TRIUNFO).reduce((s, f) => s + f.valorTotal, 0);
  const pagosParaTriunfo = pagamentosF.filter((p) => p.transportadora === TRIUNFO).reduce((s, p) => s + p.valor, 0);
  const abastTriunfo = abastCarretaF.filter((a) => a.transportadora === TRIUNFO).reduce((s, a) => s + a.valorTotal, 0);
  const saldoTriunfo = fretesTriunfo - pagosParaTriunfo - abastTriunfo;

  // ── Pagamentos EMT Construtora ──
  const EMT = 'EMT Construtora';
  const pagamentosEmt = pagamentosF.filter((p) => p.pagoPor?.trim() === EMT);
  const pagosPelaEmt = pagamentosEmt.reduce((s, p) => s + p.valor, 0);

  // ── Saldo ETAM Construtora ──
  const ETAM = 'ETAM Construtora';
  const fretesEtam = fretesF.filter((f) => f.transportadora === ETAM).reduce((s, f) => s + f.valorTotal, 0);
  const pagosPelaEtam = pagamentosF.filter((p) => p.pagoPor?.trim() === ETAM).reduce((s, p) => s + p.valor, 0);
  const pagosParaEtam = pagamentosF.filter((p) => p.transportadora === ETAM).reduce((s, p) => s + p.valor, 0);
  const saldoEtam = fretesEtam + pagosPelaEtam - pagosParaEtam;

  // ── A Pagar EMT ──
  const aPagarEmt = saldoAreacre + saldoAmazonia + saldoTriunfo + saldoEtam;

  // ── Media ponderada de km (peso como peso) ──
  const totalPesoKm = fretesF.reduce((sum, f) => sum + f.kmRodados * f.pesoToneladas, 0);
  const totalPeso = fretesF.reduce((sum, f) => sum + f.pesoToneladas, 0);
  const mediaKmPonderada = totalPeso > 0 ? totalPesoKm / totalPeso : 0;

  // ── Gasto por transportadora ──
  const gastoPorTransportadora = new Map<string, number>();
  const tkmPorTransportadora = new Map<string, { somaValorTkm: number; somaTkm: number; count: number }>();
  fretesF.forEach((f) => {
    if (!f.transportadora) return;
    gastoPorTransportadora.set(
      f.transportadora,
      (gastoPorTransportadora.get(f.transportadora) || 0) + f.valorTotal
    );
    const prev = tkmPorTransportadora.get(f.transportadora) || { somaValorTkm: 0, somaTkm: 0, count: 0 };
    tkmPorTransportadora.set(f.transportadora, {
      somaValorTkm: prev.somaValorTkm + f.valorTkm,
      somaTkm: prev.somaTkm + f.kmRodados * f.pesoToneladas,
      count: prev.count + 1,
    });
  });
  const listaTransportadoras = Array.from(gastoPorTransportadora.entries())
    .sort((a, b) => b[1] - a[1]);

  // ── Gasto por obra ──
  const gastoPorObra = new Map<string, number>();
  fretesF.forEach((f) => {
    if (!f.obraId) return;
    gastoPorObra.set(f.obraId, (gastoPorObra.get(f.obraId) || 0) + f.valorTotal);
  });

  // ── Gasto com transporte por material e pedreira (origem) ──
  const gastoTranspMatPedreira = new Map<string, Map<string, { valor: number; peso: number }>>();
  fretesF.forEach((f) => {
    if (!f.insumoId || !f.origem) return;
    const origem = f.origem.trim();
    let matMap = gastoTranspMatPedreira.get(origem);
    if (!matMap) {
      matMap = new Map();
      gastoTranspMatPedreira.set(origem, matMap);
    }
    const prev = matMap.get(f.insumoId) || { valor: 0, peso: 0 };
    matMap.set(f.insumoId, { valor: prev.valor + f.valorTotal, peso: prev.peso + f.pesoToneladas });
  });
  // Flatten para lista agrupada
  interface TranspMatRow { origem: string; insumoId: string; valor: number; peso: number; custoMedioTon: number }
  const transpMatRows: TranspMatRow[] = [];
  const totaisPorPedreira: { origem: string; totalValor: number; totalPeso: number }[] = [];
  let totalGeralTranspMat = 0;
  let totalGeralTranspPeso = 0;
  Array.from(gastoTranspMatPedreira.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([origem, matMap]) => {
      let pedrValor = 0;
      let pedrPeso = 0;
      Array.from(matMap.entries())
        .sort((a, b) => b[1].valor - a[1].valor)
        .forEach(([insumoId, d]) => {
          const custoMedioTon = d.peso > 0 ? d.valor / d.peso : 0;
          transpMatRows.push({ origem, insumoId, valor: d.valor, peso: d.peso, custoMedioTon });
          pedrValor += d.valor;
          pedrPeso += d.peso;
        });
      totaisPorPedreira.push({ origem, totalValor: pedrValor, totalPeso: pedrPeso });
      totalGeralTranspMat += pedrValor;
      totalGeralTranspPeso += pedrPeso;
    });

  // ── Quantidade de material transportado / em transito ──
  const materialTransporte = new Map<string, { entregue: number; transito: number; pesoEntregue: number; pesoTransito: number }>();
  fretesF.forEach((f) => {
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

  // ── Pagamentos por empresa (pagoPor) + abastecimentos como Areacre ──
  const pagPorPessoa = new Map<string, { valor: number; count: number }>();
  pagamentosF.forEach((p) => {
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
      count: prevAreacre.count + abastCarretaF.length,
    });
  }
  const listaPagPorPessoa = Array.from(pagPorPessoa.entries())
    .sort((a, b) => b[1].valor - a[1].valor);
  const totalPagoPorPessoa = listaPagPorPessoa.reduce((s, [, d]) => s + d.valor, 0);

  // ── Pagamentos por empresa × método ──
  const pagEmpresaMetodo = new Map<string, Map<string, number>>();
  const todosMetodosSet = new Set<string>();
  pagamentosF.forEach((p) => {
    const nome = p.pagoPor?.trim() || '';
    if (!nome) return;
    todosMetodosSet.add(p.metodo);
    let metMap = pagEmpresaMetodo.get(nome);
    if (!metMap) { metMap = new Map(); pagEmpresaMetodo.set(nome, metMap); }
    metMap.set(p.metodo, (metMap.get(p.metodo) || 0) + p.valor);
  });
  const todosMetodos = Array.from(todosMetodosSet).sort((a, b) => {
    const ordem = ['pix', 'boleto', 'cheque', 'dinheiro', 'transferencia', 'combustivel'];
    return ordem.indexOf(a) - ordem.indexOf(b);
  });
  const listaEmpresaMetodo = Array.from(pagEmpresaMetodo.entries())
    .map(([nome, metMap]) => {
      const total = Array.from(metMap.values()).reduce((s, v) => s + v, 0);
      return { nome, metMap, total };
    })
    .sort((a, b) => b.total - a.total);
  const totalGeralEmpresaMetodo = listaEmpresaMetodo.reduce((s, e) => s + e.total, 0);

  // ── Abastecimentos por transportadora × placa ──
  const abastEmpresaPlaca = new Map<string, Map<string, { litros: number; valor: number; count: number }>>();
  abastCarretaF.forEach((a) => {
    const empresa = a.transportadora?.trim() || '';
    const placa = a.placaCarreta?.trim() || 'Sem placa';
    if (!empresa) return;
    let placaMap = abastEmpresaPlaca.get(empresa);
    if (!placaMap) { placaMap = new Map(); abastEmpresaPlaca.set(empresa, placaMap); }
    const prev = placaMap.get(placa) || { litros: 0, valor: 0, count: 0 };
    placaMap.set(placa, { litros: prev.litros + a.quantidadeLitros, valor: prev.valor + a.valorTotal, count: prev.count + 1 });
  });
  const listaAbastEmpresa = Array.from(abastEmpresaPlaca.entries())
    .map(([empresa, placaMap]) => {
      const placas = Array.from(placaMap.entries())
        .map(([placa, d]) => ({ placa, ...d }))
        .sort((a, b) => b.valor - a.valor);
      const totalLitros = placas.reduce((s, p) => s + p.litros, 0);
      const totalValor = placas.reduce((s, p) => s + p.valor, 0);
      const totalCount = placas.reduce((s, p) => s + p.count, 0);
      return { empresa, placas, totalLitros, totalValor, totalCount };
    })
    .sort((a, b) => b.totalValor - a.totalValor);

  // ── Pedidos de Material por Fornecedor ──
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f.nome]));
  // Busca fornecedorId pela origem do frete (match flexivel: "Britam" casa com "Pedreira Britam")
  const fornecedorList = fornecedores.map((f) => ({ id: f.id, nomeLower: f.nome.toLowerCase().trim() }));
  function findFornecedorByOrigem(origem: string): string | undefined {
    const o = origem.toLowerCase().trim();
    // Primeiro tenta match exato
    const exact = fornecedorList.find((f) => f.nomeLower === o);
    if (exact) return exact.id;
    // Depois tenta: origem contida no nome do fornecedor ou vice-versa
    const partial = fornecedorList.find((f) => f.nomeLower.includes(o) || o.includes(f.nomeLower));
    return partial?.id;
  }
  // Mapas de transporte: "fornecedorId|insumoId" -> qtdTransportada / custoFrete
  const transporteMap = new Map<string, number>();
  const freteValorMap = new Map<string, number>();
  fretesF.forEach((f) => {
    if (!f.origem || !f.insumoId) return;
    const fornecedorId = findFornecedorByOrigem(f.origem);
    if (!fornecedorId) return;
    const key = `${fornecedorId}|${f.insumoId}`;
    transporteMap.set(key, (transporteMap.get(key) || 0) + f.pesoToneladas);
    freteValorMap.set(key, (freteValorMap.get(key) || 0) + f.valorTotal);
  });
  // Agregar: fornecedorId -> material (insumoId) -> { qtd, valor }
  const pedidosPorFornecedor = new Map<string, Map<string, { qtd: number; valor: number }>>();
  pedidosF.forEach((p) => {
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
  interface PedidoFornRow { fornecedorId: string; fornecedorNome: string; insumoId: string; qtd: number; qtdTransportada: number; saldoQtd: number; vlrMedio: number; custoMedioFrete: number; valor: number; saldoValor: number }
  const pedidosFornecedorRows: PedidoFornRow[] = [];
  let totalGeralQtd = 0;
  let totalGeralQtdTransp = 0;
  let totalGeralPedidos = 0;
  let totalGeralFreteValor = 0;
  let totalGeralSaldoValor = 0;
  const totaisPorFornecedor: { fornecedorId: string; fornecedorNome: string; totalQtd: number; totalQtdTransp: number; totalValor: number; totalFreteValor: number; totalSaldoValor: number }[] = [];
  Array.from(pedidosPorFornecedor.entries())
    .sort((a, b) => {
      const nomeA = fornecedoresMap.get(a[0]) || '';
      const nomeB = fornecedoresMap.get(b[0]) || '';
      return nomeA.localeCompare(nomeB);
    })
    .forEach(([fornecedorId, materiaisMap]) => {
      let fornQtd = 0;
      let fornQtdTransp = 0;
      let fornValor = 0;
      let fornFreteValor = 0;
      let fornSaldoValor = 0;
      const fornecedorNome = fornecedoresMap.get(fornecedorId) || fornecedorId;
      Array.from(materiaisMap.entries())
        .sort((a, b) => b[1].valor - a[1].valor)
        .forEach(([insumoId, dados]) => {
          const vlrMedio = dados.qtd > 0 ? dados.valor / dados.qtd : 0;
          const key = `${fornecedorId}|${insumoId}`;
          const qtdTransportada = transporteMap.get(key) || 0;
          const freteValor = freteValorMap.get(key) || 0;
          const custoMedioFrete = qtdTransportada > 0 ? freteValor / qtdTransportada : 0;
          const saldoQtd = dados.qtd - qtdTransportada;
          const saldoValor = saldoQtd * vlrMedio;
          pedidosFornecedorRows.push({ fornecedorId, fornecedorNome, insumoId, qtd: dados.qtd, qtdTransportada, saldoQtd, vlrMedio, custoMedioFrete, valor: dados.valor, saldoValor });
          fornQtd += dados.qtd;
          fornQtdTransp += qtdTransportada;
          fornValor += dados.valor;
          fornFreteValor += freteValor;
          fornSaldoValor += saldoValor;
        });
      totaisPorFornecedor.push({ fornecedorId, fornecedorNome, totalQtd: fornQtd, totalQtdTransp: fornQtdTransp, totalValor: fornValor, totalFreteValor: fornFreteValor, totalSaldoValor: fornSaldoValor });
      totalGeralQtd += fornQtd;
      totalGeralQtdTransp += fornQtdTransp;
      totalGeralPedidos += fornValor;
      totalGeralFreteValor += fornFreteValor;
      totalGeralSaldoValor += fornSaldoValor;
    });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Obra</label>
          <select
            value={obraIdFiltro}
            onChange={(e) => setObraIdFiltro(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white h-[34px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicio</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(dataInicio || dataFim || obraIdFiltro) && (
          <button
            onClick={() => { setDataInicio(''); setDataFim(''); setObraIdFiltro(''); }}
            className="text-sm text-red-600 hover:text-red-800 font-medium pb-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Cards resumo - fileira 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Fretes</p>
          <p className="text-2xl font-bold text-emt-verde mt-1">
            {formatCurrency(totalFretes)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {fretesF.length} frete{fretesF.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pagamentos EMT</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(pagosPelaEmt)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {pagamentosEmt.length} pagamento{pagamentosEmt.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">A Pagar EMT</p>
          <p className={`text-2xl font-bold mt-1 ${aPagarEmt > 0 ? 'text-red-600' : aPagarEmt < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(aPagarEmt)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Areacre: {formatCurrency(saldoAreacre)}</p>
            <p>Amazonia: {formatCurrency(saldoAmazonia)}</p>
            <p>Triunfo: {formatCurrency(saldoTriunfo)}</p>
            <p>ETAM: {formatCurrency(saldoEtam)}</p>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Media Ponderada KM</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            {mediaKmPonderada.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t transportadas
          </p>
        </Card>
      </div>

      {/* Cards resumo - fileira 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Saldo Areacre</p>
          <p className={`text-2xl font-bold mt-1 ${saldoAreacre > 0 ? 'text-red-600' : saldoAreacre < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoAreacre)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Fretes: {formatCurrency(fretesAreacre)}</p>
            <p>Pago p/ Areacre: −{formatCurrency(pagosParaAreacre)}</p>
            <p>Abastecimentos: +{formatCurrency(totalAbastCarreta)}</p>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Saldo Amazonia</p>
          <p className={`text-2xl font-bold mt-1 ${saldoAmazonia > 0 ? 'text-red-600' : saldoAmazonia < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoAmazonia)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Fretes: {formatCurrency(fretesAmazonia)}</p>
            <p>Abastecimentos: −{formatCurrency(abastAmazonia)}</p>
            <p>Pago p/ Amazonia: −{formatCurrency(pagosParaAmazonia)}</p>
            <p>Pago pela Amazonia: +{formatCurrency(pagosPelaAmazonia)}</p>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Saldo Triunfo</p>
          <p className={`text-2xl font-bold mt-1 ${saldoTriunfo > 0 ? 'text-red-600' : saldoTriunfo < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoTriunfo)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Fretes: {formatCurrency(fretesTriunfo)}</p>
            <p>Pago p/ Triunfo: −{formatCurrency(pagosParaTriunfo)}</p>
            <p>Abastecimentos: −{formatCurrency(abastTriunfo)}</p>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Saldo ETAM</p>
          <p className={`text-2xl font-bold mt-1 ${saldoEtam > 0 ? 'text-red-600' : saldoEtam < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoEtam)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Total Fretes: {formatCurrency(fretesEtam)}</p>
            <p>Pago pela Etam: +{formatCurrency(pagosPelaEtam)}</p>
            <p>Pago p/ Etam: −{formatCurrency(pagosParaEtam)}</p>
          </div>
        </Card>
      </div>

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
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Total TKM</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Valor Médio do TKM</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Fretes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaTransportadoras.map(([nome, valorFretes]) => {
                  const tkmData = tkmPorTransportadora.get(nome);
                  const tkmMedio = tkmData && tkmData.count > 0 ? tkmData.somaValorTkm / tkmData.count : 0;
                  const totalTkm = tkmData?.somaTkm || 0;
                  return (
                    <tr key={nome} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{nome}</td>
                      <td className="px-4 py-2 text-center text-gray-700">{totalTkm > 0 ? totalTkm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-4 py-2 text-center text-orange-600">{tkmMedio > 0 ? formatCurrency(tkmMedio) : '-'}</td>
                      <td className="px-4 py-2 text-center text-emt-verde">{formatCurrency(valorFretes)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  <td className="px-4 py-2 text-center text-gray-700">{fretesF.reduce((s, f) => s + f.kmRodados * f.pesoToneladas, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-center text-orange-600">{fretesF.length > 0 ? formatCurrency(fretesF.reduce((s, f) => s + f.valorTkm, 0) / fretesF.length) : '-'}</td>
                  <td className="px-4 py-2 text-center text-emt-verde">{formatCurrency(totalFretes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Pagamentos por Empresa e Método */}
      {listaEmpresaMetodo.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Pagamentos por Empresa e Método
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Empresa</th>
                  {todosMetodos.map((m) => (
                    <th key={m} className="text-center px-4 py-2 font-medium text-gray-600">{METODO_LABELS[m] || m}</th>
                  ))}
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listaEmpresaMetodo.map(({ nome, metMap, total }) => (
                  <tr key={nome} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{nome}</td>
                    {todosMetodos.map((m) => {
                      const val = metMap.get(m) || 0;
                      return (
                        <td key={m} className="px-4 py-2 text-center text-gray-600">
                          {val > 0 ? formatCurrency(val) : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center font-semibold text-gray-800">{formatCurrency(total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  {todosMetodos.map((m) => {
                    const totalMetodo = listaEmpresaMetodo.reduce((s, e) => s + (e.metMap.get(m) || 0), 0);
                    return (
                      <td key={m} className="px-4 py-2 text-center text-gray-700">
                        {totalMetodo > 0 ? formatCurrency(totalMetodo) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-center font-bold text-gray-800">{formatCurrency(totalGeralEmpresaMetodo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Abastecimentos na Transterra */}
      {listaAbastEmpresa.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Abastecimentos na Transterra
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Empresa / Placa</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Abastecimentos</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Litros</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {listaAbastEmpresa.map(({ empresa, placas, totalLitros, totalValor, totalCount }) => (
                  <Fragment key={empresa}>
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                      <td className="px-4 py-2 font-bold text-gray-800">{empresa}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-600">{totalCount}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-600">{totalLitros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-700">{formatCurrency(totalValor)}</td>
                    </tr>
                    {placas.map((p) => (
                      <tr key={`${empresa}-${p.placa}`} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="px-4 py-1.5 pl-8 text-gray-600">{p.placa}</td>
                        <td className="px-4 py-1.5 text-center text-gray-600">{p.count}</td>
                        <td className="px-4 py-1.5 text-center text-gray-600">{p.litros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-1.5 text-center text-gray-700">{formatCurrency(p.valor)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-400">
                <tr className="font-bold bg-gray-100">
                  <td className="px-4 py-2 text-gray-800">Total Geral</td>
                  <td className="px-4 py-2 text-center text-gray-800">{listaAbastEmpresa.reduce((s, e) => s + e.totalCount, 0)}</td>
                  <td className="px-4 py-2 text-center text-gray-800">{listaAbastEmpresa.reduce((s, e) => s + e.totalLitros, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-center text-gray-800">{formatCurrency(listaAbastEmpresa.reduce((s, e) => s + e.totalValor, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Pedidos de Material por Fornecedor */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Pedidos de Material por Fornecedor
        </h3>
        {pedidosFornecedorRows.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Linha de grupo */}
                <tr className="border-b border-gray-200">
                  <th rowSpan={2} className="text-left px-3 py-2 font-semibold text-gray-700 bg-gray-50 border-b-2 border-gray-300">Material</th>
                  <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-blue-50 border-b border-blue-200">Pedido</th>
                  <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-emerald-50 border-b border-emerald-200">Transportado</th>
                  <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-amber-50 border-b border-amber-200">Saldo na Pedreira</th>
                  <th colSpan={3} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-purple-50 border-b border-purple-200">Custo R$/t</th>
                </tr>
                {/* Sub-colunas */}
                <tr className="border-b-2 border-gray-300">
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-blue-50 text-xs">Qtd (t)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-blue-50 text-xs">Valor (R$)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-emerald-50 text-xs">Qtd (t)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-emerald-50 text-xs">Valor (R$)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-amber-50 text-xs">Qtd (t)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-amber-50 text-xs">Valor (R$)</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-purple-50 text-xs">Material</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-purple-50 text-xs">Frete</th>
                  <th className="text-right px-3 py-1.5 font-medium text-gray-500 bg-purple-50 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {totaisPorFornecedor.map((forn) => {
                  const rows = pedidosFornecedorRows.filter((r) => r.fornecedorId === forn.fornecedorId);
                  const fornCustoMedioMat = forn.totalQtd > 0 ? forn.totalValor / forn.totalQtd : 0;
                  const fornCustoMedioFrete = forn.totalQtdTransp > 0 ? forn.totalFreteValor / forn.totalQtdTransp : 0;
                  return (
                    <Fragment key={forn.fornecedorId}>
                      {/* Sub-header do fornecedor */}
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-bold text-gray-800">{forn.fornecedorNome}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-600">{forn.totalQtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-600">{formatCurrency(forn.totalValor)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{forn.totalQtdTransp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(forn.totalValor - forn.totalSaldoValor)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${(forn.totalQtd - forn.totalQtdTransp) < 0 ? 'text-red-600' : (forn.totalQtd - forn.totalQtdTransp) === 0 ? 'text-gray-400' : 'text-green-600'}`}>{(forn.totalQtd - forn.totalQtdTransp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${forn.totalSaldoValor < 0 ? 'text-red-600' : forn.totalSaldoValor === 0 ? 'text-gray-400' : 'text-green-600'}`}>{formatCurrency(forn.totalSaldoValor)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-purple-700">{formatCurrency(fornCustoMedioMat)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-purple-700">{fornCustoMedioFrete > 0 ? formatCurrency(fornCustoMedioFrete) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold text-purple-800">{fornCustoMedioFrete > 0 ? formatCurrency(fornCustoMedioMat + fornCustoMedioFrete) : formatCurrency(fornCustoMedioMat)}</td>
                      </tr>
                      {/* Linhas de material */}
                      {rows.map((r) => (
                        <tr key={`${r.fornecedorId}-${r.insumoId}`} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-1.5 pl-6 text-gray-600">{insumosMap.get(r.insumoId) || r.insumoId}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{r.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(r.valor)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-600">{r.qtdTransportada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-600">{formatCurrency(r.qtdTransportada * r.vlrMedio)}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${r.saldoQtd < 0 ? 'text-red-600' : r.saldoQtd === 0 ? 'text-gray-400' : 'text-green-600'}`}>{r.saldoQtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${r.saldoValor < 0 ? 'text-red-600' : r.saldoValor === 0 ? 'text-gray-400' : 'text-green-600'}`}>{formatCurrency(r.saldoValor)}</td>
                          <td className="px-3 py-1.5 text-right text-purple-600">{formatCurrency(r.vlrMedio)}</td>
                          <td className="px-3 py-1.5 text-right text-purple-600">{r.custoMedioFrete > 0 ? formatCurrency(r.custoMedioFrete) : '-'}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-purple-700">{r.custoMedioFrete > 0 ? formatCurrency(r.vlrMedio + r.custoMedioFrete) : formatCurrency(r.vlrMedio)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                  <td className="px-3 py-2 text-gray-800">Total Geral</td>
                  <td className="px-3 py-2 text-right text-gray-800">{totalGeralQtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(totalGeralPedidos)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{totalGeralQtdTransp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(totalGeralPedidos - totalGeralSaldoValor)}</td>
                  <td className={`px-3 py-2 text-right ${(totalGeralQtd - totalGeralQtdTransp) < 0 ? 'text-red-600' : (totalGeralQtd - totalGeralQtdTransp) === 0 ? 'text-gray-400' : 'text-green-600'}`}>{(totalGeralQtd - totalGeralQtdTransp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className={`px-3 py-2 text-right ${totalGeralSaldoValor < 0 ? 'text-red-600' : totalGeralSaldoValor === 0 ? 'text-gray-400' : 'text-green-600'}`}>{formatCurrency(totalGeralSaldoValor)}</td>
                  <td className="px-3 py-2 text-right text-purple-700">{totalGeralQtd > 0 ? formatCurrency(totalGeralPedidos / totalGeralQtd) : '-'}</td>
                  <td className="px-3 py-2 text-right text-purple-700">{totalGeralQtdTransp > 0 ? formatCurrency(totalGeralFreteValor / totalGeralQtdTransp) : '-'}</td>
                  <td className="px-3 py-2 text-right text-purple-800">{totalGeralQtd > 0 ? formatCurrency((totalGeralPedidos / totalGeralQtd) + (totalGeralQtdTransp > 0 ? totalGeralFreteValor / totalGeralQtdTransp : 0)) : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Gasto com Transporte por Material e Pedreira */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Gasto com Transporte por Material e Pedreira
        </h3>
        {transpMatRows.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem dados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Pedreira / Material</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Peso (t)</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Custo Frete (R$)</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Custo R$/t</th>
                </tr>
              </thead>
              <tbody>
                {totaisPorPedreira.map((pedr) => {
                  const rows = transpMatRows.filter((r) => r.origem === pedr.origem);
                  const custoMedioPedr = pedr.totalPeso > 0 ? pedr.totalValor / pedr.totalPeso : 0;
                  return (
                    <Fragment key={pedr.origem}>
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-bold text-gray-800">{pedr.origem}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-600">{pedr.totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700">{formatCurrency(pedr.totalValor)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-purple-700">{formatCurrency(custoMedioPedr)}</td>
                      </tr>
                      {rows.map((r) => (
                        <tr key={`${r.origem}-${r.insumoId}`} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-1.5 pl-6 text-gray-600">{insumosMap.get(r.insumoId) || r.insumoId}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{r.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(r.valor)}</td>
                          <td className="px-3 py-1.5 text-right text-purple-600">{formatCurrency(r.custoMedioTon)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                  <td className="px-3 py-2 text-gray-800">Total Geral</td>
                  <td className="px-3 py-2 text-right text-gray-800">{totalGeralTranspPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(totalGeralTranspMat)}</td>
                  <td className="px-3 py-2 text-right text-purple-700">{totalGeralTranspPeso > 0 ? formatCurrency(totalGeralTranspMat / totalGeralTranspPeso) : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

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

      {/* Gasto por Obra */}
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
    </div>
  );
}
