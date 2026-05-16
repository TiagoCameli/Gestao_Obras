/**
 * OrdemCompraFormV2 — formulário premium de Ordem de Compra.
 *
 * Workflow de aprovação SEPARADO (decisão 2-b):
 *   1. Quem cria salva como `aprovada=false` (status='emitida')
 *   2. Botão "Aprovar OC" aparece para quem tem `aprovar_ordem_compra`
 *      (ele vê tanto na lista quanto dentro do form de edição)
 *   3. Ao aprovar: aprovada=true, aprovada_por, aprovada_em e o trigger do BD
 *      marca lancamento_financeiro_status='pendente' automaticamente
 *
 * Destinos com regras (ver REGRAS_DESTINO em comprasValidator):
 *   - obra_etapa            → obra + etapa  | Material + Serviço
 *   - obra_deposito         → obra + dep    | Material apenas
 *   - deposito_central      → dep central   | Material apenas
 *   - sede                  → ---           | Material + Serviço
 *   - manutencao_equipamento→ equip + dep   | Material (almox) + Serviço
 *
 * Os campos extras aparecem/somem dinamicamente conforme o destino escolhido.
 * Itens incompatíveis com o destino são bloqueados na validação.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trash2, Plus, AlertCircle, Calendar, FileText, Truck, Banknote, FileDown,
  CheckCircle2, ShoppingCart, Building2, Warehouse, Briefcase, Wrench,
} from 'lucide-react';
import type {
  OrdemCompra,
  ItemOrdemCompra,
  Obra,
  EtapaObra,
  Equipamento,
  Fornecedor,
  Insumo,
  TipoItemCompra,
  TipoDestinoOC,
  DepositoMaterial,
} from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  REGRAS_DESTINO,
  validarOrdemCompra,
  validarItemNoDestino,
  buscarInsumosSimilares,
} from '../../utils/comprasValidator';
import { gerarPdfOrdemCompra } from '../../utils/comprasPdf';

interface Props {
  initial: OrdemCompra | null;
  obras: Obra[];
  etapas: EtapaObra[];
  fornecedores: Fornecedor[];
  insumos: Insumo[];
  equipamentos: Equipamento[];
  depositosMaterial: DepositoMaterial[];
  proximoNumero: string;
  onSubmit: (oc: OrdemCompra) => Promise<void>;
  onCancel: () => void;
  onCreateFornecedor: (nome: string) => Promise<string>;
  /** Aprovação separada (decisão 2-b): quem tem aprovar_ordem_compra clica isso */
  onAprovar?: (oc: OrdemCompra) => Promise<void>;
  /** Geração de lançamento financeiro */
  onGerarLancamento?: (oc: OrdemCompra) => void;
}

const DESTINOS: { value: TipoDestinoOC; label: string; Icon: typeof Building2; sub: string }[] = [
  { value: 'obra_etapa',             label: 'Obra (etapa específica)', Icon: Building2, sub: 'Material + Serviço' },
  { value: 'obra_deposito',          label: 'Obra (depósito)',         Icon: Warehouse, sub: 'Apenas material' },
  { value: 'deposito_central',       label: 'Depósito Central',        Icon: Warehouse, sub: 'Apenas material' },
  { value: 'sede',                   label: 'Sede da empresa',         Icon: Briefcase, sub: 'Material + Serviço' },
  { value: 'manutencao_equipamento', label: 'Manutenção de equipamento', Icon: Wrench,  sub: 'Material (almox) + Serviço' },
];

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

export default function OrdemCompraFormV2({
  initial, obras, etapas, fornecedores, insumos, equipamentos, depositosMaterial,
  proximoNumero, onSubmit, onCancel, onCreateFornecedor, onAprovar, onGerarLancamento,
}: Props) {
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();
  void onCreateFornecedor;
  const podeAprovar = temAcao('aprovar_ordem_compra');

  const [numero] = useState(initial?.numero || proximoNumero);
  const [dataCriacao, setDataCriacao] = useState(initial?.dataCriacao || new Date().toISOString().slice(0, 10));
  const [dataEntrega, setDataEntrega] = useState(initial?.dataEntrega || '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId || '');
  const [empresaFaturamento, setEmpresaFaturamento] = useState(initial?.empresaFaturamento || '');
  const [tipoDestino, setTipoDestino] = useState<TipoDestinoOC | ''>(initial?.tipoDestino || '');
  const [obraId, setObraId] = useState(initial?.obraId || '');
  const [etapaObraId, setEtapaObraId] = useState(initial?.etapaObraId || '');
  const [depositoDestinoId, setDepositoDestinoId] = useState(initial?.depositoDestinoId || '');
  const [equipamentoId, setEquipamentoId] = useState(initial?.equipamentoId || '');

  const [itens, setItens] = useState<ItemOrdemCompra[]>(
    initial?.itens && initial.itens.length > 0 ? initial.itens : []
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

  // ── Cálculos ───────────────────────────────────────────────────────────
  const totalMateriais = useMemo(
    () => itens.reduce((sum, it) => sum + (it.precoUnitario * it.quantidade), 0),
    [itens]
  );
  const totalGeral = useMemo(
    () => totalMateriais + custoFrete + custoOutras + custoImpostos - custoDesconto,
    [totalMateriais, custoFrete, custoOutras, custoImpostos, custoDesconto]
  );

  const regra = tipoDestino ? REGRAS_DESTINO[tipoDestino] : null;

  // Etapas filtradas pela obra escolhida
  const etapasDaObra = useMemo(
    () => etapas.filter((e) => e.obraId === obraId),
    [etapas, obraId]
  );

  // ── Item helpers ───────────────────────────────────────────────────────
  const adicionarItem = useCallback(() => setItens((prev) => [...prev, novoItem()]), []);
  const atualizarItem = useCallback((id: string, patch: Partial<ItemOrdemCompra>) => {
    setItens((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      next.subtotal = next.precoUnitario * next.quantidade;
      return next;
    }));
  }, []);
  const removerItem = useCallback((id: string) => {
    setItens((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // Quando muda destino, limpa campos extras inválidos
  useEffect(() => {
    if (!regra) return;
    if (!regra.exigeObra && obraId) setObraId('');
    if (!regra.exigeEtapa && etapaObraId) setEtapaObraId('');
    if (!regra.exigeDeposito && depositoDestinoId) setDepositoDestinoId('');
    if (!regra.exigeEquipamento && equipamentoId) setEquipamentoId('');
  }, [regra, obraId, etapaObraId, depositoDestinoId, equipamentoId]);

  // ── Construir OC ───────────────────────────────────────────────────────
  const construirOC = useCallback((overrides: Partial<OrdemCompra> = {}): OrdemCompra => ({
    id: initial?.id || genId(),
    numero,
    dataCriacao,
    dataEntrega,
    obraId,
    etapaObraId,
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
    tipoDestino: tipoDestino || undefined,
    equipamentoId: equipamentoId || undefined,
    depositoDestinoId: depositoDestinoId || undefined,
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
  }), [initial, numero, dataCriacao, dataEntrega, obraId, etapaObraId, fornecedorId,
       itens, custoFrete, custoOutras, custoImpostos, custoDesconto,
       totalMateriais, totalGeral, condicaoPagamento, formaPagamento,
       prazoEntrega, observacoes, empresaFaturamento, tipoDestino,
       equipamentoId, depositoDestinoId, usuario]);

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const oc = construirOC();
    const v = validarOrdemCompra(oc);
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
  }, [construirOC, onSubmit, showToast]);

  const handleAprovar = async () => {
    if (!onAprovar) return;
    const oc = construirOC();
    const v = validarOrdemCompra(oc);
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
      {/* ── Banner financeiro pendente ──────────────────────────────────── */}
      {initial && lancamentoStatus === 'pendente' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
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
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Lançamento financeiro registrado{initial.lancadoFinanceiroPor ? ` por ${initial.lancadoFinanceiroPor}` : ''}.
        </div>
      )}

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
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
          <Input value={empresaFaturamento} onChange={(e) => setEmpresaFaturamento(e.target.value)} placeholder="EMT Construtora" />
        </div>
      </header>

      {/* ── Destino ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader titulo="Destino da compra" subtitulo="Define onde os itens vão e quais campos extras são exigidos" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {DESTINOS.map(({ value, label, Icon, sub }) => {
            const ativo = tipoDestino === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTipoDestino(value)}
                className={
                  'p-3 rounded-xl border text-left transition-colors ' +
                  (ativo
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]')
                }
              >
                <Icon className={`w-4 h-4 mb-1.5 ${ativo ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'}`} />
                <div className="text-xs font-semibold text-[var(--color-fg)]">{label}</div>
                <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">{sub}</div>
              </button>
            );
          })}
        </div>

        {/* Campos extras dinâmicos por destino */}
        {regra && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {regra.exigeObra && (
              <div>
                <Label>Obra <span className="text-rose-500">*</span></Label>
                <select
                  value={obraId}
                  onChange={(e) => { setObraId(e.target.value); setEtapaObraId(''); }}
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
                  value={etapaObraId}
                  onChange={(e) => setEtapaObraId(e.target.value)}
                  required
                  disabled={!obraId}
                  className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] disabled:bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                >
                  <option value="">{obraId ? '— selecione —' : 'Selecione a obra primeiro'}</option>
                  {etapasDaObra.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
                </select>
              </div>
            )}
            {regra.exigeDeposito && (
              <div>
                <Label>
                  Depósito {tipoDestino === 'manutencao_equipamento' ? '(almoxarifado)' : 'destino'} <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={depositoDestinoId}
                  onChange={(e) => setDepositoDestinoId(e.target.value)}
                  required
                  className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                >
                  <option value="">— selecione —</option>
                  {depositosMaterial.map((d) => (<option key={d.id} value={d.id}>{d.nome}</option>))}
                </select>
              </div>
            )}
            {regra.exigeEquipamento && (
              <div>
                <Label>Equipamento <span className="text-rose-500">*</span></Label>
                <select
                  value={equipamentoId}
                  onChange={(e) => setEquipamentoId(e.target.value)}
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
      </section>

      {/* ── Itens ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader titulo="Itens" actionLabel="Adicionar item" onAction={adicionarItem} />
        {itens.length === 0 ? (
          <button
            type="button"
            onClick={adicionarItem}
            className="w-full py-6 rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors text-sm flex flex-col items-center gap-1.5"
          >
            <Plus className="w-5 h-5" /> Adicionar primeiro item
          </button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
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
                {itens.map((item) => (
                  <ItemOCRow
                    key={item.id}
                    item={item}
                    insumos={insumos}
                    destino={tipoDestino || undefined}
                    onChange={(patch) => atualizarItem(item.id, patch)}
                    onRemove={() => removerItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Custos adicionais + Totais ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader titulo="Custos adicionais" />
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
            <ResumoLinha label="Total materiais/serviços" valor={totalMateriais} />
            <ResumoLinha label="+ Frete" valor={custoFrete} />
            <ResumoLinha label="+ Outras despesas" valor={custoOutras} />
            <ResumoLinha label="+ Impostos" valor={custoImpostos} />
            <ResumoLinha label="− Desconto" valor={custoDesconto} />
            <div className="h-px bg-[var(--color-border)] my-2" />
            <ResumoLinha label="TOTAL GERAL" valor={totalGeral} bold />
          </div>
        </div>
      </section>

      {/* ── Pagamento + observações ───────────────────────────────────── */}
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
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        {initial?.id && (
          <Button type="button" variant="secondary" onClick={handlePdf}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting || aprovando}>
          Cancelar
        </Button>
        <Button type="submit" variant="secondary" disabled={submitting || aprovando}>
          <ShoppingCart className="w-4 h-4" />
          {submitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Salvar OC'}
        </Button>
        {/* Botão de aprovação aparece pra quem tem permissão e a OC ainda não foi aprovada */}
        {podeAprovar && initial && !initial.aprovada && onAprovar && (
          <Button type="button" onClick={handleAprovar} disabled={submitting || aprovando}>
            <CheckCircle2 className="w-4 h-4" />
            {aprovando ? 'Aprovando…' : 'Aprovar OC'}
          </Button>
        )}
      </div>

      {/* Hint sobre Truck pra evitar warning de import não utilizado */}
      <span className="hidden"><Truck /></span>
    </form>
  );
}

// ─────────────────────────── auxiliares ──────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
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
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] tracking-tight">{titulo}</h3>
        {subtitulo && <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">{subtitulo}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ResumoLinha({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-[var(--color-fg)] font-semibold' : 'text-[var(--color-fg-muted)]'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
    </div>
  );
}

function ItemOCRow({
  item, insumos, destino, onChange, onRemove,
}: {
  item: ItemOrdemCompra;
  insumos: Insumo[];
  destino?: TipoDestinoOC;
  onChange: (patch: Partial<ItemOrdemCompra>) => void;
  onRemove: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const sugestoes = useMemo(() => {
    if (item.descricao.trim().length < 2) return [];
    return buscarInsumosSimilares(item.descricao, insumos, 4);
  }, [item.descricao, insumos]);

  // Validação visual: se item incompatível com destino, mostra hint
  const incompatibilidade = destino ? validarItemNoDestino(item, destino) : { ok: true };
  const tipo = item.tipo ?? 'material';

  return (
    <tr className={'hover:bg-[var(--color-surface-2)]/40 transition-colors ' + (!incompatibilidade.ok ? 'bg-rose-50/40 dark:bg-rose-950/20' : '')}>
      <td className="px-3 py-2 align-top relative">
        <input
          type="text"
          value={item.descricao}
          onChange={(e) => { onChange({ descricao: e.target.value }); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar ou digitar…"
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        />
        {!incompatibilidade.ok && 'erro' in incompatibilidade && (
          <div className="text-[11px] text-rose-700 mt-0.5 ml-2.5">
            ⚠ {incompatibilidade.erro}
          </div>
        )}
        {aberto && sugestoes.length > 0 && (
          <div className="absolute z-30 left-2 right-2 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg max-h-48 overflow-auto">
            {sugestoes.map((s) => {
              const ins = insumos.find((i) => i.id === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => {
                    onChange({
                      descricao: s.nome,
                      unidade: ins?.unidade ?? item.unidade,
                      insumoId: s.id,
                    });
                    setAberto(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                >
                  {s.nome}
                </button>
              );
            })}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={tipo}
          onChange={(e) => onChange({ tipo: e.target.value as TipoItemCompra })}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)]"
        >
          <option value="material">Material</option>
          <option value="servico">Serviço</option>
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
