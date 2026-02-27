import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { CategoriaMaterial, CategoriaMaterialCompra, Colaborador, Deposito, DepositoMaterial, Empresa, Equipamento, Fornecedor, Insumo, Obra, TipoInsumo, TipoInsumoEntity, TipoMedicao, UnidadeMedida } from '../types';
import { useObras } from '../hooks/useObras';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito } from '../hooks/useDepositos';
import { useEquipamentos, useAdicionarEquipamento, useAtualizarEquipamento, useExcluirEquipamento } from '../hooks/useEquipamentos';
import { useInsumos, useAdicionarInsumo, useAtualizarInsumo, useExcluirInsumo } from '../hooks/useInsumos';
import { useFornecedores, useAdicionarFornecedor, useAtualizarFornecedor, useExcluirFornecedor } from '../hooks/useFornecedores';
import { useUnidades, useAdicionarUnidade, useAtualizarUnidade, useExcluirUnidade } from '../hooks/useUnidades';
import { useCategoriasMaterial, useAdicionarCategoriaMaterial, useAtualizarCategoriaMaterial, useExcluirCategoriaMaterial } from '../hooks/useCategoriasMaterial';
import { useTiposInsumo, useAdicionarTipoInsumo, useAtualizarTipoInsumo, useExcluirTipoInsumo } from '../hooks/useTiposInsumo';
import { useDepositosMaterial, useAdicionarDepositoMaterial, useAtualizarDepositoMaterial, useExcluirDepositoMaterial } from '../hooks/useDepositosMaterial';
import { useColaboradores, useAdicionarColaborador, useAtualizarColaborador, useExcluirColaborador } from '../hooks/useColaboradores';
import { useEmpresas, useAdicionarEmpresa, useAtualizarEmpresa, useExcluirEmpresa } from '../hooks/useEmpresas';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { formatDate, formatCPF, formatTelefone } from '../utils/formatters';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PasswordDialog from '../components/ui/PasswordDialog';
import ImportEquipamentosModal from '../components/obras/ImportEquipamentosModal';
import ImportExcelModal, { parseStr, parseNumero, type ParsedRow } from '../components/ui/ImportExcelModal';
import { useAuth } from '../contexts/AuthContext';

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function TanqueForm({
  initial,
  obras,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: Deposito | null;
  obras: Obra[];
  onSubmit: (dep: Deposito) => void;
  onCancel: () => void;
  onImportBatch?: (items: Deposito[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [capacidade, setCapacidade] = useState(
    initial?.capacidadeLitros?.toString() || ''
  );
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const cap = parseFloat(capacidade) || 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      obraId,
      capacidadeLitros: cap,
      nivelAtualLitros: initial?.nivelAtualLitros || 0,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = nome && obraId && capacidade;

  const parseTanqueRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const obraName = parseStr(row[1]);
    const capVal = parseNumero(row[2]);

    if (!nomeVal) erros.push('Nome obrigatorio');
    let obraMatch: Obra | undefined;
    if (!obraName) {
      erros.push('Obra obrigatoria');
    } else {
      obraMatch = obras.find(o => o.nome.toLowerCase() === obraName.toLowerCase());
      if (!obraMatch) erros.push(`Obra "${obraName}" nao encontrada`);
    }
    if (capVal === null) erros.push('Capacidade obrigatoria (numerico)');

    const obraNome = obraMatch?.nome || obraName;
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} | ${obraNome} | ${capVal ?? ''}L`,
      dados: { nome: nomeVal, obraId: obraMatch?.id || '', capacidadeLitros: capVal ?? 0 },
    };
  }, [obras]);

  const tanqueToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    obraId: row.dados.obraId,
    capacidadeLitros: row.dados.capacidadeLitros,
    nivelAtualLitros: 0,
    ativo: true,
    criadoPor: '',
  }), []);

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
          label="Nome do Tanque"
          id="tanqueNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Tanque Diesel 01"
          required
        />
        <Select
          label="Obra"
          id="tanqueObraId"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <Input
          label="Capacidade (litros)"
          id="tanqueCapacidade"
          type="number"
          step="0.0001"
          min="0"
          value={capacidade}
          onChange={(e) => setCapacidade(e.target.value)}
          placeholder="Ex: 5000"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ativo
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
          {initial ? 'Salvar Alterações' : 'Cadastrar Tanque'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as Deposito[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} tanque${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Tanques do Excel"
          entityLabel="Tanque"
          genderFem={false}
          templateData={[
            ['Nome', 'Obra', 'Capacidade (L)'],
            ['Tanque Diesel 01', 'Obra ABC', '5000'],
          ]}
          templateFileName="template_tanques.xlsx"
          sheetName="Tanques"
          templateColWidths={[25, 25, 18]}
          formatHintHeaders={['Nome', 'Obra', 'Capacidade (L)']}
          formatHintExample={['Tanque Diesel 01', 'Obra ABC', '5000']}
          parseRow={parseTanqueRow}
          toEntity={tanqueToEntity}
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

function EquipamentoForm({
  initial,
  onSubmit,
  onCancel,
  onImportBatch,
  existentes,
}: {
  initial: Equipamento | null;
  onSubmit: (eq: Equipamento) => void;
  onCancel: () => void;
  onImportBatch?: (eqs: Equipamento[]) => void;
  existentes?: Equipamento[];
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [codigoPatrimonio, setCodigoPatrimonio] = useState(initial?.codigoPatrimonio || '');
  const [numeroSerie, setNumeroSerie] = useState(initial?.numeroSerie || '');
  const [ano, setAno] = useState(initial?.ano || '');
  const [marca, setMarca] = useState(initial?.marca || '');
  const [tipoMedicao, setTipoMedicao] = useState<TipoMedicao>(
    initial?.tipoMedicao || 'horimetro'
  );
  const [medicaoInicial, setMedicaoInicial] = useState(
    initial?.medicaoInicial?.toString() || '0'
  );
  const [ativo, setAtivo] = useState(initial?.ativo !== false);
  const [dataAquisicao, setDataAquisicao] = useState(initial?.dataAquisicao || '');
  const [dataVenda, setDataVenda] = useState(initial?.dataVenda || '');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      codigoPatrimonio,
      numeroSerie,
      ano,
      marca,
      tipoMedicao,
      medicaoInicial: parseFloat(medicaoInicial) || 0,
      ativo: dataVenda ? false : ativo,
      dataAquisicao,
      dataVenda,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = !!nome.trim();

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
          id="eqNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Escavadeira CAT 320"
          required
        />
        <Input
          label="Código de Patrimônio"
          id="eqPatrimonio"
          value={codigoPatrimonio}
          onChange={(e) => setCodigoPatrimonio(e.target.value)}
          placeholder="Ex: PAT-001"
        />
        <Input
          label="Número de Série"
          id="eqSerie"
          value={numeroSerie}
          onChange={(e) => setNumeroSerie(e.target.value)}
          placeholder="Ex: CAT320-2024-001"
        />
        <Input
          label="Marca"
          id="eqMarca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Ex: Caterpillar"
        />
        <Input
          label="Ano"
          id="eqAno"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          placeholder="Ex: 2024"
        />
        <Select
          label="Tipo de Medição"
          id="eqTipoMedicao"
          value={tipoMedicao}
          onChange={(e) => setTipoMedicao(e.target.value as TipoMedicao)}
          options={[
            { value: 'horimetro', label: 'Horímetro' },
            { value: 'odometro', label: 'Odômetro' },
          ]}
        />
        <Input
          label={tipoMedicao === 'horimetro' ? 'Horímetro Inicial' : 'Odômetro Inicial (KM)'}
          id="eqMedicao"
          type="number"
          step="0.0001"
          min="0"
          value={medicaoInicial}
          onChange={(e) => setMedicaoInicial(e.target.value)}
        />
        <Input
          label="Data de Aquisição"
          id="eqDataAquisicao"
          type="date"
          value={dataAquisicao}
          onChange={(e) => setDataAquisicao(e.target.value)}
        />
        <Input
          label="Data de Venda"
          id="eqDataVenda"
          type="date"
          value={dataVenda}
          onChange={(e) => {
            setDataVenda(e.target.value);
            if (e.target.value) setAtivo(false);
          }}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ativo
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
          equipamentosExistentes={existentes ?? []}
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

function UnidadeMedidaForm({
  initial,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: UnidadeMedida | null;
  onSubmit: (unidade: UnidadeMedida) => void;
  onCancel: () => void;
  onImportBatch?: (items: UnidadeMedida[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [sigla, setSigla] = useState(initial?.sigla || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      sigla,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = nome.trim().length > 0 && sigla.trim().length > 0;

  const parseUnidadeRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const siglaVal = parseStr(row[1]);

    if (!nomeVal) erros.push('Nome obrigatorio');
    if (!siglaVal) erros.push('Sigla obrigatoria');

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} | ${siglaVal}`,
      dados: { nome: nomeVal, sigla: siglaVal },
    };
  }, []);

  const unidadeToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    sigla: row.dados.sigla,
    ativo: true,
    criadoPor: '',
  }), []);

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
          label="Nome"
          id="unidadeNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Metro quadrado (m²)"
          required
        />
        <Input
          label="Sigla"
          id="unidadeSigla"
          value={sigla}
          onChange={(e) => setSigla(e.target.value)}
          placeholder="Ex: m²"
          required
        />
      </div>
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                ativo
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(true)}
            >
              Ativo
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                !ativo
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Cadastrar Unidade'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as UnidadeMedida[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} unidade${items.length !== 1 ? 's' : ''} importada${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Unidades de Medida do Excel"
          entityLabel="Unidade"
          genderFem={true}
          templateData={[
            ['Nome', 'Sigla'],
            ['Metro quadrado', 'm2'],
          ]}
          templateFileName="template_unidades.xlsx"
          sheetName="Unidades"
          templateColWidths={[25, 15]}
          formatHintHeaders={['Nome', 'Sigla']}
          formatHintExample={['Metro quadrado', 'm2']}
          parseRow={parseUnidadeRow}
          toEntity={unidadeToEntity}
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

function gerarSlug(texto: string) {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function TipoInsumoForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: TipoInsumoEntity | null;
  onSubmit: (tipo: TipoInsumoEntity) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      valor: initial?.valor || gerarSlug(nome),
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = !!nome;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nome"
        id="tipoInsumoNome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex: Combustível, Material, Peça"
        required
      />
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alteracoes' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}

function CategoriaMaterialForm({
  initial,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: CategoriaMaterial | null;
  onSubmit: (categoria: CategoriaMaterial) => void;
  onCancel: () => void;
  onImportBatch?: (items: CategoriaMaterial[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      valor: initial?.valor || gerarSlug(nome),
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = !!nome;

  const parseCategoriaRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);

    if (!nomeVal) erros.push('Nome obrigatorio');

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} → ${gerarSlug(nomeVal)}`,
      dados: { nome: nomeVal },
    };
  }, []);

  const categoriaToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    valor: gerarSlug(row.dados.nome as string),
    ativo: true,
    criadoPor: '',
  }), []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <Input
        label="Nome"
        id="categoriaNome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex: Concreto e Argamassa"
        required
      />
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alteracoes' : 'Cadastrar'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as CategoriaMaterial[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} categoria${items.length !== 1 ? 's' : ''} importada${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Categorias de Material do Excel"
          entityLabel="Categoria"
          genderFem={true}
          templateData={[
            ['Nome'],
            ['Concreto e Argamassa'],
          ]}
          templateFileName="template_categorias_material.xlsx"
          sheetName="Categorias"
          templateColWidths={[30]}
          formatHintHeaders={['Nome']}
          formatHintExample={['Concreto e Argamassa']}
          parseRow={parseCategoriaRow}
          toEntity={categoriaToEntity}
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

function InsumoForm({
  initial,
  unidades,
  categorias,
  tipos,
  onSubmit,
  onCancel,
  onImportBatch,
  onCreateCategoria,
  onCreateTipo,
}: {
  initial: Insumo | null;
  unidades: UnidadeMedida[];
  categorias: { value: string; label: string }[];
  tipos: { value: string; label: string }[];
  onSubmit: (insumo: Insumo) => void;
  onCancel: () => void;
  onImportBatch?: (items: Insumo[]) => void;
  onCreateCategoria?: (nome: string) => Promise<string>;
  onCreateTipo?: (nome: string) => Promise<string>;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [tipo, setTipo] = useState<TipoInsumo>(initial?.tipo || tipos[0]?.value || 'material');
  const [unidade, setUnidade] = useState(initial?.unidade || '');
  const [descricao, setDescricao] = useState(initial?.descricao || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);
  const [categoria, setCategoria] = useState<CategoriaMaterialCompra>(initial?.categoria || 'outros');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  const unidadeOptions = useMemo(
    () => unidades.filter((u) => u.ativo).map((u) => ({ value: u.sigla, label: u.nome })),
    [unidades]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      tipo,
      unidade,
      descricao,
      ativo,
      criadoPor: initial?.criadoPor || '',
      categoria,
    });
  }

  const isValid = nome && unidade;

  const parseInsumoRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const tipoVal = parseStr(row[1]).toLowerCase();
    const unidadeVal = parseStr(row[2]);
    const descricaoVal = parseStr(row[3]);

    if (!nomeVal) erros.push('Nome obrigatorio');
    const tiposValidos = tipos.map(t => t.value);
    if (!tiposValidos.includes(tipoVal)) erros.push(`Tipo "${tipoVal}" nao encontrado (validos: ${tiposValidos.join(', ')})`);

    let siglaMatch: UnidadeMedida | undefined;
    if (!unidadeVal) {
      erros.push('Unidade obrigatoria');
    } else {
      siglaMatch = unidades.find(u => u.sigla.toLowerCase() === unidadeVal.toLowerCase() || u.nome.toLowerCase() === unidadeVal.toLowerCase());
      if (!siglaMatch) erros.push(`Unidade "${unidadeVal}" nao encontrada`);
    }

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} | ${tipoVal} | ${siglaMatch?.sigla || unidadeVal}`,
      dados: { nome: nomeVal, tipo: tipoVal as TipoInsumo, unidade: siglaMatch?.sigla || '', descricao: descricaoVal },
    };
  }, [unidades, tipos]);

  const insumoToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    tipo: row.dados.tipo,
    unidade: row.dados.unidade,
    descricao: row.dados.descricao,
    ativo: true,
    criadoPor: '',
  }), []);

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
          label="Nome do Insumo"
          id="insumoNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Diesel S10, Cimento CP-II, Brita"
          required
        />
        <div>
          {criandoTipo ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Novo Tipo</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  value={novoTipoNome}
                  onChange={(e) => setNovoTipoNome(e.target.value)}
                  placeholder="Nome do tipo"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={!novoTipoNome.trim() || salvandoTipo}
                  className="px-3 py-1 bg-emt-verde text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  onClick={async () => {
                    if (!onCreateTipo || !novoTipoNome.trim()) return;
                    setSalvandoTipo(true);
                    try {
                      const valor = await onCreateTipo(novoTipoNome.trim());
                      setTipo(valor);
                      setCriandoTipo(false);
                      setNovoTipoNome('');
                    } finally {
                      setSalvandoTipo(false);
                    }
                  }}
                >
                  {salvandoTipo ? '...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                  onClick={() => { setCriandoTipo(false); setNovoTipoNome(''); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Select
                label="Tipo"
                id="insumoTipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoInsumo)}
                options={tipos}
                required
              />
              {onCreateTipo && (
                <button
                  type="button"
                  className="text-xs text-emt-verde hover:underline mt-1"
                  onClick={() => setCriandoTipo(true)}
                >
                  + Novo tipo
                </button>
              )}
            </div>
          )}
        </div>
        <Select
          label="Unidade de Medida"
          id="insumoUnidade"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
          options={unidadeOptions}
          placeholder="Selecione a unidade"
          required
        />
        <div>
          {criandoCategoria ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Categoria</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  placeholder="Nome da categoria"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={!novaCategoriaNome.trim() || salvandoCategoria}
                  className="px-3 py-1 bg-emt-verde text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  onClick={async () => {
                    if (!onCreateCategoria || !novaCategoriaNome.trim()) return;
                    setSalvandoCategoria(true);
                    try {
                      const valor = await onCreateCategoria(novaCategoriaNome.trim());
                      setCategoria(valor);
                      setCriandoCategoria(false);
                      setNovaCategoriaNome('');
                    } finally {
                      setSalvandoCategoria(false);
                    }
                  }}
                >
                  {salvandoCategoria ? '...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                  onClick={() => { setCriandoCategoria(false); setNovaCategoriaNome(''); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Select
                label="Categoria"
                id="insumoCategoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaMaterialCompra)}
                options={categorias}
              />
              {onCreateCategoria && (
                <button
                  type="button"
                  className="text-xs text-emt-verde hover:underline mt-1"
                  onClick={() => setCriandoCategoria(true)}
                >
                  + Nova categoria
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <label
          htmlFor="insumoDescricao"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Descricao
        </label>
        <textarea
          id="insumoDescricao"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descricao do insumo..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ativo
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
          {initial ? 'Salvar Alterações' : 'Cadastrar Insumo'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as Insumo[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} insumo${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Insumos do Excel"
          entityLabel="Insumo"
          genderFem={false}
          templateData={[
            ['Nome', 'Tipo', 'Unidade', 'Descricao'],
            ['Diesel S10', 'combustivel', 'litro', ''],
          ]}
          templateFileName="template_insumos.xlsx"
          sheetName="Insumos"
          templateColWidths={[25, 18, 18, 30]}
          formatHintHeaders={['Nome', 'Tipo', 'Unidade', 'Descricao']}
          formatHintExample={['Diesel S10', 'combustivel', 'litro', '']}
          parseRow={parseInsumoRow}
          toEntity={insumoToEntity}
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

function DepositoMaterialForm({
  initial,
  obras,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: DepositoMaterial | null;
  obras: Obra[];
  onSubmit: (dep: DepositoMaterial) => void;
  onCancel: () => void;
  onImportBatch?: (items: DepositoMaterial[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [responsavel, setResponsavel] = useState(initial?.responsavel || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      obraId,
      endereco,
      responsavel,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = nome.trim().length > 0 && obraId;

  const parseDepMatRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const obraName = parseStr(row[1]);
    const enderecoVal = parseStr(row[2]);
    const responsavelVal = parseStr(row[3]);

    if (!nomeVal) erros.push('Nome obrigatorio');
    let obraMatch: Obra | undefined;
    if (!obraName) {
      erros.push('Obra obrigatoria');
    } else {
      obraMatch = obras.find(o => o.nome.toLowerCase() === obraName.toLowerCase());
      if (!obraMatch) erros.push(`Obra "${obraName}" nao encontrada`);
    }

    const obraNome = obraMatch?.nome || obraName;
    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} | ${obraNome}`,
      dados: { nome: nomeVal, obraId: obraMatch?.id || '', endereco: enderecoVal, responsavel: responsavelVal },
    };
  }, [obras]);

  const depMatToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    obraId: row.dados.obraId,
    endereco: row.dados.endereco,
    responsavel: row.dados.responsavel,
    ativo: true,
    criadoPor: '',
  }), []);

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
          label="Nome do Depósito"
          id="depMatNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Almoxarifado Central"
          required
        />
        <Select
          label="Obra"
          id="depMatObra"
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione a obra"
          required
        />
        <Input
          label="Endereço"
          id="depMatEndereco"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Ex: Rua das Flores, 100"
        />
        <Input
          label="Responsável"
          id="depMatResponsavel"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          placeholder="Ex: Carlos Silva"
        />
      </div>
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                ativo
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(true)}
            >
              Ativo
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                !ativo
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Cadastrar Depósito'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as DepositoMaterial[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} deposito${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Depositos do Excel"
          entityLabel="Deposito"
          genderFem={false}
          templateData={[
            ['Nome', 'Obra', 'Endereço', 'Responsável'],
            ['Almoxarifado Central', 'Obra ABC', 'Rua X, 100', 'Carlos'],
          ]}
          templateFileName="template_depositos_material.xlsx"
          sheetName="Depositos"
          templateColWidths={[25, 25, 25, 20]}
          formatHintHeaders={['Nome', 'Obra', 'Endereço', 'Responsável']}
          formatHintExample={['Almoxarifado Central', 'Obra ABC', 'Rua X, 100', 'Carlos']}
          parseRow={parseDepMatRow}
          toEntity={depMatToEntity}
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

function FornecedorForm({
  initial,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: Fornecedor | null;
  onSubmit: (fornecedor: Fornecedor) => void;
  onCancel: () => void;
  onImportBatch?: (items: Fornecedor[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [cnpj, setCnpj] = useState(initial?.cnpj || '');
  const [telefone, setTelefone] = useState(initial?.telefone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      cnpj,
      telefone,
      email,
      observacoes,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const isValid = nome.trim().length > 0;

  const parseFornecedorRow = useCallback((row: unknown[], _index: number): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const cnpjVal = parseStr(row[1]);
    const telefoneVal = parseStr(row[2]);
    const emailVal = parseStr(row[3]);
    const observacoesVal = parseStr(row[4]);

    if (!nomeVal) erros.push('Nome obrigatorio');

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal} | ${cnpjVal}`,
      dados: { nome: nomeVal, cnpj: cnpjVal, telefone: telefoneVal, email: emailVal, observacoes: observacoesVal },
    };
  }, []);

  const fornecedorToEntity = useCallback((row: ParsedRow): Record<string, unknown> => ({
    id: gerarId(),
    nome: row.dados.nome,
    cnpj: row.dados.cnpj,
    telefone: row.dados.telefone,
    email: row.dados.email,
    observacoes: row.dados.observacoes,
    ativo: true,
    criadoPor: '',
  }), []);

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
          label="Nome"
          id="fornecedorNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Distribuidora ABC"
          required
        />
        <Input
          label="CPF / CNPJ (opcional)"
          id="fornecedorCnpj"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-90"
        />
        <Input
          label="Telefone (opcional)"
          id="fornecedorTelefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Ex: (11) 99999-0000"
        />
        <Input
          label="E-mail (opcional)"
          id="fornecedorEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ex: contato@empresa.com"
        />
      </div>
      <div>
        <label
          htmlFor="fornecedorObs"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Observações (opcional)
        </label>
        <textarea
          id="fornecedorObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação..."
        />
      </div>
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                ativo
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(true)}
            >
              Ativo
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                !ativo
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
        </Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as Fornecedor[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} fornecedor${items.length !== 1 ? 'es' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Fornecedores do Excel"
          entityLabel="Fornecedor"
          genderFem={false}
          templateData={[
            ['Nome', 'CNPJ', 'Telefone', 'Email', 'Observações'],
            ['Distribuidora ABC', '12.345.678/0001-90', '(11) 99999-0000', 'contato@abc.com', ''],
          ]}
          templateFileName="template_fornecedores.xlsx"
          sheetName="Fornecedores"
          templateColWidths={[25, 22, 20, 25, 25]}
          formatHintHeaders={['Nome', 'CNPJ', 'Telefone', 'Email', 'Observações']}
          formatHintExample={['Distribuidora ABC', '12.345.678/0001-90', '(11) 99999-0000', 'contato@abc.com', '']}
          parseRow={parseFornecedorRow}
          toEntity={fornecedorToEntity}
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

function EmpresaForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Empresa | null;
  onSubmit: (empresa: Empresa) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [cnpj, setCnpj] = useState(initial?.cnpj || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [areaAtuacao, setAreaAtuacao] = useState(initial?.areaAtuacao || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const isValid = nome.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome: nome.trim(),
      cnpj,
      endereco,
      areaAtuacao,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nome da Empresa" id="empresaNome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input label="CNPJ" id="empresaCnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
        <Input label="Endereço" id="empresaEndereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        <Input label="Área de Atuação" id="empresaArea" value={areaAtuacao} onChange={(e) => setAreaAtuacao(e.target.value)} placeholder="Ex: Construção Civil" />
      </div>

      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ativo ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              onClick={() => setAtivo(true)}
            >
              Ativo
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!ativo ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={!isValid}>{initial ? 'Salvar Alterações' : 'Cadastrar Empresa'}</Button>
      </div>
    </form>
  );
}

function ColaboradorForm({
  initial,
  empresas,
  onSubmit,
  onCancel,
  onImportBatch,
}: {
  initial: Colaborador | null;
  empresas: Empresa[];
  onSubmit: (colab: Colaborador) => void;
  onCancel: () => void;
  onImportBatch?: (items: Colaborador[]) => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [empresaId, setEmpresaId] = useState(initial?.empresaId || '');
  const [dataNascimento, setDataNascimento] = useState(initial?.dataNascimento || '');
  const [dataIngresso, setDataIngresso] = useState(initial?.dataIngresso || '');
  const [telefone, setTelefone] = useState(initial?.telefone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [altura, setAltura] = useState(initial?.altura || '');
  const [tamanhoCamisa, setTamanhoCamisa] = useState(initial?.tamanhoCamisa || '');
  const [tamanhoCalca, setTamanhoCalca] = useState(initial?.tamanhoCalca || '');
  const [tamanhoSapato, setTamanhoSapato] = useState(initial?.tamanhoSapato || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [cpf, setCpf] = useState(initial?.cpf || '');
  const [rg, setRg] = useState(initial?.rg || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isValid = nome.trim() && empresaId;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome: nome.trim(),
      empresaId,
      dataNascimento,
      dataIngresso,
      telefone,
      email: email.trim(),
      altura,
      tamanhoCamisa,
      tamanhoCalca,
      tamanhoSapato,
      endereco,
      cpf,
      rg,
      observacoes,
      ativo,
      criadoPor: initial?.criadoPor || '',
    });
  }

  const empresasAtivas = empresas.filter(f => f.ativo !== false);

  const parseColabRow = useCallback((row: unknown[]): ParsedRow => {
    const erros: string[] = [];
    const nomeVal = parseStr(row[0]);
    const empresaName = parseStr(row[1]);
    const cpfVal = parseStr(row[2]);
    const rgVal = parseStr(row[3]);
    const telVal = parseStr(row[4]);
    const emailVal = parseStr(row[5]);
    const altVal = parseStr(row[6]);
    const camisaVal = parseStr(row[7]);
    const calcaVal = parseStr(row[8]);
    const sapatoVal = parseStr(row[9]);
    const endVal = parseStr(row[10]);
    const obsVal = parseStr(row[11]);

    if (!nomeVal) erros.push('Nome obrigatorio');
    let empresaMatch: Empresa | undefined;
    if (!empresaName) {
      erros.push('Empresa obrigatoria');
    } else {
      empresaMatch = empresas.find(e => e.nome.toLowerCase() === empresaName.toLowerCase());
      if (!empresaMatch) erros.push(`Empresa "${empresaName}" nao encontrada no cadastro de empresas`);
    }

    return {
      valido: erros.length === 0,
      erros,
      resumo: `${nomeVal || '(sem nome)'} | ${empresaName || '(sem empresa)'}`,
      dados: { nome: nomeVal, empresaId: empresaMatch?.id || '', cpf: cpfVal, rg: rgVal, telefone: telVal, email: emailVal, altura: altVal, tamanhoCamisa: camisaVal, tamanhoCalca: calcaVal, tamanhoSapato: sapatoVal, endereco: endVal, observacoes: obsVal },
    };
  }, [empresas]);

  const colabToEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      nome: (d.nome as string).trim(),
      empresaId: d.empresaId || '',
      dataNascimento: '',
      dataIngresso: '',
      telefone: d.telefone || '',
      email: ((d.email as string) || '').trim(),
      altura: d.altura || '',
      tamanhoCamisa: d.tamanhoCamisa || '',
      tamanhoCalca: d.tamanhoCalca || '',
      tamanhoSapato: d.tamanhoSapato || '',
      endereco: d.endereco || '',
      cpf: d.cpf || '',
      rg: d.rg || '',
      observacoes: d.observacoes || '',
      ativo: true,
      criadoPor: '',
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados Obrigatórios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome" id="colabNome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <Select
            label="Empresa"
            id="colabEmpresa"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            options={empresasAtivas.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="Selecione a empresa"
            required
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Documentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="CPF" id="colabCpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" />
          <Input label="RG" id="colabRg" value={rg} onChange={(e) => setRg(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Data de Nascimento" id="colabNasc" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          <Input label="Data de Ingresso" id="colabIngresso" type="date" value={dataIngresso} onChange={(e) => setDataIngresso(e.target.value)} />
          <Input label="Telefone" id="colabTel" value={telefone} onChange={(e) => setTelefone(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" />
          <Input label="E-mail" id="colabEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Endereço" id="colabEndereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Medidas / Uniformes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input label="Altura" id="colabAltura" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="Ex: 1.75" />
          <Input label="Camisa" id="colabCamisa" value={tamanhoCamisa} onChange={(e) => setTamanhoCamisa(e.target.value)} placeholder="Ex: M, G, GG" />
          <Input label="Calça" id="colabCalca" value={tamanhoCalca} onChange={(e) => setTamanhoCalca(e.target.value)} placeholder="Ex: 40, 42" />
          <Input label="Sapato" id="colabSapato" value={tamanhoSapato} onChange={(e) => setTamanhoSapato(e.target.value)} placeholder="Ex: 41, 42" />
        </div>
      </div>

      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ativo ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              onClick={() => setAtivo(true)}
            >
              Ativo
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!ativo ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              onClick={() => setAtivo(false)}
            >
              Inativo
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="colabObs" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          id="colabObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={!isValid}>{initial ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            onImportBatch(items as unknown as Colaborador[]);
            setImportModalOpen(false);
            setToastMsg(`${items.length} colaborador${items.length !== 1 ? 'es' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Colaboradores do Excel"
          entityLabel="Colaborador"
          templateData={[
            ['Nome', 'Empresa', 'CPF', 'RG', 'Telefone', 'Email', 'Altura', 'Camisa', 'Calça', 'Sapato', 'Endereço', 'Observações'],
            ['João Silva', 'Empresa ABC', '123.456.789-00', '12.345.678-9', '(11) 99999-0000', 'joao@email.com', '1.75', 'G', '42', '41', 'Rua A, 123', ''],
          ]}
          templateFileName="template_colaboradores.xlsx"
          sheetName="Colaboradores"
          templateColWidths={[20, 20, 16, 14, 16, 22, 8, 8, 8, 8, 25, 20]}
          formatHintHeaders={['Nome', 'Empresa', 'CPF', 'RG', 'Telefone', 'Email', 'Altura', 'Camisa', 'Calça', 'Sapato', 'Endereço', 'Obs']}
          formatHintExample={['João Silva', 'Empresa ABC', '', '', '', '', '1.75', 'G', '42', '41', '', '']}
          parseRow={parseColabRow}
          toEntity={colabToEntity}
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

export default function Obras() {
  const { temAcao, usuario } = useAuth();
  const canCreate = temAcao('criar_cadastros');

  // ---- Supabase query hooks ----
  const { data: obras = [], isLoading: loadingObras } = useObras();
  useDepositos();
  const { data: todosEquipamentos = [], isLoading: loadingEquipamentos } = useEquipamentos();
  const { data: todosInsumos = [], isLoading: loadingInsumos } = useInsumos();
  const { data: todosFornecedores = [], isLoading: loadingFornecedores } = useFornecedores();
  const { data: todasUnidades = [] } = useUnidades();
  useDepositosMaterial();
  const { data: todasCategorias = [] } = useCategoriasMaterial();
  const { data: todosTiposInsumo = [] } = useTiposInsumo();
  const { data: todosColaboradores = [], isLoading: loadingColaboradores } = useColaboradores();
  const { data: todasEmpresas = [], isLoading: loadingEmpresas } = useEmpresas();

  const unidadesMap = useMemo(() => new Map(todasUnidades.map((u) => [u.sigla, u.nome])), [todasUnidades]);
  const categoriasOptions = useMemo(() => todasCategorias.filter((c) => c.ativo).map((c) => ({ value: c.valor, label: c.nome })), [todasCategorias]);
  const tiposInsumoOptions = useMemo(() => todosTiposInsumo.filter((t) => t.ativo).map((t) => ({ value: t.valor, label: t.nome })), [todosTiposInsumo]);
  const tiposInsumoMap = useMemo(() => new Map(todosTiposInsumo.map((t) => [t.valor, t.nome])), [todosTiposInsumo]);

  // ---- Supabase mutation hooks (must be called at top level) ----
  const adicionarDepositoMutation = useAdicionarDeposito();
  const atualizarDepositoMutation = useAtualizarDeposito();
  const excluirDepositoMutation = useExcluirDeposito();
  const adicionarEquipamentoMutation = useAdicionarEquipamento();
  const atualizarEquipamentoMutation = useAtualizarEquipamento();
  const excluirEquipamentoMutation = useExcluirEquipamento();
  const adicionarInsumoMutation = useAdicionarInsumo();
  const atualizarInsumoMutation = useAtualizarInsumo();
  const excluirInsumoMutation = useExcluirInsumo();
  const adicionarFornecedorMutation = useAdicionarFornecedor();
  const atualizarFornecedorMutation = useAtualizarFornecedor();
  const excluirFornecedorMutation = useExcluirFornecedor();
  const adicionarUnidadeMutation = useAdicionarUnidade();
  const atualizarUnidadeMutation = useAtualizarUnidade();
  const excluirUnidadeMutation = useExcluirUnidade();
  const adicionarDepositoMaterialMutation = useAdicionarDepositoMaterial();
  const atualizarDepositoMaterialMutation = useAtualizarDepositoMaterial();
  const excluirDepositoMaterialMutation = useExcluirDepositoMaterial();
  const adicionarCategoriaMutation = useAdicionarCategoriaMaterial();
  const atualizarCategoriaMutation = useAtualizarCategoriaMaterial();
  const excluirCategoriaMutation = useExcluirCategoriaMaterial();
  const adicionarTipoInsumoMutation = useAdicionarTipoInsumo();
  const atualizarTipoInsumoMutation = useAtualizarTipoInsumo();
  const excluirTipoInsumoMutation = useExcluirTipoInsumo();
  const adicionarColaboradorMutation = useAdicionarColaborador();
  const atualizarColaboradorMutation = useAtualizarColaborador();
  const excluirColaboradorMutation = useExcluirColaborador();
  const adicionarEmpresaMutation = useAdicionarEmpresa();
  const atualizarEmpresaMutation = useAtualizarEmpresa();
  const excluirEmpresaMutation = useExcluirEmpresa();

  // ---- Loading state (minimal — only block if obras not ready, used by many sections) ----
  const isLoading = loadingObras;

  const [deleteDepId, setDeleteDepId] = useState<string | null>(null);

  // Password gate para edicao
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAction, setSenhaAction] = useState<(() => void) | null>(null);

  function pedirSenha(action: () => void) {
    if (usuario?.cargo === 'Administrador') {
      action();
      return;
    }
    setSenhaAction(() => action);
    setSenhaOpen(true);
  }

  const handleDeleteDeposito = useCallback(async (id: string) => {
    await excluirDepositoMutation.mutateAsync(id);
    setDeleteDepId(null);
  }, [excluirDepositoMutation]);

  // Visibilidade das secoes
  const [equipamentosVisiveis, setEquipamentosVisiveis] = useState(true);
  const [insumosVisiveis, setInsumosVisiveis] = useState(true);
  const [fornecedoresVisiveis, setFornecedoresVisiveis] = useState(true);


  // Tanque state
  const [modalTanqueOpen, setModalTanqueOpen] = useState(false);
  const [editandoTanque, setEditandoTanque] = useState<Deposito | null>(null);

  const handleSubmitTanque = useCallback(
    async (dep: Deposito) => {
      if (editandoTanque) {
        await atualizarDepositoMutation.mutateAsync(dep);
      } else {
        await adicionarDepositoMutation.mutateAsync({ ...dep, criadoPor: usuario?.nome || '' });
      }
      setModalTanqueOpen(false);
      setEditandoTanque(null);
    },
    [editandoTanque, atualizarDepositoMutation, adicionarDepositoMutation, usuario]
  );

  // Equipamento state
  const [modalEquipOpen, setModalEquipOpen] = useState(false);
  const [editandoEquip, setEditandoEquip] = useState<Equipamento | null>(null);
  const [deleteEquipId, setDeleteEquipId] = useState<string | null>(null);

  const handleSubmitEquip = useCallback(
    async (eq: Equipamento) => {
      if (editandoEquip) {
        await atualizarEquipamentoMutation.mutateAsync(eq);
      } else {
        await adicionarEquipamentoMutation.mutateAsync({ ...eq, criadoPor: usuario?.nome || '' });
      }
      setModalEquipOpen(false);
      setEditandoEquip(null);
    },
    [editandoEquip, atualizarEquipamentoMutation, adicionarEquipamentoMutation, usuario]
  );

  const handleDeleteEquip = useCallback(async (id: string) => {
    await excluirEquipamentoMutation.mutateAsync(id);
    setDeleteEquipId(null);
  }, [excluirEquipamentoMutation]);

  // Insumo state
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false);
  const [editandoInsumo, setEditandoInsumo] = useState<Insumo | null>(null);
  const [deleteInsumoId, setDeleteInsumoId] = useState<string | null>(null);

  const handleSubmitInsumo = useCallback(
    async (insumo: Insumo) => {
      if (editandoInsumo) {
        await atualizarInsumoMutation.mutateAsync(insumo);
      } else {
        await adicionarInsumoMutation.mutateAsync({ ...insumo, criadoPor: usuario?.nome || '' });
      }
      setModalInsumoOpen(false);
      setEditandoInsumo(null);
    },
    [editandoInsumo, atualizarInsumoMutation, adicionarInsumoMutation, usuario]
  );

  const handleDeleteInsumo = useCallback(async (id: string) => {
    await excluirInsumoMutation.mutateAsync(id);
    setDeleteInsumoId(null);
  }, [excluirInsumoMutation]);

  // Fornecedor state
  const [modalFornecedorOpen, setModalFornecedorOpen] = useState(false);
  const [editandoFornecedor, setEditandoFornecedor] = useState<Fornecedor | null>(null);
  const [deleteFornecedorId, setDeleteFornecedorId] = useState<string | null>(null);

  const handleSubmitFornecedor = useCallback(
    async (fornecedor: Fornecedor) => {
      if (editandoFornecedor) {
        await atualizarFornecedorMutation.mutateAsync(fornecedor);
      } else {
        await adicionarFornecedorMutation.mutateAsync({ ...fornecedor, criadoPor: usuario?.nome || '' });
      }
      setModalFornecedorOpen(false);
      setEditandoFornecedor(null);
    },
    [editandoFornecedor, atualizarFornecedorMutation, adicionarFornecedorMutation, usuario]
  );

  const handleDeleteFornecedor = useCallback(async (id: string) => {
    await excluirFornecedorMutation.mutateAsync(id);
    setDeleteFornecedorId(null);
  }, [excluirFornecedorMutation]);

  // Empresa state
  const [empresasVisiveis, setEmpresasVisiveis] = useState(true);
  const [modalEmpresaOpen, setModalEmpresaOpen] = useState(false);
  const [editandoEmpresa, setEditandoEmpresa] = useState<Empresa | null>(null);
  const [deleteEmpresaId, setDeleteEmpresaId] = useState<string | null>(null);

  const empresasMap = useMemo(() => new Map(todasEmpresas.map((e) => [e.id, e.nome])), [todasEmpresas]);

  const handleSubmitEmpresa = useCallback(
    async (empresa: Empresa) => {
      if (editandoEmpresa) {
        await atualizarEmpresaMutation.mutateAsync(empresa);
      } else {
        await adicionarEmpresaMutation.mutateAsync({ ...empresa, criadoPor: usuario?.nome || '' });
      }
      setModalEmpresaOpen(false);
      setEditandoEmpresa(null);
    },
    [editandoEmpresa, atualizarEmpresaMutation, adicionarEmpresaMutation, usuario]
  );

  const handleDeleteEmpresa = useCallback(async (id: string) => {
    await excluirEmpresaMutation.mutateAsync(id);
    setDeleteEmpresaId(null);
  }, [excluirEmpresaMutation]);

  // Colaborador state
  const [colaboradoresVisiveis, setColaboradoresVisiveis] = useState(true);
  const [modalColaboradorOpen, setModalColaboradorOpen] = useState(false);
  const [editandoColaborador, setEditandoColaborador] = useState<Colaborador | null>(null);
  const [deleteColaboradorId, setDeleteColaboradorId] = useState<string | null>(null);

  const handleSubmitColaborador = useCallback(
    async (colab: Colaborador) => {
      if (editandoColaborador) {
        await atualizarColaboradorMutation.mutateAsync(colab);
      } else {
        await adicionarColaboradorMutation.mutateAsync({ ...colab, criadoPor: usuario?.nome || '' });
      }
      setModalColaboradorOpen(false);
      setEditandoColaborador(null);
    },
    [editandoColaborador, atualizarColaboradorMutation, adicionarColaboradorMutation, usuario]
  );

  const handleDeleteColaborador = useCallback(async (id: string) => {
    await excluirColaboradorMutation.mutateAsync(id);
    setDeleteColaboradorId(null);
  }, [excluirColaboradorMutation]);

  // Deposito Material state
  const [modalDepMatOpen, setModalDepMatOpen] = useState(false);
  const [editandoDepMat, setEditandoDepMat] = useState<DepositoMaterial | null>(null);
  const [deleteDepMatId, setDeleteDepMatId] = useState<string | null>(null);

  const handleSubmitDepMat = useCallback(
    async (dep: DepositoMaterial) => {
      if (editandoDepMat) {
        await atualizarDepositoMaterialMutation.mutateAsync(dep);
      } else {
        await adicionarDepositoMaterialMutation.mutateAsync({ ...dep, criadoPor: usuario?.nome || '' });
      }
      setModalDepMatOpen(false);
      setEditandoDepMat(null);
    },
    [editandoDepMat, atualizarDepositoMaterialMutation, adicionarDepositoMaterialMutation, usuario]
  );

  const handleDeleteDepMat = useCallback(async (id: string) => {
    await excluirDepositoMaterialMutation.mutateAsync(id);
    setDeleteDepMatId(null);
  }, [excluirDepositoMaterialMutation]);

  // Unidade de Medida state
  const [modalUnidadeOpen, setModalUnidadeOpen] = useState(false);
  const [editandoUnidade, setEditandoUnidade] = useState<UnidadeMedida | null>(null);
  const [deleteUnidadeId, setDeleteUnidadeId] = useState<string | null>(null);

  const handleSubmitUnidade = useCallback(
    async (unidade: UnidadeMedida) => {
      if (editandoUnidade) {
        await atualizarUnidadeMutation.mutateAsync(unidade);
      } else {
        await adicionarUnidadeMutation.mutateAsync({ ...unidade, criadoPor: usuario?.nome || '' });
      }
      setModalUnidadeOpen(false);
      setEditandoUnidade(null);
    },
    [editandoUnidade, atualizarUnidadeMutation, adicionarUnidadeMutation, usuario]
  );

  const handleDeleteUnidade = useCallback(async (id: string) => {
    await excluirUnidadeMutation.mutateAsync(id);
    setDeleteUnidadeId(null);
  }, [excluirUnidadeMutation]);

  // Categoria de Material state

  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<CategoriaMaterial | null>(null);
  const [deleteCategoriaId, setDeleteCategoriaId] = useState<string | null>(null);

  const handleSubmitCategoria = useCallback(
    async (categoria: CategoriaMaterial) => {
      if (editandoCategoria) {
        await atualizarCategoriaMutation.mutateAsync(categoria);
      } else {
        await adicionarCategoriaMutation.mutateAsync({ ...categoria, criadoPor: usuario?.nome || '' });
      }
      setModalCategoriaOpen(false);
      setEditandoCategoria(null);
    },
    [editandoCategoria, atualizarCategoriaMutation, adicionarCategoriaMutation, usuario]
  );

  const handleDeleteCategoria = useCallback(async (id: string) => {
    await excluirCategoriaMutation.mutateAsync(id);
    setDeleteCategoriaId(null);
  }, [excluirCategoriaMutation]);

  // Tipo de Insumo state

  const [modalTipoInsumoOpen, setModalTipoInsumoOpen] = useState(false);
  const [editandoTipoInsumo, setEditandoTipoInsumo] = useState<TipoInsumoEntity | null>(null);
  const [deleteTipoInsumoId, setDeleteTipoInsumoId] = useState<string | null>(null);

  const handleSubmitTipoInsumo = useCallback(
    async (tipo: TipoInsumoEntity) => {
      if (editandoTipoInsumo) {
        await atualizarTipoInsumoMutation.mutateAsync(tipo);
      } else {
        await adicionarTipoInsumoMutation.mutateAsync({ ...tipo, criadoPor: usuario?.nome || '' });
      }
      setModalTipoInsumoOpen(false);
      setEditandoTipoInsumo(null);
    },
    [editandoTipoInsumo, atualizarTipoInsumoMutation, adicionarTipoInsumoMutation, usuario]
  );

  const handleDeleteTipoInsumo = useCallback(async (id: string) => {
    await excluirTipoInsumoMutation.mutateAsync(id);
    setDeleteTipoInsumoId(null);
  }, [excluirTipoInsumoMutation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Carregando cadastros...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Cadastros</h1>
        <div className="flex flex-wrap gap-2">
          {canCreate && <>
            <Button
              onClick={() => {
                setEditandoEmpresa(null);
                setModalEmpresaOpen(true);
              }}
            >
              Nova Empresa
            </Button>
            <Button
              onClick={() => {
                setEditandoFornecedor(null);
                setModalFornecedorOpen(true);
              }}
            >
              Novo Fornecedor
            </Button>
            <Button
              onClick={() => {
                setEditandoColaborador(null);
                setModalColaboradorOpen(true);
              }}
            >
              Novo Colaborador
            </Button>
            <Button
              onClick={() => {
                setEditandoInsumo(null);
                setModalInsumoOpen(true);
              }}
            >
              Novo Insumo
            </Button>
            <Button
              onClick={() => {
                setEditandoEquip(null);
                setModalEquipOpen(true);
              }}
            >
              Novo Equipamento
            </Button>
          </>}
        </div>
      </div>

      {/* Modal Deposito de Material */}
      <Modal
        open={modalDepMatOpen}
        onClose={() => {
          setModalDepMatOpen(false);
          setEditandoDepMat(null);
        }}
        title={editandoDepMat ? 'Editar Deposito' : 'Novo Deposito'}
      >
        <DepositoMaterialForm
          initial={editandoDepMat}
          obras={obras}
          onSubmit={handleSubmitDepMat}
          onCancel={() => {
            setModalDepMatOpen(false);
            setEditandoDepMat(null);
          }}
          onImportBatch={async (novos) => {
            for (const d of novos) {
              await adicionarDepositoMaterialMutation.mutateAsync(d);
            }
            setModalDepMatOpen(false);
            setEditandoDepMat(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteDepMatId !== null}
        onClose={() => setDeleteDepMatId(null)}
        onConfirm={() => {
          if (deleteDepMatId) handleDeleteDepMat(deleteDepMatId);
        }}
        title="Excluir Deposito"
        message="Tem certeza que deseja excluir este deposito?"
      />

      {/* Secao Equipamentos */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Equipamentos</h2>
          {loadingEquipamentos && <span className="text-sm text-gray-400 animate-pulse">Carregando...</span>}
          {!loadingEquipamentos && todosEquipamentos.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setEquipamentosVisiveis((v) => !v)}
            >
              {equipamentosVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {!loadingEquipamentos && todosEquipamentos.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum equipamento cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoEquip(null);
                  setModalEquipOpen(true);
                }}
              >
                Cadastrar Primeiro Equipamento
              </Button>
            </div>
          </Card>
        ) : equipamentosVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosEquipamentos.map((eq) => (
              <Card key={eq.id} className={eq.ativo === false ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {eq.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      eq.ativo !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {eq.ativo !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {eq.codigoPatrimonio && (
                    <div className="flex justify-between">
                      <span>Patrimonio</span>
                      <span className="text-gray-700 font-medium">{eq.codigoPatrimonio}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Marca</span>
                    <span className="text-gray-700 font-medium">{eq.marca}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>N. Serie</span>
                    <span className="text-gray-700 font-medium">{eq.numeroSerie}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ano</span>
                    <span className="text-gray-700 font-medium">{eq.ano}</span>
                  </div>
                  {eq.tipoMedicao && (
                    <div className="flex justify-between">
                      <span>{eq.tipoMedicao === 'horimetro' ? 'Horímetro Inicial' : 'Odômetro Inicial'}</span>
                      <span className="text-gray-700 font-medium">
                        {(eq.medicaoInicial ?? 0).toLocaleString('pt-BR')} {eq.tipoMedicao === 'horimetro' ? 'h' : 'km'}
                      </span>
                    </div>
                  )}
                  {eq.dataAquisicao && (
                    <div className="flex justify-between">
                      <span>Aquisicao</span>
                      <span className="text-gray-700 font-medium">{formatDate(eq.dataAquisicao)}</span>
                    </div>
                  )}
                  {eq.dataVenda && (
                    <div className="flex justify-between">
                      <span>Venda</span>
                      <span className="text-gray-700 font-medium">{formatDate(eq.dataVenda)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      pedirSenha(() => {
                        setEditandoEquip(eq);
                        setModalEquipOpen(true);
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => pedirSenha(() => setDeleteEquipId(eq.id))}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Secao Insumos */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Insumos</h2>
          {loadingInsumos && <span className="text-sm text-gray-400 animate-pulse">Carregando...</span>}
          {!loadingInsumos && todosInsumos.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setInsumosVisiveis((v) => !v)}
            >
              {insumosVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {!loadingInsumos && todosInsumos.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum insumo cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoInsumo(null);
                  setModalInsumoOpen(true);
                }}
              >
                Cadastrar Primeiro Insumo
              </Button>
            </div>
          </Card>
        ) : insumosVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosInsumos.map((insumo) => {
              const unidadeLabel = unidadesMap.get(insumo.unidade) || insumo.unidade;
              return (
                <Card key={insumo.id} className={insumo.ativo === false ? 'opacity-60' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {insumo.nome}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          insumo.tipo === 'combustivel'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-emt-verde-claro text-emt-verde-escuro'
                        }`}
                      >
                        {tiposInsumoMap.get(insumo.tipo) || insumo.tipo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          insumo.ativo !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {insumo.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 mb-3">
                    <div className="flex justify-between">
                      <span>Unidade</span>
                      <span className="text-gray-700 font-medium">{unidadeLabel}</span>
                    </div>
                    {insumo.descricao && (
                      <p className="text-gray-500 mt-1">{insumo.descricao}</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => {
                        pedirSenha(() => {
                          setEditandoInsumo(insumo);
                          setModalInsumoOpen(true);
                        });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => pedirSenha(() => setDeleteInsumoId(insumo.id))}
                    >
                      Excluir
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Secao Empresas */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Empresas</h2>
          {loadingEmpresas && <span className="text-sm text-gray-400 animate-pulse">Carregando...</span>}
          {!loadingEmpresas && todasEmpresas.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setEmpresasVisiveis((v) => !v)}
            >
              {empresasVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {!loadingEmpresas && todasEmpresas.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhuma empresa cadastrada ainda.</p>
              <Button
                onClick={() => {
                  setEditandoEmpresa(null);
                  setModalEmpresaOpen(true);
                }}
              >
                Cadastrar Primeira Empresa
              </Button>
            </div>
          </Card>
        ) : empresasVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todasEmpresas.map((empresa) => (
              <Card key={empresa.id} className={empresa.ativo === false ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {empresa.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      empresa.ativo !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {empresa.ativo !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {empresa.cnpj && (
                    <div className="flex justify-between">
                      <span>CNPJ</span>
                      <span className="text-gray-700 font-medium">{empresa.cnpj}</span>
                    </div>
                  )}
                  {empresa.areaAtuacao && (
                    <div className="flex justify-between">
                      <span>Área de Atuação</span>
                      <span className="text-gray-700 font-medium">{empresa.areaAtuacao}</span>
                    </div>
                  )}
                  {empresa.endereco && (
                    <div className="flex justify-between">
                      <span>Endereço</span>
                      <span className="text-gray-700 font-medium">{empresa.endereco}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      pedirSenha(() => {
                        setEditandoEmpresa(empresa);
                        setModalEmpresaOpen(true);
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => pedirSenha(() => setDeleteEmpresaId(empresa.id))}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Secao Fornecedores */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Fornecedores</h2>
          {loadingFornecedores && <span className="text-sm text-gray-400 animate-pulse">Carregando...</span>}
          {!loadingFornecedores && todosFornecedores.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setFornecedoresVisiveis((v) => !v)}
            >
              {fornecedoresVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {!loadingFornecedores && todosFornecedores.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum fornecedor cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoFornecedor(null);
                  setModalFornecedorOpen(true);
                }}
              >
                Cadastrar Primeiro Fornecedor
              </Button>
            </div>
          </Card>
        ) : fornecedoresVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosFornecedores.map((forn) => (
              <Card key={forn.id} className={forn.ativo === false ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {forn.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      forn.ativo !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {forn.ativo !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {forn.cnpj && (
                    <div className="flex justify-between">
                      <span>CPF / CNPJ</span>
                      <span className="text-gray-700 font-medium">{forn.cnpj}</span>
                    </div>
                  )}
                  {forn.telefone && (
                    <div className="flex justify-between">
                      <span>Telefone</span>
                      <span className="text-gray-700 font-medium">{forn.telefone}</span>
                    </div>
                  )}
                  {forn.email && (
                    <div className="flex justify-between">
                      <span>E-mail</span>
                      <span className="text-gray-700 font-medium">{forn.email}</span>
                    </div>
                  )}
                  {forn.observacoes && (
                    <p className="text-gray-500 mt-1">{forn.observacoes}</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      pedirSenha(() => {
                        setEditandoFornecedor(forn);
                        setModalFornecedorOpen(true);
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => pedirSenha(() => setDeleteFornecedorId(forn.id))}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Secao Colaboradores */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Colaboradores</h2>
          {loadingColaboradores && <span className="text-sm text-gray-400 animate-pulse">Carregando...</span>}
          {!loadingColaboradores && todosColaboradores.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setColaboradoresVisiveis((v) => !v)}
            >
              {colaboradoresVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {!loadingColaboradores && todosColaboradores.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum colaborador cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoColaborador(null);
                  setModalColaboradorOpen(true);
                }}
              >
                Cadastrar Primeiro Colaborador
              </Button>
            </div>
          </Card>
        ) : colaboradoresVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosColaboradores.map((colab) => (
              <Card key={colab.id} className={colab.ativo === false ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {colab.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      colab.ativo !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {colab.ativo !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  <div className="flex justify-between">
                    <span>Empresa</span>
                    <span className="text-gray-700 font-medium">{empresasMap.get(colab.empresaId) || '-'}</span>
                  </div>
                  {colab.cpf && (
                    <div className="flex justify-between">
                      <span>CPF</span>
                      <span className="text-gray-700 font-medium">{colab.cpf}</span>
                    </div>
                  )}
                  {colab.telefone && (
                    <div className="flex justify-between">
                      <span>Telefone</span>
                      <span className="text-gray-700 font-medium">{colab.telefone}</span>
                    </div>
                  )}
                  {colab.email && (
                    <div className="flex justify-between">
                      <span>E-mail</span>
                      <span className="text-gray-700 font-medium">{colab.email}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      pedirSenha(() => {
                        setEditandoColaborador(colab);
                        setModalColaboradorOpen(true);
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => pedirSenha(() => setDeleteColaboradorId(colab.id))}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Modal Unidade de Medida */}
      <Modal
        open={modalUnidadeOpen}
        onClose={() => {
          setModalUnidadeOpen(false);
          setEditandoUnidade(null);
        }}
        title={editandoUnidade ? 'Editar Unidade de Medida' : 'Nova Unidade de Medida'}
      >
        <UnidadeMedidaForm
          initial={editandoUnidade}
          onSubmit={handleSubmitUnidade}
          onCancel={() => {
            setModalUnidadeOpen(false);
            setEditandoUnidade(null);
          }}
          onImportBatch={async (novos) => {
            for (const u of novos) {
              await adicionarUnidadeMutation.mutateAsync(u);
            }
            setModalUnidadeOpen(false);
            setEditandoUnidade(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteUnidadeId !== null}
        onClose={() => setDeleteUnidadeId(null)}
        onConfirm={() => {
          if (deleteUnidadeId) handleDeleteUnidade(deleteUnidadeId);
        }}
        title="Excluir Unidade de Medida"
        message="Tem certeza que deseja excluir esta unidade de medida?"
      />

      {/* Modal Tipo de Insumo */}
      <Modal
        open={modalTipoInsumoOpen}
        onClose={() => {
          setModalTipoInsumoOpen(false);
          setEditandoTipoInsumo(null);
        }}
        title={editandoTipoInsumo ? 'Editar Tipo de Insumo' : 'Novo Tipo de Insumo'}
      >
        <TipoInsumoForm
          initial={editandoTipoInsumo}
          onSubmit={handleSubmitTipoInsumo}
          onCancel={() => {
            setModalTipoInsumoOpen(false);
            setEditandoTipoInsumo(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteTipoInsumoId !== null}
        onClose={() => setDeleteTipoInsumoId(null)}
        onConfirm={() => {
          if (deleteTipoInsumoId) handleDeleteTipoInsumo(deleteTipoInsumoId);
        }}
        title="Excluir Tipo de Insumo"
        message="Tem certeza que deseja excluir este tipo de insumo?"
      />

      {/* Modal Categoria de Material */}
      <Modal
        open={modalCategoriaOpen}
        onClose={() => {
          setModalCategoriaOpen(false);
          setEditandoCategoria(null);
        }}
        title={editandoCategoria ? 'Editar Categoria de Material' : 'Nova Categoria de Material'}
      >
        <CategoriaMaterialForm
          initial={editandoCategoria}
          onSubmit={handleSubmitCategoria}
          onCancel={() => {
            setModalCategoriaOpen(false);
            setEditandoCategoria(null);
          }}
          onImportBatch={async (novos) => {
            for (const c of novos) {
              await adicionarCategoriaMutation.mutateAsync(c);
            }
            setModalCategoriaOpen(false);
            setEditandoCategoria(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteCategoriaId !== null}
        onClose={() => setDeleteCategoriaId(null)}
        onConfirm={() => {
          if (deleteCategoriaId) handleDeleteCategoria(deleteCategoriaId);
        }}
        title="Excluir Categoria de Material"
        message="Tem certeza que deseja excluir esta categoria de material?"
      />

      {/* Modal Fornecedor */}
      <Modal
        open={modalFornecedorOpen}
        onClose={() => {
          setModalFornecedorOpen(false);
          setEditandoFornecedor(null);
        }}
        title={editandoFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <FornecedorForm
          initial={editandoFornecedor}
          onSubmit={handleSubmitFornecedor}
          onCancel={() => {
            setModalFornecedorOpen(false);
            setEditandoFornecedor(null);
          }}
          onImportBatch={async (novos) => {
            for (const f of novos) {
              await adicionarFornecedorMutation.mutateAsync(f);
            }
            setModalFornecedorOpen(false);
            setEditandoFornecedor(null);
          }}
        />
      </Modal>

      {/* Modal Empresa */}
      <Modal
        open={modalEmpresaOpen}
        onClose={() => {
          setModalEmpresaOpen(false);
          setEditandoEmpresa(null);
        }}
        title={editandoEmpresa ? 'Editar Empresa' : 'Nova Empresa'}
      >
        <EmpresaForm
          initial={editandoEmpresa}
          onSubmit={handleSubmitEmpresa}
          onCancel={() => {
            setModalEmpresaOpen(false);
            setEditandoEmpresa(null);
          }}
        />
      </Modal>

      {/* Modal Colaborador */}
      <Modal
        open={modalColaboradorOpen}
        onClose={() => {
          setModalColaboradorOpen(false);
          setEditandoColaborador(null);
        }}
        title={editandoColaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
      >
        <ColaboradorForm
          initial={editandoColaborador}
          empresas={todasEmpresas}
          onSubmit={handleSubmitColaborador}
          onCancel={() => {
            setModalColaboradorOpen(false);
            setEditandoColaborador(null);
          }}
          onImportBatch={async (novos) => {
            for (const c of novos) {
              await adicionarColaboradorMutation.mutateAsync({ ...c, criadoPor: usuario?.nome || '' });
            }
            setModalColaboradorOpen(false);
            setEditandoColaborador(null);
          }}
        />
      </Modal>

      {/* Modal Insumo */}
      <Modal
        open={modalInsumoOpen}
        onClose={() => {
          setModalInsumoOpen(false);
          setEditandoInsumo(null);
        }}
        title={editandoInsumo ? 'Editar Insumo' : 'Novo Insumo'}
      >
        <InsumoForm
          initial={editandoInsumo}
          unidades={todasUnidades}
          categorias={categoriasOptions}
          tipos={tiposInsumoOptions}
          onSubmit={handleSubmitInsumo}
          onCancel={() => {
            setModalInsumoOpen(false);
            setEditandoInsumo(null);
          }}
          onImportBatch={async (novos) => {
            for (const i of novos) {
              await adicionarInsumoMutation.mutateAsync(i);
            }
            setModalInsumoOpen(false);
            setEditandoInsumo(null);
          }}
          onCreateCategoria={async (nomeCategoria) => {
            const valor = gerarSlug(nomeCategoria);
            await adicionarCategoriaMutation.mutateAsync({
              id: gerarId(),
              nome: nomeCategoria,
              valor,
              ativo: true,
              criadoPor: usuario?.nome || '',
            });
            return valor;
          }}
          onCreateTipo={async (nomeTipo) => {
            const valor = gerarSlug(nomeTipo);
            await adicionarTipoInsumoMutation.mutateAsync({
              id: gerarId(),
              nome: nomeTipo,
              valor,
              ativo: true,
              criadoPor: usuario?.nome || '',
            });
            return valor;
          }}
        />
      </Modal>

      {/* Modal Equipamento */}
      <Modal
        open={modalEquipOpen}
        onClose={() => {
          setModalEquipOpen(false);
          setEditandoEquip(null);
        }}
        title={editandoEquip ? 'Editar Equipamento' : 'Novo Equipamento'}
      >
        <EquipamentoForm
          initial={editandoEquip}
          onSubmit={handleSubmitEquip}
          onCancel={() => {
            setModalEquipOpen(false);
            setEditandoEquip(null);
          }}
          onImportBatch={async (novos) => {
            for (const eq of novos) {
              await adicionarEquipamentoMutation.mutateAsync(eq);
            }
            setModalEquipOpen(false);
            setEditandoEquip(null);
          }}
          existentes={todosEquipamentos}
        />
      </Modal>

      {/* Modal Tanque */}
      <Modal
        open={modalTanqueOpen}
        onClose={() => {
          setModalTanqueOpen(false);
          setEditandoTanque(null);
        }}
        title={editandoTanque ? 'Editar Tanque' : 'Novo Tanque de Combustível'}
      >
        <TanqueForm
          initial={editandoTanque}
          obras={obras}
          onSubmit={handleSubmitTanque}
          onCancel={() => {
            setModalTanqueOpen(false);
            setEditandoTanque(null);
          }}
          onImportBatch={async (novos) => {
            for (const t of novos) {
              await adicionarDepositoMutation.mutateAsync(t);
            }
            setModalTanqueOpen(false);
            setEditandoTanque(null);
          }}
        />
      </Modal>

      <PasswordDialog
        open={senhaOpen}
        onClose={() => {
          setSenhaOpen(false);
          setSenhaAction(null);
        }}
        onSuccess={() => {
          if (senhaAction) senhaAction();
          setSenhaAction(null);
        }}
        title="Senha de Edicao"
      />

      <ConfirmDialog
        open={deleteDepId !== null}
        onClose={() => setDeleteDepId(null)}
        onConfirm={() => {
          if (deleteDepId) handleDeleteDeposito(deleteDepId);
        }}
        title="Excluir Tanque"
        message="Tem certeza que deseja excluir este tanque? Todas as entradas e saidas de combustivel vinculadas a este tanque tambem serao excluidas."
      />

      <ConfirmDialog
        open={deleteEquipId !== null}
        onClose={() => setDeleteEquipId(null)}
        onConfirm={() => {
          if (deleteEquipId) handleDeleteEquip(deleteEquipId);
        }}
        title="Excluir Equipamento"
        message="Tem certeza que deseja excluir este equipamento?"
      />

      <ConfirmDialog
        open={deleteInsumoId !== null}
        onClose={() => setDeleteInsumoId(null)}
        onConfirm={() => {
          if (deleteInsumoId) handleDeleteInsumo(deleteInsumoId);
        }}
        title="Excluir Insumo"
        message="Tem certeza que deseja excluir este insumo?"
      />

      <ConfirmDialog
        open={deleteFornecedorId !== null}
        onClose={() => setDeleteFornecedorId(null)}
        onConfirm={() => {
          if (deleteFornecedorId) handleDeleteFornecedor(deleteFornecedorId);
        }}
        title="Excluir Fornecedor"
        message="Tem certeza que deseja excluir este fornecedor?"
      />

      <ConfirmDialog
        open={deleteColaboradorId !== null}
        onClose={() => setDeleteColaboradorId(null)}
        onConfirm={() => {
          if (deleteColaboradorId) handleDeleteColaborador(deleteColaboradorId);
        }}
        title="Excluir Colaborador"
        message="Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita."
      />

      <ConfirmDialog
        open={deleteEmpresaId !== null}
        onClose={() => setDeleteEmpresaId(null)}
        onConfirm={() => {
          if (deleteEmpresaId) handleDeleteEmpresa(deleteEmpresaId);
        }}
        title="Excluir Empresa"
        message="Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
