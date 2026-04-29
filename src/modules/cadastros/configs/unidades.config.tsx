import {
  useUnidades,
  useAdicionarUnidade,
  useAtualizarUnidade,
  useExcluirUnidade,
} from '../../../hooks/useUnidades';
import type { UnidadeMedida } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const unidadesConfig: EntityConfig<UnidadeMedida> = {
  slug: 'unidades',
  singular: 'Unidade de medida',
  plural: 'Unidades de medida',
  description: 'Unidades usadas em insumos, etapas e medições.',
  category: 'materiais',
  genderFem: true,
  accent: 'blue',
  searchKey: 'nome',
  searchKey2: 'sigla',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M3 9h18" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'sigla', label: 'Sigla', width: '120px' },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (u) =>
        u.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativa</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativa</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Saco' },
    { key: 'sigla', label: 'Sigla', type: 'text', required: true, placeholder: 'sc' },
    { key: 'ativo', label: 'Unidade ativa', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({ nome: '', sigla: '', ativo: true, criadoPor: '' }),

  hooks: {
    useList: useUnidades,
    useAdd: useAdicionarUnidade,
    useUpdate: useAtualizarUnidade,
    useDelete: useExcluirUnidade,
  },

  excel: {
    templateHeaders: ['Nome', 'Sigla', 'Ativa (sim/não)'],
    templateExample: ['Saco', 'sc', 'sim'],
    templateColWidths: [22, 12, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const sigla = parseStr(row[1]);
      const ativoRaw = parseStr(row[2]).toLowerCase();
      if (!nome) erros.push('Nome obrigatório');
      if (!sigla) erros.push('Sigla obrigatória');
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, sigla, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): UnidadeMedida => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        sigla: String(d.sigla ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_unidades',
    edit: 'editar_unidades',
    delete: 'excluir_unidades',
  },
};
