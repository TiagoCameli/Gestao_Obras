import {
  useObras,
  useAdicionarObra,
  useAtualizarObra,
  useExcluirObra,
} from '../../../hooks/useObras';
import type { Obra } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, parseNumero, parseData, type ParsedRow } from '../../../components/ui/ImportExcelModal';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const STATUS_OPTIONS = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'pausada', label: 'Pausada' },
];

const STATUS_LABEL: Record<Obra['status'], string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
};

const STATUS_COLOR: Record<Obra['status'], string> = {
  planejamento: 'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  em_andamento: 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]',
  concluida: 'bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]',
  pausada: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]',
};

export const obrasConfig: EntityConfig<Obra> = {
  slug: 'obras',
  singular: 'Obra',
  plural: 'Obras',
  description: 'Cadastro mestre das obras / contratos da empresa.',
  category: 'obra',
  genderFem: true,
  accent: 'green',
  searchKey: 'nome',
  searchKey2: 'responsavel',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21v-8h6v8" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (o) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status]}`}>
          {STATUS_LABEL[o.status]}
        </span>
      ),
    },
    { key: 'responsavel', label: 'Responsável', hideOnMobile: true },
    {
      key: 'orcamento',
      label: 'Orçamento',
      align: 'right',
      hideOnMobile: true,
      render: (o) => formatCurrency(o.orcamento || 0),
    },
    {
      key: 'dataPrevisaoFim',
      label: 'Previsão',
      hideOnMobile: true,
      render: (o) => formatDate(o.dataPrevisaoFim),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome da obra', type: 'text', required: true, colSpan: 2, placeholder: 'Ex.: Pavimentação BR-364 Lote 09' },
    { key: 'endereco', label: 'Endereço', type: 'text', colSpan: 2 },
    { key: 'status', label: 'Status', type: 'select', required: true, staticOptions: STATUS_OPTIONS },
    { key: 'responsavel', label: 'Responsável', type: 'text', placeholder: 'Engenheiro responsável' },
    { key: 'dataInicio', label: 'Data de início', type: 'date' },
    { key: 'dataPrevisaoFim', label: 'Previsão de término', type: 'date' },
    { key: 'orcamento', label: 'Orçamento (R$)', type: 'currency', colSpan: 2 },
  ],

  defaultValues: () => ({
    nome: '',
    endereco: '',
    status: 'planejamento',
    dataInicio: '',
    dataPrevisaoFim: '',
    responsavel: '',
    orcamento: 0,
    criadoPor: '',
  }),

  hooks: {
    useList: useObras,
    useAdd: useAdicionarObra,
    useUpdate: useAtualizarObra,
    useDelete: useExcluirObra,
  },

  excel: {
    templateHeaders: [
      'Nome',
      'Endereço',
      'Status (planejamento|em_andamento|concluida|pausada)',
      'Responsável',
      'Data Início (AAAA-MM-DD)',
      'Previsão Fim (AAAA-MM-DD)',
      'Orçamento (R$)',
    ],
    templateExample: [
      'Pavimentação BR-364',
      'BR-364 km 100',
      'em_andamento',
      'João da Silva',
      '2025-01-15',
      '2026-12-31',
      1500000,
    ],
    templateColWidths: [32, 28, 32, 22, 16, 16, 14],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const endereco = parseStr(row[1]);
      const statusRaw = parseStr(row[2]).toLowerCase().replace(/\s+/g, '_');
      const responsavel = parseStr(row[3]);
      const dataInicio = parseData(row[4]);
      const dataPrevisaoFim = parseData(row[5]);
      const orcamento = parseNumero(row[6]) ?? 0;
      const validStatuses = ['planejamento', 'em_andamento', 'concluida', 'pausada'];

      if (!nome) erros.push('Nome obrigatório');
      if (!validStatuses.includes(statusRaw)) erros.push(`Status inválido (linha ${index + 2})`);

      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, endereco, status: statusRaw, responsavel, dataInicio, dataPrevisaoFim, orcamento },
      };
    },
    toEntity: (row, gerarId, criadoPor): Obra => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        endereco: String(d.endereco ?? ''),
        status: (d.status as Obra['status']) || 'planejamento',
        responsavel: String(d.responsavel ?? ''),
        dataInicio: String(d.dataInicio ?? ''),
        dataPrevisaoFim: String(d.dataPrevisaoFim ?? ''),
        orcamento: Number(d.orcamento) || 0,
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_obras',
    edit: 'editar_obras',
    delete: 'excluir_obras',
  },
};
