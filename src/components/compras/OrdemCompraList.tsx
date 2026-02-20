import { useState, useMemo } from 'react';
import type { OrdemCompra, Obra, EtapaObra, Fornecedor, Cotacao, PedidoCompra, DepositoMaterial, Deposito } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Select from '../ui/Select';

const EMPRESA_LABEL: Record<string, string> = {
  emt_construtora: 'EMT Construtora',
  amazonia_agroindustria: 'Amazonia Agroindustria',
  james_castro_cameli: 'James Castro Cameli',
  tiago_melo_cameli: 'Tiago de Melo Cameli',
};

const FORMA_PGTO_LABEL: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  cheque: 'Cheque',
};

type SortField = 'numero' | 'valor' | 'criacao';
type SortDir = 'asc' | 'desc';

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  return (
    <span className="inline-flex flex-col ml-1 leading-none" aria-label={`Ordenar por ${field}`}>
      <svg className={`w-3 h-3 ${active && dir === 'asc' ? 'text-gray-800' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z" /></svg>
      <svg className={`w-3 h-3 ${active && dir === 'desc' ? 'text-gray-800' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z" /></svg>
    </span>
  );
}

function extractNum(numero: string): number {
  const m = numero.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

interface OrdemCompraListProps {
  ordens: OrdemCompra[];
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  cotacoes: Cotacao[];
  pedidos: PedidoCompra[];
  onEdit: (oc: OrdemCompra) => void;
  onMarcarEntregue: (oc: OrdemCompra) => void;
  onReabrir: (oc: OrdemCompra) => void;
  onExcluir: (oc: OrdemCompra) => void;
  onAprovar: (oc: OrdemCompra) => void;
  onGerarEntrada: (oc: OrdemCompra, tipo: 'insumos' | 'combustivel', depositoId: string) => Promise<void>;
  depositosMaterial: DepositoMaterial[];
  depositosCombustivel: Deposito[];
  canEdit: boolean;
}

export default function OrdemCompraList({
  ordens,
  obras,
  etapas,
  fornecedores,
  cotacoes,
  pedidos,
  onEdit,
  onMarcarEntregue,
  onReabrir,
  onExcluir,
  onAprovar,
  onGerarEntrada,
  depositosMaterial,
  depositosCombustivel,
  canEdit,
}: OrdemCompraListProps) {
  const [visualizando, setVisualizando] = useState<OrdemCompra | null>(null);
  const [sortField, setSortField] = useState<SortField>('criacao');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Gerar entrada no estoque
  const [entradaTipo, setEntradaTipo] = useState<'insumos' | 'combustivel'>('insumos');
  const [entradaDepositoId, setEntradaDepositoId] = useState('');
  const [entradaSaving, setEntradaSaving] = useState(false);
  const [entradaMsg, setEntradaMsg] = useState('');
  const [entradaErro, setEntradaErro] = useState('');

  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e.nome]));
  const fornecedoresMap = new Map(fornecedores.map((f) => [f.id, f]));
  const cotacoesMap = new Map(cotacoes.map((c) => [c.id, c.numero]));
  const pedidosMap = new Map(pedidos.map((p) => [p.id, p.numero]));

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const list = [...ordens];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'numero') return (extractNum(a.numero) - extractNum(b.numero)) * dir;
      if (sortField === 'valor') return (a.totalGeral - b.totalGeral) * dir;
      return a.dataCriacao.localeCompare(b.dataCriacao) * dir;
    });
    return list;
  }, [ordens, sortField, sortDir]);

  const totalOCs = ordens.length;
  const valorTotal = ordens.filter((o) => o.status !== 'cancelada').reduce((sum, o) => sum + o.totalGeral, 0);
  const entregues = ordens.filter((o) => o.status === 'entregue').length;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Total OCs</p><p className="text-2xl font-bold text-gray-800 mt-1">{totalOCs}</p></Card>
        <Card><p className="text-sm text-gray-500">Valor Total (Ativas)</p><p className="text-2xl font-bold text-emt-verde mt-1">{formatCurrency(valorTotal)}</p></Card>
        <Card><p className="text-sm text-gray-500">Entregues</p><p className="text-2xl font-bold text-green-600 mt-1">{entregues}</p></Card>
      </div>

      {/* Tabela */}
      <Card>
        {sorted.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhuma ordem de compra encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider cursor-pointer select-none w-[70px]" onClick={() => toggleSort('numero')}>
                    <span className="inline-flex items-center">Nº <SortIcon field="numero" active={sortField === 'numero'} dir={sortDir} /></span>
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider">Fornecedor</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider cursor-pointer select-none w-[180px]" onClick={() => toggleSort('valor')}>
                    <span className="inline-flex items-center justify-end">Valor <SortIcon field="valor" active={sortField === 'valor'} dir={sortDir} /></span>
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider">Centro de Custo</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider">Etapa</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider cursor-pointer select-none w-[120px]" onClick={() => toggleSort('criacao')}>
                    <span className="inline-flex items-center">Criação <SortIcon field="criacao" active={sortField === 'criacao'} dir={sortDir} /></span>
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[80px]">Pedido</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[80px]">Cotação</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[70px]">Aprov.</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[100px]">Entrega</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider w-[120px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((oc) => {
                  const forn = fornecedoresMap.get(oc.fornecedorId);
                  const num = extractNum(oc.numero);
                  return (
                    <tr key={oc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setVisualizando(oc)}>
                      {/* 1. Número */}
                      <td className="px-3 py-3 text-left font-bold text-gray-800">{num || oc.numero}</td>
                      {/* 2. Fornecedor */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-gray-800 text-sm uppercase">{forn?.nome || '-'}</span>
                      </td>
                      {/* 3. Valor */}
                      <td className="px-3 py-3 text-right">
                        <p className="font-bold text-green-800">{formatCurrency(oc.totalGeral)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Faturamento: {EMPRESA_LABEL[oc.empresaFaturamento] || '-'}</p>
                        <p className="text-xs text-gray-400">Cond. Pgto: {FORMA_PGTO_LABEL[oc.formaPagamento] || '-'}</p>
                      </td>
                      {/* 4. Centro de Custo */}
                      <td className="px-3 py-3 text-left max-w-[200px]">
                        <p className="text-gray-700 truncate" title={obrasMap.get(oc.obraId) || '-'}>{obrasMap.get(oc.obraId) || '-'}</p>
                      </td>
                      {/* 5. Etapa */}
                      <td className="px-3 py-3 text-left max-w-[180px]">
                        {oc.entradaInsumos
                          ? <span className="text-xs text-purple-600 font-medium">Estoque</span>
                          : <p className="text-gray-600 truncate" title={etapasMap.get(oc.etapaObraId) || '-'}>{etapasMap.get(oc.etapaObraId) || '-'}</p>
                        }
                      </td>
                      {/* 6. Criação */}
                      <td className="px-3 py-3 text-left">
                        <p className="text-gray-700">{formatDate(oc.dataCriacao)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Por: {oc.criadoPor || '-'}</p>
                      </td>
                      {/* 6. Pedido */}
                      <td className="px-3 py-3 text-center text-gray-500">{oc.pedidoCompraId ? pedidosMap.get(oc.pedidoCompraId) || '-' : '-'}</td>
                      {/* 7. Cotação */}
                      <td className="px-3 py-3 text-center text-gray-500">{oc.cotacaoId ? cotacoesMap.get(oc.cotacaoId) || '-' : '-'}</td>
                      {/* 8. Aprovação */}
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={oc.aprovada}
                          onChange={() => onAprovar({ ...oc, aprovada: !oc.aprovada })}
                          disabled={!canEdit}
                          className="w-5 h-5 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      {/* 9. Entrega */}
                      <td className="px-3 py-3 text-center text-gray-500">{oc.dataEntrega ? formatDate(oc.dataEntrega) : '-'}</td>
                      {/* Ações */}
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1 flex-wrap">
                          {oc.status === 'emitida' && canEdit && (
                            <button onClick={() => onMarcarEntregue(oc)} className="text-xs text-green-600 hover:text-green-800 font-medium">
                              Entregue
                            </button>
                          )}
                          {oc.status === 'entregue' && canEdit && (
                            <button onClick={() => onReabrir(oc)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                              Reabrir
                            </button>
                          )}
                          {!oc.aprovada && !oc.entradaGerada && canEdit && (
                            <button onClick={() => onExcluir(oc)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Visualização OC formal */}
      <Modal open={visualizando !== null} onClose={() => { setVisualizando(null); setEntradaMsg(''); setEntradaErro(''); setEntradaDepositoId(''); }} title={visualizando ? `Ordem de Compra ${visualizando.numero}` : ''} size="xl">
        {visualizando && (() => {
          const forn = fornecedoresMap.get(visualizando.fornecedorId);
          return (
            <div className="space-y-5">
              {/* Cabeçalho formal */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold text-gray-800">EMT Construtora</h2>
                <p className="text-sm text-gray-500">Ordem de Compra</p>
                <p className="text-lg font-semibold text-emt-verde mt-1">{visualizando.numero}</p>
                <p className="text-xs text-gray-400">Data: {formatDate(visualizando.dataCriacao)}</p>
              </div>

              {/* Dados fornecedor */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fornecedor</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Nome:</span> <span className="font-medium">{forn?.nome || '-'}</span></div>
                  <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{forn?.cnpj || '-'}</span></div>
                  <div><span className="text-gray-500">Telefone:</span> <span className="font-medium">{forn?.telefone || '-'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{forn?.email || '-'}</span></div>
                </div>
              </div>

              {/* Dados obra + referências */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Obra:</span> <span className="font-medium">{obrasMap.get(visualizando.obraId) || '-'}</span></div>
                <div><span className="text-gray-500">Etapa:</span> <span className="font-medium">{visualizando.entradaInsumos ? 'Estoque de Insumos' : (etapasMap.get(visualizando.etapaObraId) || '-')}</span></div>
                {visualizando.cotacaoId && <div><span className="text-gray-500">Cotação:</span> <span className="font-medium">{cotacoesMap.get(visualizando.cotacaoId) || '-'}</span></div>}
                {visualizando.pedidoCompraId && <div><span className="text-gray-500">Pedido:</span> <span className="font-medium">{pedidosMap.get(visualizando.pedidoCompraId) || '-'}</span></div>}
              </div>

              {/* Tabela de itens */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Descrição</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Qtd</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Unid.</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Preço Unit.</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Subtotal</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Obra</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Etapa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visualizando.itens.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.descricao}</td>
                        <td className="px-3 py-2 text-right">{item.quantidade}</td>
                        <td className="px-3 py-2">{item.unidade}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.precoUnitario)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                        <td className="px-3 py-2 text-gray-600">{visualizando.entradaInsumos ? '' : (obrasMap.get(item.obraId) || '-')}</td>
                        <td className="px-3 py-2 text-gray-600">{visualizando.entradaInsumos ? '' : (item.etapaObraId ? (etapasMap.get(item.etapaObraId) || '-') : '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Custos */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal Materiais</span><span className="font-medium">{formatCurrency(visualizando.totalMateriais)}</span></div>
                {visualizando.custosAdicionais.frete > 0 && <div className="flex justify-between"><span className="text-gray-600">Frete</span><span>{formatCurrency(visualizando.custosAdicionais.frete)}</span></div>}
                {visualizando.custosAdicionais.outrasDespesas > 0 && <div className="flex justify-between"><span className="text-gray-600">Outras Despesas</span><span>{formatCurrency(visualizando.custosAdicionais.outrasDespesas)}</span></div>}
                {visualizando.custosAdicionais.impostos > 0 && <div className="flex justify-between"><span className="text-gray-600">Impostos</span><span>{formatCurrency(visualizando.custosAdicionais.impostos)}</span></div>}
                {visualizando.custosAdicionais.desconto > 0 && <div className="flex justify-between"><span className="text-gray-600">Desconto</span><span className="text-red-600">-{formatCurrency(visualizando.custosAdicionais.desconto)}</span></div>}
                <div className="flex justify-between pt-2 border-t border-gray-200 text-lg font-bold">
                  <span>Total Geral</span>
                  <span className="text-emt-verde">{formatCurrency(visualizando.totalGeral)}</span>
                </div>
              </div>

              {/* Condições */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {visualizando.condicaoPagamento && (
                  <div><span className="text-gray-500">Condição de Pagamento:</span><p className="font-medium mt-0.5">{visualizando.condicaoPagamento}</p></div>
                )}
                {visualizando.prazoEntrega && (
                  <div><span className="text-gray-500">Prazo de Entrega:</span><p className="font-medium mt-0.5">{visualizando.prazoEntrega}</p></div>
                )}
              </div>

              {/* Empresa de Faturamento */}
              {visualizando.empresaFaturamento && (
                <div className="text-sm">
                  <span className="text-gray-500">Empresa de Faturamento:</span>
                  <p className="font-medium mt-0.5">{EMPRESA_LABEL[visualizando.empresaFaturamento] || visualizando.empresaFaturamento}</p>
                </div>
              )}

              {/* Observações */}
              {visualizando.observacoes && (
                <div className="text-sm">
                  <span className="text-gray-500">Observações:</span>
                  <p className="text-gray-700 mt-0.5">{visualizando.observacoes}</p>
                </div>
              )}

              {/* Aprovação */}
              {canEdit && visualizando.status === 'emitida' && (
                <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visualizando.aprovada}
                    onChange={() => {
                      const atualizada = { ...visualizando, aprovada: !visualizando.aprovada };
                      onAprovar(atualizada);
                      setVisualizando(atualizada);
                    }}
                    className="w-5 h-5 accent-emt-verde"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">Aprovar Ordem de Compra</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {visualizando.aprovada ? 'Ordem de compra aprovada' : 'Marque para aprovar esta ordem de compra'}
                    </p>
                  </div>
                  {visualizando.aprovada && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aprovada</span>
                  )}
                </label>
              )}
              {visualizando.aprovada && visualizando.status !== 'emitida' && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aprovada</span>
                </div>
              )}

              {/* Gerar Entrada no Estoque */}
              {visualizando.entradaInsumos && canEdit && visualizando.aprovada && (
                visualizando.entradaGerada ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Entrada Gerada</span>
                    <span className="text-sm text-green-700">A entrada no estoque já foi gerada para esta OC.</span>
                  </div>
                ) : (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-purple-800">Gerar Entrada no Estoque</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label="Tipo"
                        id="entrada-tipo"
                        options={[
                          { value: 'insumos', label: 'Estoque de Insumos' },
                          { value: 'combustivel', label: 'Estoque de Combustível' },
                        ]}
                        value={entradaTipo}
                        onChange={(e) => { setEntradaTipo(e.target.value as 'insumos' | 'combustivel'); setEntradaDepositoId(''); }}
                      />
                      <Select
                        label="Depósito"
                        id="entrada-deposito"
                        options={
                          entradaTipo === 'insumos'
                            ? depositosMaterial.filter((d) => d.ativo).map((d) => ({ value: d.id, label: d.nome }))
                            : depositosCombustivel.filter((d) => d.ativo).map((d) => ({ value: d.id, label: d.nome }))
                        }
                        value={entradaDepositoId}
                        onChange={(e) => setEntradaDepositoId(e.target.value)}
                        placeholder="Selecione..."
                      />
                    </div>
                    {entradaMsg && <p className="text-sm text-green-700 bg-green-50 rounded p-2">{entradaMsg}</p>}
                    {entradaErro && <p className="text-sm text-red-700 bg-red-50 rounded p-2">{entradaErro}</p>}
                    <Button
                      onClick={async () => {
                        if (!entradaDepositoId) { setEntradaErro('Selecione um depósito.'); return; }
                        setEntradaSaving(true); setEntradaMsg(''); setEntradaErro('');
                        try {
                          await onGerarEntrada(visualizando, entradaTipo, entradaDepositoId);
                          setEntradaMsg('Entrada gerada com sucesso!');
                          setEntradaDepositoId('');
                          setVisualizando({ ...visualizando, entradaGerada: true });
                        } catch (err: unknown) {
                          const e = err as { message?: string };
                          setEntradaErro(e?.message || 'Erro ao gerar entrada.');
                        } finally {
                          setEntradaSaving(false);
                        }
                      }}
                      disabled={entradaSaving || !entradaDepositoId}
                    >
                      {entradaSaving ? 'Gerando...' : 'Gerar Entrada'}
                    </Button>
                  </div>
                )
              )}

              {/* Ações */}
              <div className="flex justify-end gap-2 pt-2">
                {visualizando.status === 'emitida' && canEdit && (
                  <>
                    <Button variant="secondary" onClick={() => { setVisualizando(null); onEdit(visualizando); }}>Editar</Button>
                    <Button onClick={() => { onMarcarEntregue(visualizando); setVisualizando(null); }}>Marcar Entregue</Button>
                  </>
                )}
                {visualizando.status === 'entregue' && canEdit && (
                  <Button variant="secondary" onClick={() => { onReabrir(visualizando); setVisualizando(null); }}>Reabrir</Button>
                )}
                <Button variant="secondary" onClick={() => setVisualizando(null)}>Fechar</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
