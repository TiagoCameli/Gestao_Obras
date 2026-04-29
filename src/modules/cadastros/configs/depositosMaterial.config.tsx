import {
  useDepositosMaterial,
  useAdicionarDepositoMaterial,
  useAtualizarDepositoMaterial,
  useExcluirDepositoMaterial,
} from '../../../hooks/useDepositosMaterial';
import { useObras } from '../../../hooks/useObras';
import type { DepositoMaterial, Obra } from '../../../types';
import type { EntityConfig, FieldOption } from '../types';
import { parseStr, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const depositosMaterialConfig: EntityConfig<DepositoMaterial> = {
  slug: 'depositos-material',
  singular: 'Depósito de material',
  plural: 'Depósitos de material',
  description: 'Locais de armazenagem de insumos por obra.',
  category: 'materiais',
  accent: 'blue',
  searchKey: 'nome',
  searchKey2: 'responsavel',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V11l9-6 9 6v10" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    {
      key: 'obraId',
      label: 'Obra',
      hideOnMobile: true,
      useLookup: () => {
        const { data = [] } = useObras();
        return new Map(data.map((o: Obra) => [o.id, o.nome]));
      },
    },
    { key: 'responsavel', label: 'Responsável', hideOnMobile: true },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (d) =>
        d.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativo</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativo</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, colSpan: 2 },
    {
      key: 'obraId',
      label: 'Obra',
      type: 'select',
      required: true,
      colSpan: 2,
      useOptions: () => {
        const { data = [] } = useObras();
        return data.map<FieldOption>((o) => ({ value: o.id, label: o.nome }));
      },
    },
    { key: 'responsavel', label: 'Responsável', type: 'text' },
    { key: 'endereco', label: 'Endereço', type: 'text' },
    { key: 'ativo', label: 'Depósito ativo', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({
    nome: '',
    obraId: '',
    endereco: '',
    responsavel: '',
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useDepositosMaterial,
    useAdd: useAdicionarDepositoMaterial,
    useUpdate: useAtualizarDepositoMaterial,
    useDelete: useExcluirDepositoMaterial,
  },

  excel: {
    templateHeaders: ['Nome', 'Obra (nome exato)', 'Responsável', 'Endereço', 'Ativo (sim/não)'],
    templateExample: ['Depósito Central', 'Pavimentação BR-364', 'João Silva', 'Canteiro km 100', 'sim'],
    templateColWidths: [24, 28, 22, 28, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      if (!nome) erros.push('Nome obrigatório');
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome, obraName: parseStr(row[1]) },
      };
    },
    useBoundParser: () => {
      const { data: obras = [] } = useObras();
      return (row, index) => {
        const erros: string[] = [];
        const nome = parseStr(row[0]);
        const obraName = parseStr(row[1]);
        const responsavel = parseStr(row[2]);
        const endereco = parseStr(row[3]);
        const ativoRaw = parseStr(row[4]).toLowerCase();
        if (!nome) erros.push('Nome obrigatório');
        const obra = obras.find((o: Obra) => o.nome.toLowerCase() === obraName.toLowerCase());
        if (!obraName) erros.push('Obra obrigatória');
        else if (!obra) erros.push(`Obra "${obraName}" não encontrada`);
        const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
        return {
          valido: erros.length === 0,
          erros,
          resumo: nome || `(linha ${index + 2})`,
          dados: { nome, obraId: obra?.id ?? '', responsavel, endereco, ativo },
        };
      };
    },
    toEntity: (row, gerarId, criadoPor): DepositoMaterial => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        obraId: String(d.obraId ?? ''),
        endereco: String(d.endereco ?? ''),
        responsavel: String(d.responsavel ?? ''),
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_depositos_material',
    edit: 'editar_depositos_material',
    delete: 'excluir_depositos_material',
  },
};
