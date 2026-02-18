import { useCallback, useState, useEffect, type FormEvent } from 'react';
import type { Frete, Obra, Insumo, Localidade } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAdicionarLocalidade } from '../../hooks/useLocalidades';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';

interface FreteFormProps {
  initial?: Frete | null;
  onSubmit: (data: Frete) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  localidades: Localidade[];
  transportadoras: string[];
  onImportBatch?: (items: Frete[]) => void;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const FRETE_TEMPLATE = [
  ['Data Saída', 'Data Chegada', 'Origem', 'Destino', 'Transportadora', 'Motorista', 'Material', 'Peso (t)', 'KM', 'R$/TKM', 'Obra', 'NF', 'Placa Carreta', 'Observações'],
  ['2024-01-15', '2024-01-16', 'Sao Paulo', 'Campinas', 'Transportes ABC', 'Joao Silva', 'Brita', '25', '100', '0.15', 'Obra XYZ', 'NF-001', 'ABC-1234', ''],
];

export default function FreteForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos,
  localidades,
  transportadoras,
  onImportBatch,
}: FreteFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [dataChegada, setDataChegada] = useState(initial?.dataChegada || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [origem, setOrigem] = useState(initial?.origem || '');
  const [destino, setDestino] = useState(initial?.destino || '');
  const [transportadora, setTransportadora] = useState(initial?.transportadora || '');
  const [insumoId, setInsumoId] = useState(initial?.insumoId || '');
  const [pesoToneladas, setPesoToneladas] = useState(initial?.pesoToneladas?.toString() || '');
  const [kmRodados, setKmRodados] = useState(initial?.kmRodados?.toString() || '');
  const [valorTkm, setValorTkm] = useState(initial?.valorTkm?.toString() || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [placaCarreta, setPlacaCarreta] = useState(initial?.placaCarreta || '');
  const [motorista, setMotorista] = useState(initial?.motorista || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Inline nova localidade
  const [listaLocalidades, setListaLocalidades] = useState<Localidade[]>(localidades);
  const [novaOrigemAberta, setNovaOrigemAberta] = useState(false);
  const [novaOrigemNome, setNovaOrigemNome] = useState('');
  const [novaDestinoAberta, setNovaDestinoAberta] = useState(false);
  const [novaDestinoNome, setNovaDestinoNome] = useState('');

  const adicionarLocalidadeMutation = useAdicionarLocalidade();

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseData(row[0]);
      const dataChegada = parseData(row[1]);
      const origem = parseStr(row[2]);
      const destino = parseStr(row[3]);
      const transportadora = parseStr(row[4]);
      const motorista = parseStr(row[5]);
      const materialNome = parseStr(row[6]);
      const peso = parseNumero(row[7]);
      const km = parseNumero(row[8]);
      const tkm = parseNumero(row[9]);
      const obraNome = parseStr(row[10]);
      const notaFiscal = parseStr(row[11]);
      const placaCarreta = parseStr(row[12]);
      const observacoes = parseStr(row[13]);

      if (!data) erros.push('Falta data');
      if (!origem) erros.push('Falta origem');
      if (!destino) erros.push('Falta destino');
      if (!transportadora) erros.push('Falta transportadora');
      if (!motorista) erros.push('Falta motorista');

      let insumoId = '';
      if (!materialNome) {
        erros.push('Falta material');
      } else {
        const found = insumos.find((i) => i.nome.toLowerCase() === materialNome.toLowerCase());
        if (found) {
          insumoId = found.id;
        } else {
          erros.push(`Material "${materialNome}" nao encontrado`);
        }
      }

      if (peso === null) erros.push('Falta peso');
      if (km === null) erros.push('Falta KM');
      if (tkm === null) erros.push('Falta R$/TKM');

      let obraId = '';
      if (obraNome) {
        const found = obras.find((o) => o.nome.toLowerCase() === obraNome.toLowerCase());
        if (found) obraId = found.id;
      }

      const resumo = `${data || '?'} | ${origem || '?'} -> ${destino || '?'} | ${transportadora || '?'} | ${motorista || '?'} | ${materialNome || '?'}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, dataChegada, origem, destino, transportadora, motorista, insumoId, peso: peso ?? 0, km: km ?? 0, tkm: tkm ?? 0, obraId, notaFiscal, placaCarreta, observacoes },
      };
    },
    [insumos, obras]
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    const peso = d.peso as number;
    const km = d.km as number;
    const tkm = d.tkm as number;
    return {
      id: gerarId(),
      data: d.data,
      dataChegada: d.dataChegada || '',
      obraId: d.obraId,
      origem: d.origem,
      destino: d.destino,
      transportadora: d.transportadora,
      insumoId: d.insumoId,
      pesoToneladas: peso,
      kmRodados: km,
      valorTkm: tkm,
      valorTotal: peso * km * tkm,
      notaFiscal: d.notaFiscal,
      placaCarreta: d.placaCarreta,
      motorista: d.motorista,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as Frete[]);
        setToastMsg(`${items.length} frete${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  // Sync when localidades prop changes (e.g. after mutation invalidation)
  useEffect(() => {
    setListaLocalidades(localidades);
  }, [localidades]);

  const localidadesAtivas = listaLocalidades.filter((l) => l.ativo !== false);

  const peso = parseFloat(pesoToneladas) || 0;
  const km = parseFloat(kmRodados) || 0;
  const tkm = parseFloat(valorTkm) || 0;
  const valorTotal = km * peso * tkm;

  // Reset form when initial changes (edit mode)
  useEffect(() => {
    if (initial) {
      setData(initial.data);
      setDataChegada(initial.dataChegada || '');
      setObraId(initial.obraId);
      setOrigem(initial.origem);
      setDestino(initial.destino);
      setTransportadora(initial.transportadora);
      setInsumoId(initial.insumoId);
      setPesoToneladas(initial.pesoToneladas?.toString() || '');
      setKmRodados(initial.kmRodados?.toString() || '');
      setValorTkm(initial.valorTkm?.toString() || '');
      setNotaFiscal(initial.notaFiscal);
      setPlacaCarreta(initial.placaCarreta || '');
      setMotorista(initial.motorista || '');
      setObservacoes(initial.observacoes);
    }
  }, [initial]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      data,
      dataChegada,
      obraId,
      origem,
      destino,
      transportadora,
      insumoId,
      pesoToneladas: peso,
      kmRodados: km,
      valorTkm: tkm,
      valorTotal,
      notaFiscal,
      placaCarreta,
      motorista,
      observacoes,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = data && origem && destino && transportadora && motorista && insumoId && pesoToneladas && kmRodados && valorTkm;

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
          label="Data de Saída"
          id="freteData"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Select
          label="Obra (opcional)"
          id="freteObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
        />

        {/* Origem */}
        <div>
          <Select
            label="Origem"
            id="freteOrigem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            options={localidadesAtivas.map((l) => ({ value: l.nome, label: l.nome }))}
            placeholder="Selecione a origem"
            required
          />
          {!novaOrigemAberta ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovaOrigemAberta(true)}
            >
              + Nova Localidade
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome da localidade"
                  value={novaOrigemNome}
                  onChange={(e) => setNovaOrigemNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novaOrigemNome.trim()}
                  onClick={() => {
                    const nova: Localidade = {
                      id: gerarId(),
                      nome: novaOrigemNome.trim(),
                      endereco: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarLocalidadeMutation.mutate(nova);
                    setListaLocalidades((prev) => [...prev, nova]);
                    setOrigem(nova.nome);
                    setNovaOrigemNome('');
                    setNovaOrigemAberta(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setNovaOrigemAberta(false);
                    setNovaOrigemNome('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Destino */}
        <div>
          <Select
            label="Destino"
            id="freteDestino"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            options={localidadesAtivas.map((l) => ({ value: l.nome, label: l.nome }))}
            placeholder="Selecione o destino"
            required
          />
          {!novaDestinoAberta ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovaDestinoAberta(true)}
            >
              + Nova Localidade
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  placeholder="Nome da localidade"
                  value={novaDestinoNome}
                  onChange={(e) => setNovaDestinoNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novaDestinoNome.trim()}
                  onClick={() => {
                    const nova: Localidade = {
                      id: gerarId(),
                      nome: novaDestinoNome.trim(),
                      endereco: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarLocalidadeMutation.mutate(nova);
                    setListaLocalidades((prev) => [...prev, nova]);
                    setDestino(nova.nome);
                    setNovaDestinoNome('');
                    setNovaDestinoAberta(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setNovaDestinoAberta(false);
                    setNovaDestinoNome('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <Select
          label="Transportadora"
          id="freteTransportadora"
          value={transportadora}
          onChange={(e) => setTransportadora(e.target.value)}
          options={transportadoras.map((t) => ({ value: t, label: t }))}
          placeholder="Selecione a transportadora"
          required
        />
        <Input
          label="Motorista"
          id="freteMotorista"
          type="text"
          value={motorista}
          onChange={(e) => setMotorista(e.target.value)}
          placeholder="Nome do motorista"
          required
        />
        <Select
          label="Material Transportado"
          id="freteInsumoId"
          value={insumoId}
          onChange={(e) => setInsumoId(e.target.value)}
          options={insumos.map((i) => ({ value: i.id, label: i.nome }))}
          placeholder="Selecione o material"
          required
        />
        <Input
          label="Peso (toneladas)"
          id="fretePeso"
          type="number"
          step="0.0001"
          min="0"
          value={pesoToneladas}
          onChange={(e) => setPesoToneladas(e.target.value)}
          required
        />
        <Input
          label="KM Rodados"
          id="freteKm"
          type="number"
          step="0.0001"
          min="0"
          value={kmRodados}
          onChange={(e) => setKmRodados(e.target.value)}
          required
        />
        <Input
          label="Valor por T×KM (R$)"
          id="freteValorTkm"
          type="number"
          step="0.0001"
          min="0"
          value={valorTkm}
          onChange={(e) => setValorTkm(e.target.value)}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor Total (R$)
          </label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-emt-verde">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-gray-400 mt-1">KM × Peso × R$/TKM</p>
        </div>
        <Input
          label="Nota Fiscal (opcional)"
          id="freteNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
        <Input
          label="Placa da Carreta (opcional)"
          id="fretePlacaCarreta"
          type="text"
          value={placaCarreta}
          onChange={(e) => setPlacaCarreta(e.target.value)}
          placeholder="Ex: ABC-1234"
        />
      </div>
      <div>
        <label
          htmlFor="freteObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="freteObs"
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
          {initial ? 'Salvar Alterações' : 'Registrar Frete'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Fretes do Excel"
        entityLabel="Frete"
        genderFem={false}
        templateData={FRETE_TEMPLATE}
        templateFileName="template_fretes.xlsx"
        sheetName="Fretes"
        templateColWidths={[12, 12, 15, 15, 20, 18, 15, 10, 8, 10, 15, 10, 12, 15]}
        formatHintHeaders={['Saída', 'Chegada', 'Origem', 'Destino', 'Transp.', 'Motorista', 'Material', 'Peso(t)', 'KM', 'R$/TKM', 'Obra', 'NF', 'Placa', 'Obs']}
        formatHintExample={['2024-01-15', '2024-01-16', 'S.Paulo', 'Campinas', 'ABC', 'Joao', 'Brita', '25', '100', '0.15', 'Obra X', '', 'ABC-1234', '']}
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
