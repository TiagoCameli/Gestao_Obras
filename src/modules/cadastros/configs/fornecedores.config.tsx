import {
  useFornecedores,
  useAdicionarFornecedor,
  useAtualizarFornecedor,
  useExcluirFornecedor,
} from '../../../hooks/useFornecedores';
import type { Fornecedor } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';
import { formatCNPJ } from '../utils';
import { formatTelefone } from '../../../utils/formatters';

export const fornecedoresConfig: EntityConfig<Fornecedor> = {
  slug: 'fornecedores',
  singular: 'Fornecedor',
  plural: 'Fornecedores',
  description: 'Empresas e prestadores que fornecem materiais e serviços.',
  category: 'materiais',
  accent: 'amber',
  searchKey: 'nome',
  searchKey2: 'cnpj',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5" />
      <path d="M5 9v11h14V9" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    {
      key: 'cnpj',
      label: 'CNPJ',
      width: '180px',
      hideOnMobile: true,
      render: (f) => f.cnpj || '-',
    },
    { key: 'telefone', label: 'Telefone', hideOnMobile: true },
    { key: 'email', label: 'E-mail', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (f) =>
        f.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">
            Inativo
          </span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Razão social / Nome', type: 'text', required: true, colSpan: 2 },
    { key: 'cnpj', label: 'CNPJ', type: 'cnpj', placeholder: '00.000.000/0000-00' },
    { key: 'telefone', label: 'Telefone', type: 'tel', placeholder: '(00) 00000-0000' },
    { key: 'email', label: 'E-mail', type: 'email', colSpan: 2, placeholder: 'contato@fornecedor.com' },
    { key: 'observacoes', label: 'Observações', type: 'textarea', colSpan: 2 },
    { key: 'ativo', label: 'Fornecedor ativo', type: 'checkbox' },
  ],

  defaultValues: () => ({
    nome: '',
    cnpj: '',
    telefone: '',
    email: '',
    observacoes: '',
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useFornecedores,
    useAdd: useAdicionarFornecedor,
    useUpdate: useAtualizarFornecedor,
    useDelete: useExcluirFornecedor,
  },

  excel: {
    templateHeaders: ['Nome', 'CNPJ', 'Telefone', 'E-mail', 'Observações', 'Ativo (sim/não)'],
    templateExample: [
      'Materiais Brasil Ltda',
      '12.345.678/0001-90',
      '(69) 99999-9999',
      'comercial@materiaisbrasil.com',
      '',
      'sim',
    ],
    templateColWidths: [32, 22, 18, 28, 28, 14],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const cnpjRaw = parseStr(row[1]);
      const telRaw = parseStr(row[2]);
      const email = parseStr(row[3]);
      const observacoes = parseStr(row[4]);
      const ativoRaw = parseStr(row[5]).toLowerCase();

      if (!nome) erros.push('Nome obrigatório');

      const cnpj = cnpjRaw ? formatCNPJ(cnpjRaw) : '';
      const telefone = telRaw ? formatTelefone(telRaw) : '';
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);

      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, cnpj, telefone, email, observacoes, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): Fornecedor => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        cnpj: String(d.cnpj ?? ''),
        telefone: String(d.telefone ?? ''),
        email: String(d.email ?? ''),
        observacoes: String(d.observacoes ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_fornecedores',
    edit: 'editar_fornecedores',
    delete: 'excluir_fornecedores',
  },
};
