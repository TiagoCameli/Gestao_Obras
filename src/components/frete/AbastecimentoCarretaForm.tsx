import { useCallback, useState, useEffect, type FormEvent } from 'react';
import type {
  Abastecimento,
  AbastecimentoCarreta,
  CategoriaAbastecimentoCarreta,
  Deposito,
  EtapaObra,
  Insumo,
  Obra,
} from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';
import { Truck, Building2 } from 'lucide-react';

interface AbastecimentoCarretaFormProps {
  initial?: AbastecimentoCarreta | null;
  onSubmit: (data: AbastecimentoCarreta) => void;
  /** Callback usado quando categoria='emt': salva carreta + saída de combustível atomicamente. */
  onSubmitEmt?: (carreta: AbastecimentoCarreta, saida: Omit<Abastecimento, 'id' | 'criadoPor' | 'pago' | 'dataPagamento' | 'pagoPor' | 'origemCombustivel' | 'fornecedor' | 'fotosUrls'>) => void;
  onCancel: () => void;
  transportadoras: string[];
  combustiveis: Insumo[];
  obras?: Obra[];
  depositos?: Deposito[];
  etapas?: EtapaObra[];
  /** Entradas de combustível pra cálculo do preço médio do tanque. */
  entradasCombustivel?: Array<{ depositoId: string; quantidadeLitros: number; valorTotal: number }>;
  onImportBatch?: (items: AbastecimentoCarreta[]) => void;
  /** Categoria padrão pra novo registro (vem da aba ativa do Frete). */
  defaultCategoria?: CategoriaAbastecimentoCarreta;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ABASTCARRETA_TEMPLATE = [
  ['Data', 'Transportadora', 'Placa', 'Mês Referência', 'Combustível', 'Litros', 'Valor Unitário', 'Observações'],
  ['2024-01-15', 'Transportes ABC', 'ABC-1234', '2024-01', 'Diesel S10', '500', '5.50', ''],
];

export default function AbastecimentoCarretaForm({
  initial,
  onSubmit,
  onSubmitEmt,
  onCancel,
  transportadoras,
  combustiveis,
  obras = [],
  depositos = [],
  etapas = [],
  entradasCombustivel = [],
  onImportBatch,
  defaultCategoria,
}: AbastecimentoCarretaFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [transportadora, setTransportadora] = useState(initial?.transportadora || '');
  const [categoria, setCategoria] = useState<CategoriaAbastecimentoCarreta>(
    initial?.categoria ?? defaultCategoria ?? 'transterra'
  );
  const [placaCarreta, setPlacaCarreta] = useState(initial?.placaCarreta || '');
  const [mesReferencia, setMesReferencia] = useState(initial?.mesReferencia || '');
  const [tipoCombustivel, setTipoCombustivel] = useState(initial?.tipoCombustivel || '');
  const [quantidadeLitros, setQuantidadeLitros] = useState(initial?.quantidadeLitros?.toString() || '');
  const [valorUnidade, setValorUnidade] = useState(initial?.valorUnidade?.toString() || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  // Campos extras pra modo EMT
  const [obraId, setObraId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [taxaLitro, setTaxaLitro] = useState(initial?.taxaLitro?.toString() || '0');

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
      const mesReferencia = parseStr(row[3]);
      const combustivelNome = parseStr(row[4]);
      const litros = parseNumero(row[5]);
      const vlrUnit = parseNumero(row[6]);
      const observacoes = parseStr(row[7]);

      if (!data) erros.push('Falta data');
      if (!transportadora) erros.push('Falta transportadora');
      if (!placa) erros.push('Falta placa');
      if (!mesReferencia) erros.push('Falta mes referencia');

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

      const resumo = `${data || '?'} | ${transportadora || '?'} | ${placa || '?'} | ${mesReferencia || '?'} | ${combustivelNome || '?'} | ${litros ?? '?'} L`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, transportadora, placa, mesReferencia, combustivelId, litros: litros ?? 0, vlrUnit: vlrUnit ?? 0, observacoes },
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
      mesReferencia: d.mesReferencia,
      tipoCombustivel: d.combustivelId,
      quantidadeLitros: litros,
      valorUnidade: vlrUnit,
      valorTotal: litros * vlrUnit,
      observacoes: d.observacoes,
      categoria: defaultCategoria ?? 'transterra',
      criadoPor: '',
    };
  }, [defaultCategoria]);

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
      setMesReferencia(initial.mesReferencia || '');
      setTipoCombustivel(initial.tipoCombustivel);
      setQuantidadeLitros(initial.quantidadeLitros?.toString() || '');
      setValorUnidade(initial.valorUnidade?.toString() || '');
      setObservacoes(initial.observacoes);
      setCategoria(initial.categoria ?? 'transterra');
    }
  }, [initial]);

  const litros = parseFloat(quantidadeLitros) || 0;
  const vlrUnit = parseFloat(valorUnidade) || 0;
  const valorTotal = litros * vlrUnit;

  // ── Cálculos EMT ──
  const isEmt = categoria === 'emt';
  const depositosDaObra = obraId
    ? depositos.filter((d) => d.obraId === obraId && d.ativo !== false)
    : [];
  const etapasDaObra = obraId ? etapas.filter((e) => e.obraId === obraId) : [];
  const entradasTanque = depositoId
    ? entradasCombustivel.filter((e) => e.depositoId === depositoId)
    : [];
  const totalLitrosEnt = entradasTanque.reduce((s, e) => s + e.quantidadeLitros, 0);
  const totalValorEnt = entradasTanque.reduce((s, e) => s + e.valorTotal, 0);
  const precoMedioTanque = totalLitrosEnt > 0 ? totalValorEnt / totalLitrosEnt : 0;
  const taxaNum = parseFloat(taxaLitro) || 0;
  const valorUnitFinal = isEmt ? precoMedioTanque + taxaNum : vlrUnit;
  const valorTotalFinal = isEmt ? litros * valorUnitFinal : valorTotal;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (isEmt && onSubmitEmt) {
      const carreta: AbastecimentoCarreta = {
        id: initial?.id || gerarId(),
        data,
        transportadora,
        placaCarreta,
        mesReferencia,
        tipoCombustivel,
        quantidadeLitros: litros,
        valorUnidade: valorUnitFinal,
        valorTotal: valorTotalFinal,
        observacoes,
        categoria: 'emt',
        taxaLitro: taxaNum,
        criadoPor: initial?.criadoPor || '',
      };
      const dataHora = `${data}T00:00:00`;
      const saidaPayload = {
        dataHora,
        tipoCombustivel,
        quantidadeLitros: litros,
        valorTotal: valorTotalFinal,
        obraId,
        etapaId,
        alocacoes: etapaId ? [{ etapaId, percentual: 100 }] : [],
        depositoId,
        equipamentoId: '',
        veiculo: `${transportadora} · ${placaCarreta}`,
        observacoes:
          observacoes ||
          `Abastecimento EMT — taxa R$ ${taxaNum.toFixed(4)}/L · preço médio R$ ${precoMedioTanque.toFixed(4)}/L`,
      };
      onSubmitEmt(carreta, saidaPayload);
      return;
    }

    onSubmit({
      id: initial?.id || gerarId(),
      data,
      transportadora,
      placaCarreta,
      mesReferencia,
      tipoCombustivel,
      quantidadeLitros: litros,
      valorUnidade: vlrUnit,
      valorTotal,
      observacoes,
      categoria,
      taxaLitro: 0,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = isEmt
    ? data && obraId && depositoId && etapaId && transportadora && placaCarreta && tipoCombustivel && litros > 0 && precoMedioTanque > 0
    : data && transportadora && placaCarreta && mesReferencia && tipoCombustivel && quantidadeLitros && valorUnidade;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}

      {/* Toggle Categoria — destaque grande */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Abastecimento
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCategoria('transterra')}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              categoria === 'transterra'
                ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              categoria === 'transterra' ? 'bg-emt-verde text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Truck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${categoria === 'transterra' ? 'text-emt-verde-escuro' : 'text-gray-800'}`}>
                Abastecimento Transterra
              </div>
              <div className="text-xs text-gray-500">
                Terceirizado — informa valor unitário direto
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setCategoria('emt')}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              categoria === 'emt'
                ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              categoria === 'emt' ? 'bg-emt-verde text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${categoria === 'emt' ? 'text-emt-verde-escuro' : 'text-gray-800'}`}>
                Abastecimento EMT
              </div>
              <div className="text-xs text-gray-500">
                Sai do tanque EMT — preço calculado + taxa
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data"
          id="abastCarretaData"
          type="date"
          value={data}
          onChange={(e) => { setData(e.target.value); if (e.target.value) setMesReferencia(e.target.value.slice(0, 7)); }}
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
        {!isEmt && (
          <Input
            label="Mês Referência"
            id="abastCarretaMesRef"
            value={mesReferencia ? (() => { const [a, m] = mesReferencia.split('-'); const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']; return `${nomes[parseInt(m,10)-1]} ${a}`; })() : ''}
            onChange={() => {}}
            readOnly
          />
        )}

        {/* Tipo Combustivel com inline + Novo */}
        <div>
          <Select
            label="Tipo de Combustível"
            id="abastCarretaCombustivel"
            value={tipoCombustivel}
            onChange={(e) => setTipoCombustivel(e.target.value)}
            options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecione o combustível"
            required
          />
          {!novoCombustivelAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoCombustivelAberto(true)}
            >
              + Novo Combustível
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome do combustível"
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
        {!isEmt && (
          <Input
            label="Valor Unitário (R$/litro)"
            id="abastCarretaVlrUnit"
            type="number"
            step="0.0001"
            min="0"
            value={valorUnidade}
            onChange={(e) => setValorUnidade(e.target.value)}
            required
          />
        )}
        {!isEmt && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Total (R$)
            </label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-emt-verde">
              {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Litros x Valor Unitário</p>
          </div>
        )}
      </div>

      {isEmt && (
        <div className="rounded-xl border border-emt-verde/30 bg-emt-verde/5 p-4 space-y-4">
          <div className="flex items-center gap-2 text-emt-verde-escuro">
            <Building2 className="w-4 h-4" />
            <span className="font-semibold text-sm">Saída do Tanque EMT</span>
          </div>
          <p className="text-xs text-gray-600 -mt-2">
            Este abastecimento também será registrado como saída de combustível no módulo Combustível.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Obra"
              id="abastCarretaObraEmt"
              value={obraId}
              onChange={(e) => { setObraId(e.target.value); setDepositoId(''); setEtapaId(''); }}
              options={obras.map((o) => ({ value: o.id, label: o.nome }))}
              placeholder="Selecione a obra"
              required
            />
            <Select
              label="Tanque (depósito)"
              id="abastCarretaTanqueEmt"
              value={depositoId}
              onChange={(e) => setDepositoId(e.target.value)}
              options={depositosDaObra.map((d) => ({ value: d.id, label: d.nome }))}
              placeholder={obraId ? 'Selecione o tanque' : 'Selecione uma obra primeiro'}
              disabled={!obraId}
              required
            />
            <Select
              label="Etapa da Obra"
              id="abastCarretaEtapaEmt"
              value={etapaId}
              onChange={(e) => setEtapaId(e.target.value)}
              options={etapasDaObra.map((et) => ({ value: et.id, label: et.nome }))}
              placeholder={obraId ? 'Selecione a etapa' : 'Selecione uma obra primeiro'}
              disabled={!obraId}
              required
            />
            <Input
              label="Taxa por Litro (R$/L)"
              id="abastCarretaTaxa"
              type="number"
              step="0.0001"
              min="0"
              value={taxaLitro}
              onChange={(e) => setTaxaLitro(e.target.value)}
              placeholder="0.0000"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preço Médio do Tanque</label>
              <div className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-semibold text-gray-800">
                {precoMedioTanque > 0
                  ? precoMedioTanque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
                  : '—'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Calculado das entradas do tanque</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor Unitário Final</label>
              <div className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-semibold text-gray-800">
                {valorUnitFinal > 0
                  ? valorUnitFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
                  : '—'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Preço médio + Taxa</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total</label>
              <div className="w-full border border-emt-verde/40 bg-white rounded-lg px-3 py-2 text-sm font-bold text-emt-verde">
                {valorTotalFinal > 0
                  ? valorTotalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '—'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Litros × Valor Unitário Final</p>
            </div>
          </div>

          {depositoId && precoMedioTanque === 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
              Este tanque ainda não tem entradas de combustível registradas. Cadastre uma entrada no módulo Combustível antes de prosseguir.
            </div>
          )}
        </div>
      )}
      <div>
        <label
          htmlFor="abastCarretaObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="abastCarretaObs"
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
          {initial ? 'Salvar Alterações' : 'Registrar Abastecimento'}
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
        templateColWidths={[12, 20, 12, 14, 18, 10, 14, 15]}
        formatHintHeaders={['Data', 'Transp.', 'Placa', 'Mês Ref', 'Combustível', 'Litros', 'Vlr Unit', 'Obs']}
        formatHintExample={['2024-01-15', 'ABC', 'ABC-1234', '2024-01', 'Diesel S10', '500', '5.50', '']}
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
