/**
 * OrdemCompraFormV2 — formulário premium de Ordem de Compra com
 * arquitetura de BLOCOS (v2.5+).
 *
 * Uma OC pode ter MÚLTIPLOS destinos: você pode comprar materiais que vão
 * pra obras/etapas diferentes, peças que vão pro almoxarifado e mão de obra
 * que vai pra uma OS — TUDO numa só OC. Para isso, a OC é dividida em
 * "blocos", cada um com seu próprio destino + sua lista de itens.
 *
 * Cada bloco respeita todas as regras de destino (REGRAS_DESTINO em
 * comprasValidator):
 *   - obra_etapa            → obra + etapa  | Material + Mão de obra
 *   - obra_deposito         → obra + dep    | Material apenas
 *   - deposito_central      → dep central   | Material apenas
 *   - sede                  → ---           | Material + Mão de obra
 *   - manutencao_equipamento→ almox (peças) | Peça (almox) + Mão de obra (OS)
 *   - tanque_combustivel    → tanque        | Combustível apenas
 *
 * Aprovação: única (uma só pra OC inteira). Os efeitos rolam POR ITEM:
 * etapa→custo na etapa, depósito→entrada, OS→registra mão de obra, etc.
 *
 * Custos adicionais (frete/impostos/desconto) são rateados
 * proporcionalmente ao subtotal entre os itens (ver ratearCustosAdicionais).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2, Plus, AlertCircle, Calendar, FileText, Truck, Banknote, FileDown,
  CheckCircle2, ShoppingCart, Building2, Warehouse, Briefcase, Wrench, Fuel,
  PackagePlus, ClipboardPlus, X,
} from 'lucide-react';
import type {
  OrdemCompra,
  ItemOrdemCompra,
  Obra,
  EtapaObra,
  Equipamento,
  Empresa,
  Fornecedor,
  Insumo,
  TipoItemCompra,
  TipoDestinoOC,
  DepositoMaterial,
  Deposito,
  OrdemServico,
} from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import FilterCombobox from '../ui/FilterCombobox';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  REGRAS_DESTINO,
  validarOrdemCompra,
  validarItemNoDestino,
  insumoCabeNoDestino,
} from '../../utils/comprasValidator';
import { gerarPdfOrdemCompra } from '../../utils/comprasPdf';
import { useOrdensServico } from '../../hooks/useOrdensServico';
import PecaFormModal from '../manutencao/almoxarifado/PecaFormModal';
import NovaOSModal from '../manutencao/os/NovaOSModal';
import InsumoQuickModal from './InsumoQuickModal';
import { useCategoriasMaterial } from '../../hooks/useCategoriasMaterial';

interface Props {
  initial: OrdemCompra | null;
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  equipamentos: Equipamento[];
  depositosMaterial: DepositoMaterial[];
  tanquesCombustivel?: Deposito[];
  empresas?: Empresa[];
  proximoNumero: string;
  onSubmit: (oc: OrdemCompra) => Promise<void>;
  onCancel: () => void;
  onCreateFornecedor: (nome: string) => Promise<string>;
  onAprovar?: (oc: OrdemCompra) => Promise<void>;
  onGerarLancamento?: (oc: OrdemCompra) => void;
}

const DESTINOS: { value: TipoDestinoOC; label: string; Icon: typeof Building2; sub: string }[] = [
  { value: 'obra_etapa',             label: 'Obra (etapa específica)', Icon: Building2, sub: 'Material + Mão de obra (vai pra etapa)' },
  { value: 'obra_deposito',          label: 'Obra (depósito)',         Icon: Warehouse, sub: 'Só material — sem combustível' },
  { value: 'deposito_central',       label: 'Depósito Central',        Icon: Warehouse, sub: 'Só material — sem combustível' },
  { value: 'sede',                   label: 'Sede da empresa',         Icon: Briefcase, sub: 'Material + Mão de obra' },
  { value: 'manutencao_equipamento', label: 'Manutenção de equipamento', Icon: Wrench,  sub: 'Peça do almoxarifado · mão de obra pra OS' },
  { value: 'tanque_combustivel',     label: 'Tanque de combustível',   Icon: Fuel,      sub: 'Só combustível — distribuição na saída' },
];

// Mapa rápido pra header dos blocos
const DESTINO_ICON: Record<TipoDestinoOC, typeof Building2> = {
  obra_etapa: Building2,
  obra_deposito: Warehouse,
  deposito_central: Warehouse,
  sede: Briefcase,
  manutencao_equipamento: Wrench,
  tanque_combustivel: Fuel,
};
const DESTINO_LABEL: Record<TipoDestinoOC, string> = {
  obra_etapa: 'Obra (etapa)',
  obra_deposito: 'Obra (depósito)',
  deposito_central: 'Depósito Central',
  sede: 'Sede',
  manutencao_equipamento: 'Manutenção',
  tanque_combustivel: 'Tanque',
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function novoItem(): ItemOrdemCompra {
  return {
    id: genId(),
    descricao: '',
    quantidade: 1,
    unidade: 'un',
    precoUnitario: 0,
    subtotal: 0,
    obraId: '',
    etapaObraId: '',
    tipo: 'material',
    marca: '',
  };
}

/**
 * Bloco visual de destinação na OC — UI state only (no banco viraria
 * apenas o destino preenchido em cada item do array OC.itens).
 */
interface BlocoOC {
  id: string;
  tipoDestino: TipoDestinoOC | '';
  obraId: string;
  etapaObraId: string;
  depositoDestinoId: string;
  equipamentoId: string;
  itens: ItemOrdemCompra[];
}

function novoBloco(destino: TipoDestinoOC | '' = '', semItem = false): BlocoOC {
  return {
    id: genId(),
    tipoDestino: destino,
    obraId: '',
    etapaObraId: '',
    depositoDestinoId: '',
    equipamentoId: '',
    itens: semItem ? [] : [novoItem()],
  };
}

/**
 * Quando carrega uma OC existente, monta os blocos a partir dos itens.
 * Agrupa itens por chave (destino + obra + etapa + depósito + equipamento)
 * preservando a granularidade. OCs antigas (sem destino por item) caem
 * num único bloco com o destino global da OC.
 */
function blocosDeOC(oc: OrdemCompra): BlocoOC[] {
  const grupos = new Map<string, BlocoOC>();
  for (const item of oc.itens) {
    // herda do nível OC pra OCs antigas
    const tipoDestino = item.tipoDestino ?? oc.tipoDestino ?? '';
    const obraId = item.obraId || oc.obraId || '';
    const etapaObraId = item.etapaObraId || oc.etapaObraId || '';
    const depositoDestinoId = item.depositoDestinoId ?? oc.depositoDestinoId ?? '';
    const equipamentoId = item.equipamentoId ?? oc.equipamentoId ?? '';
    const chave = `${tipoDestino}|${obraId}|${etapaObraId}|${depositoDestinoId}|${equipamentoId}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        id: genId(),
        tipoDestino,
        obraId,
        etapaObraId,
        depositoDestinoId,
        equipamentoId,
        itens: [],
      });
    }
    grupos.get(chave)!.itens.push({ ...item });
  }
  const arr = [...grupos.values()];
  return arr.length > 0 ? arr : [novoBloco()];
}

/**
 * Flatten dos blocos: replica os campos contextuais do bloco em cada
 * item, retornando o array final que vai pra OC.itens. Também calcula
 * os campos OC-level (compat retroativa): se há um único destino, copia
 * pra OC; se múltiplos, deixa vazio.
 */
function flattenBlocos(blocos: BlocoOC[]): {
  itens: ItemOrdemCompra[];
  ocFields: {
    tipoDestino?: TipoDestinoOC;
    obraId: string;
    etapaObraId: string;
    depositoDestinoId?: string;
    equipamentoId?: string;
  };
} {
  const itens: ItemOrdemCompra[] = [];
  for (const b of blocos) {
    for (const item of b.itens) {
      itens.push({
        ...item,
        tipoDestino: b.tipoDestino || undefined,
        obraId: b.obraId,
        etapaObraId: b.etapaObraId,
        depositoDestinoId: b.depositoDestinoId || undefined,
        equipamentoId: b.equipamentoId || undefined,
      });
    }
  }
  const destinos = new Set(blocos.map((b) => b.tipoDestino).filter(Boolean));
  if (destinos.size === 1 && blocos.length === 1) {
    const b = blocos[0];
    return {
      itens,
      ocFields: {
        tipoDestino: (b.tipoDestino || undefined) as TipoDestinoOC | undefined,
        obraId: b.obraId,
        etapaObraId: b.etapaObraId,
        depositoDestinoId: b.depositoDestinoId || undefined,
        equipamentoId: b.equipamentoId || undefined,
      },
    };
  }
  // Múltiplos blocos: OC-level fields ficam vazios (a OC é "multi-destino")
  return {
    itens,
    ocFields: {
      tipoDestino: undefined,
      obraId: '',
      etapaObraId: '',
      depositoDestinoId: undefined,
      equipamentoId: undefined,
    },
  };
}

export default function OrdemCompraFormV2({
  initial, obras, etapas, fornecedores, insumos, equipamentos, depositosMaterial,
  tanquesCombustivel = [], empresas = [],
  proximoNumero, onSubmit, onCancel, onCreateFornecedor, onAprovar, onGerarLancamento,
}: Props) {
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();
  void onCreateFornecedor;
  const podeAprovar = temAcao('aprovar_ordem_compra');

  // ── Header da OC ──
  const [numero] = useState(initial?.numero || proximoNumero);
  const [dataCriacao, setDataCriacao] = useState(initial?.dataCriacao || new Date().toISOString().slice(0, 10));
  const [dataEntrega, setDataEntrega] = useState(initial?.dataEntrega || '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId || '');
  const [empresaFaturamento, setEmpresaFaturamento] = useState(initial?.empresaFaturamento || '');

  // ── Blocos ──
  // Inicializa a partir da OC existente (agrupando itens) ou cria 1 bloco vazio.
  const [blocos, setBlocos] = useState<BlocoOC[]>(() =>
    initial ? blocosDeOC(initial) : [novoBloco()]
  );

  const [custoFrete, setCustoFrete] = useState(initial?.custosAdicionais.frete ?? 0);
  const [custoOutras, setCustoOutras] = useState(initial?.custosAdicionais.outrasDespesas ?? 0);
  const [custoImpostos, setCustoImpostos] = useState(initial?.custosAdicionais.impostos ?? 0);
  const [custoDesconto, setCustoDesconto] = useState(initial?.custosAdicionais.desconto ?? 0);

  const [condicaoPagamento, setCondicaoPagamento] = useState(initial?.condicaoPagamento || '');
  const [formaPagamento, setFormaPagamento] = useState(initial?.formaPagamento || '');
  const [prazoEntrega, setPrazoEntrega] = useState(initial?.prazoEntrega || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  const [submitting, setSubmitting] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ── Modais de cadastro rápido ──
  // O id guarda { blocoId, itemId } pra vincular de volta corretamente
  const [pecaModalRef, setPecaModalRef] = useState<{ blocoId: string; itemId: string } | null>(null);
  const [insumoModalRef, setInsumoModalRef] = useState<{ blocoId: string; itemId: string } | null>(null);
  const [insumoModalNomeInicial, setInsumoModalNomeInicial] = useState('');
  const [osModalRef, setOsModalRef] = useState<{ blocoId: string; itemId: string } | null>(null);

  // ── Dados auxiliares ──
  const { data: categoriasMaterial = [] } = useCategoriasMaterial();
  const categoriasOptions = useMemo(
    () => categoriasMaterial
      .filter((c) => c.ativo)
      .map((c) => ({ value: c.valor, label: c.nome })),
    [categoriasMaterial]
  );

  // OSs abertas (precisa só se houver algum bloco com destino manutenção)
  const temBlocoManutencao = useMemo(
    () => blocos.some((b) => b.tipoDestino === 'manutencao_equipamento'),
    [blocos]
  );
  const { data: osList = [] } = useOrdensServico({
    status: temBlocoManutencao
      ? ['rascunho', 'aberta', 'aguardando_pecas', 'em_execucao', 'aguardando_aprovacao']
      : 'todas',
  });
  const osDisponiveis = useMemo(
    () => osList.filter((os) =>
      ['rascunho', 'aberta', 'aguardando_pecas', 'em_execucao', 'aguardando_aprovacao'].includes(os.status)
    ),
    [osList]
  );

  // ── Cálculos ──
  const totalMateriais = useMemo(
    () => blocos.reduce(
      (sum, b) => sum + b.itens.reduce((s, it) => s + (it.precoUnitario * it.quantidade), 0),
      0
    ),
    [blocos]
  );
  const totalGeral = useMemo(
    () => totalMateriais + custoFrete + custoOutras + custoImpostos - custoDesconto,
    [totalMateriais, custoFrete, custoOutras, custoImpostos, custoDesconto]
  );

  // ── Helpers de blocos ──
  const adicionarBloco = useCallback(() => {
    setBlocos((prev) => [...prev, novoBloco()]);
  }, []);

  const removerBloco = useCallback((blocoId: string) => {
    setBlocos((prev) => {
      if (prev.length <= 1) return prev; // sempre pelo menos 1
      return prev.filter((b) => b.id !== blocoId);
    });
  }, []);

  const atualizarBlocoCampo = useCallback(
    (blocoId: string, patch: Partial<Pick<BlocoOC, 'obraId' | 'etapaObraId' | 'depositoDestinoId' | 'equipamentoId'>>) => {
      setBlocos((prev) => prev.map((b) => b.id === blocoId ? { ...b, ...patch } : b));
    },
    []
  );

  /**
   * Troca o destino do bloco. Se houver itens incompatíveis com o novo
   * destino (regras de tipo material/serviço), eles migram automaticamente
   * para um NOVO BLOCO sem destino — assim o usuário não perde nada.
   */
  const mudarDestinoDoBloco = useCallback((blocoId: string, novoDestino: TipoDestinoOC) => {
    setBlocos((prev) => {
      const idx = prev.findIndex((b) => b.id === blocoId);
      if (idx === -1) return prev;
      const bloco = prev[idx];
      const regra = REGRAS_DESTINO[novoDestino];

      // Separa itens compatíveis e incompatíveis com o novo destino
      const compativeis: ItemOrdemCompra[] = [];
      const incompativeis: ItemOrdemCompra[] = [];
      for (const item of bloco.itens) {
        const tipoItem = item.tipo ?? 'material';
        const aceita = tipoItem === 'material' ? regra.aceitaMaterial : regra.aceitaServico;
        if (aceita) compativeis.push(item);
        else incompativeis.push(item);
      }

      // Atualiza o bloco com novo destino e itens compatíveis
      // (também limpa campos contextuais incompatíveis com o destino)
      const blocoAtualizado: BlocoOC = {
        ...bloco,
        tipoDestino: novoDestino,
        obraId: regra.exigeObra ? bloco.obraId : '',
        etapaObraId: regra.exigeEtapa ? bloco.etapaObraId : '',
        depositoDestinoId: (regra.exigeDeposito || novoDestino === 'manutencao_equipamento') ? bloco.depositoDestinoId : '',
        equipamentoId: regra.exigeEquipamento ? bloco.equipamentoId : '',
        itens: compativeis.length > 0 ? compativeis : [novoItem()],
      };

      const novoArr = [...prev];
      novoArr[idx] = blocoAtualizado;

      // Se sobrou item incompatível, cria bloco-auxiliar sem destino com os itens migrados
      if (incompativeis.length > 0) {
        const blocoAux: BlocoOC = {
          id: genId(),
          tipoDestino: '',
          obraId: '',
          etapaObraId: '',
          depositoDestinoId: '',
          equipamentoId: '',
          itens: incompativeis,
        };
        novoArr.splice(idx + 1, 0, blocoAux);
      }
      return novoArr;
    });
  }, []);

  const adicionarItem = useCallback((blocoId: string) => {
    setBlocos((prev) => prev.map((b) =>
      b.id === blocoId ? { ...b, itens: [...b.itens, novoItem()] } : b
    ));
  }, []);

  const atualizarItem = useCallback((blocoId: string, itemId: string, patch: Partial<ItemOrdemCompra>) => {
    setBlocos((prev) => prev.map((b) => {
      if (b.id !== blocoId) return b;
      return {
        ...b,
        itens: b.itens.map((it) => {
          if (it.id !== itemId) return it;
          const next = { ...it, ...patch };
          next.subtotal = next.precoUnitario * next.quantidade;
          return next;
        }),
      };
    }));
  }, []);

  const removerItem = useCallback((blocoId: string, itemId: string) => {
    setBlocos((prev) => prev.map((b) =>
      b.id === blocoId ? { ...b, itens: b.itens.filter((it) => it.id !== itemId) } : b
    ));
  }, []);

  // Limpa campos contextuais quando muda o destino (legacy effect — agora cobrado em mudarDestinoDoBloco).
  // Mantemos um efeito leve só pra etapa quando muda obra.
  useEffect(() => {
    setBlocos((prev) => prev.map((b) => {
      if (b.etapaObraId) {
        // se a etapa não pertence à obra do bloco, limpa
        const etapa = etapas.find((e) => e.id === b.etapaObraId);
        if (etapa && etapa.obraId !== b.obraId) {
          return { ...b, etapaObraId: '' };
        }
      }
      return b;
    }));
  }, [etapas, blocos.length]);

  // ── Construir OC ──
  const construirOC = useCallback((overrides: Partial<OrdemCompra> = {}): OrdemCompra => {
    const { itens, ocFields } = flattenBlocos(blocos);
    return {
      id: initial?.id || genId(),
      numero,
      dataCriacao,
      dataEntrega,
      obraId: ocFields.obraId,
      etapaObraId: ocFields.etapaObraId,
      fornecedorId,
      cotacaoId: initial?.cotacaoId || '',
      pedidoCompraId: initial?.pedidoCompraId || '',
      itens,
      custosAdicionais: {
        frete: custoFrete, outrasDespesas: custoOutras, impostos: custoImpostos, desconto: custoDesconto,
      },
      totalMateriais, totalGeral,
      condicaoPagamento, formaPagamento,
      parcelas: initial?.parcelas || [],
      prazoEntrega,
      status: initial?.status || 'emitida',
      observacoes,
      entradaInsumos: initial?.entradaInsumos ?? false,
      entradaGerada: initial?.entradaGerada ?? false,
      empresaFaturamento,
      aprovada: initial?.aprovada ?? false,
      criadoPor: initial?.criadoPor || usuario?.nome || '',
      tipoDestino: ocFields.tipoDestino,
      equipamentoId: ocFields.equipamentoId,
      depositoDestinoId: ocFields.depositoDestinoId,
      aprovadaPor: initial?.aprovadaPor,
      aprovadaEm: initial?.aprovadaEm,
      canceladaPor: initial?.canceladaPor,
      canceladaEm: initial?.canceladaEm,
      recebidaPor: initial?.recebidaPor,
      recebidaEm: initial?.recebidaEm,
      atualizadoPor: usuario?.nome || '',
      lancamentoFinanceiroStatus: initial?.lancamentoFinanceiroStatus ?? 'nao_aplicavel',
      lancadoFinanceiroEm: initial?.lancadoFinanceiroEm,
      lancadoFinanceiroPor: initial?.lancadoFinanceiroPor,
      lancamentoFinanceiroId: initial?.lancamentoFinanceiroId,
      ...overrides,
    };
  }, [initial, numero, dataCriacao, dataEntrega, fornecedorId, blocos,
       custoFrete, custoOutras, custoImpostos, custoDesconto,
       totalMateriais, totalGeral, condicaoPagamento, formaPagamento,
       prazoEntrega, observacoes, empresaFaturamento, usuario]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const oc = construirOC();
    const v = validarOrdemCompra(oc, insumos, tanquesCombustivel);
    if (!v.ok) {
      setErro(v.erro);
      showToast({ kind: 'error', message: v.erro });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(oc);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [construirOC, onSubmit, showToast, insumos, tanquesCombustivel]);

  const handleAprovar = async () => {
    if (!onAprovar) return;
    const oc = construirOC();
    const v = validarOrdemCompra(oc, insumos, tanquesCombustivel);
    if (!v.ok) {
      setErro(v.erro);
      showToast({ kind: 'error', message: v.erro });
      return;
    }
    setAprovando(true);
    try {
      await onAprovar(oc);
    } finally {
      setAprovando(false);
    }
  };

  const handlePdf = async () => {
    const oc = construirOC();
    const fornecedor = fornecedores.find((f) => f.id === oc.fornecedorId);
    const obra = obras.find((o) => o.id === oc.obraId);
    await gerarPdfOrdemCompra(oc, fornecedor, obra);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const fornecedorAtivo = fornecedores.find((f) => f.id === fornecedorId);
  const lancamentoStatus = initial?.lancamentoFinanceiroStatus ?? 'nao_aplicavel';

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Banner financeiro pendente */}
      {initial && lancamentoStatus === 'pendente' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100">
          <Banknote className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <strong>Aguardando lançamento financeiro.</strong>{' '}
            Esta OC foi aprovada e está pendente de lançamento.
          </div>
          {onGerarLancamento && (
            <button
              type="button"
              onClick={() => onGerarLancamento(construirOC())}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              <Banknote className="w-3.5 h-3.5" /> Gerar lançamento
            </button>
          )}
        </div>
      )}
      {initial && lancamentoStatus === 'lancada' && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Lançamento financeiro registrado{initial.lancadoFinanceiroPor ? ` por ${initial.lancadoFinanceiroPor}` : ''}.
        </div>
      )}

      {/* Cabeçalho */}
      <header className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label>Número</Label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-mono text-[var(--color-fg)]">
            <FileText className="w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
            {numero}
          </div>
        </div>
        <div>
          <Label>Data de criação</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-fg-subtle)] pointer-events-none" />
            <Input type="date" value={dataCriacao} onChange={(e) => setDataCriacao(e.target.value)} className="pl-9" required />
          </div>
        </div>
        <div>
          <Label>Data de entrega prevista</Label>
          <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <Label>Fornecedor <span className="text-rose-500">*</span></Label>
          <select
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            required
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
          >
            <option value="">— selecione —</option>
            {fornecedores.filter((f) => f.ativo !== false).map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          {fornecedorAtivo && (
            <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1">
              {fornecedorAtivo.cnpj && `CNPJ: ${fornecedorAtivo.cnpj} · `}
              {fornecedorAtivo.telefone && `Tel: ${fornecedorAtivo.telefone}`}
            </p>
          )}
        </div>
        <div>
          <Label>Faturar para (empresa)</Label>
          <FilterCombobox
            value={empresaFaturamento}
            onChange={setEmpresaFaturamento}
            options={empresas
              .filter((e) => e.ativo !== false)
              .map((e) => ({
                value: e.nome,
                label: e.cnpj ? `${e.nome} — ${e.cnpj}` : e.nome,
              }))
              .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
            }
            placeholder={empresas.length === 0 ? 'Nenhuma empresa cadastrada' : '— selecione a empresa —'}
          />
        </div>
      </header>

      {/* ── Destinações em blocos ────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Destinações"
          subtitulo={
            blocos.length > 1
              ? `Esta OC tem ${blocos.length} destinos. Cada bloco vai pra um destino diferente.`
              : 'Defina pra onde os itens dessa OC vão. Adicione blocos extras pra dividir entre obras/etapas/depósitos diferentes.'
          }
          actionLabel="Adicionar bloco"
          onAction={adicionarBloco}
        />
        <div className="space-y-4">
          {blocos.map((bloco, idx) => (
            <BlocoCard
              key={bloco.id}
              bloco={bloco}
              idx={idx}
              totalBlocos={blocos.length}
              obras={obras}
              etapas={etapas}
              equipamentos={equipamentos}
              depositosMaterial={depositosMaterial}
              tanquesCombustivel={tanquesCombustivel}
              insumos={insumos}
              osDisponiveis={osDisponiveis}
              onMudarDestino={(d) => mudarDestinoDoBloco(bloco.id, d)}
              onAtualizarCampo={(patch) => atualizarBlocoCampo(bloco.id, patch)}
              onAdicionarItem={() => adicionarItem(bloco.id)}
              onAtualizarItem={(itemId, patch) => atualizarItem(bloco.id, itemId, patch)}
              onRemoverItem={(itemId) => removerItem(bloco.id, itemId)}
              onRemoverBloco={() => removerBloco(bloco.id)}
              onAbrirCadastroPeca={(itemId) => setPecaModalRef({ blocoId: bloco.id, itemId })}
              onAbrirCadastroMaterial={(itemId, descricao) => {
                setInsumoModalNomeInicial(descricao);
                setInsumoModalRef({ blocoId: bloco.id, itemId });
              }}
              onAbrirNovaOS={(itemId) => setOsModalRef({ blocoId: bloco.id, itemId })}
            />
          ))}
        </div>
      </section>

      {/* ── Custos adicionais + Totais ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader
            titulo="Custos adicionais"
            subtitulo="Frete, impostos e descontos são rateados proporcionalmente entre os itens"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frete">
              <Input type="number" step="0.01" min="0" value={custoFrete} onChange={(e) => setCustoFrete(Number(e.target.value))} />
            </Field>
            <Field label="Outras despesas">
              <Input type="number" step="0.01" min="0" value={custoOutras} onChange={(e) => setCustoOutras(Number(e.target.value))} />
            </Field>
            <Field label="Impostos">
              <Input type="number" step="0.01" min="0" value={custoImpostos} onChange={(e) => setCustoImpostos(Number(e.target.value))} />
            </Field>
            <Field label="Desconto">
              <Input type="number" step="0.01" min="0" value={custoDesconto} onChange={(e) => setCustoDesconto(Number(e.target.value))} />
            </Field>
          </div>
        </div>
        <div>
          <SectionHeader titulo="Resumo" />
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 space-y-1.5 text-sm">
            <ResumoLinha label="Total materiais/mão de obra" valor={totalMateriais} />
            <ResumoLinha label="+ Frete" valor={custoFrete} />
            <ResumoLinha label="+ Outras despesas" valor={custoOutras} />
            <ResumoLinha label="+ Impostos" valor={custoImpostos} />
            <ResumoLinha label="− Desconto" valor={custoDesconto} />
            <div className="h-px bg-[var(--color-border)] my-2" />
            <ResumoLinha label="TOTAL GERAL" valor={totalGeral} bold />
          </div>
        </div>
      </section>

      {/* Pagamento + Observações */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Condição de pagamento">
          <Input value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)} placeholder="Ex.: 30/60/90 dias" />
        </Field>
        <Field label="Forma de pagamento">
          <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} placeholder="Boleto / PIX / Transferência" />
        </Field>
        <Field label="Prazo de entrega">
          <Input value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} placeholder="Ex.: 5 dias úteis" />
        </Field>
      </section>

      <section>
        <Label>Observações</Label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </section>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-900 dark:text-rose-100">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {initial?.id && (
            <Button type="button" variant="secondary" onClick={handlePdf}>
              <FileDown className="w-4 h-4" /> Exportar PDF
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting || aprovando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || aprovando}>
            <ShoppingCart className="w-4 h-4" />
            {submitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Salvar OC'}
          </Button>
          {podeAprovar && initial && !initial.aprovada && onAprovar && (
            <Button type="button" onClick={handleAprovar} disabled={submitting || aprovando}>
              <CheckCircle2 className="w-4 h-4" />
              {aprovando ? 'Aprovando…' : 'Aprovar OC'}
            </Button>
          )}
        </div>
      </div>

      {/* Hint sobre Truck pra evitar warning de import não utilizado */}
      <span className="hidden"><Truck /></span>

      {/* ── Modais de cadastro rápido ───────────────────────────── */}
      <PecaFormModal
        open={pecaModalRef !== null}
        onClose={() => setPecaModalRef(null)}
      />
      <InsumoQuickModal
        open={insumoModalRef !== null}
        onClose={() => { setInsumoModalRef(null); setInsumoModalNomeInicial(''); }}
        nomeInicial={insumoModalNomeInicial}
        categorias={categoriasOptions}
        tipoInsumo={
          insumoModalRef
            ? (blocos.find((b) => b.id === insumoModalRef.blocoId)?.tipoDestino === 'tanque_combustivel'
                ? 'combustivel'
                : 'material')
            : 'material'
        }
        onCriado={(novoInsumo) => {
          if (!insumoModalRef) return;
          atualizarItem(insumoModalRef.blocoId, insumoModalRef.itemId, {
            descricao: novoInsumo.nome,
            unidade: novoInsumo.unidade,
            insumoId: novoInsumo.id,
          });
        }}
      />
      <NovaOSModal
        open={osModalRef !== null}
        onClose={() => setOsModalRef(null)}
        equipamentos={equipamentos}
        equipamentoIdInicial={
          osModalRef
            ? blocos.find((b) => b.id === osModalRef.blocoId)?.equipamentoId || undefined
            : undefined
        }
      />
    </form>
  );
}

// ─────────────────────────── BlocoCard ───────────────────────────

interface BlocoCardProps {
  bloco: BlocoOC;
  idx: number;
  totalBlocos: number;
  obras: Obra[];
  etapas: EtapaObra[];
  equipamentos: Equipamento[];
  depositosMaterial: DepositoMaterial[];
  tanquesCombustivel: Deposito[];
  insumos: Insumo[];
  osDisponiveis: OrdemServico[];
  onMudarDestino: (d: TipoDestinoOC) => void;
  onAtualizarCampo: (patch: Partial<Pick<BlocoOC, 'obraId' | 'etapaObraId' | 'depositoDestinoId' | 'equipamentoId'>>) => void;
  onAdicionarItem: () => void;
  onAtualizarItem: (itemId: string, patch: Partial<ItemOrdemCompra>) => void;
  onRemoverItem: (itemId: string) => void;
  onRemoverBloco: () => void;
  onAbrirCadastroPeca: (itemId: string) => void;
  onAbrirCadastroMaterial: (itemId: string, descricao: string) => void;
  onAbrirNovaOS: (itemId: string) => void;
}

function BlocoCard({
  bloco, idx, totalBlocos, obras, etapas, equipamentos, depositosMaterial,
  tanquesCombustivel, insumos, osDisponiveis,
  onMudarDestino, onAtualizarCampo, onAdicionarItem, onAtualizarItem,
  onRemoverItem, onRemoverBloco, onAbrirCadastroPeca, onAbrirCadastroMaterial, onAbrirNovaOS,
}: BlocoCardProps) {
  const regra = bloco.tipoDestino ? REGRAS_DESTINO[bloco.tipoDestino] : null;
  const semDestino = !bloco.tipoDestino;

  // Etapas da obra escolhida no bloco
  const etapasDaObra = useMemo(
    () => etapas.filter((e) => e.obraId === bloco.obraId),
    [etapas, bloco.obraId]
  );

  // Dinâmico: bloco manutenção exige almoxarifado só se houver peça
  const temPecasManutencao = bloco.tipoDestino === 'manutencao_equipamento'
    && bloco.itens.some((it) => (it.tipo ?? 'material') === 'material');
  const mostrarSelectDeposito = (regra?.exigeDeposito ?? false)
    || (bloco.tipoDestino === 'manutencao_equipamento' && temPecasManutencao);

  // Combustível obrigatório do tanque (se houver)
  const tanqueSelecionado = bloco.tipoDestino === 'tanque_combustivel' && bloco.depositoDestinoId
    ? tanquesCombustivel.find((t) => t.id === bloco.depositoDestinoId)
    : undefined;
  const combustivelObrigatorioId = tanqueSelecionado?.combustivelAtualId ?? null;
  const combustivelObrigatorio = combustivelObrigatorioId
    ? insumos.find((i) => i.id === combustivelObrigatorioId)
    : undefined;

  const Icon = bloco.tipoDestino ? DESTINO_ICON[bloco.tipoDestino] : null;
  const resumoCampos = useMemo(() => {
    if (!bloco.tipoDestino) return null;
    const partes: string[] = [];
    if (bloco.obraId) partes.push(obras.find((o) => o.id === bloco.obraId)?.nome ?? '');
    if (bloco.etapaObraId) partes.push(etapas.find((e) => e.id === bloco.etapaObraId)?.nome ?? '');
    if (bloco.depositoDestinoId) {
      const d = depositosMaterial.find((x) => x.id === bloco.depositoDestinoId)
        ?? tanquesCombustivel.find((x) => x.id === bloco.depositoDestinoId);
      // @ts-expect-error união ad-hoc
      if (d) partes.push(d.apelido || d.nome);
    }
    if (bloco.equipamentoId) {
      const eq = equipamentos.find((x) => x.id === bloco.equipamentoId);
      if (eq) partes.push(eq.codigoPatrimonio || eq.modelo || eq.tipo);
    }
    return partes.filter(Boolean).join(' · ');
  }, [bloco, obras, etapas, depositosMaterial, tanquesCombustivel, equipamentos]);

  return (
    <div className={
      'rounded-2xl border bg-[var(--color-surface-1)] transition-colors ' +
      (semDestino
        ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/[0.04]'
        : 'border-[var(--color-border)]')
    }>
      {/* Header do bloco */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className={
            'inline-flex items-center justify-center w-9 h-9 rounded-xl ' +
            (semDestino
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]')
          }>
            {Icon ? <Icon className="w-[18px] h-[18px]" /> : <span className="text-xs font-bold">{idx + 1}</span>}
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
              Bloco {idx + 1} de {totalBlocos}
            </div>
            <div className="text-[14px] font-semibold text-[var(--color-fg)] tracking-tight truncate">
              {bloco.tipoDestino ? DESTINO_LABEL[bloco.tipoDestino] : 'Sem destino — selecione abaixo'}
            </div>
            {resumoCampos && (
              <div className="text-[11px] text-[var(--color-fg-subtle)] truncate">{resumoCampos}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-fg-muted)]">
          <span>{bloco.itens.length} {bloco.itens.length === 1 ? 'item' : 'itens'}</span>
          {totalBlocos > 1 && (
            <button
              type="button"
              onClick={onRemoverBloco}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--color-fg-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 transition-colors"
              title="Remover bloco"
              aria-label="Remover bloco"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo do bloco */}
      <div className="p-4 space-y-4">
        {/* Selector de destino */}
        <div>
          <Label>Destino deste bloco {semDestino && <span className="text-rose-500">*</span>}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {DESTINOS.map(({ value, label, Icon: DIcon, sub }) => {
              const ativo = bloco.tipoDestino === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onMudarDestino(value)}
                  className={
                    'p-2.5 rounded-xl border-2 text-left transition-all ' +
                    (ativo
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]')
                  }
                >
                  <DIcon className={`w-4 h-4 mb-1.5 ${ativo ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'}`} strokeWidth={2} />
                  <div className="text-[11.5px] font-semibold text-[var(--color-fg)] leading-tight">{label}</div>
                  <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5 leading-snug">{sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Banner manutenção */}
        {bloco.tipoDestino === 'manutencao_equipamento' && (
          <div className="px-3.5 py-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] text-[12px] text-amber-900 dark:text-amber-100 leading-relaxed">
            <strong className="font-semibold">Como funciona neste bloco:</strong>{' '}
            Peças precisam estar cadastradas no almoxarifado e entram no estoque.
            Mão de obra não estoca — cada item vincula a uma OS.
            Ao aprovar a OC, os lançamentos rolam automaticamente.
          </div>
        )}

        {/* Campos contextuais do destino */}
        {regra && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {regra.exigeObra && (
              <div>
                <Label>Obra <span className="text-rose-500">*</span></Label>
                <select
                  value={bloco.obraId}
                  onChange={(e) => onAtualizarCampo({ obraId: e.target.value, etapaObraId: '' })}
                  required
                  className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                >
                  <option value="">— selecione —</option>
                  {obras.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
                </select>
              </div>
            )}
            {regra.exigeEtapa && (
              <div>
                <Label>Etapa <span className="text-rose-500">*</span></Label>
                <select
                  value={bloco.etapaObraId}
                  onChange={(e) => onAtualizarCampo({ etapaObraId: e.target.value })}
                  required
                  disabled={!bloco.obraId}
                  className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] disabled:bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                >
                  <option value="">{bloco.obraId ? '— selecione —' : 'Selecione a obra primeiro'}</option>
                  {etapasDaObra.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
                </select>
              </div>
            )}
            {mostrarSelectDeposito && (() => {
              const ehTanque = bloco.tipoDestino === 'tanque_combustivel';
              const ehManutencao = bloco.tipoDestino === 'manutencao_equipamento';
              const labelDep = ehTanque ? 'Tanque destino'
                : ehManutencao ? 'Almoxarifado de peças'
                : 'Depósito destino';
              const depositosFiltrados = ehManutencao
                ? depositosMaterial.filter((d) => d.ativo && d.ehAlmoxarifadoPecas)
                : depositosMaterial.filter((d) => d.ativo && !d.ehAlmoxarifadoPecas);
              const tanquesAtivos = tanquesCombustivel.filter((t) => t.ativo);
              const hint = ehTanque
                ? (combustivelObrigatorio
                    ? `Tanque atualmente com ${combustivelObrigatorio.nome} — só ele pode entrar. Esvazie-o para trocar.`
                    : 'Combustível fica no tanque até ser usado (saídas).')
                : ehManutencao
                  ? 'Peça vai pro almoxarifado e depois é alocada a uma OS específica.'
                  : 'Materiais vão pra esse depósito até serem alocados.';
              return (
                <div>
                  <Label>{labelDep} <span className="text-rose-500">*</span></Label>
                  <select
                    value={bloco.depositoDestinoId}
                    onChange={(e) => onAtualizarCampo({ depositoDestinoId: e.target.value })}
                    required
                    className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                  >
                    <option value="">— selecione —</option>
                    {ehTanque ? (
                      tanquesAtivos.length === 0
                        ? <option disabled>Nenhum tanque cadastrado</option>
                        : tanquesAtivos.map((t) => {
                            const combAtual = t.combustivelAtualId
                              ? insumos.find((i) => i.id === t.combustivelAtualId)
                              : undefined;
                            return (
                              <option key={t.id} value={t.id}>
                                ⛽ {t.apelido || t.nome}
                                {t.capacidadeLitros ? ` (${Math.round(t.nivelAtualLitros || 0)}/${Math.round(t.capacidadeLitros)} L)` : ''}
                                {combAtual ? ` — ${combAtual.nome}` : ' — vazio'}
                              </option>
                            );
                          })
                    ) : (
                      depositosFiltrados.length === 0
                        ? <option disabled>
                            {ehManutencao
                              ? 'Nenhum almoxarifado de peças — cadastre em Depósitos'
                              : 'Nenhum depósito de material cadastrado'}
                          </option>
                        : depositosFiltrados.map((d) => (
                            <option key={d.id} value={d.id}>
                              {ehManutencao ? '🔧' : '📦'} {d.nome}
                            </option>
                          ))
                    )}
                  </select>
                  <p className="text-[10.5px] text-[var(--color-fg-subtle)] mt-0.5">{hint}</p>
                </div>
              );
            })()}
            {regra.exigeEquipamento && (
              <div>
                <Label>Equipamento <span className="text-rose-500">*</span></Label>
                <select
                  value={bloco.equipamentoId}
                  onChange={(e) => onAtualizarCampo({ equipamentoId: e.target.value })}
                  required
                  className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                >
                  <option value="">— selecione —</option>
                  {equipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ` : ''}{eq.modelo || eq.tipo}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Itens do bloco */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-fg-muted)]">
              Itens deste bloco
            </span>
            <button
              type="button"
              onClick={onAdicionarItem}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11.5px] font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </button>
          </div>
          {bloco.itens.length === 0 ? (
            <button
              type="button"
              onClick={onAdicionarItem}
              className="w-full py-5 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors text-sm flex flex-col items-center gap-1.5"
            >
              <Plus className="w-5 h-5" /> Adicionar primeiro item
            </button>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold w-28">Marca</th>
                    <th className="px-3 py-2 text-right font-semibold w-20">Qtd</th>
                    <th className="px-3 py-2 text-left font-semibold w-20">Un</th>
                    <th className="px-3 py-2 text-right font-semibold w-28">Preço unit.</th>
                    <th className="px-3 py-2 text-right font-semibold w-28">Subtotal</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {bloco.itens.map((item) => (
                    <ItemOCRow
                      key={item.id}
                      item={item}
                      insumos={insumos}
                      destino={bloco.tipoDestino || undefined}
                      osDisponiveis={osDisponiveis}
                      equipamentos={equipamentos}
                      combustivelObrigatorioId={combustivelObrigatorioId}
                      combustivelObrigatorioNome={combustivelObrigatorio?.nome}
                      onChange={(patch) => onAtualizarItem(item.id, patch)}
                      onRemove={() => onRemoverItem(item.id)}
                      onAbrirCadastroPeca={() => onAbrirCadastroPeca(item.id)}
                      onAbrirCadastroMaterial={() => onAbrirCadastroMaterial(item.id, item.descricao)}
                      onAbrirNovaOS={() => onAbrirNovaOS(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── auxiliares ──────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10.5px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-[0.06em] mb-1.5">
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({
  titulo, subtitulo, actionLabel, onAction,
}: { titulo: string; subtitulo?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3.5">
      <div>
        <h3 className="text-[15px] font-semibold text-[var(--color-fg)] tracking-tight leading-none">{titulo}</h3>
        {subtitulo && <p className="text-[12px] text-[var(--color-fg-subtle)] mt-1.5 leading-snug">{subtitulo}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ResumoLinha({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <div className={
      `flex items-center justify-between ${
        bold
          ? 'text-[var(--color-fg)] font-semibold text-[15px]'
          : 'text-[13px] text-[var(--color-fg-muted)]'
      }`
    }>
      <span>{label}</span>
      <span className="tabular-nums">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
    </div>
  );
}

function ItemOCRow({
  item, insumos, destino, osDisponiveis, equipamentos,
  combustivelObrigatorioId, combustivelObrigatorioNome,
  onChange, onRemove, onAbrirCadastroPeca, onAbrirCadastroMaterial, onAbrirNovaOS,
}: {
  item: ItemOrdemCompra;
  insumos: Insumo[];
  destino?: TipoDestinoOC;
  osDisponiveis: OrdemServico[];
  equipamentos: Equipamento[];
  combustivelObrigatorioId: string | null;
  combustivelObrigatorioNome?: string;
  onChange: (patch: Partial<ItemOrdemCompra>) => void;
  onRemove: () => void;
  onAbrirCadastroPeca: () => void;
  onAbrirCadastroMaterial: () => void;
  onAbrirNovaOS: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ehManutencao = destino === 'manutencao_equipamento';
  const tipo = item.tipo ?? 'material';

  const inputRef = useRef<HTMLInputElement>(null);
  const [posicaoDropdown, setPosicaoDropdown] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!aberto || !inputRef.current) return;
    const recalcular = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPosicaoDropdown({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    recalcular();
    window.addEventListener('resize', recalcular);
    window.addEventListener('scroll', recalcular, true);
    return () => {
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('scroll', recalcular, true);
    };
  }, [aberto]);

  const insumosFiltrados = useMemo(() => {
    if (tipo !== 'material') return insumos;
    if (ehManutencao) {
      return insumos.filter((i) => i.usadoEmManutencao && i.ativo !== false);
    }
    if (!destino) return insumos.filter((i) => i.ativo !== false);
    if (destino === 'tanque_combustivel' && combustivelObrigatorioId) {
      return insumos.filter((i) => i.id === combustivelObrigatorioId);
    }
    return insumos.filter((i) =>
      i.ativo !== false
      && insumoCabeNoDestino(i.tipo, destino)
      && !i.usadoEmManutencao
    );
  }, [insumos, ehManutencao, tipo, destino, combustivelObrigatorioId]);

  const sugestoes = useMemo(() => {
    const termoRaw = item.descricao.trim();
    if (termoRaw.length === 0) {
      if (tipo === 'material') return insumosFiltrados.slice(0, 15);
      return [];
    }
    const termo = termoRaw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const norm = (s: string) =>
      (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return insumosFiltrados
      .filter((i) =>
        norm(i.nome).includes(termo)
        || norm(i.codigoSku ?? '').includes(termo)
        || norm(i.fabricante ?? '').includes(termo)
      )
      .slice(0, 15);
  }, [item.descricao, insumosFiltrados, tipo]);

  const incompatibilidade = destino ? validarItemNoDestino(item, destino) : { ok: true };

  const exigeInsumoPeca = ehManutencao && tipo === 'material';
  const exigeInsumoMaterial = !ehManutencao && tipo === 'material';
  const exigeQualquerInsumo = exigeInsumoPeca || exigeInsumoMaterial;
  const exigeOSServico = ehManutencao && tipo === 'servico';
  const pecaNaoVinculada = exigeInsumoPeca && !item.insumoId;
  const materialNaoVinculado = exigeInsumoMaterial && !item.insumoId;
  const servicoSemOS = exigeOSServico && !item.osId;
  const temAlertaManutencao = pecaNaoVinculada || materialNaoVinculado || servicoSemOS;

  const osSelecionada = item.osId ? osDisponiveis.find((o) => o.id === item.osId) : undefined;
  const equipamentoDaOS = osSelecionada
    ? equipamentos.find((eq) => eq.id === osSelecionada.equipamentoId)
    : undefined;

  return (
    <tr className={
      'hover:bg-[var(--color-surface-2)]/40 transition-colors ' +
      (!incompatibilidade.ok || temAlertaManutencao ? 'bg-amber-50/40 dark:bg-amber-500/[0.06]' : '')
    }>
      <td className="px-3 py-2 align-top relative">
        <input
          ref={inputRef}
          type="text"
          value={item.descricao}
          onChange={(e) => {
            const desvinculaInsumo = exigeQualquerInsumo && item.insumoId ? { insumoId: undefined } : {};
            onChange({ descricao: e.target.value, ...desvinculaInsumo });
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          placeholder={
            exigeInsumoPeca ? 'Buscar peça cadastrada no almoxarifado…'
              : exigeInsumoMaterial ? 'Buscar material cadastrado…'
              : 'Buscar ou digitar…'
          }
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />

        {exigeInsumoPeca && (
          <div className="flex items-center gap-1.5 mt-0.5 ml-1.5 text-[11px]">
            {item.insumoId ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                ✓ vinculado ao almoxarifado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                ⚠ peça precisa estar cadastrada no almoxarifado
              </span>
            )}
            <button
              type="button"
              onClick={onAbrirCadastroPeca}
              className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
            >
              <PackagePlus className="w-3 h-3" /> Cadastrar peça
            </button>
          </div>
        )}

        {destino === 'tanque_combustivel' && combustivelObrigatorioId && (
          <div className="mt-0.5 ml-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            🔒 Tanque já contém <strong>{combustivelObrigatorioNome || 'esse combustível'}</strong> —
            só ele pode ser comprado pra este tanque. Esvazie-o para trocar.
          </div>
        )}

        {exigeInsumoMaterial && (
          <div className="flex items-center gap-1.5 mt-0.5 ml-1.5 text-[11px]">
            {item.insumoId ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                ✓ {destino === 'tanque_combustivel' ? 'combustível' : 'material'} cadastrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                ⚠ {destino === 'tanque_combustivel' ? 'combustível' : 'material'} precisa estar cadastrado
              </span>
            )}
            <button
              type="button"
              onClick={onAbrirCadastroMaterial}
              className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
            >
              <PackagePlus className="w-3 h-3" /> Cadastrar {destino === 'tanque_combustivel' ? 'combustível' : 'material'}
            </button>
          </div>
        )}
        {exigeOSServico && (
          <div className="flex items-center gap-2 mt-1 ml-1.5 text-[11px]">
            <span className="text-[var(--color-fg-subtle)] whitespace-nowrap">OS:</span>
            <select
              value={item.osId ?? ''}
              onChange={(e) => onChange({ osId: e.target.value || undefined })}
              className="flex-1 min-w-0 h-7 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-1.5 text-[11px] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">— selecione a OS —</option>
              {osDisponiveis.length === 0 && <option disabled>Nenhuma OS aberta</option>}
              {osDisponiveis.map((os) => {
                const eq = equipamentos.find((e) => e.id === os.equipamentoId);
                const eqLabel = eq ? (eq.codigoPatrimonio || eq.modelo || eq.tipo) : '?';
                return (
                  <option key={os.id} value={os.id}>
                    {os.numero} — {eqLabel}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={onAbrirNovaOS}
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
            >
              <ClipboardPlus className="w-3 h-3" /> Nova OS
            </button>
          </div>
        )}
        {osSelecionada && equipamentoDaOS && (
          <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5 ml-2">
            Equipamento: {equipamentoDaOS.codigoPatrimonio ? `${equipamentoDaOS.codigoPatrimonio} — ` : ''}{equipamentoDaOS.modelo || equipamentoDaOS.tipo}
          </div>
        )}

        {!incompatibilidade.ok && 'erro' in incompatibilidade && (
          <div className="text-[11px] text-rose-700 mt-0.5 ml-2.5">
            ⚠ {incompatibilidade.erro}
          </div>
        )}

        {aberto && posicaoDropdown && sugestoes.length > 0 && createPortal(
          <div
            style={{
              position: 'fixed',
              top: posicaoDropdown.top,
              left: posicaoDropdown.left,
              width: posicaoDropdown.width,
              zIndex: 9999,
            }}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl max-h-72 overflow-auto"
            onMouseDown={(e) => e.preventDefault()}
          >
            {tipo === 'material' && (
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-[var(--color-fg-subtle)] border-b border-[var(--color-border)] bg-[var(--color-surface-2)] sticky top-0">
                {destino === 'tanque_combustivel'
                  ? (combustivelObrigatorioId
                      ? `🔒 Travado no combustível atual do tanque`
                      : `Combustíveis cadastrados · ${insumosFiltrados.length} no total`)
                  : ehManutencao
                    ? `Peças cadastradas no almoxarifado · ${insumosFiltrados.length} no total`
                    : `Materiais cadastrados · ${insumosFiltrados.length} no total`}
              </div>
            )}
            {sugestoes.map((ins) => (
              <button
                key={ins.id}
                type="button"
                onClick={() => {
                  onChange({
                    descricao: ins.nome,
                    unidade: ins.unidade ?? item.unidade,
                    insumoId: ins.id,
                  });
                  setAberto(false);
                  inputRef.current?.blur();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] border-b border-[var(--color-border)]/50 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--color-fg)] truncate">{ins.nome}</span>
                  {ins.unidade && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      {ins.unidade}
                    </span>
                  )}
                </div>
                {(ins.codigoSku || ins.fabricante) && (
                  <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">
                    {ins.fabricante && <span>{ins.fabricante}</span>}
                    {ins.codigoSku && <span>{ins.fabricante ? ' · ' : ''}SKU: {ins.codigoSku}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
        {aberto && posicaoDropdown && exigeQualquerInsumo && sugestoes.length === 0 && createPortal(
          <div
            style={{
              position: 'fixed',
              top: posicaoDropdown.top,
              left: posicaoDropdown.left,
              width: posicaoDropdown.width,
              zIndex: 9999,
            }}
            className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/90 shadow-2xl p-3 text-[12px] text-amber-800 dark:text-amber-200"
            onMouseDown={(e) => e.preventDefault()}
          >
            {insumosFiltrados.length === 0
              ? (exigeInsumoPeca
                  ? <>Nenhuma peça cadastrada no almoxarifado ainda.</>
                  : <>Nenhum material cadastrado ainda.</>)
              : (exigeInsumoPeca
                  ? <>Nenhuma peça encontrada com &quot;{item.descricao}&quot;.</>
                  : <>Nenhum material encontrado com &quot;{item.descricao}&quot;.</>)
            }
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                if (exigeInsumoPeca) onAbrirCadastroPeca();
                else onAbrirCadastroMaterial();
              }}
              className="ml-2 underline font-medium hover:text-amber-900"
            >
              {exigeInsumoPeca ? 'Cadastrar nova peça' : 'Cadastrar novo material'}
            </button>
          </div>,
          document.body
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={tipo}
          onChange={(e) => {
            const novoTipo = e.target.value as TipoItemCompra;
            onChange({ tipo: novoTipo, insumoId: undefined, osId: undefined });
          }}
          disabled={destino === 'tanque_combustivel'}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <option value="material">
            {destino === 'tanque_combustivel' ? 'Combustível'
              : ehManutencao ? 'Peça'
              : 'Material'}
          </option>
          {(destino === undefined || REGRAS_DESTINO[destino]?.aceitaServico || tipo === 'servico') && (
            <option value="servico">Mão de obra</option>
          )}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          value={item.marca ?? ''}
          onChange={(e) => onChange({ marca: e.target.value })}
          placeholder="—"
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number" step="any" min="0"
          value={item.quantidade}
          onChange={(e) => onChange({ quantidade: Number(e.target.value) })}
          className="w-full px-2.5 py-1.5 text-sm text-right rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          value={item.unidade}
          onChange={(e) => onChange({ unidade: e.target.value })}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number" step="0.01" min="0"
          value={item.precoUnitario}
          onChange={(e) => onChange({ precoUnitario: Number(e.target.value) })}
          className="w-full px-2.5 py-1.5 text-sm text-right rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
      </td>
      <td className="px-3 py-2 align-top text-right tabular-nums text-sm text-[var(--color-fg)]">
        {item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
      <td className="px-2 py-2 align-top text-center">
        <button
          type="button" onClick={onRemove}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
