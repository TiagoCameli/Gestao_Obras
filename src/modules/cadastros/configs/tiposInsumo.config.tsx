import {
  useTiposInsumo,
  useAdicionarTipoInsumo,
  useAtualizarTipoInsumo,
  useExcluirTipoInsumo,
} from '../../../hooks/useTiposInsumo';
import type { TipoInsumoEntity } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const tiposInsumoConfig: EntityConfig<TipoInsumoEntity> = {
  slug: 'tipos-insumo',
  singular: 'Tipo de insumo',
  plural: 'Tipos de insumo',
  description: 'Categorias usadas para classificar insumos (combustível, material, etc.).',
  category: 'materiais',
  accent: 'blue',
  searchKey: 'nome',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'valor', label: 'Valor (slug)', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (t) =>
        t.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativo</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativo</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Combustível' },
    { key: 'valor', label: 'Valor (slug)', type: 'text', required: true, placeholder: 'combustivel' },
    { key: 'ativo', label: 'Tipo ativo', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({ nome: '', valor: '', ativo: true, criadoPor: '' }),

  hooks: {
    useList: useTiposInsumo,
    useAdd: useAdicionarTipoInsumo,
    useUpdate: useAtualizarTipoInsumo,
    useDelete: useExcluirTipoInsumo,
  },

  excel: {
    templateHeaders: ['Nome', 'Valor (slug)', 'Ativo (sim/não)'],
    templateExample: ['Combustível', 'combustivel', 'sim'],
    templateColWidths: [22, 22, 12],
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
    toEntity: (row, gerarId, criadoPor): TipoInsumoEntity => {
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
    create: 'criar_tipos_insumo',
    edit: 'editar_tipos_insumo',
    delete: 'excluir_tipos_insumo',
  },
};
