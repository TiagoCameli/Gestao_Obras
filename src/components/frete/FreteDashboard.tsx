import { Fragment, useState, useRef, useEffect, useMemo } from 'react';
import type { Frete, PagamentoFrete, AbastecimentoCarreta, Obra, PedidoMaterial, Fornecedor } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { formatCurrency } from '../../utils/formatters';
import Card from '../ui/Card';

function FilterMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Todos',
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const label = selected.length === 0 ? placeholder : selected.length === 1 ? (options.find((o) => o.id === selected[0])?.label || selected[0]) : `${selected.length} selecionados`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={
          'rounded-md px-2.5 py-1 text-xs text-left flex items-center gap-1 min-w-[130px] h-[30px] border transition-colors ' +
          (selected.length > 0
            ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]/40 text-[var(--color-accent-fg)]'
            : 'bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]')
        }
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className="truncate flex-1">{label}</span>
        <svg className="w-3 h-3 shrink-0 text-[var(--color-fg-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[220px] bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] max-h-64 overflow-hidden">
          <div className="p-1.5 border-b border-[var(--color-border)]">
            <input
              type="text"
              className="w-full rounded-md px-2 py-1 text-xs bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48 py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-[var(--color-fg-subtle)] p-2">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <label key={o.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--color-surface-2)] cursor-pointer text-xs text-[var(--color-fg)] mx-1 rounded">
                  <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="rounded accent-[var(--color-accent)]" />
                  <span className="truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[var(--color-border)] p-1.5">
              <button onClick={() => onChange([])} className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger-fg)] font-medium w-full text-left px-1">Limpar seleção</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [cmfMaterialFiltro, setCmfMaterialFiltro] = useState<string[]>([]);
  const [cmfDestinoFiltro, setCmfDestinoFiltro] = useState<string[]>([]);
  const [cmfPedreiraFiltro, setCmfPedreiraFiltro] = useState<string[]>([]);
  // Filtros: Resumo por Transportadora
  const [rptPedreiraFiltro, setRptPedreiraFiltro] = useState<string[]>([]);
  const [rptMaterialFiltro, setRptMaterialFiltro] = useState<string[]>([]);
  const [rptDestinoFiltro, setRptDestinoFiltro] = useState<string[]>([]);
  // Filtros: Pedidos de Material por Fornecedor
  const [pmfPedreiraFiltro, setPmfPedreiraFiltro] = useState<string[]>([]);
  const [pmfMaterialFiltro, setPmfMaterialFiltro] = useState<string[]>([]);
  const [pmfDestinoFiltro, setPmfDestinoFiltro] = useState<string[]>([]);
  // Filtros: Gasto com Transporte por Material e Pedreira
  const [gtmpPedreiraFiltro, setGtmpPedreiraFiltro] = useState<string[]>([]);
  const [gtmpMaterialFiltro, setGtmpMaterialFiltro] = useState<string[]>([]);
  const [gtmpDestinoFiltro, setGtmpDestinoFiltro] = useState<string[]>([]);
  // Filtros: Material Transportado
  const [mtPedreiraFiltro, setMtPedreiraFiltro] = useState<string[]>([]);
  const [mtMaterialFiltro, setMtMaterialFiltro] = useState<string[]>([]);
  const [mtDestinoFiltro, setMtDestinoFiltro] = useState<string[]>([]);

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

  // ── Opções de filtro extraídas dos fretes ──
  const opsPedreiras = Array.from(new Set(fretesF.map((f) => f.origem?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((o) => ({ id: o, label: o }));
  const opsDestinos = Array.from(new Set(fretesF.map((f) => f.destino?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((d) => ({ id: d, label: d }));
  const opsMateriais = Array.from(new Set(fretesF.map((f) => f.insumoId).filter(Boolean))).sort((a, b) => (insumosMap.get(a) || a).localeCompare(insumosMap.get(b) || b)).map((id) => ({ id, label: insumosMap.get(id) || id }));
  const matchFiltro = (val: string | undefined, filtro: string[]) => filtro.length === 0 || (val != null && filtro.includes(val.trim()));

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

  // ── Saldo EMT Transportes ──
  const EMT_TRANSPORTES = 'EMT Transportes';
  const fretesEmtTransportes = fretesF.filter((f) => f.transportadora === EMT_TRANSPORTES).reduce((s, f) => s + f.valorTotal, 0);
  const pagosParaEmtTransportes = pagamentosF.filter((p) => p.transportadora === EMT_TRANSPORTES).reduce((s, p) => s + p.valor, 0);
  const abastEmtTransportes = abastCarretaF.filter((a) => a.transportadora === EMT_TRANSPORTES).reduce((s, a) => s + a.valorTotal, 0);
  const saldoEmtTransportes = fretesEmtTransportes - pagosParaEmtTransportes - abastEmtTransportes;

  // ── Saldo Andrade Transporte ──
  const ANDRADE = 'Andrade Transporte';
  const fretesAndrade = fretesF.filter((f) => f.transportadora === ANDRADE).reduce((s, f) => s + f.valorTotal, 0);
  const pagosParaAndrade = pagamentosF.filter((p) => p.transportadora === ANDRADE).reduce((s, p) => s + p.valor, 0);
  const abastAndrade = abastCarretaF.filter((a) => a.transportadora === ANDRADE).reduce((s, a) => s + a.valorTotal, 0);
  const saldoAndrade = fretesAndrade - pagosParaAndrade - abastAndrade;

  // ── A Pagar EMT ──
  const aPagarEmt = saldoAreacre + saldoAmazonia + saldoTriunfo + saldoEtam + saldoAndrade + saldoEmtTransportes;

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
  Array.from(gastoPorTransportadora.entries())
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
  Array.from(materialTransporte.entries())
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
  // Mapas de transporte: "fornecedorId|insumoId" -> qtdTransportada / custoFrete / valorMaterial
  const transporteMap = new Map<string, number>();
  const freteValorMap = new Map<string, number>();
  const materialValorMap = new Map<string, number>();
  fretesF.forEach((f) => {
    if (!f.origem || !f.insumoId) return;
    const fornecedorId = findFornecedorByOrigem(f.origem);
    if (!fornecedorId) return;
    const key = `${fornecedorId}|${f.insumoId}`;
    transporteMap.set(key, (transporteMap.get(key) || 0) + f.pesoToneladas);
    freteValorMap.set(key, (freteValorMap.get(key) || 0) + f.valorTotal);
    materialValorMap.set(key, (materialValorMap.get(key) || 0) + (f.valorMaterial || 0));
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
  interface PedidoFornRow { fornecedorId: string; fornecedorNome: string; insumoId: string; qtd: number; qtdTransportada: number; saldoQtd: number; vlrMedio: number; custoMedioFrete: number; valor: number; valorMaterialTransp: number; saldoValor: number }
  const pedidosFornecedorRows: PedidoFornRow[] = [];
  let totalGeralQtd = 0;
  let totalGeralQtdTransp = 0;
  let totalGeralPedidos = 0;
  let totalGeralFreteValor = 0;
  let totalGeralSaldoValor = 0;
  const totaisPorFornecedor: { fornecedorId: string; fornecedorNome: string; totalQtd: number; totalQtdTransp: number; totalValor: number; totalFreteValor: number; totalSaldoValor: number; totalValorMaterialTransp: number }[] = [];
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
      let fornValorMaterialTransp = 0;
      const fornecedorNome = fornecedoresMap.get(fornecedorId) || fornecedorId;
      Array.from(materiaisMap.entries())
        .sort((a, b) => b[1].valor - a[1].valor)
        .forEach(([insumoId, dados]) => {
          const vlrMedio = dados.qtd > 0 ? dados.valor / dados.qtd : 0;
          const key = `${fornecedorId}|${insumoId}`;
          const qtdTransportada = transporteMap.get(key) || 0;
          const freteValor = freteValorMap.get(key) || 0;
          const valorMaterialTransp = materialValorMap.get(key) || 0;
          const custoMedioFrete = qtdTransportada > 0 ? freteValor / qtdTransportada : 0;
          const saldoQtdRaw = dados.qtd - qtdTransportada;
          const saldoQtd = Math.abs(saldoQtdRaw) < 0.1 ? 0 : saldoQtdRaw;
          const saldoValorRaw = dados.valor - valorMaterialTransp;
          const saldoValor = Math.abs(saldoValorRaw) < 0.01 ? 0 : saldoValorRaw;
          pedidosFornecedorRows.push({ fornecedorId, fornecedorNome, insumoId, qtd: dados.qtd, qtdTransportada, saldoQtd, vlrMedio, custoMedioFrete, valor: dados.valor, valorMaterialTransp, saldoValor });
          fornQtd += dados.qtd;
          fornQtdTransp += qtdTransportada;
          fornValor += dados.valor;
          fornFreteValor += freteValor;
          fornSaldoValor += saldoValor;
          fornValorMaterialTransp += valorMaterialTransp;
        });
      totaisPorFornecedor.push({ fornecedorId, fornecedorNome, totalQtd: fornQtd, totalQtdTransp: fornQtdTransp, totalValor: fornValor, totalFreteValor: fornFreteValor, totalSaldoValor: fornSaldoValor, totalValorMaterialTransp: fornValorMaterialTransp });
      totalGeralQtd += fornQtd;
      totalGeralQtdTransp += fornQtdTransp;
      totalGeralPedidos += fornValor;
      totalGeralFreteValor += fornFreteValor;
      totalGeralSaldoValor += fornSaldoValor;
    });

  // ── Custo Material + Frete por Pedreira e Local de Entrega ──
  interface CustoMatFreteRow {
    origem: string;
    destino: string;
    insumoId: string;
    qtdTon: number;
    custoFrete: number;
    custoFretePorTon: number;
    custoUnitMaterial: number;
    custoTotalMaterial: number;
    custoTotal: number;
  }
  const custoMatFreteAgg = new Map<string, Map<string, Map<string, { qtdTon: number; custoFrete: number }>>>();
  fretesF.forEach((f) => {
    if (!f.origem || !f.destino || !f.insumoId) return;
    const origem = f.origem.trim();
    const destino = f.destino.trim();
    let destMap = custoMatFreteAgg.get(origem);
    if (!destMap) { destMap = new Map(); custoMatFreteAgg.set(origem, destMap); }
    let matMap = destMap.get(destino);
    if (!matMap) { matMap = new Map(); destMap.set(destino, matMap); }
    const prev = matMap.get(f.insumoId) || { qtdTon: 0, custoFrete: 0 };
    matMap.set(f.insumoId, { qtdTon: prev.qtdTon + f.pesoToneladas, custoFrete: prev.custoFrete + f.valorTotal });
  });
  function getCustoUnitMaterial(origem: string, insumoId: string): number {
    const fornId = findFornecedorByOrigem(origem);
    if (!fornId) return 0;
    const materiaisMap = pedidosPorFornecedor.get(fornId);
    if (!materiaisMap) return 0;
    const dados = materiaisMap.get(insumoId);
    if (!dados || dados.qtd === 0) return 0;
    return dados.valor / dados.qtd;
  }
  const custoMatFreteRows: CustoMatFreteRow[] = [];
  interface TotaisDestinoCMF { destino: string; qtdTon: number; custoFrete: number; custoMaterial: number; custoTotal: number }
  interface TotaisPedreiraCMF { origem: string; destinos: TotaisDestinoCMF[]; qtdTon: number; custoFrete: number; custoMaterial: number; custoTotal: number }
  const custoMatFretePedreiras: TotaisPedreiraCMF[] = [];
  const custoMatFreteTotalGeral = { qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
  Array.from(custoMatFreteAgg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([origem, destMap]) => {
      const pedreira: TotaisPedreiraCMF = { origem, destinos: [], qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
      Array.from(destMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([destino, matMap]) => {
          const dest: TotaisDestinoCMF = { destino, qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
          Array.from(matMap.entries())
            .sort((a, b) => b[1].custoFrete - a[1].custoFrete)
            .forEach(([insumoId, d]) => {
              const custoFretePorTon = d.qtdTon > 0 ? d.custoFrete / d.qtdTon : 0;
              const custoUnitMaterial = getCustoUnitMaterial(origem, insumoId);
              const custoTotalMaterial = custoUnitMaterial * d.qtdTon;
              const custoTotal = custoTotalMaterial + d.custoFrete;
              custoMatFreteRows.push({ origem, destino, insumoId, qtdTon: d.qtdTon, custoFrete: d.custoFrete, custoFretePorTon, custoUnitMaterial, custoTotalMaterial, custoTotal });
              dest.qtdTon += d.qtdTon;
              dest.custoFrete += d.custoFrete;
              dest.custoMaterial += custoTotalMaterial;
              dest.custoTotal += custoTotal;
            });
          pedreira.destinos.push(dest);
          pedreira.qtdTon += dest.qtdTon;
          pedreira.custoFrete += dest.custoFrete;
          pedreira.custoMaterial += dest.custoMaterial;
          pedreira.custoTotal += dest.custoTotal;
        });
      custoMatFretePedreiras.push(pedreira);
      custoMatFreteTotalGeral.qtdTon += pedreira.qtdTon;
      custoMatFreteTotalGeral.custoFrete += pedreira.custoFrete;
      custoMatFreteTotalGeral.custoMaterial += pedreira.custoMaterial;
      custoMatFreteTotalGeral.custoTotal += pedreira.custoTotal;
    });

  // ── Último preço por material (de pedidos de material) ──
  const ultimoPrecoPorMaterial = new Map<string, { valorUnitario: number; data: string; fornecedorId: string }>();
  // Ordenar pedidos por data crescente para que o último sobrescreva
  [...pedidosF]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((p) => {
      (p.itens || []).forEach((item) => {
        if (item.valorUnitario > 0) {
          ultimoPrecoPorMaterial.set(item.insumoId, {
            valorUnitario: item.valorUnitario,
            data: p.data,
            fornecedorId: p.fornecedorId,
          });
        }
      });
    });

  // ── Último preço de frete por material ──
  const ultimoFretePorMaterial = new Map<string, { custoPorTon: number; data: string; transportadora: string; origem: string }>();
  [...fretesF]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((f) => {
      if (!f.insumoId || f.pesoToneladas <= 0) return;
      ultimoFretePorMaterial.set(f.insumoId, {
        custoPorTon: f.valorTotal / f.pesoToneladas,
        data: f.data,
        transportadora: f.transportadora,
        origem: f.origem,
      });
    });

  const listaUltimoPreco = Array.from(ultimoPrecoPorMaterial.entries())
    .map(([insumoId, info]) => {
      const frete = ultimoFretePorMaterial.get(insumoId);
      return {
        insumoId,
        material: insumosMap.get(insumoId) || insumoId,
        fornecedor: fornecedoresMap.get(info.fornecedorId) || info.fornecedorId,
        valorUnitario: info.valorUnitario,
        data: info.data,
        fretePorTon: frete?.custoPorTon ?? 0,
        freteData: frete?.data ?? '',
        freteTransportadora: frete?.transportadora ?? '',
      };
    })
    .sort((a, b) => a.material.localeCompare(b.material));

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 card-premium p-4">
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1 uppercase tracking-wider">Obra</label>
          <select
            value={obraIdFiltro}
            onChange={(e) => setObraIdFiltro(e.target.value)}
            className="rounded-md px-3 text-sm h-[34px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1 uppercase tracking-wider">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="rounded-md px-3 text-sm h-[34px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1 uppercase tracking-wider">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="rounded-md px-3 text-sm h-[34px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        {(dataInicio || dataFim || obraIdFiltro) && (
          <button
            onClick={() => { setDataInicio(''); setDataFim(''); setObraIdFiltro(''); }}
            className="text-sm text-[var(--color-danger)] hover:text-[var(--color-danger-fg)] font-medium pb-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Cards resumo - fileira 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <p>Andrade: {formatCurrency(saldoAndrade)}</p>
            <p>ETAM: {formatCurrency(saldoEtam)}</p>
            <p>EMT Transportes: {formatCurrency(saldoEmtTransportes)}</p>
          </div>
        </Card>
      </div>

      {/* Cards resumo - fileira 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
          <p className="text-sm text-gray-500">Saldo Andrade Transporte</p>
          <p className={`text-2xl font-bold mt-1 ${saldoAndrade > 0 ? 'text-red-600' : saldoAndrade < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoAndrade)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Fretes: {formatCurrency(fretesAndrade)}</p>
            <p>Pago p/ Andrade: −{formatCurrency(pagosParaAndrade)}</p>
            <p>Abastecimentos: −{formatCurrency(abastAndrade)}</p>
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
        <Card>
          <p className="text-sm text-gray-500">Saldo EMT Transportes</p>
          <p className={`text-2xl font-bold mt-1 ${saldoEmtTransportes > 0 ? 'text-red-600' : saldoEmtTransportes < 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(saldoEmtTransportes)}
          </p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            <p>Fretes: {formatCurrency(fretesEmtTransportes)}</p>
            <p>Pago p/ EMT Transportes: −{formatCurrency(pagosParaEmtTransportes)}</p>
            <p>Abastecimentos: −{formatCurrency(abastEmtTransportes)}</p>
          </div>
        </Card>
      </div>

      {/* Gasto por transportadora com saldo */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Resumo por Transportadora</h3>
          <FilterMultiSelect options={opsPedreiras} selected={rptPedreiraFiltro} onChange={setRptPedreiraFiltro} placeholder="Todas as pedreiras" />
          <FilterMultiSelect options={opsMateriais} selected={rptMaterialFiltro} onChange={setRptMaterialFiltro} placeholder="Todos os materiais" />
          <FilterMultiSelect options={opsDestinos} selected={rptDestinoFiltro} onChange={setRptDestinoFiltro} placeholder="Todos os locais" />
          {(rptPedreiraFiltro.length > 0 || rptMaterialFiltro.length > 0 || rptDestinoFiltro.length > 0) && (
            <button onClick={() => { setRptPedreiraFiltro([]); setRptMaterialFiltro([]); setRptDestinoFiltro([]); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Limpar</button>
          )}
        </div>
        {(() => {
          const rptFretes = fretesF.filter((f) => {
            if (!matchFiltro(f.origem, rptPedreiraFiltro)) return false;
            if (!matchFiltro(f.insumoId, rptMaterialFiltro)) return false;
            if (!matchFiltro(f.destino, rptDestinoFiltro)) return false;
            return true;
          });
          const rptGasto = new Map<string, number>();
          const rptTkm = new Map<string, { somaValorTkm: number; somaTkm: number; count: number }>();
          rptFretes.forEach((f) => {
            if (!f.transportadora) return;
            rptGasto.set(f.transportadora, (rptGasto.get(f.transportadora) || 0) + f.valorTotal);
            const prev = rptTkm.get(f.transportadora) || { somaValorTkm: 0, somaTkm: 0, count: 0 };
            rptTkm.set(f.transportadora, { somaValorTkm: prev.somaValorTkm + f.valorTkm, somaTkm: prev.somaTkm + f.kmRodados * f.pesoToneladas, count: prev.count + 1 });
          });
          const rptLista = Array.from(rptGasto.entries()).sort((a, b) => b[1] - a[1]);
          const rptTotal = rptFretes.reduce((s, f) => s + f.valorTotal, 0);
          if (rptLista.length === 0) return <p className="text-gray-400 text-sm">Sem dados</p>;
          return (
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
                  {rptLista.map(([nome, valorFretes]) => {
                    const tkmData = rptTkm.get(nome);
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
                    <td className="px-4 py-2 text-center text-gray-700">{rptFretes.reduce((s, f) => s + f.kmRodados * f.pesoToneladas, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-center text-orange-600">{rptFretes.length > 0 ? formatCurrency(rptFretes.reduce((s, f) => s + f.valorTkm, 0) / rptFretes.length) : '-'}</td>
                    <td className="px-4 py-2 text-center text-emt-verde">{formatCurrency(rptTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
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
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Pedidos de Material por Fornecedor</h3>
          <FilterMultiSelect options={totaisPorFornecedor.map((f) => ({ id: f.fornecedorId, label: f.fornecedorNome }))} selected={pmfPedreiraFiltro} onChange={setPmfPedreiraFiltro} placeholder="Todos os fornecedores" />
          <FilterMultiSelect options={Array.from(new Set(pedidosFornecedorRows.map((r) => r.insumoId))).sort((a, b) => (insumosMap.get(a) || a).localeCompare(insumosMap.get(b) || b)).map((id) => ({ id, label: insumosMap.get(id) || id }))} selected={pmfMaterialFiltro} onChange={setPmfMaterialFiltro} placeholder="Todos os materiais" />
          <FilterMultiSelect options={opsDestinos} selected={pmfDestinoFiltro} onChange={setPmfDestinoFiltro} placeholder="Todos os locais" />
          {(pmfPedreiraFiltro.length > 0 || pmfMaterialFiltro.length > 0 || pmfDestinoFiltro.length > 0) && (
            <button onClick={() => { setPmfPedreiraFiltro([]); setPmfMaterialFiltro([]); setPmfDestinoFiltro([]); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Limpar</button>
          )}
        </div>
        {(() => {
          const pmfFretesFiltr = fretesF.filter((f) => {
            if (!matchFiltro(f.destino, pmfDestinoFiltro)) return false;
            return true;
          });
          const pmfTranspMap = new Map<string, number>();
          const pmfFreteValMap = new Map<string, number>();
          const pmfMatValMap = new Map<string, number>();
          pmfFretesFiltr.forEach((f) => {
            if (!f.origem || !f.insumoId) return;
            const fId = findFornecedorByOrigem(f.origem);
            if (!fId) return;
            const key = `${fId}|${f.insumoId}`;
            pmfTranspMap.set(key, (pmfTranspMap.get(key) || 0) + f.pesoToneladas);
            pmfFreteValMap.set(key, (pmfFreteValMap.get(key) || 0) + f.valorTotal);
            pmfMatValMap.set(key, (pmfMatValMap.get(key) || 0) + (f.valorMaterial || 0));
          });
          // Rebuild rows with filters
          const pmfRows: PedidoFornRow[] = [];
          const pmfTotForn: typeof totaisPorFornecedor = [];
          let pmfTotalQtd = 0, pmfTotalQtdTransp = 0, pmfTotalPedidos = 0, pmfTotalFreteValor = 0, pmfTotalSaldoValor = 0, pmfTotalMatTransp = 0;
          Array.from(pedidosPorFornecedor.entries())
            .filter(([fId]) => pmfPedreiraFiltro.length === 0 || pmfPedreiraFiltro.includes(fId))
            .sort((a, b) => (fornecedoresMap.get(a[0]) || '').localeCompare(fornecedoresMap.get(b[0]) || ''))
            .forEach(([fornecedorId, materiaisMap]) => {
              let fQtd = 0, fQtdT = 0, fVal = 0, fFrete = 0, fSaldo = 0, fMatTransp = 0;
              const fornecedorNome = fornecedoresMap.get(fornecedorId) || fornecedorId;
              Array.from(materiaisMap.entries())
                .filter(([insumoId]) => pmfMaterialFiltro.length === 0 || pmfMaterialFiltro.includes(insumoId))
                .sort((a, b) => b[1].valor - a[1].valor)
                .forEach(([insumoId, dados]) => {
                  const vlrMedio = dados.qtd > 0 ? dados.valor / dados.qtd : 0;
                  const key = `${fornecedorId}|${insumoId}`;
                  const qtdTransportada = pmfTranspMap.get(key) || 0;
                  const freteValor = pmfFreteValMap.get(key) || 0;
                  const valorMaterialTransp = pmfMatValMap.get(key) || 0;
                  const custoMedioFrete = qtdTransportada > 0 ? freteValor / qtdTransportada : 0;
                  const saldoQtdRaw = dados.qtd - qtdTransportada;
                  const saldoQtd = Math.abs(saldoQtdRaw) < 0.1 ? 0 : saldoQtdRaw;
                  const saldoValorRaw = dados.valor - valorMaterialTransp;
                  const saldoValor = Math.abs(saldoValorRaw) < 0.01 ? 0 : saldoValorRaw;
                  pmfRows.push({ fornecedorId, fornecedorNome, insumoId, qtd: dados.qtd, qtdTransportada, saldoQtd, vlrMedio, custoMedioFrete, valor: dados.valor, valorMaterialTransp, saldoValor });
                  fQtd += dados.qtd; fQtdT += qtdTransportada; fVal += dados.valor; fFrete += freteValor; fSaldo += saldoValor; fMatTransp += valorMaterialTransp;
                });
              if (fQtd > 0 || fQtdT > 0) {
                pmfTotForn.push({ fornecedorId, fornecedorNome, totalQtd: fQtd, totalQtdTransp: fQtdT, totalValor: fVal, totalFreteValor: fFrete, totalSaldoValor: fSaldo, totalValorMaterialTransp: fMatTransp });
                pmfTotalQtd += fQtd; pmfTotalQtdTransp += fQtdT; pmfTotalPedidos += fVal; pmfTotalFreteValor += fFrete; pmfTotalSaldoValor += fSaldo; pmfTotalMatTransp += fMatTransp;
              }
            });
          if (pmfRows.length === 0) return <p className="text-gray-400 text-sm">Sem dados</p>;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th rowSpan={2} className="text-left px-3 py-2 font-semibold text-gray-700 bg-gray-50 border-b-2 border-gray-300">Material</th>
                    <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-blue-50 border-b border-blue-200">Pedido</th>
                    <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-emerald-50 border-b border-emerald-200">Transportado</th>
                    <th colSpan={2} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-amber-50 border-b border-amber-200">Saldo na Pedreira</th>
                    <th colSpan={3} className="text-center px-3 py-1.5 font-semibold text-gray-600 bg-purple-50 border-b border-purple-200">Custo R$/t</th>
                  </tr>
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
                  {pmfTotForn.map((forn) => {
                    const rows = pmfRows.filter((r) => r.fornecedorId === forn.fornecedorId);
                    const fornCMM = forn.totalQtd > 0 ? forn.totalValor / forn.totalQtd : 0;
                    const fornCMF = forn.totalQtdTransp > 0 ? forn.totalFreteValor / forn.totalQtdTransp : 0;
                    return (
                      <Fragment key={forn.fornecedorId}>
                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                          <td className="px-3 py-2 font-bold text-gray-800">{forn.fornecedorNome}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">{forn.totalQtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">{formatCurrency(forn.totalValor)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{forn.totalQtdTransp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(forn.totalValorMaterialTransp)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${(() => { const v = forn.totalQtd - forn.totalQtdTransp; const s = Math.abs(v) < 0.1 ? 0 : v; return s < 0 ? 'text-red-600' : s === 0 ? 'text-gray-400' : 'text-green-600'; })()}`}>{(() => { const v = forn.totalQtd - forn.totalQtdTransp; return (Math.abs(v) < 0.1 ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); })()}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${forn.totalSaldoValor < 0 ? 'text-red-600' : forn.totalSaldoValor === 0 ? 'text-gray-400' : 'text-green-600'}`}>{formatCurrency(forn.totalSaldoValor)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-purple-700">{formatCurrency(fornCMM)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-purple-700">{fornCMF > 0 ? formatCurrency(fornCMF) : '-'}</td>
                          <td className="px-3 py-2 text-right font-bold text-purple-800">{fornCMF > 0 ? formatCurrency(fornCMM + fornCMF) : formatCurrency(fornCMM)}</td>
                        </tr>
                        {rows.map((r) => (
                          <tr key={`${r.fornecedorId}-${r.insumoId}`} className="hover:bg-gray-50 border-b border-gray-100">
                            <td className="px-3 py-1.5 pl-6 text-gray-600">{insumosMap.get(r.insumoId) || r.insumoId}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700">{r.qtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(r.valor)}</td>
                            <td className="px-3 py-1.5 text-right text-emerald-600">{r.qtdTransportada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-1.5 text-right text-emerald-600">{formatCurrency(r.valorMaterialTransp)}</td>
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
                    <td className="px-3 py-2 text-right text-gray-800">{pmfTotalQtd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(pmfTotalPedidos)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{pmfTotalQtdTransp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(pmfTotalMatTransp)}</td>
                    <td className={`px-3 py-2 text-right ${(() => { const v = pmfTotalQtd - pmfTotalQtdTransp; const s = Math.abs(v) < 0.1 ? 0 : v; return s < 0 ? 'text-red-600' : s === 0 ? 'text-gray-400' : 'text-green-600'; })()}`}>{(() => { const v = pmfTotalQtd - pmfTotalQtdTransp; return (Math.abs(v) < 0.1 ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); })()}</td>
                    <td className={`px-3 py-2 text-right ${pmfTotalSaldoValor < 0 ? 'text-red-600' : pmfTotalSaldoValor === 0 ? 'text-gray-400' : 'text-green-600'}`}>{formatCurrency(pmfTotalSaldoValor)}</td>
                    <td className="px-3 py-2 text-right text-purple-700">{pmfTotalQtd > 0 ? formatCurrency(pmfTotalPedidos / pmfTotalQtd) : '-'}</td>
                    <td className="px-3 py-2 text-right text-purple-700">{pmfTotalQtdTransp > 0 ? formatCurrency(pmfTotalFreteValor / pmfTotalQtdTransp) : '-'}</td>
                    <td className="px-3 py-2 text-right text-purple-800">{pmfTotalQtd > 0 ? formatCurrency((pmfTotalPedidos / pmfTotalQtd) + (pmfTotalQtdTransp > 0 ? pmfTotalFreteValor / pmfTotalQtdTransp : 0)) : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </Card>

      {/* Custo Material + Frete por Pedreira e Local de Entrega */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Custo Material + Frete por Pedreira e Local de Entrega
          </h3>
          <FilterMultiSelect options={Array.from(new Set(custoMatFreteRows.map((r) => r.origem))).sort((a, b) => a.localeCompare(b)).map((o) => ({ id: o, label: o }))} selected={cmfPedreiraFiltro} onChange={setCmfPedreiraFiltro} placeholder="Todas as pedreiras" />
          <FilterMultiSelect options={Array.from(new Set(custoMatFreteRows.map((r) => r.insumoId))).sort((a, b) => (insumosMap.get(a) || a).localeCompare(insumosMap.get(b) || b)).map((id) => ({ id, label: insumosMap.get(id) || id }))} selected={cmfMaterialFiltro} onChange={setCmfMaterialFiltro} placeholder="Todos os materiais" />
          <FilterMultiSelect options={Array.from(new Set(custoMatFreteRows.map((r) => r.destino))).sort((a, b) => a.localeCompare(b)).map((d) => ({ id: d, label: d }))} selected={cmfDestinoFiltro} onChange={setCmfDestinoFiltro} placeholder="Todos os locais" />
          {(cmfPedreiraFiltro.length > 0 || cmfMaterialFiltro.length > 0 || cmfDestinoFiltro.length > 0) && (
            <button onClick={() => { setCmfPedreiraFiltro([]); setCmfMaterialFiltro([]); setCmfDestinoFiltro([]); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Limpar</button>
          )}
        </div>
        {(() => {
          const rowsFiltrados = custoMatFreteRows.filter((r) => {
            if (cmfPedreiraFiltro.length > 0 && !cmfPedreiraFiltro.includes(r.origem)) return false;
            if (cmfMaterialFiltro.length > 0 && !cmfMaterialFiltro.includes(r.insumoId)) return false;
            if (cmfDestinoFiltro.length > 0 && !cmfDestinoFiltro.includes(r.destino)) return false;
            return true;
          });
          // Reagrupar por pedreira → destino
          const pedreirasMap = new Map<string, { destinos: Map<string, CustoMatFreteRow[]> }>();
          rowsFiltrados.forEach((r) => {
            let p = pedreirasMap.get(r.origem);
            if (!p) { p = { destinos: new Map() }; pedreirasMap.set(r.origem, p); }
            let d = p.destinos.get(r.destino);
            if (!d) { d = []; p.destinos.set(r.destino, d); }
            d.push(r);
          });
          const totalFiltrado = { qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
          rowsFiltrados.forEach((r) => { totalFiltrado.qtdTon += r.qtdTon; totalFiltrado.custoFrete += r.custoFrete; totalFiltrado.custoMaterial += r.custoTotalMaterial; totalFiltrado.custoTotal += r.custoTotal; });
          if (rowsFiltrados.length === 0) return <p className="text-gray-400 text-sm">Sem dados</p>;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Pedreira / Local / Material</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Qtd (t)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Material R$/t</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Frete R$/t</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total R$/t</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total Material (R$)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total Frete (R$)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(pedreirasMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([origem, pData]) => {
                    const pedrRows = rowsFiltrados.filter((r) => r.origem === origem);
                    const pedrTotais = { qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
                    pedrRows.forEach((r) => { pedrTotais.qtdTon += r.qtdTon; pedrTotais.custoFrete += r.custoFrete; pedrTotais.custoMaterial += r.custoTotalMaterial; pedrTotais.custoTotal += r.custoTotal; });
                    return (
                      <Fragment key={origem}>
                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                          <td className="px-3 py-2 font-bold text-gray-800">{origem}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">{pedrTotais.qtdTon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">-</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">{pedrTotais.qtdTon > 0 ? formatCurrency(pedrTotais.custoFrete / pedrTotais.qtdTon) : '-'}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-700">{pedrTotais.qtdTon > 0 ? formatCurrency(pedrTotais.custoTotal / pedrTotais.qtdTon) : '-'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-700">{formatCurrency(pedrTotais.custoMaterial)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-700">{formatCurrency(pedrTotais.custoFrete)}</td>
                          <td className="px-3 py-2 text-right font-bold text-purple-800">{formatCurrency(pedrTotais.custoTotal)}</td>
                        </tr>
                        {Array.from(pData.destinos.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([destino, dRows]) => {
                          const destTotais = { qtdTon: 0, custoFrete: 0, custoMaterial: 0, custoTotal: 0 };
                          dRows.forEach((r) => { destTotais.qtdTon += r.qtdTon; destTotais.custoFrete += r.custoFrete; destTotais.custoMaterial += r.custoTotalMaterial; destTotais.custoTotal += r.custoTotal; });
                          return (
                            <Fragment key={`${origem}-${destino}`}>
                              <tr className="bg-emerald-50 border-t border-gray-200">
                                <td className="px-3 py-1.5 pl-6 font-semibold text-gray-700">{destino}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-gray-600">{destTotais.qtdTon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-gray-500">-</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-orange-600">{destTotais.qtdTon > 0 ? formatCurrency(destTotais.custoFrete / destTotais.qtdTon) : '-'}</td>
                                <td className="px-3 py-1.5 text-right font-bold text-green-600">{destTotais.qtdTon > 0 ? formatCurrency(destTotais.custoTotal / destTotais.qtdTon) : '-'}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{formatCurrency(destTotais.custoMaterial)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-orange-600">{formatCurrency(destTotais.custoFrete)}</td>
                                <td className="px-3 py-1.5 text-right font-bold text-purple-700">{formatCurrency(destTotais.custoTotal)}</td>
                              </tr>
                              {dRows.map((r) => (
                                <tr key={`${r.origem}-${r.destino}-${r.insumoId}`} className="hover:bg-gray-50 border-b border-gray-100">
                                  <td className="px-3 py-1.5 pl-10 text-gray-600">{insumosMap.get(r.insumoId) || r.insumoId}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-700">{r.qtdTon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-1.5 text-right text-blue-600">{r.custoUnitMaterial > 0 ? formatCurrency(r.custoUnitMaterial) : '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-orange-600">{formatCurrency(r.custoFretePorTon)}</td>
                                  <td className="px-3 py-1.5 text-right font-medium text-green-700">{formatCurrency(r.custoUnitMaterial + r.custoFretePorTon)}</td>
                                  <td className="px-3 py-1.5 text-right text-blue-600">{r.custoTotalMaterial > 0 ? formatCurrency(r.custoTotalMaterial) : '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-orange-600">{formatCurrency(r.custoFrete)}</td>
                                  <td className="px-3 py-1.5 text-right font-medium text-purple-700">{formatCurrency(r.custoTotal)}</td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                    <td className="px-3 py-2 text-gray-800">Total Geral</td>
                    <td className="px-3 py-2 text-right text-gray-800">{totalFiltrado.qtdTon.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-gray-800">-</td>
                    <td className="px-3 py-2 text-right text-orange-700">{totalFiltrado.qtdTon > 0 ? formatCurrency(totalFiltrado.custoFrete / totalFiltrado.qtdTon) : '-'}</td>
                    <td className="px-3 py-2 text-right text-green-700">{totalFiltrado.qtdTon > 0 ? formatCurrency(totalFiltrado.custoTotal / totalFiltrado.qtdTon) : '-'}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{formatCurrency(totalFiltrado.custoMaterial)}</td>
                    <td className="px-3 py-2 text-right text-orange-700">{formatCurrency(totalFiltrado.custoFrete)}</td>
                    <td className="px-3 py-2 text-right text-purple-800">{formatCurrency(totalFiltrado.custoTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </Card>

      {/* Gasto com Transporte por Material e Pedreira */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Gasto com Transporte por Material e Pedreira</h3>
          <FilterMultiSelect options={opsPedreiras} selected={gtmpPedreiraFiltro} onChange={setGtmpPedreiraFiltro} placeholder="Todas as pedreiras" />
          <FilterMultiSelect options={opsMateriais} selected={gtmpMaterialFiltro} onChange={setGtmpMaterialFiltro} placeholder="Todos os materiais" />
          <FilterMultiSelect options={opsDestinos} selected={gtmpDestinoFiltro} onChange={setGtmpDestinoFiltro} placeholder="Todos os locais" />
          {(gtmpPedreiraFiltro.length > 0 || gtmpMaterialFiltro.length > 0 || gtmpDestinoFiltro.length > 0) && (
            <button onClick={() => { setGtmpPedreiraFiltro([]); setGtmpMaterialFiltro([]); setGtmpDestinoFiltro([]); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Limpar</button>
          )}
        </div>
        {(() => {
          const gtmpFretes = fretesF.filter((f) => {
            if (!f.insumoId || !f.origem) return false;
            if (!matchFiltro(f.origem, gtmpPedreiraFiltro)) return false;
            if (!matchFiltro(f.insumoId, gtmpMaterialFiltro)) return false;
            if (!matchFiltro(f.destino, gtmpDestinoFiltro)) return false;
            return true;
          });
          const gtmpAgg = new Map<string, Map<string, { valor: number; peso: number }>>();
          gtmpFretes.forEach((f) => {
            const origem = f.origem.trim();
            let matMap = gtmpAgg.get(origem);
            if (!matMap) { matMap = new Map(); gtmpAgg.set(origem, matMap); }
            const prev = matMap.get(f.insumoId) || { valor: 0, peso: 0 };
            matMap.set(f.insumoId, { valor: prev.valor + f.valorTotal, peso: prev.peso + f.pesoToneladas });
          });
          const gtmpRows: TranspMatRow[] = [];
          const gtmpPedrTotais: { origem: string; totalValor: number; totalPeso: number }[] = [];
          let gtmpTotalPeso = 0, gtmpTotalValor = 0;
          Array.from(gtmpAgg.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([origem, matMap]) => {
            let pV = 0, pP = 0;
            Array.from(matMap.entries()).sort((a, b) => b[1].valor - a[1].valor).forEach(([insumoId, d]) => {
              const custoMedioTon = d.peso > 0 ? d.valor / d.peso : 0;
              gtmpRows.push({ origem, insumoId, valor: d.valor, peso: d.peso, custoMedioTon });
              pV += d.valor; pP += d.peso;
            });
            gtmpPedrTotais.push({ origem, totalValor: pV, totalPeso: pP });
            gtmpTotalPeso += pP; gtmpTotalValor += pV;
          });
          if (gtmpRows.length === 0) return <p className="text-gray-400 text-sm">Sem dados</p>;
          return (
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
                  {gtmpPedrTotais.map((pedr) => {
                    const rows = gtmpRows.filter((r) => r.origem === pedr.origem);
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
                    <td className="px-3 py-2 text-right text-gray-800">{gtmpTotalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(gtmpTotalValor)}</td>
                    <td className="px-3 py-2 text-right text-purple-700">{gtmpTotalPeso > 0 ? formatCurrency(gtmpTotalValor / gtmpTotalPeso) : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </Card>

      {/* Material transportado / em transito */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Material Transportado</h3>
          <FilterMultiSelect options={opsPedreiras} selected={mtPedreiraFiltro} onChange={setMtPedreiraFiltro} placeholder="Todas as pedreiras" />
          <FilterMultiSelect options={opsMateriais} selected={mtMaterialFiltro} onChange={setMtMaterialFiltro} placeholder="Todos os materiais" />
          <FilterMultiSelect options={opsDestinos} selected={mtDestinoFiltro} onChange={setMtDestinoFiltro} placeholder="Todos os locais" />
          {(mtPedreiraFiltro.length > 0 || mtMaterialFiltro.length > 0 || mtDestinoFiltro.length > 0) && (
            <button onClick={() => { setMtPedreiraFiltro([]); setMtMaterialFiltro([]); setMtDestinoFiltro([]); }} className="text-xs text-red-600 hover:text-red-800 font-medium">Limpar</button>
          )}
        </div>
        {(() => {
          const mtFretes = fretesF.filter((f) => {
            if (!f.insumoId) return false;
            if (!matchFiltro(f.origem, mtPedreiraFiltro)) return false;
            if (!matchFiltro(f.insumoId, mtMaterialFiltro)) return false;
            if (!matchFiltro(f.destino, mtDestinoFiltro)) return false;
            return true;
          });
          const mtAgg = new Map<string, { entregue: number; transito: number; pesoEntregue: number; pesoTransito: number }>();
          mtFretes.forEach((f) => {
            const prev = mtAgg.get(f.insumoId) || { entregue: 0, transito: 0, pesoEntregue: 0, pesoTransito: 0 };
            if (f.dataChegada) {
              mtAgg.set(f.insumoId, { ...prev, entregue: prev.entregue + 1, pesoEntregue: prev.pesoEntregue + f.pesoToneladas });
            } else {
              mtAgg.set(f.insumoId, { ...prev, transito: prev.transito + 1, pesoTransito: prev.pesoTransito + f.pesoToneladas });
            }
          });
          const mtLista = Array.from(mtAgg.entries()).sort((a, b) => (b[1].pesoEntregue + b[1].pesoTransito) - (a[1].pesoEntregue + a[1].pesoTransito));
          if (mtLista.length === 0) return <p className="text-gray-400 text-sm">Sem dados</p>;
          return (
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
                  {mtLista.map(([insumoId, dados]) => (
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
                    <td className="px-4 py-2 text-right text-green-600">{mtLista.reduce((s, [, d]) => s + d.entregue, 0)}</td>
                    <td className="px-4 py-2 text-right text-green-600">{mtLista.reduce((s, [, d]) => s + d.pesoEntregue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right text-amber-600">{mtLista.reduce((s, [, d]) => s + d.transito, 0) || '-'}</td>
                    <td className="px-4 py-2 text-right text-amber-600">{mtLista.reduce((s, [, d]) => s + d.pesoTransito, 0) > 0 ? mtLista.reduce((s, [, d]) => s + d.pesoTransito, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{mtLista.reduce((s, [, d]) => s + d.pesoEntregue + d.pesoTransito, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </Card>

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

      {/* Último Preço por Material */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          Último Preço por Material
        </h3>
        {listaUltimoPreco.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem dados de pedidos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-600 text-left">
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400">Material</th>
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400">Fornecedor</th>
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400 text-right">Preço Material (R$/ton)</th>
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400 text-right">Data Pedido</th>
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400 text-right">Preço Frete (R$/ton)</th>
                  <th className="py-2 pr-4 font-semibold text-gray-600 dark:text-slate-400">Transportadora</th>
                  <th className="py-2 font-semibold text-gray-600 dark:text-slate-400 text-right">Data Frete</th>
                </tr>
              </thead>
              <tbody>
                {listaUltimoPreco.map((row) => (
                  <tr key={row.insumoId} className="border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <td className="py-2 pr-4 text-gray-700 dark:text-slate-300">{row.material}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">{row.fornecedor}</td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-slate-200">{formatCurrency(row.valorUnitario)}</td>
                    <td className="py-2 pr-4 text-right text-gray-500 dark:text-slate-400">
                      {row.data ? new Date(row.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-800 dark:text-slate-200">
                      {row.fretePorTon > 0 ? formatCurrency(row.fretePorTon) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {row.freteTransportadora || '—'}
                    </td>
                    <td className="py-2 text-right text-gray-500 dark:text-slate-400">
                      {row.freteData ? new Date(row.freteData + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
