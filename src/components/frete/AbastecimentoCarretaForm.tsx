import { useCallback, useState, useEffect, type FormEvent } from 'react';
import type { AbastecimentoCarreta, Insumo } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';

interface AbastecimentoCarretaFormProps {
  initial?: AbastecimentoCarreta | null;
  onSubmit: (data: AbastecimentoCarreta) => void;
  onCancel: () => void;
  transportadoras: string[];
  combustiveis: Insumo[];
  onImportBatch?: (items: AbastecimentoCarreta[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ABASTCARRETA_TEMPLATE = [
  ['Data', 'Transportadora', 'Placa', 'Combustivel', 'Litros', 'Valor Unitario', 'Observacoes'],
  ['2024-01-15', 'Transportes ABC', 'ABC-1234', 'Diesel S10', '500', '5.50', ''],
];

export default function AbastecimentoCarretaForm({
  initial,
  onSubmit,
  onCancel,
  transportadoras,
  combustiveis,
  onImportBatch,
}: AbastecimentoCarretaFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [transportadora, setTransportadora] = useState(initial?.transportadora || '');
  const [placaCarreta, setPlacaCarreta] = useState(initial?.placaCarreta || '');
  const [tipoCombustivel, setTipoCombustivel] = useState(initial?.tipoCombustivel || '');
  const [quantidadeLitros, setQuantidadeLitros] = useState(initial?.quantidadeLitros?.toString() || '');
  const [valorUnidade, setValorUnidade] = useState(initial?.valorUnidade?.toString() || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Inline novo combustivel
  const [listaCombustiveis, setListaCombustiveis] = useState<Insumo[]>(combustiveis);
  const [novoCombustivelAberto, setNovoCombustivelAberto] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');
  const adicionarInsumoMutation = useAdicionarInsumo();

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseData(row[0]);
      const transportadora = parseStr(row[1]);
      const placa = parseStr(row[2]);
      const combustivelNome = parseStr(row[3]);
      const litros = parseNumero(row[4]);
      const vlrUnit = parseNumero(row[5]);
      const observacoes = parseStr(row[6]);

      if (!data) erros.push('Falta data');
      if (!transportadora) erros.push('Falta transportadora');
      if (!placa) erros.push('Falta placa');

      let combustivelId = '';
      if (!combustivelNome) {
        erros.push('Falta combustivel');
      } else {
        const found = combustiveis.find((c) => c.nome.toLowerCase() === combustivelNome.toLowerCase());
        if (found) {
          combustivelId = found.id;
        } else {
          erros.push(`Combustivel "${combustivelNome}" nao encontrado`);
        }
      }

      if (litros === null) erros.push('Falta litros');
      if (vlrUnit === null) erros.push('Falta valor unitario');

      const resumo = `${data || '?'} | ${transportadora || '?'} | ${placa || '?'} | ${combustivelNome || '?'} | ${litros ?? '?'} L`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, transportadora, placa, combustivelId, litros: litros ?? 0, vlrUnit: vlrUnit ?? 0, observacoes },
      };
    },
    [combustiveis]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    const litros = d.litros as number;
    const vlrUnit = d.vlrUnit as number;
    return {
      id: gerarId(),
      data: d.data,
      transportadora: d.transportadora,
      placaCarreta: d.placa,
      tipoCombustivel: d.combustivelId,
      quantidadeLitros: litros,
      valorUnidade: vlrUnit,
      valorTotal: litros * vlrUnit,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as AbastecimentoCarreta[]);
        setToastMsg(`${items.length} abastecimento${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  useEffect(() => {
    setListaCombustiveis(combustiveis);
  }, [combustiveis]);

  useEffect(() => {
    if (initial) {
      setData(initial.data);
      setTransportadora(initial.transportadora);
      setPlacaCarreta(initial.placaCarreta);
      setTipoCombustivel(initial.tipoCombustivel);
      setQuantidadeLitros(initial.quantidadeLitros?.toString() || '');
      setValorUnidade(initial.valorUnidade?.toString() || '');
      setObservacoes(initial.observacoes);
    }
  }, [initial]);

  const litros = parseFloat(quantidadeLitros) || 0;
  const vlrUnit = parseFloat(valorUnidade) || 0;
  const valorTotal = litros * vlrUnit;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      data,
      transportadora,
      placaCarreta,
      tipoCombustivel,
      quantidadeLitros: litros,
      valorUnidade: vlrUnit,
      valorTotal,
      observacoes,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = data && transportadora && placaCarreta && tipoCombustivel && quantidadeLitros && valorUnidade;

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
          label="Data"
          id="abastCarretaData"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Select
          label="Transportadora"
          id="abastCarretaTransp"
          value={transportadora}
          onChange={(e) => setTransportadora(e.target.value)}
          options={transportadoras.map((t) => ({ value: t, label: t }))}
          placeholder="Selecione a transportadora"
          required
        />
        <Input
          label="Placa da Carreta"
          id="abastCarretaPlaca"
          type="text"
          value={placaCarreta}
          onChange={(e) => setPlacaCarreta(e.target.value.toUpperCase())}
          placeholder="Ex: ABC-1234"
          required
        />

        {/* Tipo Combustivel com inline + Novo */}
        <div>
          <Select
            label="Tipo de Combustivel"
            id="abastCarretaCombustivel"
            value={tipoCombustivel}
            onChange={(e) => setTipoCombustivel(e.target.value)}
            options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecione o combustivel"
            required
          />
          {!novoCombustivelAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoCombustivelAberto(true)}
            >
              + Novo Combustivel
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome do combustivel"
                  value={novoCombustivelNome}
                  onChange={(e) => setNovoCombustivelNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novoCombustivelNome.trim()}
                  onClick={() => {
                    const novo: Insumo = {
                      id: gerarId(),
                      nome: novoCombustivelNome.trim(),
                      tipo: 'combustivel',
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
            </div>
          )}
        </div>

        <Input
          label="Quantidade (litros)"
          id="abastCarretaLitros"
          type="number"
          step="0.0001"
          min="0"
          value={quantidadeLitros}
          onChange={(e) => setQuantidadeLitros(e.target.value)}
          required
        />
        <Input
          label="Valor Unitario (R$/litro)"
          id="abastCarretaVlrUnit"
          type="number"
          step="0.0001"
          min="0"
          value={valorUnidade}
          onChange={(e) => setValorUnidade(e.target.value)}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor Total (R$)
          </label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-emt-verde">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-gray-400 mt-1">Litros x Valor Unitario</p>
        </div>
      </div>
      <div>
        <label
          htmlFor="abastCarretaObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="abastCarretaObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observacao..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alteracoes' : 'Registrar Abastecimento'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Abastecimentos de Carreta do Excel"
        entityLabel="Abastecimento"
        genderFem={false}
        templateData={ABASTCARRETA_TEMPLATE}
        templateFileName="template_abastecimentos_carreta.xlsx"
        sheetName="Abastecimentos"
        templateColWidths={[12, 20, 12, 18, 10, 14, 15]}
        formatHintHeaders={['Data', 'Transp.', 'Placa', 'Combustivel', 'Litros', 'Vlr Unit', 'Obs']}
        formatHintExample={['2024-01-15', 'ABC', 'ABC-1234', 'Diesel S10', '500', '5.50', '']}
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
