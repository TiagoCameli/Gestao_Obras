import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type { PedidoMaterial, ItemPedidoMaterial, Fornecedor, Insumo } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';

interface PedidoMaterialFormProps {
  initial?: PedidoMaterial | null;
  onSubmit: (data: PedidoMaterial) => void;
  onCancel: () => void;
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  onImportBatch?: (items: PedidoMaterial[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const EMPTY_ITEM: ItemPedidoMaterial = { insumoId: '', quantidade: 0, valorUnitario: 0 };

const PEDIDO_TEMPLATE = [
  ['Data', 'Fornecedor', 'Material', 'Quantidade', 'Valor Unitário', 'Observações'],
  ['2024-01-15', 'Fornecedor ABC', 'Brita', '100', '25.00', ''],
];

export default function PedidoMaterialForm({
  initial,
  onSubmit,
  onCancel,
  fornecedores,
  insumos,
  onImportBatch,
}: PedidoMaterialFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId || '');
  const [itens, setItens] = useState<ItemPedidoMaterial[]>(
    initial?.itens?.length ? initial.itens : [{ ...EMPTY_ITEM }]
  );
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const dataVal = parseData(row[0]);
      const fornecedorNome = parseStr(row[1]);
      const materialNome = parseStr(row[2]);
      const qtd = parseNumero(row[3]);
      const vlrUnit = parseNumero(row[4]);
      const obs = parseStr(row[5]);

      if (!dataVal) erros.push('Falta data');

      let fornecedorIdVal = '';
      if (!fornecedorNome) {
        erros.push('Falta fornecedor');
      } else {
        const found = fornecedores.find((f) => f.nome.toLowerCase() === fornecedorNome.toLowerCase());
        if (found) {
          fornecedorIdVal = found.id;
        } else {
          erros.push(`Fornecedor "${fornecedorNome}" nao encontrado`);
        }
      }

      let insumoIdVal = '';
      if (!materialNome) {
        erros.push('Falta material');
      } else {
        const found = insumos.find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
        if (found) {
          insumoIdVal = found.id;
        } else {
          erros.push(`Material "${materialNome}" nao encontrado`);
        }
      }

      if (qtd === null) erros.push('Falta quantidade');
      if (vlrUnit === null) erros.push('Falta valor unitario');

      const resumo = `${dataVal || '?'} | ${fornecedorNome || '?'} | ${materialNome || '?'} | ${qtd ?? '?'} x ${vlrUnit ?? '?'}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data: dataVal, fornecedorId: fornecedorIdVal, insumoId: insumoIdVal, quantidade: qtd ?? 0, valorUnitario: vlrUnit ?? 0, observacoes: obs },
      };
    },
    [fornecedores, insumos]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    return { ...row.dados };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (!onImportBatch) return;

      // Group by data|fornecedorId
      const groups = new Map<string, { data: string; fornecedorId: string; observacoes: string; itens: ItemPedidoMaterial[] }>();
      for (const item of items) {
        const key = `${item.data}|${item.fornecedorId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            data: item.data as string,
            fornecedorId: item.fornecedorId as string,
            observacoes: (item.observacoes as string) || '',
            itens: [],
          });
        }
        groups.get(key)!.itens.push({
          insumoId: item.insumoId as string,
          quantidade: item.quantidade as number,
          valorUnitario: item.valorUnitario as number,
        });
      }

      const pedidos: PedidoMaterial[] = Array.from(groups.values()).map((g) => ({
        id: gerarId(),
        data: g.data,
        fornecedorId: g.fornecedorId,
        itens: g.itens,
        observacoes: g.observacoes,
        criadoPor: '',
      }));

      onImportBatch(pedidos);
      setToastMsg(`${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} importado${pedidos.length !== 1 ? 's' : ''} com sucesso (${items.length} ite${items.length !== 1 ? 'ns' : 'm'})`);
      setTimeout(() => setToastMsg(''), 4000);
    },
    [onImportBatch]
  );

  useEffect(() => {
    if (initial) {
      setData(initial.data);
      setFornecedorId(initial.fornecedorId);
      setItens(initial.itens.length ? initial.itens : [{ ...EMPTY_ITEM }]);
      setObservacoes(initial.observacoes);
    }
  }, [initial]);

  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo !== false);
  const insumosAtivos = insumos.filter((i) => i.ativo !== false);

  function updateItem(index: number, field: keyof ItemPedidoMaterial, value: string | number) {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItens((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  function subtotal(item: ItemPedidoMaterial): number {
    return item.quantidade * item.valorUnitario;
  }

  const valorTotal = itens.reduce((sum, item) => sum + subtotal(item), 0);

  const isValid =
    data &&
    fornecedorId &&
    itens.length > 0 &&
    itens.every((item) => item.insumoId && item.quantidade > 0 && item.valorUnitario > 0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      id: initial?.id || gerarId(),
      data,
      fornecedorId,
      itens,
      observacoes,
      criadoPor: initial?.criadoPor || '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data do Pedido"
          id="pedidoMaterialData"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Select
          label="Fornecedor"
          id="pedidoMaterialFornecedor"
          value={fornecedorId}
          onChange={(e) => setFornecedorId(e.target.value)}
          options={fornecedoresAtivos.map((f) => ({ value: f.id, label: f.nome }))}
          placeholder="Selecione o fornecedor"
          required
        />
      </div>

      {/* Itens do Pedido */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Itens do Pedido</label>
          <button
            type="button"
            className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
            onClick={addItem}
          >
            + Adicionar Material
          </button>
        </div>

        <div className="space-y-2">
          {itens.map((item, index) => {
            const insumoSelecionado = insumosAtivos.find((ins) => ins.id === item.insumoId);
            return (
              <div
                key={index}
                className="grid grid-cols-[2fr_80px_1fr_1fr_1fr_32px] gap-2 items-end"
              >
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>
                  )}
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                    value={item.insumoId}
                    onChange={(e) => updateItem(index, 'insumoId', e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    {insumosAtivos.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Unidade</label>
                  )}
                  <div className="w-full h-[38px] flex items-center justify-center border border-gray-200 bg-gray-50 rounded-lg px-2 text-sm text-gray-600">
                    {insumoSelecionado?.unidade || '—'}
                  </div>
                </div>
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qtd</label>
                  )}
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                    value={item.quantidade || ''}
                    onChange={(e) => updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Vlr Unit (R$)</label>
                  )}
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                    value={item.valorUnitario || ''}
                    onChange={(e) => updateItem(index, 'valorUnitario', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal</label>
                  )}
                  <div className="w-full h-[38px] flex items-center justify-end border border-gray-200 bg-gray-50 rounded-lg px-3 text-sm font-medium text-emt-verde">
                    {subtotal(item).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
                <div>
                  {index === 0 && <div className="h-4 mb-1" />}
                  {itens.length > 1 && (
                    <button
                      type="button"
                      className="w-8 h-[38px] flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      onClick={() => removeItem(index)}
                      title="Remover item"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Valor Total */}
      <div className="flex justify-end">
        <div className="text-right">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor Total do Pedido
          </label>
          <div className="border border-gray-200 bg-gray-50 rounded-lg px-4 py-2 text-lg font-bold text-emt-verde">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="pedidoMaterialObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="pedidoMaterialObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Pedido'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Pedidos de Material do Excel"
        entityLabel="Item"
        genderFem={false}
        templateData={PEDIDO_TEMPLATE}
        templateFileName="template_pedidos_material.xlsx"
        sheetName="Pedidos"
        templateColWidths={[12, 20, 18, 12, 14, 15]}
        formatHintHeaders={['Data', 'Fornecedor', 'Material', 'Qtd', 'Vlr Unit', 'Obs']}
        formatHintExample={['2024-01-15', 'Fornecedor ABC', 'Brita', '100', '25.00', '']}
        parseRow={parseRow}
        toEntity={toEntity}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
