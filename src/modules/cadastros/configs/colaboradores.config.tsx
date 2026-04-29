import {
  useColaboradores,
  useAdicionarColaborador,
  useAtualizarColaborador,
  useExcluirColaborador,
} from '../../../hooks/useColaboradores';
import { useEmpresas } from '../../../hooks/useEmpresas';
import type { Colaborador, Empresa } from '../../../types';
import type { EntityConfig, FieldOption } from '../types';
import { parseStr, parseData, type ParsedRow } from '../../../components/ui/ImportExcelModal';
import { formatCPF, formatTelefone } from '../../../utils/formatters';

export const colaboradoresConfig: EntityConfig<Colaborador> = {
  slug: 'colaboradores',
  singular: 'Colaborador',
  plural: 'Colaboradores',
  description: 'Pessoas terceirizadas (operadores, motoristas) vinculadas a empresas.',
  category: 'pessoas',
  accent: 'purple',
  searchKey: 'nome',
  searchKey2: 'cpf',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    {
      key: 'empresaId',
      label: 'Empresa',
      hideOnMobile: true,
      useLookup: () => {
        const { data = [] } = useEmpresas();
        return new Map(data.map((e: Empresa) => [e.id, e.nome]));
      },
    },
    { key: 'cpf', label: 'CPF', hideOnMobile: true },
    { key: 'telefone', label: 'Telefone', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (c) =>
        c.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativo</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativo</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome completo', type: 'text', required: true, colSpan: 2, groupStart: 'Identificação' },
    { key: 'cpf', label: 'CPF', type: 'cpf' },
    { key: 'rg', label: 'RG', type: 'text' },
    { key: 'dataNascimento', label: 'Data de nascimento', type: 'date' },
    {
      key: 'empresaId',
      label: 'Empresa',
      type: 'select',
      useOptions: () => {
        const { data = [] } = useEmpresas();
        return data
          .filter((e) => e.ativo)
          .map<FieldOption>((e) => ({ value: e.id, label: e.nome }));
      },
    },
    { key: 'dataIngresso', label: 'Data de ingresso', type: 'date', groupStart: 'Contato' },
    { key: 'telefone', label: 'Telefone', type: 'tel' },
    { key: 'email', label: 'E-mail', type: 'email', colSpan: 2 },
    { key: 'endereco', label: 'Endereço', type: 'text', colSpan: 2 },
    { key: 'altura', label: 'Altura', type: 'text', placeholder: '1.75', groupStart: 'EPI / Uniforme' },
    { key: 'tamanhoCamisa', label: 'Camisa', type: 'text', placeholder: 'M' },
    { key: 'tamanhoCalca', label: 'Calça', type: 'text', placeholder: '42' },
    { key: 'tamanhoSapato', label: 'Sapato', type: 'text', placeholder: '42' },
    { key: 'observacoes', label: 'Observações', type: 'textarea', colSpan: 2, groupStart: 'Outros' },
    { key: 'ativo', label: 'Colaborador ativo', type: 'checkbox' },
  ],

  defaultValues: () => ({
    nome: '',
    empresaId: '',
    dataNascimento: '',
    dataIngresso: '',
    telefone: '',
    email: '',
    altura: '',
    tamanhoCamisa: '',
    tamanhoCalca: '',
    tamanhoSapato: '',
    endereco: '',
    cpf: '',
    rg: '',
    observacoes: '',
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useColaboradores,
    useAdd: useAdicionarColaborador,
    useUpdate: useAtualizarColaborador,
    useDelete: useExcluirColaborador,
  },

  excel: {
    templateHeaders: [
      'Nome',
      'CPF',
      'RG',
      'Empresa (nome exato)',
      'Data nascimento (AAAA-MM-DD)',
      'Data ingresso (AAAA-MM-DD)',
      'Telefone',
      'E-mail',
      'Endereço',
      'Altura',
      'Camisa',
      'Calça',
      'Sapato',
      'Ativo (sim/não)',
    ],
    templateExample: [
      'João da Silva',
      '000.000.000-00',
      '00.000.000-0',
      'Transportes Sul Ltda',
      '1980-05-12',
      '2024-01-10',
      '(69) 99999-9999',
      'joao@empresa.com',
      'Rua X, 100',
      '1.75',
      'M',
      '42',
      '42',
      'sim',
    ],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      if (!nome) erros.push('Nome obrigatório');
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, empresaName: parseStr(row[3]) },
      };
    },
    useBoundParser: () => {
      const { data: empresas = [] } = useEmpresas();
      return (row, index) => {
        const erros: string[] = [];
        const nome = parseStr(row[0]);
        const cpfRaw = parseStr(row[1]);
        const rg = parseStr(row[2]);
        const empresaName = parseStr(row[3]);
        const dataNascimento = parseData(row[4]);
        const dataIngresso = parseData(row[5]);
        const telRaw = parseStr(row[6]);
        const email = parseStr(row[7]);
        const endereco = parseStr(row[8]);
        const altura = parseStr(row[9]);
        const tamanhoCamisa = parseStr(row[10]);
        const tamanhoCalca = parseStr(row[11]);
        const tamanhoSapato = parseStr(row[12]);
        const ativoRaw = parseStr(row[13]).toLowerCase();

        if (!nome) erros.push('Nome obrigatório');
        const empresa = empresaName
          ? empresas.find((e: Empresa) => e.nome.toLowerCase() === empresaName.toLowerCase())
          : undefined;
        if (empresaName && !empresa) erros.push(`Empresa "${empresaName}" não encontrada`);

        const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
        return {
          valido: erros.length === 0,
          erros,
          resumo: nome || `(linha ${index + 2})`,
          dados: {
            nome,
            cpf: cpfRaw ? formatCPF(cpfRaw) : '',
            rg,
            empresaId: empresa?.id ?? '',
            dataNascimento,
            dataIngresso,
            telefone: telRaw ? formatTelefone(telRaw) : '',
            email,
            endereco,
            altura,
            tamanhoCamisa,
            tamanhoCalca,
            tamanhoSapato,
            ativo,
          },
        };
      };
    },
    toEntity: (row, gerarId, criadoPor): Colaborador => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        empresaId: String(d.empresaId ?? ''),
        dataNascimento: String(d.dataNascimento ?? ''),
        dataIngresso: String(d.dataIngresso ?? ''),
        telefone: String(d.telefone ?? ''),
        email: String(d.email ?? ''),
        altura: String(d.altura ?? ''),
        tamanhoCamisa: String(d.tamanhoCamisa ?? ''),
        tamanhoCalca: String(d.tamanhoCalca ?? ''),
        tamanhoSapato: String(d.tamanhoSapato ?? ''),
        endereco: String(d.endereco ?? ''),
        cpf: String(d.cpf ?? ''),
        rg: String(d.rg ?? ''),
        observacoes: String(d.observacoes ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_colaboradores',
    edit: 'editar_colaboradores',
    delete: 'excluir_colaboradores',
  },
};
