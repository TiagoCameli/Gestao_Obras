import {
  useCategoriasMaterial,
  useAdicionarCategoriaMaterial,
  useAtualizarCategoriaMaterial,
  useExcluirCategoriaMaterial,
} from '../../../hooks/useCategoriasMaterial';
import type { CategoriaMaterial } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const categoriasMaterialConfig: EntityConfig<CategoriaMaterial> = {
  slug: 'categorias-material',
  singular: 'Categoria de material',
  plural: 'Categorias de material',
  description: 'Agrupamento de materiais para compras e relatórios.',
  category: 'materiais',
  genderFem: true,
  accent: 'blue',
  searchKey: 'nome',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'valor', label: 'Valor (slug)', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (c) =>
        c.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativa</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativa</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Cimento e Aglomerantes' },
    { key: 'valor', label: 'Valor (slug)', type: 'text', required: true, placeholder: 'cimento_aglomerantes' },
    { key: 'ativo', label: 'Categoria ativa', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({ nome: '', valor: '', ativo: true, criadoPor: '' }),

  hooks: {
    useList: useCategoriasMaterial,
    useAdd: useAdicionarCategoriaMaterial,
    useUpdate: useAtualizarCategoriaMaterial,
    useDelete: useExcluirCategoriaMaterial,
  },

  excel: {
    templateHeaders: ['Nome', 'Valor (slug)', 'Ativa (sim/não)'],
    templateExample: ['Cimento e Aglomerantes', 'cimento_aglomerantes', 'sim'],
    templateColWidths: [28, 26, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const valor = parseStr(row[1]) || nome.toLowerCase().replace(/\s+/g, '_');
      const ativoRaw = parseStr(row[2]).toLowerCase();
      if (!nome) erros.push('Nome obrigatório');
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, valor, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): CategoriaMaterial => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        valor: String(d.valor ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_categorias_material',
    edit: 'editar_categorias_material',
    delete: 'excluir_categorias_material',
  },
};
