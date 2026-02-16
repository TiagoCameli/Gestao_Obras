import { useState, useEffect, type FormEvent } from 'react';
import type { Frete, Obra, Insumo, Localidade } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAdicionarLocalidade } from '../../hooks/useLocalidades';

interface FreteFormProps {
  initial?: Frete | null;
  onSubmit: (data: Frete) => void;
  onCancel: () => void;
  obras: Obra[];
  insumos: Insumo[];
  localidades: Localidade[];
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
  localidades,
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

  // Inline nova localidade
  const [listaLocalidades, setListaLocalidades] = useState<Localidade[]>(localidades);
  const [novaOrigemAberta, setNovaOrigemAberta] = useState(false);
  const [novaOrigemNome, setNovaOrigemNome] = useState('');
  const [novaDestinoAberta, setNovaDestinoAberta] = useState(false);
  const [novaDestinoNome, setNovaDestinoNome] = useState('');

  const adicionarLocalidadeMutation = useAdicionarLocalidade();

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
                      ativo: true,
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
                      ativo: true,
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
