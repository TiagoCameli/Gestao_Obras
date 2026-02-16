import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { Deposito, DepositoMaterial, Equipamento, EtapaObra, Fornecedor, Insumo, Obra, TipoInsumo, TipoMedicao, UnidadeMedida } from '../types';
import { useObras, useAdicionarObra, useAtualizarObra, useExcluirObra } from '../hooks/useObras';
import { useEtapas, useSalvarEtapasObra } from '../hooks/useEtapas';
import { useDepositos, useAdicionarDeposito, useAtualizarDeposito, useExcluirDeposito, useSalvarDepositosObra } from '../hooks/useDepositos';
import { useEquipamentos, useAdicionarEquipamento, useAtualizarEquipamento, useExcluirEquipamento } from '../hooks/useEquipamentos';
import { useInsumos, useAdicionarInsumo, useAtualizarInsumo, useExcluirInsumo } from '../hooks/useInsumos';
import { useFornecedores, useAdicionarFornecedor, useAtualizarFornecedor, useExcluirFornecedor } from '../hooks/useFornecedores';
import { useUnidades, useAdicionarUnidade, useAtualizarUnidade, useExcluirUnidade } from '../hooks/useUnidades';
import { useDepositosMaterial, useAdicionarDepositoMaterial, useAtualizarDepositoMaterial, useExcluirDepositoMaterial } from '../hooks/useDepositosMaterial';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { formatCurrency, formatDate } from '../utils/formatters';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PasswordDialog from '../components/ui/PasswordDialog';
import ObraForm from '../components/obras/ObraForm';
import ImportEquipamentosModal from '../components/obras/ImportEquipamentosModal';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS: Record<Obra['status'], string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  concluida: 'Concluida',
  pausada: 'Pausada',
};

const STATUS_COLORS: Record<Obra['status'], string> = {
  planejamento: 'bg-emt-verde-claro text-emt-verde-escuro',
  em_andamento: 'bg-yellow-100 text-yellow-800',
  concluida: 'bg-green-100 text-green-800',
  pausada: 'bg-gray-100 text-gray-800',
};

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function TanqueForm({
  initial,
  obras,
  onSubmit,
  onCancel,
}: {
  initial: Deposito | null;
  obras: Obra[];
  onSubmit: (dep: Deposito) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [capacidade, setCapacidade] = useState(
    initial?.capacidadeLitros?.toString() || ''
  );
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

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
    });
  }

  const isValid = nome && obraId && capacidade;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          step="1"
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Tanque'}
        </Button>
      </div>
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
    });
  }

  const isValid = nome && medicaoInicial && dataAquisicao;

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
          label="Codigo de Patrimonio"
          id="eqPatrimonio"
          value={codigoPatrimonio}
          onChange={(e) => setCodigoPatrimonio(e.target.value)}
          placeholder="Ex: PAT-001"
        />
        <Input
          label="Numero de Serie"
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
          label="Tipo de Medicao"
          id="eqTipoMedicao"
          value={tipoMedicao}
          onChange={(e) => setTipoMedicao(e.target.value as TipoMedicao)}
          options={[
            { value: 'horimetro', label: 'Horimetro' },
            { value: 'odometro', label: 'Odometro' },
          ]}
          required
        />
        <Input
          label={tipoMedicao === 'horimetro' ? 'Horimetro Inicial' : 'Odometro Inicial (KM)'}
          id="eqMedicao"
          type="number"
          step="0.1"
          min="0"
          value={medicaoInicial}
          onChange={(e) => setMedicaoInicial(e.target.value)}
          required
        />
        <Input
          label="Data de Aquisicao"
          id="eqDataAquisicao"
          type="date"
          value={dataAquisicao}
          onChange={(e) => setDataAquisicao(e.target.value)}
          required
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Equipamento'}
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
}: {
  initial: UnidadeMedida | null;
  onSubmit: (unidade: UnidadeMedida) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [sigla, setSigla] = useState(initial?.sigla || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      sigla,
      ativo,
    });
  }

  const isValid = nome.trim().length > 0 && sigla.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Unidade'}
        </Button>
      </div>
    </form>
  );
}

function InsumoForm({
  initial,
  unidades,
  onSubmit,
  onCancel,
}: {
  initial: Insumo | null;
  unidades: UnidadeMedida[];
  onSubmit: (insumo: Insumo) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [tipo, setTipo] = useState<TipoInsumo>(initial?.tipo || 'material');
  const [unidade, setUnidade] = useState(initial?.unidade || '');
  const [descricao, setDescricao] = useState(initial?.descricao || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

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
    });
  }

  const isValid = nome && unidade;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do Insumo"
          id="insumoNome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Diesel S10, Cimento CP-II, Brita"
          required
        />
        <Select
          label="Tipo"
          id="insumoTipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoInsumo)}
          options={[
            { value: 'combustivel', label: 'Combustivel' },
            { value: 'material', label: 'Material' },
          ]}
          required
        />
        <Select
          label="Unidade de Medida"
          id="insumoUnidade"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
          options={unidadeOptions}
          placeholder="Selecione a unidade"
          required
        />
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Insumo'}
        </Button>
      </div>
    </form>
  );
}

function DepositoMaterialForm({
  initial,
  obras,
  onSubmit,
  onCancel,
}: {
  initial: DepositoMaterial | null;
  obras: Obra[];
  onSubmit: (dep: DepositoMaterial) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [responsavel, setResponsavel] = useState(initial?.responsavel || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      id: initial?.id || gerarId(),
      nome,
      obraId,
      endereco,
      responsavel,
      ativo,
    });
  }

  const isValid = nome.trim().length > 0 && obraId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do Deposito"
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
          label="Endereco"
          id="depMatEndereco"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Ex: Rua das Flores, 100"
        />
        <Input
          label="Responsavel"
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Deposito'}
        </Button>
      </div>
    </form>
  );
}

function FornecedorForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Fornecedor | null;
  onSubmit: (fornecedor: Fornecedor) => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [cnpj, setCnpj] = useState(initial?.cnpj || '');
  const [telefone, setTelefone] = useState(initial?.telefone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [ativo, setAtivo] = useState(initial?.ativo !== false);

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
    });
  }

  const isValid = nome.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          Observacoes (opcional)
        </label>
        <textarea
          id="fornecedorObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observacao..."
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
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Fornecedor'}
        </Button>
      </div>
    </form>
  );
}

export default function Obras() {
  const { temAcao } = useAuth();
  const canCreate = temAcao('criar_cadastros');

  // ---- Supabase query hooks ----
  const { data: obras = [], isLoading: loadingObras } = useObras();
  const { data: todasEtapas = [], isLoading: loadingEtapas } = useEtapas();
  const { data: todosDepositos = [], isLoading: loadingDepositos } = useDepositos();
  const { data: todosEquipamentos = [], isLoading: loadingEquipamentos } = useEquipamentos();
  const { data: todosInsumos = [], isLoading: loadingInsumos } = useInsumos();
  const { data: todosFornecedores = [], isLoading: loadingFornecedores } = useFornecedores();
  const { data: todasUnidades = [], isLoading: loadingUnidades } = useUnidades();
  const { data: todosDepositosMat = [], isLoading: loadingDepositosMat } = useDepositosMaterial();

  const unidadesMap = useMemo(() => new Map(todasUnidades.map((u) => [u.sigla, u.nome])), [todasUnidades]);

  // ---- Supabase mutation hooks (must be called at top level) ----
  const adicionarObraMutation = useAdicionarObra();
  const atualizarObraMutation = useAtualizarObra();
  const excluirObraMutation = useExcluirObra();
  const salvarEtapasObraMutation = useSalvarEtapasObra();
  const salvarDepositosObraMutation = useSalvarDepositosObra();
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

  // ---- Loading state ----
  const isLoading = loadingObras || loadingEtapas || loadingDepositos || loadingEquipamentos || loadingInsumos || loadingFornecedores || loadingUnidades || loadingDepositosMat;

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Obra | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDepId, setDeleteDepId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (obra: Obra, etapas: EtapaObra[], depositos: Deposito[]) => {
      if (editando) {
        await atualizarObraMutation.mutateAsync(obra);
        await salvarEtapasObraMutation.mutateAsync({ obraId: obra.id, etapas });
        await salvarDepositosObraMutation.mutateAsync({ obraId: obra.id, depositos });
      } else {
        await adicionarObraMutation.mutateAsync(obra);
        await salvarEtapasObraMutation.mutateAsync({ obraId: obra.id, etapas });
        await salvarDepositosObraMutation.mutateAsync({ obraId: obra.id, depositos });
      }
      setModalOpen(false);
      setEditando(null);
    },
    [editando, atualizarObraMutation, adicionarObraMutation, salvarEtapasObraMutation, salvarDepositosObraMutation]
  );

  // Password gate para edicao
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAction, setSenhaAction] = useState<(() => void) | null>(null);

  function pedirSenha(action: () => void) {
    setSenhaAction(() => action);
    setSenhaOpen(true);
  }

  const handleEdit = useCallback((obra: Obra) => {
    pedirSenha(() => {
      setEditando(obra);
      setModalOpen(true);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await excluirObraMutation.mutateAsync(id);
    setDeleteId(null);
  }, [excluirObraMutation]);

  const handleDeleteDeposito = useCallback(async (id: string) => {
    await excluirDepositoMutation.mutateAsync(id);
    setDeleteDepId(null);
  }, [excluirDepositoMutation]);

  // Visibilidade das secoes
  const [obrasVisiveis, setObrasVisiveis] = useState(true);
  const [tanquesVisiveis, setTanquesVisiveis] = useState(true);
  const [equipamentosVisiveis, setEquipamentosVisiveis] = useState(true);
  const [insumosVisiveis, setInsumosVisiveis] = useState(true);
  const [fornecedoresVisiveis, setFornecedoresVisiveis] = useState(true);
  const [unidadesVisiveis, setUnidadesVisiveis] = useState(true);

  // Tanque state
  const [modalTanqueOpen, setModalTanqueOpen] = useState(false);
  const [editandoTanque, setEditandoTanque] = useState<Deposito | null>(null);

  const handleSubmitTanque = useCallback(
    async (dep: Deposito) => {
      if (editandoTanque) {
        await atualizarDepositoMutation.mutateAsync(dep);
      } else {
        await adicionarDepositoMutation.mutateAsync(dep);
      }
      setModalTanqueOpen(false);
      setEditandoTanque(null);
    },
    [editandoTanque, atualizarDepositoMutation, adicionarDepositoMutation]
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
        await adicionarEquipamentoMutation.mutateAsync(eq);
      }
      setModalEquipOpen(false);
      setEditandoEquip(null);
    },
    [editandoEquip, atualizarEquipamentoMutation, adicionarEquipamentoMutation]
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
        await adicionarInsumoMutation.mutateAsync(insumo);
      }
      setModalInsumoOpen(false);
      setEditandoInsumo(null);
    },
    [editandoInsumo, atualizarInsumoMutation, adicionarInsumoMutation]
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
        await adicionarFornecedorMutation.mutateAsync(fornecedor);
      }
      setModalFornecedorOpen(false);
      setEditandoFornecedor(null);
    },
    [editandoFornecedor, atualizarFornecedorMutation, adicionarFornecedorMutation]
  );

  const handleDeleteFornecedor = useCallback(async (id: string) => {
    await excluirFornecedorMutation.mutateAsync(id);
    setDeleteFornecedorId(null);
  }, [excluirFornecedorMutation]);

  // Deposito Material state
  const [depositosMatVisiveis, setDepositosMatVisiveis] = useState(true);
  const [modalDepMatOpen, setModalDepMatOpen] = useState(false);
  const [editandoDepMat, setEditandoDepMat] = useState<DepositoMaterial | null>(null);
  const [deleteDepMatId, setDeleteDepMatId] = useState<string | null>(null);

  const handleSubmitDepMat = useCallback(
    async (dep: DepositoMaterial) => {
      if (editandoDepMat) {
        await atualizarDepositoMaterialMutation.mutateAsync(dep);
      } else {
        await adicionarDepositoMaterialMutation.mutateAsync(dep);
      }
      setModalDepMatOpen(false);
      setEditandoDepMat(null);
    },
    [editandoDepMat, atualizarDepositoMaterialMutation, adicionarDepositoMaterialMutation]
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
        await adicionarUnidadeMutation.mutateAsync(unidade);
      }
      setModalUnidadeOpen(false);
      setEditandoUnidade(null);
    },
    [editandoUnidade, atualizarUnidadeMutation, adicionarUnidadeMutation]
  );

  const handleDeleteUnidade = useCallback(async (id: string) => {
    await excluirUnidadeMutation.mutateAsync(id);
    setDeleteUnidadeId(null);
  }, [excluirUnidadeMutation]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-lg">Carregando cadastros...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Cadastros</h1>
        <div className="flex gap-3">
          {canCreate && <>
            <Button
              onClick={() => {
                setEditandoUnidade(null);
                setModalUnidadeOpen(true);
              }}
            >
              Nova Unidade
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
            <Button
              onClick={() => {
                setEditandoDepMat(null);
                setModalDepMatOpen(true);
              }}
            >
              Novo Deposito
            </Button>
            <Button
              onClick={() => {
                setEditandoTanque(null);
                setModalTanqueOpen(true);
              }}
            >
              Novo Tanque
            </Button>
            <Button
              onClick={() => {
                setEditando(null);
                setModalOpen(true);
              }}
            >
              Nova Obra
            </Button>
          </>}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-800">Obras</h2>
        {obras.length > 0 && (
          <button
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => setObrasVisiveis((v) => !v)}
          >
            {obrasVisiveis ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>

      {obras.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Nenhuma obra cadastrada ainda.</p>
            <Button
              onClick={() => {
                setEditando(null);
                setModalOpen(true);
              }}
            >
              Cadastrar Primeira Obra
            </Button>
          </div>
        </Card>
      ) : obrasVisiveis ? (
        <div className="space-y-4">
          {obras.map((obra) => {
            const etapasObra = todasEtapas.filter((e) => e.obraId === obra.id);
            const depositosObra = todosDepositos.filter((d) => d.obraId === obra.id);
            const isExpanded = expandedId === obra.id;

            return (
              <Card key={obra.id} className="p-0 overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(obra.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-semibold text-gray-800">
                          {obra.nome}
                        </h2>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[obra.status]}`}
                        >
                          {STATUS_LABELS[obra.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{obra.endereco}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <p className="text-lg font-bold text-emt-verde-escuro">
                          {formatCurrency(obra.orcamento)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {etapasObra.length} etapa{etapasObra.length !== 1 ? 's' : ''}
                          {depositosObra.length > 0 &&
                            ` · ${depositosObra.length} tanque${depositosObra.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Responsavel</p>
                        <p className="text-sm font-medium text-gray-700">
                          {obra.responsavel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Inicio</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataInicio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Previsao Termino</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataPrevisaoFim)}
                        </p>
                      </div>
                    </div>

                    {etapasObra.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Etapas</p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-emt-verde text-white">
                              <tr>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">#</th>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">Etapa</th>
                                <th className="text-left px-3 py-1.5 text-white font-medium uppercase text-xs">Unidade</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Qtd</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Valor Unit.</th>
                                <th className="text-right px-3 py-1.5 text-white font-medium uppercase text-xs">Valor Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {etapasObra.map((etapa, i) => (
                                <tr key={etapa.id}>
                                  <td className="px-3 py-1.5 text-gray-400 font-mono">{i + 1}.</td>
                                  <td className="px-3 py-1.5 text-gray-700 font-medium">{etapa.nome}</td>
                                  <td className="px-3 py-1.5 text-gray-600">{etapa.unidade || '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600">{etapa.quantidade ?? '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600">{etapa.valorUnitario != null ? formatCurrency(etapa.valorUnitario) : '-'}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700">{etapa.quantidade != null && etapa.valorUnitario != null ? formatCurrency(etapa.quantidade * etapa.valorUnitario) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Depositos */}
                    {depositosObra.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Tanques</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {depositosObra.map((dep) => {
                            const pct =
                              dep.capacidadeLitros > 0
                                ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100
                                : 0;
                            const cor =
                              pct > 50
                                ? 'bg-green-500'
                                : pct > 20
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500';
                            return (
                              <div
                                key={dep.id}
                                className="bg-white border border-gray-200 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">
                                      {dep.nome}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteDepId(dep.id);
                                    }}
                                  >
                                    Excluir
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${cor}`}
                                      style={{
                                        width: `${Math.min(pct, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {dep.nivelAtualLitros.toFixed(0)} /{' '}
                                    {dep.capacidadeLitros.toFixed(0)} L
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      <Button
                        variant="secondary"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(obra);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(obra.id);
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
        }}
        title={editando ? 'Editar Obra' : 'Nova Obra'}
      >
        <ObraForm
          initial={editando}
          initialEtapas={editando ? todasEtapas.filter((e) => e.obraId === editando.id) : []}
          initialDepositos={editando ? todosDepositos.filter((d) => d.obraId === editando.id) : []}
          unidades={todasUnidades}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        />
      </Modal>

      {/* Secao Tanques de Combustivel */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Tanques de Combustivel</h2>
          {todosDepositos.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setTanquesVisiveis((v) => !v)}
            >
              {tanquesVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todosDepositos.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum tanque cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoTanque(null);
                  setModalTanqueOpen(true);
                }}
              >
                Cadastrar Primeiro Tanque
              </Button>
            </div>
          </Card>
        ) : tanquesVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosDepositos.map((dep) => {
              const pct =
                dep.capacidadeLitros > 0
                  ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100
                  : 0;
              const cor =
                pct > 50
                  ? 'bg-green-500'
                  : pct > 20
                    ? 'bg-yellow-500'
                    : 'bg-red-500';
              const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
              return (
                <Card key={dep.id} className={dep.ativo === false ? 'opacity-60' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {dep.nome}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          dep.ativo !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {dep.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {obrasMap.get(dep.obraId) || 'Obra desconhecida'}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${cor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                      {dep.nivelAtualLitros.toFixed(0)} / {dep.capacidadeLitros.toFixed(0)} L
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => {
                        pedirSenha(() => {
                          setEditandoTanque(dep);
                          setModalTanqueOpen(true);
                        });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteDepId(dep.id)}
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

      {/* Secao Depositos de Material */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Depositos</h2>
          {todosDepositosMat.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setDepositosMatVisiveis((v) => !v)}
            >
              {depositosMatVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todosDepositosMat.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhum deposito cadastrado ainda.</p>
              <Button
                onClick={() => {
                  setEditandoDepMat(null);
                  setModalDepMatOpen(true);
                }}
              >
                Cadastrar Primeiro Deposito
              </Button>
            </div>
          </Card>
        ) : depositosMatVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosDepositosMat.map((dep) => {
              const obraNome = obras.find((o) => o.id === dep.obraId)?.nome || 'Obra desconhecida';
              return (
                <Card key={dep.id} className={dep.ativo === false ? 'opacity-60' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {dep.nome}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        dep.ativo !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {dep.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 mb-3">
                    <div className="flex justify-between">
                      <span>Obra</span>
                      <span className="text-gray-700 font-medium">{obraNome}</span>
                    </div>
                    {dep.endereco && (
                      <div className="flex justify-between">
                        <span>Endereco</span>
                        <span className="text-gray-700 font-medium">{dep.endereco}</span>
                      </div>
                    )}
                    {dep.responsavel && (
                      <div className="flex justify-between">
                        <span>Responsavel</span>
                        <span className="text-gray-700 font-medium">{dep.responsavel}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      onClick={() => {
                        pedirSenha(() => {
                          setEditandoDepMat(dep);
                          setModalDepMatOpen(true);
                        });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteDepMatId(dep.id)}
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
          {todosEquipamentos.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setEquipamentosVisiveis((v) => !v)}
            >
              {equipamentosVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todosEquipamentos.length === 0 ? (
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
                  <div className="flex justify-between">
                    <span>{eq.tipoMedicao === 'horimetro' ? 'Horimetro Inicial' : 'Odometro Inicial'}</span>
                    <span className="text-gray-700 font-medium">
                      {eq.medicaoInicial.toLocaleString('pt-BR')} {eq.tipoMedicao === 'horimetro' ? 'h' : 'km'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aquisicao</span>
                    <span className="text-gray-700 font-medium">{formatDate(eq.dataAquisicao)}</span>
                  </div>
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
                    onClick={() => setDeleteEquipId(eq.id)}
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
          {todosInsumos.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setInsumosVisiveis((v) => !v)}
            >
              {insumosVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todosInsumos.length === 0 ? (
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
                        {insumo.tipo === 'combustivel' ? 'Combustivel' : 'Material'}
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
                      onClick={() => setDeleteInsumoId(insumo.id)}
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

      {/* Secao Fornecedores */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Fornecedores</h2>
          {todosFornecedores.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setFornecedoresVisiveis((v) => !v)}
            >
              {fornecedoresVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todosFornecedores.length === 0 ? (
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
                    onClick={() => setDeleteFornecedorId(forn.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      {/* Secao Unidades de Medida */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Unidades de Medida</h2>
          {todasUnidades.length > 0 && (
            <button
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setUnidadesVisiveis((v) => !v)}
            >
              {unidadesVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
          )}
        </div>
        {todasUnidades.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">Nenhuma unidade cadastrada ainda.</p>
              <Button
                onClick={() => {
                  setEditandoUnidade(null);
                  setModalUnidadeOpen(true);
                }}
              >
                Cadastrar Primeira Unidade
              </Button>
            </div>
          </Card>
        ) : unidadesVisiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todasUnidades.map((unidade) => (
              <Card key={unidade.id} className={unidade.ativo === false ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {unidade.nome}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      unidade.ativo !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {unidade.ativo !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  <div className="flex justify-between">
                    <span>Sigla</span>
                    <span className="text-gray-700 font-medium">{unidade.sigla}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      pedirSenha(() => {
                        setEditandoUnidade(unidade);
                        setModalUnidadeOpen(true);
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteUnidadeId(unidade.id)}
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
          onSubmit={handleSubmitInsumo}
          onCancel={() => {
            setModalInsumoOpen(false);
            setEditandoInsumo(null);
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
        title={editandoTanque ? 'Editar Tanque' : 'Novo Tanque de Combustivel'}
      >
        <TanqueForm
          initial={editandoTanque}
          obras={obras}
          onSubmit={handleSubmitTanque}
          onCancel={() => {
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
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
        }}
        title="Excluir Obra"
        message="Tem certeza que deseja excluir esta obra? Todas as etapas, tanques e abastecimentos vinculados tambem serao excluidos."
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
    </div>
  );
}
