/**
 * LancamentoFinanceiroForm — Formulário de lançamento financeiro.
 *
 * Modos:
 *   - 'avulso'  → tudo editável, pelo menos 1 linha de rateio obrigatória
 *                 com destino preenchido (obra+etapa, OS de manutenção, sede)
 *   - 'oc'      → header e rateio TRAVADOS (pré-preenchidos da OC), só
 *                 categoria + forma de pagamento + parcelas + anexos editáveis
 *
 * Estrutura visual (de cima pra baixo):
 *   1. Banner contextual (avulso = info; oc = travado/auditoria)
 *   2. Header: número, datas, fornecedor, empresa, categoria, descrição, total
 *   3. Parcelas (1+ linhas; soma = total)
 *   4. Rateio (1+ linhas; soma = total; valor OU %)
 *   5. Anexos (upload Supabase Storage)
 *   6. Observações
 *
 * Validações antes de salvar (showToast se falhar):
 *   - Fornecedor OU favorecidoNome preenchido
 *   - Valor total > 0
 *   - Soma das parcelas = valor total (tolerância 0.01)
 *   - Soma dos rateios = valor total (tolerância 0.01)
 *   - Cada rateio: obra_etapa exige obraId+etapaObraId; manutencao exige ordemServicoId
 *   - Sede dispensa campos extras
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Plus, Trash2, Banknote, Lock, Paperclip,
  Building2, Wrench, Briefcase, Warehouse, Fuel, X, FileText, Loader2,
} from 'lucide-react';
import type {
  LancamentoFinanceiro,
  ParcelaLancamento,
  RateioLancamento,
  TipoDestinoRateio,
  Fornecedor,
  Empresa,
  Obra,
  EtapaObra,
  OrdemServico,
  Equipamento,
  CategoriaFinanceira,
  FormaPagamentoLancamento,
} from '../../types';
import { supabase } from '../../lib/supabase';
import { useAnexosFinanceiroUrls } from '../../hooks/useFinanceiroAnexos';
import Input from '../ui/Input';
import Button from '../ui/Button';
import SmartSelect from '../ui/SmartSelect';
import ComboboxInput from '../ui/ComboboxInput';
import { useToast } from '../ui/Toast';
import CategoriaFinanceiraQuickModal from './CategoriaFinanceiraQuickModal';

interface Props {
  initial: LancamentoFinanceiro | null;
  modo: 'avulso' | 'oc';
  fornecedores: Fornecedor[];
  empresas: Empresa[];
  obras: Obra[];
  etapas: EtapaObra[];
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  categorias: CategoriaFinanceira[];
  proximoNumero: string;
  onSubmit: (lanc: LancamentoFinanceiro) => Promise<void>;
  onCancel: () => void;
  onCreateFornecedor: (nome: string) => Promise<string>;
  onDirtyChange?: (dirty: boolean) => void;
}

// Opções de tipo de destino do rateio — subset relevante.
const TIPOS_DESTINO: { value: TipoDestinoRateio; label: string; Icon: typeof Building2; sub: string }[] = [
  { value: 'obra_etapa',             label: 'Obra (etapa)',          Icon: Building2, sub: 'Custo da etapa' },
  { value: 'manutencao_equipamento', label: 'Manutenção (OS)',       Icon: Wrench,    sub: 'Custo da OS' },
  { value: 'sede',                   label: 'Sede',                  Icon: Briefcase, sub: 'Administrativo' },
  { value: 'obra_deposito',          label: 'Obra (depósito)',       Icon: Warehouse, sub: 'Estoque obra' },
  { value: 'deposito_central',       label: 'Depósito central',      Icon: Warehouse, sub: 'Estoque geral' },
  { value: 'tanque_combustivel',     label: 'Tanque combustível',    Icon: Fuel,      sub: 'Combustível' },
];

const FORMAS_PAGAMENTO: { value: FormaPagamentoLancamento; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'outros', label: 'Outros' },
];

function novoId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function LancamentoFinanceiroForm({
  initial, modo, fornecedores, empresas, obras, etapas, ordensServico, equipamentos,
  categorias, proximoNumero, onSubmit, onCancel, onCreateFornecedor, onDirtyChange,
}: Props) {
  const { showToast } = useToast();

  const travado = modo === 'oc';

  // ── State ───────────────────────────────────────────────────────────
  const [numero] = useState(initial?.numero || proximoNumero);
  const [dataEmissao, setDataEmissao] = useState(
    initial?.dataEmissao || new Date().toISOString().slice(0, 10),
  );
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId ?? '');
  const [favorecidoNome, setFavorecidoNome] = useState(initial?.favorecidoNome ?? '');
  const [empresaPagadoraId, setEmpresaPagadoraId] = useState(initial?.empresaPagadoraId ?? '');
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [valorTotal, setValorTotal] = useState(initial?.valorTotal ?? 0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoLancamento | string>(
    initial?.formaPagamento ?? 'pix',
  );
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [anexosUrls, setAnexosUrls] = useState<string[]>(initial?.anexosUrls ?? []);
  const signedAnexosUrls = useAnexosFinanceiroUrls(anexosUrls);
  const [parcelas, setParcelas] = useState<ParcelaLancamento[]>(
    initial?.parcelas?.length
      ? initial.parcelas
      : [{
          id: novoId('parc'),
          lancamentoId: initial?.id ?? '',
          numero: 1,
          dataVencimento: new Date().toISOString().slice(0, 10),
          valor: 0,
          status: 'em_aberto',
        }],
  );
  const [rateios, setRateios] = useState<RateioLancamento[]>(
    initial?.rateios?.length ? initial.rateios : [],
  );
  const [uploading, setUploading] = useState(false);
  // Modal de cadastro rápido de categoria financeira (abre via "+ Nova categoria")
  const [novaCategoriaModal, setNovaCategoriaModal] = useState(false);

  // ── Dirty tracking ──────────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => {
    if (!dirty) {
      setDirty(true);
      onDirtyChange?.(true);
    }
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // ── Cálculos derivados ──────────────────────────────────────────────
  const somaParcelas = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const somaRateios = rateios.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const diferencaParcelas = valorTotal - somaParcelas;
  const diferencaRateios = valorTotal - somaRateios;

  // Categorias ativas (inativas só aparecem se já estiver selecionada)
  const categoriasOpcoes = useMemo(() => {
    const ativas = categorias.filter((c) => c.ativo);
    const atual = categorias.find((c) => c.id === categoriaId);
    if (atual && !atual.ativo) return [atual, ...ativas];
    return ativas;
  }, [categorias, categoriaId]);

  // ── Handlers de parcelas ────────────────────────────────────────────
  //
  // Tanto adicionar quanto remover **redistribuem o valor_total igualmente**
  // entre as parcelas resultantes. Isso evita que o usuário tenha que fazer
  // a conta manualmente e mantém a soma sempre batendo com o total.
  // Centavos errantes ficam na última parcela.
  //
  // O usuário pode ainda ajustar manualmente cada parcela depois — só não
  // queremos que clicar em "+/-" deixe a tela com soma desbalanceada.

  /** Helper: redistribui igualmente valorTotal entre N parcelas. */
  function redistribuirIgual(arr: ParcelaLancamento[]): ParcelaLancamento[] {
    const n = arr.length;
    if (n === 0 || valorTotal <= 0) return arr;
    const base = Math.floor((valorTotal / n) * 100) / 100; // 2 casas decimais
    const resto = +(valorTotal - base * n).toFixed(2);
    return arr.map((p, i) => ({
      ...p,
      numero: i + 1,
      valor: i === n - 1 ? +(base + resto).toFixed(2) : base,
    }));
  }

  function adicionarParcela() {
    markDirty();
    const ultimaData = parcelas[parcelas.length - 1]?.dataVencimento || dataEmissao;
    // Próxima parcela: 30 dias depois da última (default razoável)
    const proxData = new Date(ultimaData);
    proxData.setDate(proxData.getDate() + 30);
    setParcelas((prev) => {
      const incluida: ParcelaLancamento[] = [
        ...prev,
        {
          id: novoId('parc'),
          lancamentoId: initial?.id ?? '',
          numero: prev.length + 1,
          dataVencimento: proxData.toISOString().slice(0, 10),
          valor: 0,
          status: 'em_aberto',
        },
      ];
      return redistribuirIgual(incluida);
    });
  }

  function atualizarParcela(idx: number, patch: Partial<ParcelaLancamento>) {
    markDirty();
    setParcelas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function removerParcela(idx: number) {
    if (parcelas.length === 1) {
      showToast({ kind: 'info', message: 'Mantenha pelo menos uma parcela.' });
      return;
    }
    markDirty();
    setParcelas((prev) => {
      const restantes = prev.filter((_, i) => i !== idx);
      return redistribuirIgual(restantes);
    });
  }

  function parcelarIgual(qtd: number) {
    if (qtd < 1 || !valorTotal) {
      showToast({ kind: 'info', message: 'Defina o valor total primeiro.' });
      return;
    }
    markDirty();
    const valorParcela = Math.round((valorTotal / qtd) * 100) / 100;
    // Ajuste de centavos: última parcela compensa a diferença
    const resto = valorTotal - valorParcela * qtd;
    const novas: ParcelaLancamento[] = Array.from({ length: qtd }, (_, i) => {
      const data = new Date(dataEmissao);
      data.setDate(data.getDate() + 30 * (i + 1));
      const valor = i === qtd - 1 ? +(valorParcela + resto).toFixed(2) : valorParcela;
      return {
        id: novoId('parc'),
        lancamentoId: initial?.id ?? '',
        numero: i + 1,
        dataVencimento: data.toISOString().slice(0, 10),
        valor,
        status: 'em_aberto',
      };
    });
    setParcelas(novas);
  }

  // ── Handlers de rateio ──────────────────────────────────────────────
  function adicionarRateio() {
    markDirty();
    setRateios((prev) => [
      ...prev,
      {
        id: novoId('rat'),
        lancamentoId: initial?.id ?? '',
        tipoDestino: 'obra_etapa',
        valor: 0,
      },
    ]);
  }

  function atualizarRateio(idx: number, patch: Partial<RateioLancamento>) {
    markDirty();
    setRateios((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removerRateio(idx: number) {
    markDirty();
    setRateios((prev) => prev.filter((_, i) => i !== idx));
  }

  // Quando o usuário muda valor TOTAL, recalibra parcelas pra distribuir igualmente
  // se ainda não foram tocadas (todas com valor 0 ou apenas 1 parcela).
  function setValorTotalAjustando(novo: number) {
    markDirty();
    setValorTotal(novo);
    if (parcelas.length === 1) {
      setParcelas((prev) => [{ ...prev[0], valor: novo }]);
    }
  }

  // ── Validação ───────────────────────────────────────────────────────
  function validar(): string | null {
    if (!fornecedorId && !favorecidoNome.trim()) {
      return 'Informe o fornecedor (cadastrado) ou o nome do favorecido.';
    }
    if (!descricao.trim()) {
      return 'Informe uma descrição do lançamento.';
    }
    if (valorTotal <= 0) return 'Valor total precisa ser maior que zero.';

    if (Math.abs(diferencaParcelas) > 0.01) {
      return `Soma das parcelas (${somaParcelas.toFixed(2)}) não bate com o valor total (${valorTotal.toFixed(2)}). Diferença: R$ ${diferencaParcelas.toFixed(2)}.`;
    }
    for (const p of parcelas) {
      if (!p.dataVencimento) return `Parcela ${p.numero}: defina a data de vencimento.`;
      if (p.valor <= 0) return `Parcela ${p.numero}: valor precisa ser maior que zero.`;
    }

    if (rateios.length === 0) {
      return 'Adicione pelo menos uma linha de rateio (onde o custo será alocado).';
    }
    if (Math.abs(diferencaRateios) > 0.01) {
      return `Soma do rateio (${somaRateios.toFixed(2)}) não bate com o valor total (${valorTotal.toFixed(2)}). Diferença: R$ ${diferencaRateios.toFixed(2)}.`;
    }
    for (let i = 0; i < rateios.length; i++) {
      const r = rateios[i];
      if (r.valor <= 0) return `Rateio ${i + 1}: valor precisa ser maior que zero.`;
      if (r.tipoDestino === 'obra_etapa') {
        if (!r.obraId) return `Rateio ${i + 1}: selecione a obra.`;
        if (!r.etapaObraId) return `Rateio ${i + 1}: selecione a etapa.`;
      }
      // ⚠ OS é OPCIONAL aqui em manutenção: peças vão pro almoxarifado e
      //   a OS "puxa" depois quando consome (regra v2.7). A obrigação de
      //   "serviço precisa de OS" já é aplicada na OC, não precisa
      //   ser revalidada no lançamento financeiro.
      if (r.tipoDestino === 'obra_deposito' && !r.obraId) {
        return `Rateio ${i + 1}: selecione a obra do depósito.`;
      }
    }
    return null;
  }

  async function handleSubmit() {
    const erro = validar();
    if (erro) {
      showToast({ kind: 'error', message: erro });
      return;
    }

    const lancId = initial?.id ?? novoId('flanc');
    const lanc: LancamentoFinanceiro = {
      id: lancId,
      numero,
      origem: initial?.origem ?? (modo === 'oc' ? 'oc' : 'avulso'),
      ordemCompraId: initial?.ordemCompraId,
      dataEmissao,
      dataVencimento: parcelas[0]?.dataVencimento || dataEmissao,
      fornecedorId: fornecedorId || undefined,
      favorecidoNome: favorecidoNome || undefined,
      empresaPagadoraId: empresaPagadoraId || undefined,
      categoriaId: categoriaId || undefined,
      descricao,
      valorTotal,
      formaPagamento,
      observacoes,
      anexosUrls,
      status: initial?.status ?? 'em_aberto',
      parcelas: parcelas.map((p) => ({ ...p, lancamentoId: lancId })),
      rateios: rateios.map((r) => ({ ...r, lancamentoId: lancId })),
    };

    try {
      await onSubmit(lanc);
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar lançamento.',
      });
    }
  }

  // ── Upload de anexo ─────────────────────────────────────────────────
  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${initial?.id ?? 'novo'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('financeiro-anexos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setAnexosUrls((prev) => [...prev, path]);
      markDirty();
      showToast({ kind: 'success', message: `Anexo "${file.name}" enviado.` });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao enviar anexo.',
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // reset pra permitir reupload do mesmo arquivo
    }
  }

  function removerAnexo(url: string) {
    markDirty();
    setAnexosUrls((prev) => prev.filter((u) => u !== url));
    // Não deletamos do Storage agora — fica órfão. Job de limpeza futuro.
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
    >
      {/* Banner de modo */}
      {travado && (
        <div className="px-3.5 py-2.5 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/[0.06] text-[12px] text-sky-900 dark:text-sky-100 leading-relaxed flex items-start gap-2">
          <Lock className="w-4 h-4 mt-[1px] shrink-0" />
          <span>
            Este lançamento vem da OC{' '}
            <strong>{initial?.ordemCompraId ?? ''}</strong>. Fornecedor, empresa, valor total e
            rateio estão travados pra preservar a auditoria. Você pode ajustar parcelas,
            categoria, forma de pagamento e anexos.
          </span>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Número">
          <Input value={numero} readOnly className="bg-[var(--color-surface-2)]" />
        </Field>
        <Field label="Data de emissão">
          <Input
            type="date"
            value={dataEmissao}
            onChange={(e) => { markDirty(); setDataEmissao(e.target.value); }}
            disabled={travado}
          />
        </Field>
        <Field label="Empresa pagadora">
          <SmartSelect
            value={empresaPagadoraId}
            onChange={(e) => { markDirty(); setEmpresaPagadoraId(e.target.value); }}
            disabled={travado}
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] disabled:bg-[var(--color-surface-2)] disabled:cursor-not-allowed px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
          >
            <option value="">— escolha a empresa —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </SmartSelect>
        </Field>

        <Field label="Fornecedor / favorecido" className="sm:col-span-2">
          <FornecedorOuFavorecidoPicker
            fornecedores={fornecedores}
            fornecedorId={fornecedorId}
            favorecidoNome={favorecidoNome}
            disabled={travado}
            onChange={({ fornecedorId, favorecidoNome }) => {
              markDirty();
              setFornecedorId(fornecedorId);
              setFavorecidoNome(favorecidoNome);
            }}
            onCreate={async (nome) => {
              const id = await onCreateFornecedor(nome);
              setFornecedorId(id);
              setFavorecidoNome('');
            }}
          />
        </Field>

        <Field label="Categoria">
          <div className="flex items-stretch gap-1.5">
            <SmartSelect
              value={categoriaId}
              onChange={(e) => { markDirty(); setCategoriaId(e.target.value); }}
              wrapperClassName="relative flex-1 min-w-0"
              className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
            >
              <option value="">— sem categoria —</option>
              {categoriasOpcoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? ' (inativa)' : ''}</option>
              ))}
            </SmartSelect>
            <button
              type="button"
              onClick={() => setNovaCategoriaModal(true)}
              title="Cadastrar nova categoria"
              className="shrink-0 inline-flex items-center justify-center w-[42px] h-[42px] rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </Field>

        <Field label="Forma de pagamento">
          <SmartSelect
            value={formaPagamento}
            onChange={(e) => { markDirty(); setFormaPagamento(e.target.value as FormaPagamentoLancamento); }}
            className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
          >
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </SmartSelect>
        </Field>

        <Field label="Valor total">
          <MoneyInput
            value={valorTotal}
            onChange={setValorTotalAjustando}
            disabled={travado}
          />
        </Field>

        <Field label="Descrição" className="sm:col-span-2 lg:col-span-3">
          <Input
            value={descricao}
            onChange={(e) => { markDirty(); setDescricao(e.target.value); }}
            placeholder="Ex: NF 12345 — Cimento e areia para obra BR-364"
          />
        </Field>
      </section>

      {/* ── Parcelas ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Parcelas"
          subtitulo={`${parcelas.length} ${parcelas.length === 1 ? 'parcela' : 'parcelas'} · soma R$ ${somaParcelas.toFixed(2)}`}
        >
          <div className="inline-flex items-center gap-1">
            {[2, 3, 6, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => parcelarIgual(n)}
                className="px-2 py-1 text-[11.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                title={`Parcelar em ${n}x igual`}
              >
                {n}x
              </button>
            ))}
            <Button type="button" variant="secondary" onClick={adicionarParcela}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Parcela
              </span>
            </Button>
          </div>
        </SectionHeader>

        {Math.abs(diferencaParcelas) > 0.01 && (
          <div className="mb-2 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] text-[11.5px] text-amber-900 dark:text-amber-100">
            ⚠ Soma das parcelas <strong>{somaParcelas.toFixed(2)}</strong> difere do total
            (<strong>{valorTotal.toFixed(2)}</strong>) em <strong>R$ {diferencaParcelas.toFixed(2)}</strong>.
          </div>
        )}

        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
              <tr>
                <th className="px-3 py-2 text-left w-12">Nº</th>
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {parcelas.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-[12.5px] text-[var(--color-fg-muted)]">
                    {p.numero}/{parcelas.length}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={p.dataVencimento}
                      onChange={(e) => atualizarParcela(i, { dataVencimento: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyInput
                      value={p.valor}
                      onChange={(v) => atualizarParcela(i, { valor: v })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removerParcela(i)}
                      className="inline-flex w-7 h-7 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15"
                      title="Remover parcela"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Rateio ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo={`Rateio de custos${travado ? ' (definido na OC — travado)' : ''}`}
          subtitulo={
            rateios.length === 0
              ? 'Adicione pelo menos uma linha para alocar o custo (obra+etapa, OS de manutenção, sede…).'
              : `${rateios.length} ${rateios.length === 1 ? 'linha' : 'linhas'} · soma R$ ${somaRateios.toFixed(2)}`
          }
        >
          {!travado && (
            <Button type="button" variant="secondary" onClick={adicionarRateio}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Destino
              </span>
            </Button>
          )}
        </SectionHeader>

        {Math.abs(diferencaRateios) > 0.01 && rateios.length > 0 && (
          <div className="mb-2 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/[0.06] text-[11.5px] text-amber-900 dark:text-amber-100">
            ⚠ Soma do rateio <strong>{somaRateios.toFixed(2)}</strong> difere do total
            (<strong>{valorTotal.toFixed(2)}</strong>) em <strong>R$ {diferencaRateios.toFixed(2)}</strong>.
            {!travado && (
              <button
                type="button"
                className="ml-2 underline text-amber-900 dark:text-amber-100 hover:opacity-80"
                onClick={() => {
                  if (rateios.length === 0) return;
                  markDirty();
                  const ultimo = rateios[rateios.length - 1];
                  atualizarRateio(rateios.length - 1, {
                    valor: +(ultimo.valor + diferencaRateios).toFixed(2),
                  });
                }}
              >
                Ajustar último item
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {rateios.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] py-8 text-center text-[12.5px] text-[var(--color-fg-muted)]">
              Sem rateio definido. Clique em <strong>+ Destino</strong> pra adicionar.
            </div>
          )}
          {rateios.map((r, i) => (
            <RateioRow
              key={r.id}
              idx={i}
              rateio={r}
              valorTotalLanc={valorTotal}
              obras={obras}
              etapas={etapas}
              ordensServico={ordensServico}
              equipamentos={equipamentos}
              travado={travado}
              onChange={(patch) => atualizarRateio(i, patch)}
              onRemove={() => removerRateio(i)}
            />
          ))}
        </div>
      </section>

      {/* ── Anexos ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          titulo="Anexos"
          subtitulo="Boletos, notas fiscais, comprovantes (PDF ou imagem, máx 20 MB)"
        >
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] cursor-pointer">
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Paperclip className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Enviando...' : 'Adicionar anexo'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleUploadAnexo}
              disabled={uploading}
            />
          </label>
        </SectionHeader>

        {anexosUrls.length === 0 ? (
          <p className="text-[12px] text-[var(--color-fg-muted)] italic">Nenhum anexo.</p>
        ) : (
          <ul className="space-y-1.5">
            {anexosUrls.map((pathOrUrl) => {
              const nome = decodeURIComponent(pathOrUrl.split('/').pop() ?? '').replace(/^\d+_\w+\./, '*.');
              const href = signedAnexosUrls[pathOrUrl] ?? (pathOrUrl.startsWith('http') ? pathOrUrl : undefined);
              return (
                <li key={pathOrUrl} className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[12.5px]">
                  <FileText className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-[var(--color-fg)] hover:text-[var(--color-accent)]"
                  >
                    {nome}
                  </a>
                  <button
                    type="button"
                    onClick={() => removerAnexo(pathOrUrl)}
                    className="text-[var(--color-fg-subtle)] hover:text-rose-500"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Observações ─────────────────────────────────────────────── */}
      <section>
        <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
          Observações
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => { markDirty(); setObservacoes(e.target.value); }}
          rows={2}
          placeholder="Observações internas (opcional)"
          className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)]"
        />
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/95 backdrop-blur-sm flex items-center justify-between">
        <div className="text-[12.5px] text-[var(--color-fg-muted)] inline-flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[var(--color-accent)]" />
          Total: <strong className="text-[var(--color-fg)] tabular-nums">R$ {valorTotal.toFixed(2)}</strong>
          {' · '}
          {parcelas.length}x · {rateios.length} destino{rateios.length === 1 ? '' : 's'}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">Salvar lançamento</Button>
        </div>
      </div>

      {/* Modal de cadastro rápido de categoria */}
      <CategoriaFinanceiraQuickModal
        open={novaCategoriaModal}
        onClose={() => setNovaCategoriaModal(false)}
        ordemSugerida={
          // Última ordem + 10 (ou 999 se a lista estiver vazia)
          categorias.length > 0
            ? Math.max(...categorias.map((c) => c.ordem)) + 10
            : 999
        }
        onCriada={(cat) => {
          markDirty();
          setCategoriaId(cat.id);
        }}
      />
    </form>
  );
}

// ───────────────────────── Sub-componentes ─────────────────────────

function Field({
  label, children, className = '',
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({
  titulo, subtitulo, children,
}: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">{titulo}</h3>
        {subtitulo && (
          <p className="text-[11.5px] text-[var(--color-fg-muted)] mt-0.5">{subtitulo}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function MoneyInput({
  value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[var(--color-fg-subtle)] pointer-events-none select-none z-10">
        R$
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={
          'w-full h-[42px] rounded-lg pl-10 pr-3 py-2 text-sm text-right ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border border-[var(--color-border)] ' +
          'disabled:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-90 ' +
          'transition-[border-color,box-shadow] duration-150 ' +
          'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]'
        }
      />
    </div>
  );
}

/** Combobox de fornecedor com fallback pra "favorecido livre" (nome em texto). */
function FornecedorOuFavorecidoPicker({
  fornecedores, fornecedorId, favorecidoNome, disabled, onChange, onCreate,
}: {
  fornecedores: Fornecedor[];
  fornecedorId: string;
  favorecidoNome: string;
  disabled?: boolean;
  onChange: (v: { fornecedorId: string; favorecidoNome: string }) => void;
  onCreate: (nome: string) => Promise<void>;
}) {
  void onCreate; // reservado pra cadastro inline futuro
  const fornecedorSelecionado = fornecedores.find((f) => f.id === fornecedorId);

  if (disabled) {
    return (
      <Input
        value={fornecedorSelecionado?.nome || favorecidoNome || '—'}
        readOnly
        className="bg-[var(--color-surface-2)]"
      />
    );
  }

  // Modo simples: SmartSelect + campo livre como alternativa
  return (
    <div className="space-y-1.5">
      <SmartSelect
        value={fornecedorId}
        onChange={(e) => onChange({ fornecedorId: e.target.value, favorecidoNome: '' })}
        className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
      >
        <option value="">— buscar fornecedor cadastrado —</option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </SmartSelect>
      {!fornecedorId && (
        <ComboboxInput
          value={favorecidoNome}
          suggestions={[]}
          placeholder="ou digite o nome do favorecido (sem cadastro)"
          onChange={(v) => onChange({ fornecedorId: '', favorecidoNome: v })}
        />
      )}
    </div>
  );
}

/** Linha do rateio: tipo + campos contextuais + valor (com chip visual). */
function RateioRow({
  idx, rateio, valorTotalLanc, obras, etapas, ordensServico, equipamentos, travado, onChange, onRemove,
}: {
  idx: number;
  rateio: RateioLancamento;
  valorTotalLanc: number;
  obras: Obra[];
  etapas: EtapaObra[];
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  travado: boolean;
  onChange: (patch: Partial<RateioLancamento>) => void;
  onRemove: () => void;
}) {
  const tipoInfo = TIPOS_DESTINO.find((t) => t.value === rateio.tipoDestino) ?? TIPOS_DESTINO[0];
  const TIcon = tipoInfo.Icon;
  const etapasDaObra = etapas.filter((e) => e.obraId === rateio.obraId);
  const osAbertas = ordensServico.filter((o) => o.status !== 'concluida' && o.status !== 'cancelada');

  // Toggle valor/% — armazena em flag local. Conversão é feita no onChange.
  const [modoInput, setModoInput] = useState<'valor' | 'percentual'>(rateio.percentual != null ? 'percentual' : 'valor');

  function setValor(v: number) {
    onChange({ valor: v, percentual: modoInput === 'percentual' && valorTotalLanc > 0 ? +((v / valorTotalLanc) * 100).toFixed(2) : undefined });
  }
  function setPercentual(p: number) {
    const valor = valorTotalLanc > 0 ? +((valorTotalLanc * p) / 100).toFixed(2) : 0;
    onChange({ valor, percentual: p });
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
      <div className="flex items-start gap-3 flex-wrap">
        {/* Tipo de destino */}
        <div className="flex-shrink-0">
          <label className="block text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
            Bloco {idx + 1}
          </label>
          <SmartSelect
            value={rateio.tipoDestino}
            onChange={(e) => onChange({
              tipoDestino: e.target.value as TipoDestinoRateio,
              obraId: undefined,
              etapaObraId: undefined,
              ordemServicoId: undefined,
              equipamentoId: undefined,
              depositoMaterialId: undefined,
              depositoId: undefined,
            })}
            disabled={travado}
            className="h-9 px-2 text-[12.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] disabled:bg-[var(--color-surface-2)] flex items-center min-w-[200px]"
          >
            {TIPOS_DESTINO.map((t) => (
              <option key={t.value} value={t.value}>{t.label} — {t.sub}</option>
            ))}
          </SmartSelect>
        </div>

        {/* Campos contextuais (obra/etapa, OS, etc.) */}
        <div className="flex-1 min-w-[240px] grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
          {rateio.tipoDestino === 'obra_etapa' && (
            <>
              <CompactSelect
                label="Obra"
                value={rateio.obraId ?? ''}
                onChange={(v) => onChange({ obraId: v || undefined, etapaObraId: undefined })}
                disabled={travado}
              >
                <option value="">— selecione —</option>
                {obras.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
              </CompactSelect>
              <CompactSelect
                label="Etapa"
                value={rateio.etapaObraId ?? ''}
                onChange={(v) => onChange({ etapaObraId: v || undefined })}
                disabled={travado || !rateio.obraId}
              >
                <option value="">{rateio.obraId ? '— selecione —' : 'Escolha a obra primeiro'}</option>
                {etapasDaObra.map((e) => (<option key={e.id} value={e.id}>{e.nome}</option>))}
              </CompactSelect>
            </>
          )}

          {rateio.tipoDestino === 'manutencao_equipamento' && (
            <div className="flex-1 min-w-[200px]">
              <CompactSelect
                label="Ordem de Serviço (opcional)"
                value={rateio.ordemServicoId ?? ''}
                onChange={(v) => {
                  const os = ordensServico.find((o) => o.id === v);
                  onChange({
                    ordemServicoId: v || undefined,
                    equipamentoId: os?.equipamentoId,
                  });
                }}
                disabled={travado}
              >
                <option value="">
                  {osAbertas.length === 0 ? 'Nenhuma OS aberta — peça vai pro almoxarifado' : '— sem OS (peça pro almoxarifado) —'}
                </option>
                {osAbertas.map((os) => {
                  const eq = equipamentos.find((e) => e.id === os.equipamentoId);
                  const eqLabel = eq?.codigoPatrimonio || eq?.modelo || eq?.tipo || '?';
                  return (
                    <option key={os.id} value={os.id}>
                      {os.numero} — {eqLabel}
                    </option>
                  );
                })}
              </CompactSelect>
              <p className="text-[10.5px] text-[var(--color-fg-subtle)] mt-1 leading-snug">
                {rateio.ordemServicoId
                  ? '✓ Serviço alocado direto na OS.'
                  : 'Sem OS = peça vai pro almoxarifado; a OS puxa o custo quando consome.'}
              </p>
            </div>
          )}

          {rateio.tipoDestino === 'obra_deposito' && (
            <CompactSelect
              label="Obra"
              value={rateio.obraId ?? ''}
              onChange={(v) => onChange({ obraId: v || undefined })}
              disabled={travado}
            >
              <option value="">— selecione —</option>
              {obras.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
            </CompactSelect>
          )}

          {rateio.tipoDestino === 'sede' && (
            <div className="text-[11.5px] text-[var(--color-fg-muted)] italic">
              Sem campos extras — custo vai pro administrativo da sede.
            </div>
          )}
          {(rateio.tipoDestino === 'deposito_central' || rateio.tipoDestino === 'tanque_combustivel') && (
            <div className="text-[11.5px] text-[var(--color-fg-muted)] italic">
              {rateio.tipoDestino === 'deposito_central' ? 'Depósito central' : 'Tanque de combustível'} — destino genérico, sem vínculo específico aqui.
            </div>
          )}
        </div>

        {/* Valor / Percentual + ações */}
        <div className="flex items-end gap-2 ml-auto">
          <div className="inline-flex flex-col items-end">
            <div className="flex items-center gap-1 mb-1">
              <button
                type="button"
                onClick={() => setModoInput('valor')}
                className={
                  'px-2 py-0.5 text-[10.5px] rounded ' +
                  (modoInput === 'valor'
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                }
                disabled={travado}
              >
                R$
              </button>
              <button
                type="button"
                onClick={() => setModoInput('percentual')}
                className={
                  'px-2 py-0.5 text-[10.5px] rounded ' +
                  (modoInput === 'percentual'
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                }
                disabled={travado}
              >
                %
              </button>
            </div>
            {modoInput === 'valor' ? (
              <MoneyInput value={rateio.valor} onChange={setValor} disabled={travado} />
            ) : (
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[var(--color-fg-subtle)] pointer-events-none">%</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rateio.percentual ?? 0}
                  onChange={(e) => setPercentual(Number(e.target.value))}
                  disabled={travado}
                  className="w-[120px] h-[42px] rounded-lg pl-3 pr-8 py-2 text-sm text-right bg-[var(--color-surface-1)] border border-[var(--color-border)] disabled:bg-[var(--color-surface-2)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            )}
            <span className="text-[10.5px] text-[var(--color-fg-subtle)] mt-0.5 tabular-nums">
              {modoInput === 'valor'
                ? (valorTotalLanc > 0 ? `${((rateio.valor / valorTotalLanc) * 100).toFixed(1)}% do total` : '')
                : `R$ ${rateio.valor.toFixed(2)}`}
            </span>
          </div>
          {!travado && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex w-9 h-9 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15"
              title="Remover destino"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--color-fg-subtle)]">
        <TIcon className="w-3 h-3" />
        <span>{tipoInfo.label} · {tipoInfo.sub}</span>
      </div>
    </div>
  );
}

function CompactSelect({
  label, value, onChange, disabled, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
        {label}
      </label>
      <SmartSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-9 px-2 text-[12.5px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] disabled:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-90 flex items-center"
      >
        {children}
      </SmartSelect>
    </div>
  );
}
