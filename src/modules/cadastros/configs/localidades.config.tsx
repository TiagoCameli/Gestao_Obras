import {
  useLocalidades,
  useAdicionarLocalidade,
  useAtualizarLocalidade,
  useExcluirLocalidade,
} from '../../../hooks/useLocalidades';
import type { Localidade } from '../../../types';
import type { EntityConfig } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const localidadesConfig: EntityConfig<Localidade> = {
  slug: 'localidades',
  singular: 'Localidade',
  plural: 'Localidades',
  description: 'Origens e destinos usados em fretes.',
  category: 'obra',
  genderFem: true,
  accent: 'green',
  searchKey: 'nome',
  searchKey2: 'endereco',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-8-7-8-13a8 8 0 0 1 16 0c0 6-8 13-8 13z" />
      <circle cx="12" cy="9" r="3" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'endereco', label: 'Endereço', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (l) =>
        l.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativa</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativa</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, colSpan: 2 },
    { key: 'endereco', label: 'Endereço', type: 'text', colSpan: 2 },
    { key: 'ativo', label: 'Localidade ativa', type: 'checkbox' },
  ],

  defaultValues: () => ({
    nome: '',
    endereco: '',
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useLocalidades,
    useAdd: useAdicionarLocalidade,
    useUpdate: useAtualizarLocalidade,
    useDelete: useExcluirLocalidade,
  },

  excel: {
    templateHeaders: ['Nome', 'Endereço', 'Ativa (sim/não)'],
    templateExample: ['Cuiabá Centro', 'Av. Brasil 1000', 'sim'],
    templateColWidths: [26, 32, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      const endereco = parseStr(row[1]);
      const ativoRaw = parseStr(row[2]).toLowerCase();
      if (!nome) erros.push('Nome obrigatório');
      const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, endereco, ativo },
      };
    },
    toEntity: (row, gerarId, criadoPor): Localidade => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        endereco: String(d.endereco ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_localidades',
    edit: 'editar_localidades',
    delete: 'excluir_localidades',
  },
};
