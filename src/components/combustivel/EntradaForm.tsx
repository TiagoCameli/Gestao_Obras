import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Deposito, EntradaCombustivel, Obra } from '../../types';
import { useInsumos, useAdicionarInsumo } from '../../hooks/useInsumos';
import { useFornecedores, useAdicionarFornecedor } from '../../hooks/useFornecedores';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../ui/ImportExcelModal';

interface EntradaFormProps {
  initial?: EntradaCombustivel | null;
  onSubmit: (data: EntradaCombustivel) => void;
  onCancel: () => void;
  obras: Obra[];
  depositos: Deposito[];
  onImportBatch?: (items: EntradaCombustivel[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ENTRADA_TEMPLATE = [
  ['Data', 'Obra', 'Depósito', 'Combustível', 'Litros', 'Valor Total', 'Fornecedor', 'NF', 'Observações'],
  ['2024-01-15 08:00', 'Obra ABC', 'Tanque Diesel 01', 'Diesel S10', '1000', '6500', 'Distribuidora XYZ', 'NF-001', ''],
];

export default function EntradaForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  depositos: allDepositos,
  onImportBatch,
}: EntradaFormProps) {
  const { data: insumosData } = useInsumos();
  const adicionarInsumoMutation = useAdicionarInsumo();
  const { data: fornecedoresData } = useFornecedores();
  const adicionarFornecedorMutation = useAdicionarFornecedor();

  const allInsumos = insumosData ?? [];
  const allFornecedores = fornecedoresData ?? [];

  const [listaFornecedores, setListaFornecedores] = useState(() =>
    allFornecedores.filter((f) => f.ativo !== false)
  );
  // Keep listaFornecedores in sync when data loads
  useEffect(() => {
    if (allFornecedores.length > 0) {
      setListaFornecedores(allFornecedores.filter((f) => f.ativo !== false));
    }
  }, [allFornecedores]);

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');

  const [listaCombustiveis, setListaCombustiveis] = useState(() =>
    allInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false)
  );
  // Keep listaCombustiveis in sync when data loads
  useEffect(() => {
    if (allInsumos.length > 0) {
      setListaCombustiveis(allInsumos.filter((i) => i.tipo === 'combustivel' && i.ativo !== false));
    }
  }, [allInsumos]);

  const [novoCombustivelAberto, setNovoCombustivelAberto] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');

  const [dataHora, setDataHora] = useState(initial?.dataHora || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [depositoId, setDepositoId] = useState(initial?.depositoId || '');
  const [tipoCombustivel, setTipoCombustivel] = useState(initial?.tipoCombustivel || '');
  const [quantidadeLitros, setQuantidadeLitros] = useState(
    initial?.quantidadeLitros?.toString() || ''
  );
  const [valorTotal, setValorTotal] = useState(
    initial?.valorTotal?.toString() || ''
  );
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Filter depositos by obraId from props
  const depositos = obraId ? allDepositos.filter((d) => d.obraId === obraId && d.ativo !== false) : [];

  useEffect(() => {
    if (!initial) {
      setDepositoId('');
      setTipoCombustivel('');
    }
  }, [obraId, initial]);

  useEffect(() => {
    if (!initial) {
      setTipoCombustivel('');
    }
  }, [depositoId, initial]);

  const depositoSelecionado = depositos.find((d) => d.id === depositoId);
  const qtdLitros = parseFloat(quantidadeLitros) || 0;
  const espacoDisponivel = depositoSelecionado
    ? depositoSelecionado.capacidadeLitros - depositoSelecionado.nivelAtualLitros
    : 0;
  const excedeLimite = depositoSelecionado && qtdLitros > espacoDisponivel;

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseStr(row[0]);
      const obraNome = parseStr(row[1]);
      const depositoNome = parseStr(row[2]);
      const combustivelNome = parseStr(row[3]);
      const litros = parseNumero(row[4]);
      const valor = parseNumero(row[5]);
      const fornecedorNome = parseStr(row[6]);
      const nf = parseStr(row[7]);
      const obs = parseStr(row[8]);

      if (!data) erros.push('Falta data');

      let foundObraId = '';
      if (!obraNome) {
        erros.push('Falta obra');
      } else {
        const found = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
        if (found) foundObraId = found.id;
        else erros.push(`Obra "${obraNome}" não encontrada`);
      }

      let foundDepositoId = '';
      if (!depositoNome) {
        erros.push('Falta depósito');
      } else {
        const depositosObra = foundObraId
          ? allDepositos.filter((d) => d.obraId === foundObraId && d.ativo !== false)
          : allDepositos.filter((d) => d.ativo !== false);
        const found = depositosObra.find((d) => d.nome.toLowerCase() === depositoNome.toLowerCase());
        if (found) foundDepositoId = found.id;
        else erros.push(`Depósito "${depositoNome}" não encontrado`);
      }

      let foundCombustivelId = '';
      if (!combustivelNome) {
        erros.push('Falta combustível');
      } else {
        const found = listaCombustiveis.find((i) => i.nome.toLowerCase() === combustivelNome.toLowerCase());
        if (found) foundCombustivelId = found.id;
        else erros.push(`Combustível "${combustivelNome}" não encontrado`);
      }

      if (litros === null) erros.push('Falta litros');
      if (valor === null) erros.push('Falta valor total');

      let foundFornecedor = '';
      if (!fornecedorNome) {
        erros.push('Falta fornecedor');
      } else {
        const found = listaFornecedores.find((f) => f.nome.toLowerCase() === fornecedorNome.toLowerCase());
        if (found) foundFornecedor = found.id;
        else erros.push(`Fornecedor "${fornecedorNome}" não encontrado`);
      }

      const resumo = `${data || '?'} | ${obraNome || '?'} | ${depositoNome || '?'} | ${combustivelNome || '?'} | ${litros ?? '?'} L`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, obraId: foundObraId, depositoId: foundDepositoId, tipoCombustivel: foundCombustivelId, quantidadeLitros: litros ?? 0, valorTotal: valor ?? 0, fornecedor: foundFornecedor, notaFiscal: nf, observacoes: obs },
      };
    },
    [obras, allDepositos, listaCombustiveis, listaFornecedores]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      dataHora: d.data,
      depositoId: d.depositoId,
      tipoCombustivel: d.tipoCombustivel,
      obraId: d.obraId,
      quantidadeLitros: d.quantidadeLitros,
      valorTotal: d.valorTotal,
      fornecedor: d.fornecedor,
      notaFiscal: d.notaFiscal,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as EntradaCombustivel[]);
        setToastMsg(`${items.length} entrada${items.length !== 1 ? 's' : ''} importada${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      dataHora,
      depositoId,
      tipoCombustivel,
      obraId,
      quantidadeLitros: qtdLitros,
      valorTotal: parseFloat(valorTotal),
      fornecedor,
      notaFiscal,
      observacoes,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid =
    dataHora && obraId && depositoId && tipoCombustivel && quantidadeLitros && valorTotal && fornecedor && !excedeLimite;

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
          label="Data e Hora"
          id="entradaDataHora"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
        <Select
          label="Obra"
          id="entradaObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <div>
          <Select
            label="Tanque de Destino"
            id="entradaDepositoId"
            value={depositoId}
            onChange={(e) => setDepositoId(e.target.value)}
            options={depositos.map((d) => ({
              value: d.id,
              label: `${d.nome} (${d.nivelAtualLitros.toFixed(0)}/${d.capacidadeLitros.toFixed(0)} L)`,
            }))}
            placeholder={
              !obraId
                ? 'Selecione a obra primeiro'
                : depositos.length === 0
                  ? 'Nenhum tanque cadastrado'
                  : 'Selecione o tanque'
            }
            disabled={!obraId || depositos.length === 0}
            required
          />
          {depositoSelecionado && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    (depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100 > 50
                      ? 'bg-green-500'
                      : (depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100 > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min((depositoSelecionado.nivelAtualLitros / depositoSelecionado.capacidadeLitros) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                Espaço livre: {espacoDisponivel.toFixed(0)} L
              </span>
            </div>
          )}
        </div>
        <div>
          <Select
            label="Tipo de Combustível"
            id="entradaTipoCombustivel"
            value={tipoCombustivel}
            onChange={(e) => setTipoCombustivel(e.target.value)}
            options={listaCombustiveis.map((i) => ({
              value: i.id,
              label: i.nome,
            }))}
            placeholder={
              listaCombustiveis.length === 0
                ? 'Nenhum combustível cadastrado'
                : 'Selecione o tipo'
            }
            disabled={listaCombustiveis.length === 0}
            required
          />
          {!novoCombustivelAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoCombustivelAberto(true)}
            >
              + Novo Tipo de Combustível
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                placeholder="Nome do combustível"
                value={novoCombustivelNome}
                onChange={(e) => setNovoCombustivelNome(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                className="text-xs px-3 py-1.5"
                disabled={!novoCombustivelNome.trim()}
                onClick={() => {
                  const novo = {
                    id: gerarId(),
                    nome: novoCombustivelNome.trim(),
                    tipo: 'combustivel' as const,
                    unidade: 'litro',
                    descricao: '',
                    ativo: true,
                    criadoPor: '',
                  };
                  adicionarInsumoMutation.mutate(novo);
                  setListaCombustiveis((prev) => [...prev, novo]);
                  setTipoCombustivel(novo.id);
                  setNovoCombustivelNome('');
                  setNovoCombustivelAberto(false);
                }}
              >
                Salvar
              </Button>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setNovoCombustivelAberto(false);
                  setNovoCombustivelNome('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        <Input
          label="Quantidade (litros)"
          id="entradaQtd"
          type="number"
          step="0.0001"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          error={excedeLimite ? `Excede capacidade do tanque (${espacoDisponivel.toFixed(0)} L livres)` : undefined}
          required
        />
        <Input
          label="Valor Total (R$)"
          id="entradaValor"
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
            id="entradaFornecedor"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            options={listaFornecedores.map((f) => ({ value: f.id, label: f.nome }))}
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
                  setFornecedor(novo.id);
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
          id="entradaNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
      </div>
      <div>
        <label
          htmlFor="entradaObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="entradaObs"
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

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Entradas de Combustível do Excel"
        entityLabel="Entrada"
        genderFem={true}
        templateData={ENTRADA_TEMPLATE}
        templateFileName="template_entradas_combustivel.xlsx"
        sheetName="Entradas"
        templateColWidths={[18, 15, 20, 15, 10, 12, 20, 10, 15]}
        formatHintHeaders={['Data', 'Obra', 'Depósito', 'Combustível', 'Litros', 'Valor', 'Fornecedor', 'NF', 'Obs']}
        formatHintExample={['2024-01-15 08:00', 'Obra ABC', 'Tanque 01', 'Diesel S10', '1000', '6500', 'Dist. XYZ', '', '']}
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
