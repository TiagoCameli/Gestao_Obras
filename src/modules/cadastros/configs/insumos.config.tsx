import {
  useInsumos,
  useAdicionarInsumo,
  useAtualizarInsumo,
  useExcluirInsumo,
} from '../../../hooks/useInsumos';
import { useTiposInsumo } from '../../../hooks/useTiposInsumo';
import { useUnidades } from '../../../hooks/useUnidades';
import { useCategoriasMaterial } from '../../../hooks/useCategoriasMaterial';
import type { Insumo } from '../../../types';
import type { EntityConfig, FieldOption } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const insumosConfig: EntityConfig<Insumo> = {
  slug: 'insumos',
  singular: 'Insumo',
  plural: 'Insumos',
  description: 'Itens de consumo e materiais usados nas obras.',
  category: 'materiais',
  accent: 'blue',
  searchKey: 'nome',
  searchKey2: 'descricao',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'tipo', label: 'Tipo', hideOnMobile: true },
    { key: 'unidade', label: 'Unidade', width: '110px' },
    {
      key: 'categoria',
      label: 'Categoria',
      hideOnMobile: true,
      render: (i) => i.categoria || '-',
    },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (i) =>
        i.ativo ? (
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
    { key: 'nome', label: 'Nome do insumo', type: 'text', required: true, colSpan: 2, placeholder: 'Ex.: Cimento CP-II' },
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'select',
      required: true,
      useOptions: () => {
        const { data = [] } = useTiposInsumo();
        return data
          .filter((t) => t.ativo)
          .map<FieldOption>((t) => ({ value: t.valor || t.nome, label: t.nome }));
      },
    },
    {
      key: 'unidade',
      label: 'Unidade de medida',
      type: 'select',
      required: true,
      useOptions: () => {
        const { data = [] } = useUnidades();
        return data
          .filter((u) => u.ativo)
          .map<FieldOption>((u) => ({ value: u.sigla, label: `${u.nome} (${u.sigla})` }));
      },
    },
    {
      key: 'categoria',
      label: 'Categoria de material',
      type: 'select',
      colSpan: 2,
      useOptions: () => {
        const { data = [] } = useCategoriasMaterial();
        return data
          .filter((c) => c.ativo)
          .map<FieldOption>((c) => ({ value: c.nome, label: c.nome }));
      },
    },
    { key: 'descricao', label: 'Descrição', type: 'textarea', colSpan: 2 },
    { key: 'ativo', label: 'Insumo ativo', type: 'checkbox' },
  ],

  defaultValues: () => ({
    nome: '',
    tipo: '',
    unidade: '',
    descricao: '',
    ativo: true,
    criadoPor: '',
    categoria: '',
  }),

  hooks: {
    useList: useInsumos,
    useAdd: useAdicionarInsumo,
    useUpdate: useAtualizarInsumo,
    useDelete: useExcluirInsumo,
  },

  excel: {
    templateHeaders: ['Nome', 'Tipo', 'Unidade (sigla)', 'Categoria', 'Descrição', 'Ativo (sim/não)'],
    templateExample: ['Cimento CP-II', 'material', 'sc', 'Cimento e Aglomerantes', 'Saco 50kg', 'sim'],
    templateColWidths: [30, 18, 14, 26, 28, 14],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const tipo = parseStr(row[1]);
      const unidade = parseStr(row[2]);
      const categoria = parseStr(row[3]);
      const descricao = parseStr(row[4]);
      const ativoRaw = parseStr(row[5]).toLowerCase();

      if (!nome) erros.push('Nome obrigatório');
      if (!tipo) erros.push('Tipo obrigatório');
      if (!unidade) erros.push('Unidade obrigatória');

      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);

      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, tipo, unidade, categoria, descricao, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): Insumo => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        tipo: String(d.tipo ?? ''),
        unidade: String(d.unidade ?? ''),
        descricao: String(d.descricao ?? ''),
        categoria: String(d.categoria ?? '') || undefined,
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_insumos',
    edit: 'editar_insumos',
    delete: 'excluir_insumos',
  },
};
