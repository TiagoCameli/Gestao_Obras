import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo, Obra, UnidadeMedida } from '../../types';
import { useAdicionarFornecedor } from '../../hooks/useFornecedores';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface EntradaMaterialFormProps {
  initial?: EntradaMaterial | null;
  onSubmit: (data: EntradaMaterial) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  depositosMaterial: DepositoMaterial[];
  unidades?: UnidadeMedida[];
  onImportBatch?: (items: EntradaMaterial[]) => void;
}

const ENTRADA_MAT_TEMPLATE = [
  ['Data', 'Obra', 'Depósito', 'Material', 'Quantidade', 'Valor Total', 'Fornecedor', 'NF', 'Observações'],
  ['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado Central', 'Cimento CP-II', '100', '3500', 'Distribuidora XYZ', 'NF-001', ''],
];

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function EntradaMaterialForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos: allInsumos,
  fornecedores: allFornecedores,
  depositosMaterial: allDepositos,
  unidades: unidadesProp,
  onImportBatch,
}: EntradaMaterialFormProps) {
  const unidades = unidadesProp ?? [];
  const unidadesMap = new Map(unidades.map((u) => [u.sigla, u.nome]));
  const adicionarInsumoMutation = useAdicionarInsumo();
  const adicionarFornecedorMutation = useAdicionarFornecedor();

  const [listaMateriais, setListaMateriais] = useState(() =>
    allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false)
  );
  useEffect(() => {
    if (allInsumos.length > 0) {
      setListaMateriais(allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false));
    }
  }, [allInsumos]);

  const [novoMaterialAberto, setNovoMaterialAberto] = useState(false);
  const [novoMaterialNome, setNovoMaterialNome] = useState('');
  const [novoMaterialUnidade, setNovoMaterialUnidade] = useState('');

  const [listaFornecedores, setListaFornecedores] = useState(() =>
    allFornecedores.filter((f) => f.ativo !== false)
  );
  useEffect(() => {
    if (allFornecedores.length > 0) {
      setListaFornecedores(allFornecedores.filter((f) => f.ativo !== false));
    }
  }, [allFornecedores]);

  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');

  const [dataHora, setDataHora] = useState(initial?.dataHora || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [depositoMaterialId, setDepositoMaterialId] = useState(
    initial?.depositoMaterialId || ''
  );
  const [insumoId, setInsumoId] = useState(initial?.insumoId || '');
  const [quantidade, setQuantidade] = useState(
    initial?.quantidade?.toString() || ''
  );
  const [valorTotal, setValorTotal] = useState(
    initial?.valorTotal?.toString() || ''
  );
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const data = parseStr(row[0]);
    if (!data) erros.push('Data obrigatoria');
    const obraNome = parseStr(row[1]);
    const obra = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
    if (!obra) erros.push(`Obra "${obraNome}" não encontrada`);
    const obraId = obra?.id ?? '';
    const depositoNome = parseStr(row[2]);
    const deposito = allDepositos.filter((d) => d.ativo !== false).find((d) => d.nome.toLowerCase() === depositoNome.toLowerCase() && (!obra || d.obraId === obra.id));
    if (!deposito) erros.push(`Depósito "${depositoNome}" não encontrado`);
    const depositoMaterialId = deposito?.id ?? '';
    const materialNome = parseStr(row[3]);
    const material = allInsumos.filter((i) => i.tipo === 'material' && i.ativo !== false).find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
    if (!material) erros.push(`Material "${materialNome}" não encontrado`);
    const insumoId = material?.id ?? '';
    const qtd = parseNumero(row[4]);
    if (qtd === null || qtd <= 0) erros.push('Quantidade obrigatoria');
    const quantidade = qtd ?? 0;
    const vt = parseNumero(row[5]);
    if (vt === null || vt <= 0) erros.push('Valor Total obrigatorio');
    const valorTotal = vt ?? 0;
    const fornecedorNome = parseStr(row[6]);
    const fornecedor = allFornecedores.filter((f) => f.ativo !== false).find((f) => f.nome.toLowerCase() === fornecedorNome.toLowerCase());
    if (!fornecedor) erros.push(`Fornecedor "${fornecedorNome}" não encontrado`);
    const fornecedorId = fornecedor?.id ?? '';
    const notaFiscal = parseStr(row[7]);
    const observacoes = parseStr(row[8]);
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${data} | ${obraNome} | ${depositoNome} | ${materialNome} | ${quantidade}`,
      dados: { data, obraId, depositoMaterialId, insumoId, quantidade, valorTotal, fornecedorId, notaFiscal, observacoes },
    };
  }, [obras, allDepositos, allInsumos, allFornecedores]);

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      dataHora: d.data as string,
      depositoMaterialId: d.depositoMaterialId as string,
      insumoId: d.insumoId as string,
      obraId: d.obraId as string,
      quantidade: d.quantidade as number,
      valorTotal: d.valorTotal as number,
      fornecedorId: d.fornecedorId as string,
      notaFiscal: d.notaFiscal as string,
      observacoes: d.observacoes as string,
      criadoPor: '',
    };
  }, []);

  // Filter depositos by obraId from props
  const depositos = obraId
    ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false)
    : [];

  useEffect(() => {
    if (!initial) {
      setDepositoMaterialId('');
    }
  }, [obraId, initial]);

  const insumoSelecionado = listaMateriais.find((i) => i.id === insumoId);
  const unidadeLabel = insumoSelecionado
    ? unidadesMap.get(insumoSelecionado.unidade) || insumoSelecionado.unidade
    : '';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      dataHora,
      depositoMaterialId,
      insumoId,
      obraId,
      quantidade: parseFloat(quantidade) || 0,
      valorTotal: parseFloat(valorTotal) || 0,
      fornecedorId,
      notaFiscal,
      observacoes,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid =
    dataHora &&
    obraId &&
    depositoMaterialId &&
    insumoId &&
    parseFloat(quantidade) > 0 &&
    parseFloat(valorTotal) > 0 &&
    fornecedorId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {onImportBatch && !initial && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="entMatDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="entMatObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <Select
          label="Depósito de Destino"
          id="entMatDepositoId"
          value={depositoMaterialId}
          onChange={(e) => setDepositoMaterialId(e.target.value)}
          options={depositos.map((d) => ({
            value: d.id,
            label: d.nome,
          }))}
          placeholder={
            !obraId
              ? 'Selecione a obra primeiro'
              : depositos.length === 0
                ? 'Nenhum depósito cadastrado'
                : 'Selecione o depósito'
          }
          disabled={!obraId || depositos.length === 0}
          required
        />
        <div>
          <Select
            label="Material"
            id="entMatInsumoId"
            value={insumoId}
            onChange={(e) => setInsumoId(e.target.value)}
            options={listaMateriais.map((i) => ({
              value: i.id,
              label: i.nome,
            }))}
            placeholder={
              listaMateriais.length === 0
                ? 'Nenhum material cadastrado'
                : 'Selecione o material'
            }
            required
          />
          {!novoMaterialAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoMaterialAberto(true)}
            >
              + Novo Material
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome do material"
                  value={novoMaterialNome}
                  onChange={(e) => setNovoMaterialNome(e.target.value)}
                  autoFocus
                />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                  value={novoMaterialUnidade}
                  onChange={(e) => setNovoMaterialUnidade(e.target.value)}
                >
                  <option value="">Unidade</option>
                  {unidades
                    .filter((u) => u.ativo !== false)
                    .map((u) => (
                      <option key={u.id} value={u.sigla}>
                        {u.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novoMaterialNome.trim() || !novoMaterialUnidade}
                  onClick={() => {
                    const novo = {
                      id: gerarId(),
                      nome: novoMaterialNome.trim(),
                      tipo: 'material' as const,
                      unidade: novoMaterialUnidade,
                      descricao: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarInsumoMutation.mutate(novo);
                    setListaMateriais((prev) => [...prev, novo]);
                    setInsumoId(novo.id);
                    setNovoMaterialNome('');
                    setNovoMaterialUnidade('');
                    setNovoMaterialAberto(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setNovoMaterialAberto(false);
                    setNovoMaterialNome('');
                    setNovoMaterialUnidade('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        <Input
          label={`Quantidade${unidadeLabel ? ` (${unidadeLabel})` : ''}`}
          id="entMatQtd"
          type="number"
          step="0.0001"
          min="0"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          required
        />
        <Input
          label="Valor Total (R$)"
          id="entMatValor"
          type="number"
          step="0.0001"
          min="0"
          value={valorTotal}
          onChange={(e) => setValorTotal(e.target.value)}
          required
        />
        <div>
          <Select
            label="Fornecedor"
            id="entMatFornecedor"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            options={listaFornecedores.map((f) => ({
              value: f.id,
              label: f.nome,
            }))}
            placeholder={
              listaFornecedores.length === 0
                ? 'Nenhum fornecedor cadastrado'
                : 'Selecione o fornecedor'
            }
            required
          />
          {!novoFornecedorAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoFornecedorAberto(true)}
            >
              + Novo Fornecedor
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                placeholder="Nome do fornecedor"
                value={novoFornecedorNome}
                onChange={(e) => setNovoFornecedorNome(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                className="text-xs px-3 py-1.5"
                disabled={!novoFornecedorNome.trim()}
                onClick={() => {
                  const novo = {
                    id: gerarId(),
                    nome: novoFornecedorNome.trim(),
                    cnpj: '',
                    telefone: '',
                    email: '',
                    observacoes: '',
                    ativo: true,
                    criadoPor: '',
                  };
                  adicionarFornecedorMutation.mutate(novo);
                  setListaFornecedores((prev) => [...prev, novo]);
                  setFornecedorId(novo.id);
                  setNovoFornecedorNome('');
                  setNovoFornecedorAberto(false);
                }}
              >
                Salvar
              </Button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setNovoFornecedorAberto(false);
                  setNovoFornecedorNome('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <Input
          label="Nota Fiscal (opcional)"
          id="entMatNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
      </div>
      <div>
        <label
          htmlFor="entMatObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="entMatObs"
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
          {initial ? 'Salvar Alterações' : 'Registrar Entrada'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as EntradaMaterial[]);
            setToastMsg(`${items.length} entrada(s) importada(s) com sucesso!`);
            setTimeout(() => setToastMsg(''), 3500);
          }}
          title="Importar Entradas de Material"
          entityLabel="Entrada"
          genderFem
          templateData={ENTRADA_MAT_TEMPLATE}
          templateFileName="template_entradas_material.xlsx"
          sheetName="Entradas"
          templateColWidths={[18, 15, 22, 18, 12, 12, 20, 10, 15]}
          formatHintHeaders={['Data', 'Obra', 'Depósito', 'Material', 'Qtd', 'Valor', 'Fornecedor', 'NF', 'Obs']}
          formatHintExample={['2024-01-15 08:00', 'Obra ABC', 'Almoxarifado', 'Cimento', '100', '3500', 'Dist. XYZ', '', '']}
          parseRow={parseRow}
          toEntity={toEntity}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
