import { useState, useEffect, type FormEvent } from 'react';
import type { Frete, Obra, Insumo } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface FreteFormProps {
  initial?: Frete | null;
  onSubmit: (data: Frete) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function FreteForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  insumos,
}: FreteFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [origem, setOrigem] = useState(initial?.origem || '');
  const [destino, setDestino] = useState(initial?.destino || '');
  const [transportadora, setTransportadora] = useState(initial?.transportadora || '');
  const [insumoId, setInsumoId] = useState(initial?.insumoId || '');
  const [pesoToneladas, setPesoToneladas] = useState(initial?.pesoToneladas?.toString() || '');
  const [kmRodados, setKmRodados] = useState(initial?.kmRodados?.toString() || '');
  const [valorTkm, setValorTkm] = useState(initial?.valorTkm?.toString() || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  const peso = parseFloat(pesoToneladas) || 0;
  const km = parseFloat(kmRodados) || 0;
  const tkm = parseFloat(valorTkm) || 0;
  const valorTotal = km * peso * tkm;

  // Reset form when initial changes (edit mode)
  useEffect(() => {
    if (initial) {
      setData(initial.data);
      setObraId(initial.obraId);
      setOrigem(initial.origem);
      setDestino(initial.destino);
      setTransportadora(initial.transportadora);
      setInsumoId(initial.insumoId);
      setPesoToneladas(initial.pesoToneladas?.toString() || '');
      setKmRodados(initial.kmRodados?.toString() || '');
      setValorTkm(initial.valorTkm?.toString() || '');
      setNotaFiscal(initial.notaFiscal);
      setObservacoes(initial.observacoes);
    }
  }, [initial]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      data,
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
      observacoes,
    });
  }

  const isValid = data && origem && destino && transportadora && insumoId && pesoToneladas && kmRodados && valorTkm;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data"
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
        <Input
          label="Origem"
          id="freteOrigem"
          type="text"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Cidade/local de origem"
          required
        />
        <Input
          label="Destino"
          id="freteDestino"
          type="text"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="Cidade/local de destino"
          required
        />
        <Input
          label="Transportadora"
          id="freteTransportadora"
          type="text"
          value={transportadora}
          onChange={(e) => setTransportadora(e.target.value)}
          placeholder="Nome da transportadora"
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
          step="0.001"
          min="0"
          value={pesoToneladas}
          onChange={(e) => setPesoToneladas(e.target.value)}
          required
        />
        <Input
          label="KM Rodados"
          id="freteKm"
          type="number"
          step="0.1"
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
      </div>
      <div>
        <label
          htmlFor="freteObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observacoes (opcional)
        </label>
        <textarea
          id="freteObs"
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
          {initial ? 'Salvar Alteracoes' : 'Registrar Frete'}
        </Button>
      </div>
    </form>
  );
}
