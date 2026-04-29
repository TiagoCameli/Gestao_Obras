import {
  useDepositos,
  useAdicionarDeposito,
  useAtualizarDeposito,
  useExcluirDeposito,
} from '../../../hooks/useDepositos';
import { useObras } from '../../../hooks/useObras';
import type { Deposito, Obra } from '../../../types';
import type { EntityConfig, FieldOption } from '../types';
import { parseStr, parseNumero, type ParsedRow } from '../../../components/ui/ImportExcelModal';

export const tanquesConfig: EntityConfig<Deposito> = {
  slug: 'tanques',
  singular: 'Tanque de combustível',
  plural: 'Tanques de combustível',
  description: 'Depósitos de combustível por obra (capacidade e nível atual).',
  category: 'frota',
  accent: 'amber',
  searchKey: 'nome',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h12v18H3z" />
      <path d="M15 8h3l3 3v10h-6" />
      <circle cx="9" cy="21" r="1" />
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
    {
      key: 'capacidadeLitros',
      label: 'Capacidade',
      align: 'right',
      render: (d) => `${(d.capacidadeLitros || 0).toLocaleString('pt-BR')} L`,
    },
    {
      key: 'nivelAtualLitros',
      label: 'Nível',
      align: 'right',
      hideOnMobile: true,
      render: (d) => `${(d.nivelAtualLitros || 0).toLocaleString('pt-BR')} L`,
    },
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
    { key: 'capacidadeLitros', label: 'Capacidade (litros)', type: 'number', required: true },
    { key: 'nivelAtualLitros', label: 'Nível atual (litros)', type: 'number' },
    { key: 'ativo', label: 'Tanque ativo', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({
    nome: '',
    obraId: '',
    capacidadeLitros: 0,
    nivelAtualLitros: 0,
    ativo: true,
    criadoPor: '',
  }),

  hooks: {
    useList: useDepositos,
    useAdd: useAdicionarDeposito,
    useUpdate: useAtualizarDeposito,
    useDelete: useExcluirDeposito,
  },

  excel: {
    templateHeaders: ['Nome', 'Obra (nome exato)', 'Capacidade (L)', 'Nível atual (L)', 'Ativo (sim/não)'],
    templateExample: ['Tanque Diesel 1', 'Pavimentação BR-364', 5000, 0, 'sim'],
    templateColWidths: [22, 28, 16, 16, 12],
    parseRow: (row, index): ParsedRow => {
      const erros: string[] = [];
      const nome = parseStr(row[0]);
      if (!nome) erros.push('Nome obrigatório');
      return {
        valido: erros.length === 0,
        erros,
        resumo: nome || `(linha ${index + 2})`,
        dados: { nome },
      };
    },
    useBoundParser: () => {
      const { data: obras = [] } = useObras();
      return (row, index) => {
        const erros: string[] = [];
        const nome = parseStr(row[0]);
        const obraName = parseStr(row[1]);
        const capacidadeLitros = parseNumero(row[2]) ?? 0;
        const nivelAtualLitros = parseNumero(row[3]) ?? 0;
        const ativoRaw = parseStr(row[4]).toLowerCase();
        if (!nome) erros.push('Nome obrigatório');
        const obra = obras.find((o: Obra) => o.nome.toLowerCase() === obraName.toLowerCase());
        if (!obraName) erros.push('Obra obrigatória');
        else if (!obra) erros.push(`Obra "${obraName}" não encontrada`);
        if (capacidadeLitros <= 0) erros.push('Capacidade inválida');
        const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
        return {
          valido: erros.length === 0,
          erros,
          resumo: nome || `(linha ${index + 2})`,
          dados: { nome, obraId: obra?.id ?? '', capacidadeLitros, nivelAtualLitros, ativo },
        };
      };
    },
    toEntity: (row, gerarId, criadoPor): Deposito => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        obraId: String(d.obraId ?? ''),
        capacidadeLitros: Number(d.capacidadeLitros) || 0,
        nivelAtualLitros: Number(d.nivelAtualLitros) || 0,
        ativo: Boolean(d.ativo),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_tanques',
    edit: 'editar_tanques',
    delete: 'excluir_tanques',
  },
};
