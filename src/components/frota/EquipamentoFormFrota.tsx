import { useState, useMemo, useCallback, type FormEvent } from 'react';
import type { Equipamento, Empresa, TipoMedicao } from '../../types';
import { getCategoriaFrota, registrarCategoriaDinamica } from '../../lib/frotaConstants';
import { useTiposEquipamento, useAdicionarTipoEquipamento } from '../../hooks/useTiposEquipamento';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import SearchableSelect from '../apontamentos/SearchableSelect';
import ImportEquipamentosModal from '../obras/ImportEquipamentosModal';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function gerarCodigoPatrimonio(tipo: string, existentes: Equipamento[], codigo?: string, idAtual?: string): string {
  if (!tipo) return '';
  const cat = getCategoriaFrota(tipo, codigo);
  const prefixo = cat.codigo;

  const codigosExistentes = new Set(
    existentes
      .filter((e) => e.id !== idAtual)
      .map((e) => e.codigoPatrimonio.toUpperCase())
  );

  let numero = 1;
  while (true) {
    const cod = `${prefixo}-${String(numero).padStart(3, '0')}`;
    if (!codigosExistentes.has(cod.toUpperCase())) return cod;
    numero++;
  }
}

interface EquipamentoFormFrotaProps {
  initial?: Equipamento | null;
  onSubmit: (eq: Equipamento) => void;
  onCancel: () => void;
  empresas: Empresa[];
  equipamentosExistentes: Equipamento[];
  onImportBatch?: (eqs: Equipamento[]) => void;
}

export default function EquipamentoFormFrota({ initial, onSubmit, onCancel, empresas, equipamentosExistentes, onImportBatch }: EquipamentoFormFrotaProps) {
  const { data: tiposEquipamento = [] } = useTiposEquipamento();
  const adicionarTipoMut = useAdicionarTipoEquipamento();

  const [nome, setNome] = useState(initial?.nome || '');
  const [tipo, setTipo] = useState(initial?.tipo || '');
  const [empresaId, setEmpresaId] = useState(initial?.empresaId || '');
  const [codigoPatrimonio, setCodigoPatrimonio] = useState(initial?.codigoPatrimonio || '');
  const [numeroSerie, setNumeroSerie] = useState(initial?.numeroSerie || '');
  const [ano, setAno] = useState(initial?.ano || '');
  const [marca, setMarca] = useState(initial?.marca || '');
  const [modelo, setModelo] = useState(initial?.modelo || '');
  const [propriedade, setPropriedade] = useState<'propria' | 'alugada'>(initial?.propriedade || 'propria');
  const [tipoMedicao, setTipoMedicao] = useState<TipoMedicao>(initial?.tipoMedicao || 'horimetro');
  const [medicaoInicial, setMedicaoInicial] = useState(initial?.medicaoInicial?.toString() || '0');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);
  const [dataAquisicao, setDataAquisicao] = useState(initial?.dataAquisicao || '');
  const [dataVenda, setDataVenda] = useState(initial?.dataVenda || '');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Novo tipo inline
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoCodigo, setNovoTipoCodigo] = useState('');
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  const tiposAtivos = useMemo(
    () => tiposEquipamento.filter((t) => t.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [tiposEquipamento]
  );

  // Map de nome -> código para gerar patrimonio
  const tipoCodigoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tiposEquipamento) map.set(t.nome, t.codigo);
    return map;
  }, [tiposEquipamento]);

  const empresasAtivas = empresas.filter((e) => e.ativo !== false);

  const empresasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of empresas) map.set(e.nome.toLowerCase(), e.id);
    return map;
  }, [empresas]);

  function isEmpresaEmt(id: string) {
    const emp = empresas.find((e) => e.id === id);
    return emp ? emp.nome.toLowerCase().includes('emt') : false;
  }

  const handleTipoChange = useCallback((id: string) => {
    setTipo(id);
    if (isEmpresaEmt(empresaId) && id) {
      setCodigoPatrimonio(gerarCodigoPatrimonio(id, equipamentosExistentes, tipoCodigoMap.get(id), initial?.id));
    }
  }, [equipamentosExistentes, initial?.id, empresaId, empresas, tipoCodigoMap]);

  const handleEmpresaChange = useCallback((id: string) => {
    setEmpresaId(id);
    if (isEmpresaEmt(id) && tipo) {
      setCodigoPatrimonio(gerarCodigoPatrimonio(tipo, equipamentosExistentes, tipoCodigoMap.get(tipo), initial?.id));
    } else if (!isEmpresaEmt(id)) {
      setCodigoPatrimonio('');
    }
  }, [equipamentosExistentes, initial?.id, tipo, empresas, tipoCodigoMap]);

  async function handleAdicionarTipo() {
    if (!novoTipoNome.trim() || !novoTipoCodigo.trim()) return;
    setSalvandoTipo(true);
    try {
      const novoTipo = {
        id: gerarId(),
        nome: novoTipoNome.trim(),
        codigo: novoTipoCodigo.trim().toUpperCase(),
        ativo: true,
        criadoPor: '',
      };
      await adicionarTipoMut.mutateAsync(novoTipo);
      registrarCategoriaDinamica(novoTipo.nome, novoTipo.codigo);
      setTipo(novoTipo.nome);
      setShowNovoTipo(false);
      setNovoTipoNome('');
      setNovoTipoCodigo('');
      if (isEmpresaEmt(empresaId)) {
        setCodigoPatrimonio(gerarCodigoPatrimonio(novoTipo.nome, equipamentosExistentes, novoTipo.codigo, initial?.id));
      }
    } finally {
      setSalvandoTipo(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      tipo,
      empresaId,
      codigoPatrimonio,
      numeroSerie,
      ano,
      marca,
      modelo,
      propriedade,
      tipoMedicao,
      medicaoInicial: parseFloat(medicaoInicial) || 0,
      ativo: dataVenda ? false : ativo,
      dataAquisicao,
      dataVenda,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const empresaSelecionada = empresas.find((e) => e.id === empresaId);
  const isEmt = empresaSelecionada ? empresaSelecionada.nome.toLowerCase().includes('emt') : false;
  const isValid = !!nome.trim() && !!tipo && !!empresaId && (!isEmt || !!codigoPatrimonio.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            className="text-xs px-3 py-1.5"
            onClick={() => setImportModalOpen(true)}
          >
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do Equipamento"
          id="frotaEqNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Escavadeira CAT 320"
          required
        />
        <div>
          <label htmlFor="frotaEqTipo" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Tipo de Equipamento<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect
                options={tiposAtivos.map((t) => ({ id: t.nome, label: t.nome }))}
                value={tipo}
                onChange={handleTipoChange}
                placeholder="Selecione o tipo..."
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNovoTipo(!showNovoTipo)}
              className="h-[42px] px-3 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-lg font-bold shrink-0"
              title="Adicionar novo tipo"
            >
              +
            </button>
          </div>

          {/* Inline: novo tipo */}
          {showNovoTipo && (
            <div className="mt-2 p-3 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800/50 space-y-2">
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">Novo Tipo de Equipamento</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Usina de Asfalto)"
                  value={novoTipoNome}
                  onChange={(e) => setNovoTipoNome(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200"
                />
                <input
                  type="text"
                  placeholder="Abreviação (ex: UA)"
                  value={novoTipoCodigo}
                  onChange={(e) => setNovoTipoCodigo(e.target.value.toUpperCase())}
                  maxLength={5}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde dark:bg-slate-700 dark:text-slate-200 uppercase"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowNovoTipo(false); setNovoTipoNome(''); setNovoTipoCodigo(''); }}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdicionarTipo}
                  disabled={!novoTipoNome.trim() || !novoTipoCodigo.trim() || salvandoTipo}
                  className="text-xs bg-emt-verde text-white px-3 py-1.5 rounded-md font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {salvandoTipo ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>
        <Select
          label="Empresa"
          id="frotaEqEmpresa"
          value={empresaId}
          onChange={(e) => handleEmpresaChange(e.target.value)}
          options={empresasAtivas.map((e) => ({ value: e.id, label: e.nome }))}
          placeholder="Selecione a empresa..."
          required
        />
        <Input
          label={isEmt ? 'Código de Patrimônio' : 'Código de Patrimônio (opcional)'}
          id="frotaEqPatrimonio"
          value={codigoPatrimonio}
          onChange={(e) => setCodigoPatrimonio(e.target.value)}
          placeholder="Gerado automaticamente ao selecionar o tipo"
          required={isEmt}
        />
        <Input
          label="Número de Série"
          id="frotaEqSerie"
          value={numeroSerie}
          onChange={(e) => setNumeroSerie(e.target.value)}
          placeholder="Ex: CAT320-2024-001"
        />
        <Input
          label="Marca"
          id="frotaEqMarca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Ex: Caterpillar"
        />
        <Input
          label="Modelo"
          id="frotaEqModelo"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Ex: 320C, PC200, 2423 K/36"
        />
        <Input
          label="Ano"
          id="frotaEqAno"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          placeholder="Ex: 2024"
        />
        <Select
          label="Propriedade"
          id="frotaEqPropriedade"
          value={propriedade}
          onChange={(e) => setPropriedade(e.target.value as 'propria' | 'alugada')}
          options={[
            { value: 'propria', label: 'Própria' },
            { value: 'alugada', label: 'Alugada' },
          ]}
        />
        <Select
          label="Tipo de Medição"
          id="frotaEqTipoMedicao"
          value={tipoMedicao}
          onChange={(e) => setTipoMedicao(e.target.value as TipoMedicao)}
          options={[
            { value: 'horimetro', label: 'Horímetro' },
            { value: 'odometro', label: 'Odômetro' },
          ]}
        />
        <Input
          label={tipoMedicao === 'horimetro' ? 'Horímetro Inicial' : 'Odômetro Inicial (KM)'}
          id="frotaEqMedicao"
          type="number"
          step="0.0001"
          min="0"
          value={medicaoInicial}
          onChange={(e) => setMedicaoInicial(e.target.value)}
        />
        <Input
          label="Data de Aquisição"
          id="frotaEqDataAquisicao"
          type="date"
          value={dataAquisicao}
          onChange={(e) => setDataAquisicao(e.target.value)}
        />
        <Input
          label="Data de Venda"
          id="frotaEqDataVenda"
          type="date"
          value={dataVenda}
          onChange={(e) => {
            setDataVenda(e.target.value);
            if (e.target.value) setAtivo(false);
          }}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ativo
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500'
            }`}
            onClick={() => setAtivo(true)}
          >
            Ativo
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !ativo
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500'
            }`}
            onClick={() => setAtivo(false)}
          >
            Inativo
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportEquipamentosModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(novos) => {
            onImportBatch(novos);
            setImportModalOpen(false);
            setToastMsg(`${novos.length} equipamento${novos.length !== 1 ? 's' : ''} importado${novos.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          equipamentosExistentes={equipamentosExistentes}
          empresasMap={empresasMap}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
