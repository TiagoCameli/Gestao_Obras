import {
  useTiposEquipamento,
  useAdicionarTipoEquipamento,
  useAtualizarTipoEquipamento,
  useExcluirTipoEquipamento,
} from '../../../hooks/useTiposEquipamento';
import type { TipoEquipamentoEntity } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const tiposEquipamentoConfig: EntityConfig<TipoEquipamentoEntity> = {
  slug: 'tipos-equipamento',
  singular: 'Tipo de equipamento',
  plural: 'Tipos de equipamento',
  description: 'Categorias de máquinas e veículos.',
  category: 'frota',
  accent: 'rose',
  searchKey: 'nome',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'codigo', label: 'Código', hideOnMobile: true },
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
    { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Caminhão Basculante' },
    { key: 'codigo', label: 'Código', type: 'text', placeholder: 'CB' },
    { key: 'ativo', label: 'Tipo ativo', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({ nome: '', codigo: '', ativo: true, criadoPor: '' }),

  hooks: {
    useList: useTiposEquipamento,
    useAdd: useAdicionarTipoEquipamento,
    useUpdate: useAtualizarTipoEquipamento,
    useDelete: useExcluirTipoEquipamento,
  },

  excel: {
    templateHeaders: ['Nome', 'Código', 'Ativo (sim/não)'],
    templateExample: ['Caminhão Basculante', 'CB', 'sim'],
    templateColWidths: [28, 12, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const codigo = parseStr(row[1]);
      const ativoRaw = parseStr(row[2]).toLowerCase();
      if (!nome) erros.push('Nome obrigatório');
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, codigo, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): TipoEquipamentoEntity => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        codigo: String(d.codigo ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_tipos_equipamento',
    edit: 'editar_tipos_equipamento',
    delete: 'excluir_tipos_equipamento',
  },
};
