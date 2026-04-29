import {
  useEmpresas,
  useAdicionarEmpresa,
  useAtualizarEmpresa,
  useExcluirEmpresa,
} from '../../../hooks/useEmpresas';
import type { Empresa } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';
import { formatCNPJ } from '../utils';

export const empresasConfig: EntityConfig<Empresa> = {
  slug: 'empresas',
  singular: 'Empresa',
  plural: 'Empresas',
  description: 'Empresas terceiras (frota terceirizada, mão de obra).',
  category: 'pessoas',
  genderFem: true,
  accent: 'purple',
  searchKey: 'nome',
  searchKey2: 'cnpj',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h6" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'cnpj', label: 'CNPJ', hideOnMobile: true },
    { key: 'areaAtuacao', label: 'Área de atuação', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (e) =>
        e.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativa</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativa</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Razão social / Nome', type: 'text', required: true, colSpan: 2 },
    { key: 'cnpj', label: 'CNPJ', type: 'cnpj' },
    { key: 'areaAtuacao', label: 'Área de atuação', type: 'text' },
    { key: 'endereco', label: 'Endereço', type: 'text', colSpan: 2 },
    { key: 'ativo', label: 'Empresa ativa', type: 'checkbox' },
  ],

  defaultValues: () => ({
    nome: '',
    cnpj: '',
    endereco: '',
    areaAtuacao: '',
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useEmpresas,
    useAdd: useAdicionarEmpresa,
    useUpdate: useAtualizarEmpresa,
    useDelete: useExcluirEmpresa,
  },

  excel: {
    templateHeaders: ['Nome', 'CNPJ', 'Área de atuação', 'Endereço', 'Ativa (sim/não)'],
    templateExample: ['Transportes Sul Ltda', '12.345.678/0001-90', 'Frota terceirizada', 'Av. Brasil 200', 'sim'],
    templateColWidths: [30, 22, 22, 28, 14],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const cnpjRaw = parseStr(row[1]);
      const areaAtuacao = parseStr(row[2]);
      const endereco = parseStr(row[3]);
      const ativoRaw = parseStr(row[4]).toLowerCase();
      if (!nome) erros.push('Nome obrigatório');
      const cnpj = cnpjRaw ? formatCNPJ(cnpjRaw) : '';
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, cnpj, areaAtuacao, endereco, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): Empresa => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        cnpj: String(d.cnpj ?? ''),
        areaAtuacao: String(d.areaAtuacao ?? ''),
        endereco: String(d.endereco ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_empresas',
    edit: 'editar_empresas',
    delete: 'excluir_empresas',
  },
};
