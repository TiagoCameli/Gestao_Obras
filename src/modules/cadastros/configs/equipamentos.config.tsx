import {
  useEquipamentos,
  useAdicionarEquipamento,
  useAtualizarEquipamento,
  useExcluirEquipamento,
} from '../../../hooks/useEquipamentos';
import { useTiposEquipamento } from '../../../hooks/useTiposEquipamento';
import { useEmpresas } from '../../../hooks/useEmpresas';
import type { Equipamento, Empresa, TipoEquipamentoEntity } from '../../../types';
import type { EntityConfig, FieldOption } from '../types';
import { parseStr, parseNumero, parseData, type ParsedRow } from '../../../components/ui/ImportExcelModal';

const TIPO_MEDICAO_OPTIONS: FieldOption[] = [
  { value: 'horimetro', label: 'Horímetro' },
  { value: 'odometro', label: 'Odômetro' },
  { value: 'km', label: 'KM' },
];

export const equipamentosConfig: EntityConfig<Equipamento> = {
  slug: 'equipamentos',
  singular: 'Equipamento',
  plural: 'Equipamentos',
  description: 'Máquinas, veículos e implementos da frota.',
  category: 'frota',
  accent: 'rose',
  searchKey: 'nome',
  searchKey2: 'codigoPatrimonio',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),

  columns: [
    { key: 'nome', label: 'Nome' },
    {
      key: 'tipo',
      label: 'Tipo',
      hideOnMobile: true,
      useLookup: () => {
        const { data = [] } = useTiposEquipamento();
        return new Map(data.map((t: TipoEquipamentoEntity) => [t.nome, t.nome]));
      },
    },
    { key: 'codigoPatrimonio', label: 'Patrimônio', hideOnMobile: true },
    {
      key: 'empresaId',
      label: 'Empresa',
      hideOnMobile: true,
      useLookup: () => {
        const { data = [] } = useEmpresas();
        return new Map(data.map((e: Empresa) => [e.id, e.nome]));
      },
    },
    {
      key: 'ativo',
      label: 'Status',
      width: '110px',
      render: (e) =>
        e.ativo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">Ativo</span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">Inativo</span>
        ),
    },
  ],

  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, colSpan: 2, groupStart: 'Identificação' },
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'select',
      required: true,
      useOptions: () => {
        const { data = [] } = useTiposEquipamento();
        return data
          .filter((t) => t.ativo)
          .map<FieldOption>((t) => ({ value: t.nome, label: t.nome }));
      },
    },
    {
      key: 'empresaId',
      label: 'Empresa',
      type: 'select',
      useOptions: () => {
        const { data = [] } = useEmpresas();
        return data
          .filter((e) => e.ativo)
          .map<FieldOption>((e) => ({ value: e.id, label: e.nome }));
      },
    },
    { key: 'codigoPatrimonio', label: 'Código de patrimônio', type: 'text' },
    { key: 'numeroSerie', label: 'Número de série', type: 'text' },
    { key: 'marca', label: 'Marca', type: 'text' },
    { key: 'ano', label: 'Ano', type: 'text', placeholder: '2020' },
    { key: 'tipoMedicao', label: 'Tipo de medição', type: 'select', staticOptions: TIPO_MEDICAO_OPTIONS, groupStart: 'Operação' },
    { key: 'medicaoInicial', label: 'Medição inicial', type: 'number' },
    { key: 'dataAquisicao', label: 'Data de aquisição', type: 'date' },
    { key: 'dataVenda', label: 'Data de venda', type: 'date' },
    { key: 'ativo', label: 'Equipamento ativo', type: 'checkbox', colSpan: 2 },
  ],

  defaultValues: () => ({
    nome: '',
    tipo: '',
    empresaId: '',
    codigoPatrimonio: '',
    numeroSerie: '',
    ano: '',
    marca: '',
    tipoMedicao: 'horimetro',
    medicaoInicial: 0,
    ativo: true,
    dataAquisicao: '',
    dataVenda: '',
    criadoPor: '',
  }),

  hooks: {
    useList: useEquipamentos,
    useAdd: useAdicionarEquipamento,
    useUpdate: useAtualizarEquipamento,
    useDelete: useExcluirEquipamento,
  },

  excel: {
    templateHeaders: [
      'Nome',
      'Tipo (nome exato)',
      'Empresa (nome exato)',
      'Patrimônio',
      'Nº Série',
      'Marca',
      'Ano',
      'Tipo medição (horimetro|odometro|km)',
      'Medição inicial',
      'Data aquisição (AAAA-MM-DD)',
      'Data venda (AAAA-MM-DD)',
      'Ativo (sim/não)',
    ],
    templateExample: [
      'Caminhão 01',
      'Caminhão Basculante',
      'Transportes Sul Ltda',
      'PAT-001',
      '1234567',
      'Volvo',
      '2020',
      'odometro',
      0,
      '2024-01-10',
      '',
      'sim',
    ],
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
      const { data: tipos = [] } = useTiposEquipamento();
      const { data: empresas = [] } = useEmpresas();
      return (row, index) => {
        const erros: string[] = [];
        const nome = parseStr(row[0]);
        const tipoName = parseStr(row[1]);
        const empresaName = parseStr(row[2]);
        const codigoPatrimonio = parseStr(row[3]);
        const numeroSerie = parseStr(row[4]);
        const marca = parseStr(row[5]);
        const ano = parseStr(row[6]);
        const tipoMedicaoRaw = parseStr(row[7]).toLowerCase();
        const medicaoInicial = parseNumero(row[8]) ?? 0;
        const dataAquisicao = parseData(row[9]);
        const dataVenda = parseData(row[10]);
        const ativoRaw = parseStr(row[11]).toLowerCase();

        if (!nome) erros.push('Nome obrigatório');
        const tipoOk = tipoName ? tipos.find((t: TipoEquipamentoEntity) => t.nome.toLowerCase() === tipoName.toLowerCase()) : undefined;
        if (tipoName && !tipoOk) erros.push(`Tipo "${tipoName}" não encontrado`);
        const empresa = empresaName ? empresas.find((e: Empresa) => e.nome.toLowerCase() === empresaName.toLowerCase()) : undefined;
        if (empresaName && !empresa) erros.push(`Empresa "${empresaName}" não encontrada`);
        const tipoMedicao = ['horimetro', 'odometro', 'km'].includes(tipoMedicaoRaw) ? tipoMedicaoRaw : 'horimetro';

        const ativo = ativoRaw === '' ? true : ['sim', 's', 'true', '1', 'yes', 'y'].includes(ativoRaw);
        return {
          valido: erros.length === 0,
          erros,
          resumo: nome || `(linha ${index + 2})`,
          dados: {
            nome,
            tipo: tipoOk?.nome ?? '',
            empresaId: empresa?.id ?? '',
            codigoPatrimonio,
            numeroSerie,
            marca,
            ano,
            tipoMedicao,
            medicaoInicial,
            dataAquisicao,
            dataVenda,
            ativo,
          },
        };
      };
    },
    toEntity: (row, gerarId, criadoPor): Equipamento => {
      const d = row.dados as Record<string, unknown>;
      return {
        id: gerarId(),
        nome: String(d.nome ?? ''),
        tipo: String(d.tipo ?? ''),
        empresaId: String(d.empresaId ?? ''),
        codigoPatrimonio: String(d.codigoPatrimonio ?? ''),
        numeroSerie: String(d.numeroSerie ?? ''),
        ano: String(d.ano ?? ''),
        marca: String(d.marca ?? ''),
        tipoMedicao: (d.tipoMedicao as Equipamento['tipoMedicao']) || 'horimetro',
        medicaoInicial: Number(d.medicaoInicial) || 0,
        ativo: Boolean(d.ativo),
        dataAquisicao: String(d.dataAquisicao ?? ''),
        dataVenda: String(d.dataVenda ?? ''),
        criadoPor,
      };
    },
  },

  permissions: {
    create: 'criar_equipamentos',
    edit: 'editar_equipamentos',
    delete: 'excluir_equipamentos',
  },
};
