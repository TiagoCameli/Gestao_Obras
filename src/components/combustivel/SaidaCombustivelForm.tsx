// SaidaCombustivelForm — form unificado de saída de combustível (Fase 4).
//
// Substitui AbastecimentoForm + AbastecimentoCarretaForm. Cobre os 2 tipos
// de consumidor (equipamento próprio / carreta de transportadora) e as 3
// origens (tanque / dinheiro / requisição) num único fluxo.
//
// Cálculos:
//   - Quando origem='tanque': preco_unitario = (preco_medio_tanque + taxa
//     se carreta). Snapshot gravado em preco_medio_tanque_snapshot pra
//     extrato imutável.
//   - Quando origem='dinheiro'/'requisicao': preco_unitario é input manual
//     (sem tanque pra calcular preço médio).
//
// Preview de impacto financeiro renderiza só quando os campos relevantes
// estão preenchidos — evita ruído visual com 0×0.
//
// RZ.3 — Migrado para react-hook-form + Zod.
// ~16 useState de campos → useForm com zodResolver.
// Regras condicionais via superRefine no schema.

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Truck, Settings2, Camera, Gauge } from 'lucide-react';
import type {
  SaidaCombustivel,
  TipoMedicao,
  Obra,
  EtapaObra,
  Deposito,
  Equipamento,
  Fornecedor,
  Insumo,
  EntradaCombustivel,
  AlocacaoEtapa,
} from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FilterCombobox from '../ui/FilterCombobox';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import AnexosUploader from './AnexosUploader';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useAuth } from '../../contexts/AuthContext';
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel';
import { useSaidasCombustivel } from '../../hooks/useSaidasCombustivel';
import { calcularPrecoMedioTanque } from '../../utils/precoMedioTanque';
import { calcularPrecoFIFO, montarConsumosAnteriores } from '../../utils/fifoCombustivel';
import { useEsvaziamentosTanque } from '../../hooks/useEsvaziamentosTanque';
import { calcularEstoqueCombustivelNaData, inicioCicloAbertoTanque } from '../../hooks/useEstoque';
import {
  saidaCombustivelSchema,
  type SaidaCombustivelFormValues,
} from '../../schemas/combustivel/saidaCombustivel.schema';
import { nowAsLocalInput } from './v2/shared/formatters';
import { formatLitrosNumero } from '../../utils/formatters';

const TIPO_MEDICAO_LABEL: Record<TipoMedicao, string> = {
  horimetro: 'Horímetro',
  odometro: 'Odômetro',
  km: 'Km',
};

const TIPO_MEDICAO_UNIDADE: Record<TipoMedicao, string> = {
  horimetro: 'h',
  odometro: 'km',
  km: 'km',
};

/**
 * FI.4 — Metadata FIFO opcional. Quando origem='tanque' e for NOVA saída,
 * o form passa esses lotes pro container chamar a RPC atômica
 * `registrar_saida_combustivel_fifo`. Em edit mode ou origem != tanque,
 * `fifoMeta` vem undefined e o container usa o insert/update legado.
 */
export interface SaidaSubmitFifoMeta {
  lotes: {
    fonteTipo: 'entrada' | 'transferencia';
    fonteId: string;
    litros: number;
    precoLote: number;
  }[];
  litrosSemSuprimento: number;
}

interface Props {
  initial?: SaidaCombustivel | null;
  onSubmit: (s: SaidaCombustivel, fifoMeta?: SaidaSubmitFifoMeta) => Promise<void> | void;
  onCancel: () => void;

  obras: Obra[];
  etapas: EtapaObra[];
  /** Todos os depósitos. Form filtra por obra escolhida e por contexto
   *  (tanque externo só aparece quando tipo='carreta'). */
  depositos: Deposito[];
  /** Equipamentos ativos. Sentinel 'desconhecido' deve ser filtrado fora. */
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  /** Donas de tanque externo (nem toda dona é transportadora, ex.: Posto
   *  Progresso). Usada só pro lookup de nome da proprietária. */
  donasDeTanque?: Fornecedor[];
  combustiveis: Insumo[];
  /** Pra cálculo de preço médio do tanque. */
  entradasCombustivel: EntradaCombustivel[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ORIGEM_OPTIONS: { value: SaidaCombustivelFormValues['origem']; label: string }[] = [
  { value: 'tanque', label: 'Tanque' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'requisicao', label: 'Requisição' },
];

function fmtBRL(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function SaidaCombustivelForm({
  initial,
  onSubmit,
  onCancel,
  obras,
  etapas,
  depositos,
  equipamentos,
  transportadoras,
  donasDeTanque = [],
  combustiveis,
  entradasCombustivel,
}: Props) {
  // ── react-hook-form + Zod ──────────────────────────────────────────────────
  const {
    control,
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    setValue,
    formState: { errors, isValid: rhfIsValid, isSubmitting },
  } = useForm<SaidaCombustivelFormValues>({
    resolver: zodResolver(saidaCombustivelSchema),
    mode: 'onChange',
    defaultValues: {
      data: initial?.data ? initial.data.slice(0, 16) : nowAsLocalInput(),
      origem: initial?.origem ?? 'tanque',
      tipoConsumidor: initial?.tipoConsumidor ?? 'equipamento_proprio',
      tanqueId: initial?.tanqueId ?? '',
      equipamentoId:
        initial?.equipamentoId === 'desconhecido' ? '' : (initial?.equipamentoId ?? ''),
      transportadoraId: initial?.transportadoraId ?? '',
      placa: initial?.placa ?? '',
      obraId: initial?.obraId ?? '',
      etapaId: initial?.etapaId ?? '',
      tipoCombustivel: initial?.tipoCombustivel ?? '',
      litros: initial?.litros ?? 0,
      taxaLitro: initial?.taxaLitro ?? 0,
      precoUnitarioManual:
        initial?.origem !== 'tanque' ? (initial?.precoUnitario ?? 0) : 0,
      precoCombustivel: initial?.precoCombustivel ?? 0,
      precoCombustivelAreacre: initial?.precoCombustivelAreacre ?? 0,
      motorista: initial?.motorista ?? '',
      medicaoLeitura:
        initial?.medicaoNoAbastecimento != null
          ? String(initial.medicaoNoAbastecimento)
          : '',
      observacoes: initial?.observacoes ?? '',
      pago: initial?.pago ?? false,
      pagoEm: initial?.pagoEm?.slice(0, 16) ?? '',
    },
  });

  // Watch campos pra cálculos derivados e condicionais do JSX
  const origem = watch('origem');
  const tipoConsumidor = watch('tipoConsumidor');
  const tanqueId = watch('tanqueId');
  const equipamentoId = watch('equipamentoId');
  const obraId = watch('obraId');
  const litros = watch('litros') || 0;
  const taxaLitroRaw = watch('taxaLitro') || 0;
  const taxaLitro = tipoConsumidor === 'carreta_transportadora' ? taxaLitroRaw : 0;
  const precoUnitarioManual = watch('precoUnitarioManual') || 0;
  const precoCombustivel = watch('precoCombustivel') || 0;
  const precoCombustivelAreacre = watch('precoCombustivelAreacre') || 0;
  const pago = watch('pago');
  const data = watch('data');

  // ── useState pra anexos + inline-create + saldo ────────────────────────────
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
  const [erro, setErro] = useState<string | null>(null);

  // Combustível inline (criar novo)
  const [listaCombustiveis, setListaCombustiveis] = useState<Insumo[]>(combustiveis);
  const [novoCombustivelAberto, setNovoCombustivelAberto] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');
  const adicionarInsumoMut = useAdicionarInsumo();
  const { data: transferencias = [] } = useTransferenciasCombustivel();
  // FI.4 — saídas existentes pro replay FIFO (consome lotes em ordem
  // cronológica antes desta nova saída).
  const { data: saidasExistentes = [] } = useSaidasCombustivel();
  // Esvaziamentos também drenam o tanque e entram no replay FIFO.
  const { data: esvaziamentos = [] } = useEsvaziamentosTanque();

  // Medição (gerida por watch no RHF — campo medicaoLeitura)
  const medicaoStr = watch('medicaoLeitura');

  useEffect(() => {
    setListaCombustiveis(combustiveis);
  }, [combustiveis]);

  // ── Pre-fill: taxa default da transportadora quando muda transp ──
  useEffect(() => {
    if (tipoConsumidor !== 'carreta_transportadora' || !watch('transportadoraId')) return;
    if (initial) return; // edição — não sobrescreve
    const transportadoraId = watch('transportadoraId');
    const t = transportadoras.find((x) => x.id === transportadoraId);
    if (t && (t as unknown as { taxaLitroPadrao?: number }).taxaLitroPadrao != null) {
      setValue('taxaLitro', (t as unknown as { taxaLitroPadrao?: number }).taxaLitroPadrao ?? 0);
    }
  }, [watch('transportadoraId'), tipoConsumidor, transportadoras, initial, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listas filtradas ──
  const equipamentosVisiveis = useMemo(
    () => equipamentos.filter((e) => e.ativo !== false && e.id !== 'desconhecido'),
    [equipamentos]
  );

  // ── Equipamento selecionado e tipo de medição derivado ──
  const equipamentoSelecionado = useMemo(
    () => equipamentos.find((e) => e.id === equipamentoId) ?? null,
    [equipamentos, equipamentoId]
  );

  const tipoMedicaoEquipamento: TipoMedicao | null = useMemo(() => {
    if (!equipamentoSelecionado) return null;
    const t = equipamentoSelecionado.tipoMedicao;
    if (t === 'horimetro' || t === 'odometro' || t === 'km') return t;
    return null;
  }, [equipamentoSelecionado]);

  // Carrega a última leitura do equipamento.
  const { data: medicaoAtual } = useMedicaoAtual(
    tipoConsumidor === 'equipamento_proprio' ? equipamentoId : null
  );

  const medicaoValor = parseFloat(medicaoStr.replace(',', '.'));
  const medicaoValida = Number.isFinite(medicaoValor) && medicaoValor >= 0;

  const medicaoAlerta = useMemo(() => {
    if (!medicaoValida || !medicaoAtual || initial) return null;
    if (medicaoValor < medicaoAtual.medicaoAtual) {
      const unidade = TIPO_MEDICAO_UNIDADE[medicaoAtual.tipoMedicao];
      return `A última leitura registrada foi ${medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} ${unidade}. Confirme se o valor está correto.`;
    }
    return null;
  }, [medicaoValida, medicaoValor, medicaoAtual, initial]);

  // Tanques são globais (Fase 6) — único filtro contextual:
  //   - equipamento_proprio: só tanques internos (eh_externo=false).
  //   - carreta_transportadora: TODOS (incluindo Transterra externo).
  const tanquesVisiveis = useMemo(() => {
    let lista = depositos.filter((d) => d.ativo !== false);
    if (tipoConsumidor === 'equipamento_proprio') {
      lista = lista.filter((d) => !d.ehExterno);
    }
    return lista;
  }, [depositos, tipoConsumidor]);

  // Etapas da obra escolhida
  const etapasDaObra = useMemo(
    () => (obraId ? etapas.filter((e) => e.obraId === obraId) : []),
    [etapas, obraId]
  );

  // ── Cálculos ──

  // FI.4 — Preço CORRENTE via FIFO real (custeio por lote).
  // Substitui calcularPrecoMedioTanque (média vitalícia ponderada de todas
  // as entradas) por consumo lote-a-lote em ordem cronológica.
  //
  // O resultado traz {precoMedio, detalhamento[], litrosSemSuprimento}:
  //   - precoMedio: média ponderada DAS porções consumidas (não vitalícia)
  //   - detalhamento: quebra por lote, pra grava em saidas_lotes
  //   - litrosSemSuprimento: > 0 quando saída excede o suprimento → grava
  //     em saidas_sem_suprimento pra revisão.
  const tipoCombustivelSaida = watch('tipoCombustivel');
  const fifoResult = useMemo(() => {
    if (origem !== 'tanque' || !tanqueId) {
      return { precoMedio: 0, detalhamento: [] as ReturnType<typeof calcularPrecoFIFO>['detalhamento'], litrosSemSuprimento: 0 };
    }
    const dataValue = data
      ? data.length === 16
        ? `${data}:00`
        : data
      : new Date().toISOString().slice(0, 19);
    if (!litros || litros <= 0) {
      return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 };
    }
    return calcularPrecoFIFO({
      tanqueId,
      dataHora: dataValue,
      litros,
      entradas: entradasCombustivel,
      transferenciasIn: transferencias,
      tipoCombustivel: tipoCombustivelSaida,
      // Replay dos 3 drenos (saída/transf-out/esvaziamento). Em edit mode
      // exclui ESTA saída do replay (senão consumiria 2x).
      consumosAnteriores: montarConsumosAnteriores({
        tanqueId,
        tipoCombustivel: tipoCombustivelSaida,
        saidas: saidasExistentes,
        transferencias,
        esvaziamentos,
        excluirSaidaId: initial?.id,
      }),
    });
  }, [origem, tanqueId, data, litros, entradasCombustivel, transferencias, saidasExistentes, esvaziamentos, initial?.id, tipoCombustivelSaida]);

  // Preço médio CORRENTE do tanque (FIFO). Usado no preview da UI.
  const precoMedioTanqueCorrente = fifoResult.precoMedio;
  // Compatibilidade: mantém o helper antigo importado pra fallback de
  // diagnóstico se algum reviewer quiser comparar valores (mas não é mais
  // usado no fluxo principal).
  void calcularPrecoMedioTanque;

  // Em edit mode com tanque/origem NÃO modificados, respeita o snapshot
  // salvo (HF.11 — snapshot imutável). Caso contrário usa preço corrente.
  const isEditingExistente = !!initial?.id;
  const tanqueOrigemNaoMudou =
    !!initial && initial.tanqueId === tanqueId && initial.origem === origem;
  const usaSnapshotSalvo =
    isEditingExistente &&
    tanqueOrigemNaoMudou &&
    (initial?.precoMedioTanqueSnapshot ?? 0) > 0;

  const precoMedioTanque = usaSnapshotSalvo
    ? (initial!.precoMedioTanqueSnapshot ?? 0)
    : precoMedioTanqueCorrente;

  // Combustível disponível no tanque:
  const tipoCombustivelDoTanque = useMemo(() => {
    if (origem !== 'tanque' || !tanqueId) return '';
    const tanque = depositos.find((d) => d.id === tanqueId);
    if (tanque?.ehExterno) {
      const dieselS10 = combustiveis.find(
        (c) => c.nome.trim().toLowerCase() === 'diesel s10'
      );
      return dieselS10?.id ?? '';
    }
    const ents = entradasCombustivel
      .filter((e) => e.depositoId === tanqueId)
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
    return ents[0]?.tipoCombustivel ?? '';
  }, [origem, tanqueId, depositos, combustiveis, entradasCombustivel]);

  // Auto-seleciona combustível conforme o tanque escolhido.
  // Em edição preserva o valor salvo.
  useEffect(() => {
    if (initial) return;
    if (tipoCombustivelDoTanque) {
      setValue('tipoCombustivel', tipoCombustivelDoTanque, { shouldValidate: true });
    }
  }, [tipoCombustivelDoTanque, initial, setValue]);

  // Carreta + tanque: precoCombustivel default = preço médio do tanque.
  useEffect(() => {
    if (
      tipoConsumidor === 'carreta_transportadora' &&
      origem === 'tanque' &&
      precoMedioTanque > 0 &&
      !precoCombustivel
    ) {
      setValue('precoCombustivel', parseFloat(precoMedioTanque.toFixed(4)), {
        shouldValidate: true,
      });
    }
  }, [tipoConsumidor, origem, precoMedioTanque, precoCombustivel, setValue]);

  // Preço unitário final:
  const precoUnitario =
    tipoConsumidor === 'carreta_transportadora' && origem === 'tanque'
      ? precoCombustivel + taxaLitro
      : origem === 'tanque'
        ? precoMedioTanque + taxaLitro
        : precoUnitarioManual;

  const valorTotal = litros * precoUnitario;

  // Tanque info pra preview de impacto financeiro
  const tanqueSelecionado =
    tanquesVisiveis.find((d) => d.id === tanqueId) ??
    depositos.find((d) => d.id === tanqueId) ??
    null;

  // HF.5 — Saldo point-in-time pra bloquear saída acima do que o tanque tinha na data.
  const [saldoTanqueNaData, setSaldoTanqueNaData] = useState(0);
  useEffect(() => {
    if (origem !== 'tanque' || !tanqueId || !data) {
      setSaldoTanqueNaData(tanqueSelecionado?.nivelAtualLitros ?? 0);
      return;
    }
    const dataIso = data.length === 16 ? `${data}:00` : data;
    calcularEstoqueCombustivelNaData(tanqueId, dataIso, initial?.id)
      .then(setSaldoTanqueNaData)
      .catch((err) => {
        console.error('[SaidaCombustivelForm] saldo na data falhou', err);
        setSaldoTanqueNaData(tanqueSelecionado?.nivelAtualLitros ?? 0);
      });
  }, [origem, tanqueId, data, tanqueSelecionado?.nivelAtualLitros, initial?.id]);

  const saldoInsuficiente =
    origem === 'tanque' &&
    !!tanqueSelecionado &&
    !tanqueSelecionado.ehExterno &&
    litros > saldoTanqueNaData;

  // Trava de ciclo fechado: ao EDITAR uma saída de tanque, checa se ela está
  // antes do início do ciclo aberto (tanque zerou e recebeu combustível novo).
  // Em ciclo fechado, tanque/litros/data ficam travados (banco rejeita também).
  const [cicloFechado, setCicloFechado] = useState(false);
  useEffect(() => {
    const tanqueOriginal = initial?.tanqueId;
    if (!initial || initial.origem !== 'tanque' || !tanqueOriginal || !initial.data) {
      setCicloFechado(false);
      return;
    }
    let ativo = true;
    inicioCicloAbertoTanque(tanqueOriginal)
      .then((inicio) => {
        if (!ativo) return;
        setCicloFechado(!!inicio && initial.data < inicio);
      })
      .catch((err) => {
        console.error('[SaidaCombustivelForm] ciclo aberto falhou', err);
        if (ativo) setCicloFechado(false);
      });
    return () => {
      ativo = false;
    };
  }, [initial]);

  // Bloqueia salvar quando o tipo de combustível da saída diverge do que está
  // atualmente no tanque (situação que ocorre ao editar saída antiga depois
  // que o tanque foi esvaziado e reabastecido com outro tipo).
  const tipoCombustivelForm = watch('tipoCombustivel');
  const tipoIncompativel =
    origem === 'tanque' &&
    !!tanqueSelecionado &&
    !tanqueSelecionado.ehExterno &&
    !!tipoCombustivelDoTanque &&
    !!tipoCombustivelForm &&
    tipoCombustivelForm !== tipoCombustivelDoTanque;
  const tipoCombustivelSaidaNome = tipoIncompativel
    ? (listaCombustiveis.find((c) => c.id === tipoCombustivelForm)?.nome ?? '—')
    : '';
  const tipoCombustivelTanqueNome = tipoIncompativel
    ? (listaCombustiveis.find((c) => c.id === tipoCombustivelDoTanque)?.nome ?? '—')
    : '';

  // Tanque com proprietária externa (Transterra/Areacre, Posto Progresso):
  // split de preço. Dona pode não ser transportadora, então o lookup de nome
  // olha donasDeTanque primeiro e cai pra transportadoras (compat).
  const tanqueExterno = !!tanqueSelecionado?.transportadoraProprietariaId;
  const nomeProprietaria = useCallback(
    (id: string | null | undefined): string =>
      donasDeTanque.find((f) => f.id === id)?.nome ??
      transportadoras.find((f) => f.id === id)?.nome ??
      '?',
    [donasDeTanque, transportadoras]
  );
  const proprietariaNomeAtual = tanqueExterno
    ? nomeProprietaria(tanqueSelecionado!.transportadoraProprietariaId)
    : '';
  const creditoAreacreValor = tanqueExterno
    ? litros * (precoCombustivelAreacre + taxaLitro)
    : 0;
  const margemEmt = tanqueExterno ? valorTotal - creditoAreacreValor : 0;

  // Tanque externo: precoAreacre default = mesmo do precoCombustivel.
  useEffect(() => {
    if (
      tipoConsumidor === 'carreta_transportadora' &&
      tanqueExterno &&
      precoCombustivel > 0 &&
      !precoCombustivelAreacre
    ) {
      setValue('precoCombustivelAreacre', precoCombustivel, { shouldValidate: true });
    }
  }, [tipoConsumidor, tanqueExterno, precoCombustivel, precoCombustivelAreacre, setValue]);

  // Preview de impacto financeiro
  type PreviewLinha = { sinal: '▲' | '▼'; texto: string; cor: 'verde' | 'vermelho' | 'cinza' };
  const previewImpacto: PreviewLinha[] = useMemo(() => {
    if (litros <= 0 || valorTotal <= 0) return [];
    const transportadoraId = watch('transportadoraId');

    const linhas: PreviewLinha[] = [];

    if (tipoConsumidor === 'carreta_transportadora') {
      if (!transportadoraId || !tanqueSelecionado) return [];
      const transpNome =
        transportadoras.find((t) => t.id === transportadoraId)?.nome ?? '?';
      if (tanqueSelecionado.transportadoraProprietariaId) {
        const proprietariaNome = nomeProprietaria(
          tanqueSelecionado.transportadoraProprietariaId
        );
        linhas.push({
          sinal: '▲',
          texto: `Crédito ${proprietariaNome}: ${fmtBRL(creditoAreacreValor)}`,
          cor: 'verde',
        });
        linhas.push({
          sinal: '▼',
          texto: `Débito ${transpNome}: ${fmtBRL(valorTotal)}`,
          cor: 'vermelho',
        });
        if (Math.abs(margemEmt) > 0.005) {
          linhas.push({
            sinal: margemEmt > 0 ? '▲' : '▼',
            texto: `Margem EMT (combustível): ${fmtBRL(margemEmt)}`,
            cor: margemEmt > 0 ? 'verde' : 'vermelho',
          });
        }
      } else {
        // Tanque EMT
        linhas.push({
          sinal: '▼',
          texto: `Débito ${transpNome}: ${fmtBRL(valorTotal)}`,
          cor: 'vermelho',
        });
        linhas.push({
          sinal: '▼',
          texto: `Estoque tanque ${tanqueSelecionado.nome}: −${litros.toLocaleString('pt-BR')} L`,
          cor: 'cinza',
        });
      }
    } else if (tipoConsumidor === 'equipamento_proprio') {
      if (origem === 'tanque' && tanqueSelecionado && !tanqueSelecionado.ehExterno) {
        linhas.push({
          sinal: '▼',
          texto: `Estoque tanque ${tanqueSelecionado.nome}: −${litros.toLocaleString('pt-BR')} L`,
          cor: 'cinza',
        });
      }
    }

    return linhas;
  }, [tipoConsumidor, tanqueSelecionado, litros, valorTotal, origem, creditoAreacreValor, margemEmt, transportadoras, nomeProprietaria]); // eslint-disable-line react-hooks/exhaustive-deps

  // F5.B.2 — sanity warnings
  const sanityWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (litros >= 1000) {
      warnings.push(
        `${litros.toLocaleString('pt-BR')} L é um volume alto — confirme antes de salvar.`
      );
    }
    if (valorTotal >= 10000) {
      warnings.push(`${fmtBRL(valorTotal)} é um valor alto — confirme antes de salvar.`);
    }
    return warnings;
  }, [litros, valorTotal]);

  // F5.B.1 — campos faltantes (para feedback visual; isValid vem do RHF)
  // Mantemos pra exibir banner com nomes amigáveis
  const camposFaltantes = useMemo(() => {
    const faltam: string[] = [];
    if (!data) faltam.push('Data e hora');
    if (!obraId) faltam.push('Obra');
    if (!watch('tipoCombustivel')) faltam.push('Combustível');
    if (litros <= 0) faltam.push('Litros');
    if (precoUnitario <= 0 && origem !== 'tanque') faltam.push('Preço unitário');
    if (!watch('etapaId')) faltam.push('Etapa');
    if (tipoConsumidor === 'equipamento_proprio') {
      if (!equipamentoId || equipamentoId === 'desconhecido') faltam.push('Equipamento');
    } else {
      if (!watch('transportadoraId')) faltam.push('Transportadora');
    }
    if (origem === 'tanque' && !tanqueId) faltam.push('Tanque');
    return faltam;
  }, [data, obraId, litros, precoUnitario, origem, tipoConsumidor, equipamentoId, tanqueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = rhfIsValid && !saldoInsuficiente && !tipoIncompativel;

  // ── Auth ──
  const { temAcao } = useAuth();
  const isEditing = !!initial;
  const canAct = isEditing
    ? temAcao('editar_combustivel')
    : tipoConsumidor === 'carreta_transportadora'
      ? temAcao('criar_abastecimento_carreta')
      : temAcao('criar_saida_combustivel');

  // ── Submit ──
  const onSubmitForm = async (formData: SaidaCombustivelFormValues) => {
    if (!canAct) return;
    if (tipoIncompativel) {
      setErro(
        `Combustível incompatível: a saída é de ${tipoCombustivelSaidaNome}, mas o tanque hoje tem ${tipoCombustivelTanqueNome}.`
      );
      return;
    }
    setErro(null);
    try {
      const taxaEfetiva =
        formData.tipoConsumidor === 'carreta_transportadora' ? formData.taxaLitro : 0;

      let precoUnit: number;
      if (formData.tipoConsumidor === 'carreta_transportadora' && formData.origem === 'tanque') {
        precoUnit = formData.precoCombustivel + taxaEfetiva;
      } else if (formData.origem === 'tanque') {
        precoUnit = precoMedioTanque + taxaEfetiva;
      } else {
        precoUnit = formData.precoUnitarioManual;
      }

      const vtotal = formData.litros * precoUnit;

      const alocacoes: AlocacaoEtapa[] | null = formData.etapaId
        ? [{ etapaId: formData.etapaId, percentual: 100 }]
        : null;

      const medicaoEfetiva: number | null =
        formData.tipoConsumidor === 'equipamento_proprio' &&
        tipoMedicaoEquipamento &&
        medicaoValida
          ? medicaoValor
          : null;
      const tipoMedicaoEfetivo: TipoMedicao | null =
        medicaoEfetiva != null ? tipoMedicaoEquipamento : null;

      const payload: SaidaCombustivel = {
        id: initial?.id ?? gerarId(),
        data:
          formData.data.length === 16 ? `${formData.data}:00` : formData.data,
        origem: formData.origem,
        tipoConsumidor: formData.tipoConsumidor,
        tanqueId:
          formData.origem === 'tanque' ? formData.tanqueId || null : null,
        equipamentoId:
          formData.tipoConsumidor === 'equipamento_proprio'
            ? formData.equipamentoId || null
            : null,
        transportadoraId:
          formData.tipoConsumidor === 'carreta_transportadora'
            ? formData.transportadoraId || null
            : null,
        placa:
          formData.tipoConsumidor === 'carreta_transportadora'
            ? formData.placa || null
            : null,
        motorista:
          formData.tipoConsumidor === 'carreta_transportadora'
            ? formData.motorista.trim()
            : '',
        obraId: formData.obraId || null,
        etapaId: formData.etapaId || null,
        alocacoes,
        tipoCombustivel: formData.tipoCombustivel,
        litros: formData.litros,
        precoMedioTanqueSnapshot:
          formData.origem === 'tanque' ? precoMedioTanque : null,
        taxaLitro: taxaEfetiva,
        precoCombustivel:
          formData.tipoConsumidor === 'carreta_transportadora'
            ? formData.precoCombustivel
            : formData.origem === 'tanque'
              ? precoMedioTanque
              : formData.precoUnitarioManual,
        precoCombustivelAreacre: tanqueExterno
          ? formData.precoCombustivelAreacre
          : null,
        precoUnitario: precoUnit,
        valorTotal: vtotal,
        fotoUrls: fotoUrls.length > 0 ? fotoUrls : null,
        arquivoUrls: arquivoUrls.length > 0 ? arquivoUrls : [],
        observacoes: formData.observacoes || null,
        pago: formData.origem === 'requisicao' ? formData.pago : null,
        pagoEm:
          formData.origem === 'requisicao' && formData.pagoEm
            ? formData.pagoEm
            : null,
        movimentoId: initial?.movimentoId ?? null,
        medicaoNoAbastecimento: medicaoEfetiva,
        tipoMedicaoSnapshot: tipoMedicaoEfetivo,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: initial?.createdBy ?? null,
        updatedBy: initial?.updatedBy ?? null,
      };

      // FI.4 — passa FIFO meta pro container quando NEW + origem=tanque.
      // Container usa pra chamar a RPC `registrar_saida_combustivel_fifo`
      // (insert atômico: saida + saidas_lotes + saidas_sem_suprimento).
      // Em edit mode preserva snapshot imutável (HF.11), não recalcula.
      const fifoMeta: SaidaSubmitFifoMeta | undefined =
        !isEditingExistente && formData.origem === 'tanque'
          ? {
              lotes: fifoResult.detalhamento.map((p) => ({
                fonteTipo: p.fonteTipo,
                fonteId: p.fonteId,
                litros: p.litros,
                precoLote: p.preco,
              })),
              litrosSemSuprimento: fifoResult.litrosSemSuprimento,
            }
          : undefined;

      await onSubmit(payload, fifoMeta);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar saída');
    }
  };

  // ── Render ──
  return (
    <form onSubmit={rhfHandleSubmit(onSubmitForm)} className="space-y-5">
      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
          {erro}
        </div>
      )}

      {cicloFechado && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
          <strong>Ciclo fechado.</strong> Este tanque já zerou e recebeu combustível novo depois desta saída.
          Para não bagunçar o saldo, tanque, litros e data ficam travados. Você ainda pode ajustar equipamento, obra, etapa, fotos, observação e medição.
        </div>
      )}

      {/* Tipo de consumidor — radio cards grandes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Consumidor
        </label>
        <Controller
          name="tipoConsumidor"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  field.onChange('equipamento_proprio');
                  // Limpa campos de carreta
                  setValue('transportadoraId', '');
                  setValue('placa', '');
                  setValue('motorista', '');
                }}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
                  field.value === 'equipamento_proprio'
                    ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                    field.value === 'equipamento_proprio'
                      ? 'bg-emt-verde text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Settings2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-semibold text-sm ${
                      field.value === 'equipamento_proprio'
                        ? 'text-emt-verde-escuro'
                        : 'text-gray-800'
                    }`}
                  >
                    Equipamento Próprio
                  </div>
                  <div className="text-xs text-gray-500">Saída pra equipamento da EMT</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  field.onChange('carreta_transportadora');
                  // Limpa campos de equipamento próprio
                  setValue('equipamentoId', '');
                  setValue('medicaoLeitura', '');
                }}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
                  field.value === 'carreta_transportadora'
                    ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                    field.value === 'carreta_transportadora'
                      ? 'bg-emt-verde text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Truck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-semibold text-sm ${
                      field.value === 'carreta_transportadora'
                        ? 'text-emt-verde-escuro'
                        : 'text-gray-800'
                    }`}
                  >
                    Carreta de Transportadora
                  </div>
                  <div className="text-xs text-gray-500">
                    Carreta abastece — gera saldo conta-corrente
                  </div>
                </div>
              </button>
            </div>
          )}
        />
      </div>

      {/* Origem do combustível — radio inline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Origem do Combustível
        </label>
        <Controller
          name="origem"
          control={control}
          render={({ field }) => (
            <div className="flex gap-2 flex-wrap">
              {ORIGEM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    field.onChange(opt.value);
                    if (opt.value !== 'tanque') {
                      setValue('tanqueId', '');
                    } else {
                      setValue('precoUnitarioManual', 0);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    field.value === opt.value
                      ? 'border-emt-verde bg-emt-verde text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-emt-verde'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Bloco condicional: equipamento ou carreta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            label="Data e Hora"
            id="saidaData"
            type="datetime-local"
            {...register('data')}
            required
            disabled={cicloFechado}
          />
          {errors.data && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.data.message}</p>
          )}
        </div>

        <div>
          <Controller
            name="obraId"
            control={control}
            render={({ field }) => (
              <Select
                label="Obra"
                id="saidaObra"
                value={field.value}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  setValue('etapaId', '');
                  setValue('tanqueId', '');
                }}
                options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                placeholder="Selecione"
                required
                error={errors.obraId?.message}
              />
            )}
          />
        </div>

        {tipoConsumidor === 'equipamento_proprio' ? (
          <>
            <div>
              <label
                htmlFor="saidaEquip"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
              >
                Equipamento <span className="text-red-500">*</span>
              </label>
              <Controller
                name="equipamentoId"
                control={control}
                render={({ field }) => (
                  <FilterCombobox
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      setValue('medicaoLeitura', '');
                    }}
                    options={equipamentosVisiveis.map((eq) => ({
                      value: eq.id,
                      label: eq.codigoPatrimonio
                        ? `${eq.codigoPatrimonio} — ${eq.nome}`
                        : eq.nome,
                    }))}
                    placeholder="Buscar equipamento por código ou nome"
                  />
                )}
              />
              {errors.equipamentoId && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">
                  {errors.equipamentoId.message}
                </p>
              )}
            </div>
            {equipamentoId && tipoMedicaoEquipamento && (
              <div>
                <label
                  htmlFor="saidaMedicao"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5"
                >
                  <Gauge className="w-4 h-4 text-gray-500" />
                  {TIPO_MEDICAO_LABEL[tipoMedicaoEquipamento]} no abastecimento
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    ({TIPO_MEDICAO_UNIDADE[tipoMedicaoEquipamento]})
                  </span>
                </label>
                <input
                  id="saidaMedicao"
                  type="number"
                  step={tipoMedicaoEquipamento === 'horimetro' ? '0.1' : '1'}
                  min="0"
                  {...register('medicaoLeitura')}
                  placeholder={
                    medicaoAtual
                      ? `Última: ${medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} ${TIPO_MEDICAO_UNIDADE[medicaoAtual.tipoMedicao]}`
                      : 'Leitura atual do painel'
                  }
                  className="w-full h-[38px] rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emt-verde"
                />
                {medicaoAtual && !medicaoStr && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Última leitura registrada: {medicaoAtual.medicaoAtual.toLocaleString('pt-BR')}{' '}
                    {TIPO_MEDICAO_UNIDADE[medicaoAtual.tipoMedicao]}
                  </p>
                )}
                {medicaoAlerta && (
                  <p className="mt-1 text-xs text-[var(--color-warning-fg)]">{medicaoAlerta}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <Controller
                name="transportadoraId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Transportadora"
                    id="saidaTransp"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    options={transportadoras.map((t) => ({ value: t.id, label: t.nome }))}
                    placeholder="Selecione transportadora"
                    required
                    error={errors.transportadoraId?.message}
                  />
                )}
              />
            </div>
            <div>
              <Input
                label="Placa da Carreta"
                id="saidaPlaca"
                type="text"
                {...register('placa')}
                placeholder="ABC-1234"
              />
            </div>
            <div>
              <Input
                label="Motorista"
                id="saidaMotorista"
                type="text"
                {...register('motorista')}
                placeholder="Nome do motorista (opcional)"
              />
            </div>
          </>
        )}

        {origem === 'tanque' && (
          <div>
            <Controller
              name="tanqueId"
              control={control}
              render={({ field }) => (
                <Select
                  label="Tanque"
                  id="saidaTanque"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  options={tanquesVisiveis.map((t) => ({
                    value: t.id,
                    label: t.apelido ? `${t.apelido} (${t.nome})` : t.nome,
                  }))}
                  placeholder={obraId ? 'Selecione tanque' : 'Selecione obra primeiro'}
                  disabled={!obraId || cicloFechado}
                  required
                  error={errors.tanqueId?.message}
                />
              )}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="saidaEtapa"
            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
          >
            Etapa <span className="text-red-500">*</span>
          </label>
          {obraId ? (
            <Controller
              name="etapaId"
              control={control}
              render={({ field }) => (
                <FilterCombobox
                  value={field.value}
                  onChange={field.onChange}
                  options={etapasDaObra.map((et) => ({ value: et.id, label: et.nome }))}
                  placeholder="Buscar etapa por código ou nome"
                />
              )}
            />
          ) : (
            <input
              id="saidaEtapa"
              type="text"
              disabled
              placeholder="Selecione obra primeiro"
              className="w-full h-[38px] rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500"
            />
          )}
          {errors.etapaId?.message && (
            <p className="text-xs text-red-500 mt-1">{errors.etapaId.message}</p>
          )}
          {obraId && etapasDaObra.length === 0 && (
            <div className="text-xs text-[var(--color-warning-fg)] mt-1">
              Esta obra não tem etapas cadastradas. Cadastre em{' '}
              <Link to="/cadastros/etapas" className="underline">
                Cadastros › Etapas
              </Link>{' '}
              antes de prosseguir.
            </div>
          )}
        </div>

        <div>
          {origem === 'tanque' && tanqueId && tanqueExterno ? (
            // Tanque externo (Transterra): Select habilitado
            <Controller
              name="tipoCombustivel"
              control={control}
              render={({ field }) => (
                <Select
                  label="Tipo de Combustível"
                  id="saidaCombustivel"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione combustível"
                  required
                  error={errors.tipoCombustivel?.message}
                />
              )}
            />
          ) : origem === 'tanque' && tanqueId ? (
            tipoCombustivelDoTanque ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Tipo de Combustível
                </label>
                <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-sm">
                  {listaCombustiveis.find((c) => c.id === tipoCombustivelDoTanque)?.nome ?? '—'}
                </div>
                {tipoIncompativel && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
                    Esta saída foi lançada como <strong>{tipoCombustivelSaidaNome}</strong>,
                    mas o tanque hoje contém <strong>{tipoCombustivelTanqueNome}</strong>.
                    Editar aqui descontaria do estoque atual ({tipoCombustivelTanqueNome}).
                    Mude o tanque ou estorne esta saída.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Tipo de Combustível
                </label>
                <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm border border-amber-200 dark:border-amber-800">
                  Tanque sem entradas — registre uma entrada antes de fazer saída.
                </div>
              </div>
            )
          ) : (
            <Controller
              name="tipoCombustivel"
              control={control}
              render={({ field }) => (
                <Select
                  label="Tipo de Combustível"
                  id="saidaCombustivel"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione combustível"
                  required
                  error={errors.tipoCombustivel?.message}
                />
              )}
            />
          )}
          {!novoCombustivelAberto ? (
            <button
              type="button"
              className="mt-1 text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={() => setNovoCombustivelAberto(true)}
            >
              + Novo Combustível
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                placeholder="Nome do combustível"
                value={novoCombustivelNome}
                onChange={(e) => setNovoCombustivelNome(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="text-xs px-3 py-1.5"
                  disabled={!novoCombustivelNome.trim()}
                  onClick={() => {
                    const novo: Insumo = {
                      id: gerarId(),
                      nome: novoCombustivelNome.trim(),
                      tipo: 'combustivel',
                      unidade: 'litro',
                      descricao: '',
                      ativo: true,
                      criadoPor: '',
                    };
                    adicionarInsumoMut.mutate(novo);
                    setListaCombustiveis((prev) => [...prev, novo]);
                    setValue('tipoCombustivel', novo.id, { shouldValidate: true });
                    setNovoCombustivelNome('');
                    setNovoCombustivelAberto(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setNovoCombustivelAberto(false);
                    setNovoCombustivelNome('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <Input
            label="Quantidade (litros)"
            id="saidaLitros"
            type="number"
            step="0.001"
            min="0"
            {...register('litros', { valueAsNumber: true })}
            error={
              saldoInsuficiente
                ? `Saldo insuficiente: ${formatLitrosNumero(saldoTanqueNaData)} L disponíveis${data ? ' na data selecionada' : ''}. Reduza os litros, escolha outro tanque ou ajuste a data.`
                : errors.litros?.message
            }
            required
            disabled={cicloFechado}
          />
        </div>

        {/* Preço unitário: input manual quando origem != tanque */}
        {origem !== 'tanque' && (
          <div>
            <Input
              label="Preço Unitário (R$/L)"
              id="saidaPrecoUnit"
              type="number"
              step="0.0001"
              min="0"
              {...register('precoUnitarioManual', { valueAsNumber: true })}
              error={errors.precoUnitarioManual?.message}
              required
            />
          </div>
        )}

        {/* Tanque externo (Transterra): preço Areacre cobra */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && tanqueExterno && (
          <div>
            <Input
              label={`Preço ${proprietariaNomeAtual} cobra (R$/L)`}
              id="saidaPrecoAreacre"
              type="number"
              step="any"
              min="0"
              {...register('precoCombustivelAreacre', { valueAsNumber: true })}
              error={errors.precoCombustivelAreacre?.message}
              required
            />
          </div>
        )}

        {/* Preço combustível: cobrado da transportadora */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && (
          <div>
            <Input
              label={
                tanqueExterno
                  ? 'Preço cobrado da transportadora (R$/L)'
                  : 'Preço Combustível (R$/L)'
              }
              id="saidaPrecoCombustivel"
              type="number"
              step="any"
              min="0"
              {...register('precoCombustivel', { valueAsNumber: true })}
              placeholder={precoMedioTanque > 0 ? precoMedioTanque.toFixed(4) : '0,0000'}
              error={errors.precoCombustivel?.message}
              required
            />
          </div>
        )}

        {/* Taxa por litro: só carreta + origem=tanque */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && (
          <div>
            <Input
              label={
                tanqueExterno
                  ? `Taxa ${proprietariaNomeAtual} (R$/L)`
                  : 'Taxa por Litro (R$/L)'
              }
              id="saidaTaxa"
              type="number"
              step="any"
              min="0"
              {...register('taxaLitro', { valueAsNumber: true })}
              error={errors.taxaLitro?.message}
              placeholder="0,0000"
            />
          </div>
        )}

        {/* Preview da soma cobrada */}
        {tipoConsumidor === 'carreta_transportadora' &&
          origem === 'tanque' &&
          (precoCombustivel > 0 || taxaLitro > 0) && (
            <p className="md:col-span-2 text-sm text-gray-600 dark:text-slate-400">
              Preço unitário cobrado: <strong>{fmtBRL(precoUnitario, 4)}/L</strong>
              {' '}({fmtBRL(precoCombustivel, 4)} combustível + {fmtBRL(taxaLitro, 4)} taxa)
            </p>
          )}
      </div>

      {/* Preview de cálculo — só renderiza quando tem dado */}
      {litros > 0 && precoUnitario > 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cálculo</div>
          <div className="text-sm font-mono text-gray-800">
            {litros.toLocaleString('pt-BR')} L &nbsp;×&nbsp; R$ {precoUnitario.toFixed(4)}{' '}
            &nbsp;=&nbsp;{' '}
            <span className="font-bold text-emt-verde-escuro">{fmtBRL(valorTotal)}</span>
          </div>
          {origem === 'tanque' && precoMedioTanque > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              ({usaSnapshotSalvo ? 'preço salvo (snapshot)' : 'preço FIFO atual do tanque'}: R${' '}
              {precoMedioTanque.toFixed(4)}
              {taxaLitro > 0 && ` + taxa R$ ${taxaLitro.toFixed(4)}`})
              {usaSnapshotSalvo &&
                precoMedioTanqueCorrente > 0 &&
                Math.abs(precoMedioTanqueCorrente - precoMedioTanque) > 0.01 && (
                  <span className="ml-2 text-gray-400">
                    · preço FIFO atual: R$ {precoMedioTanqueCorrente.toFixed(4)}
                  </span>
                )}
            </div>
          )}

          {/* FI.4 — Detalhamento dos lotes FIFO (só em NEW, >1 lote). */}
          {!usaSnapshotSalvo && origem === 'tanque' && fifoResult.detalhamento.length > 1 && (
            <details className="text-xs text-gray-600 mt-2">
              <summary className="cursor-pointer hover:text-gray-800">
                Detalhamento FIFO ({fifoResult.detalhamento.length} lotes)
              </summary>
              <ul className="ml-4 mt-1 space-y-0.5 font-mono">
                {fifoResult.detalhamento.map((p, i) => (
                  <li key={i}>
                    {p.litros.toFixed(2)} L × R$ {p.preco.toFixed(4)}/L = R${' '}
                    {(p.litros * p.preco).toFixed(2)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* FI.4 — Warning: litros sem suprimento na linha do tempo. */}
          {!usaSnapshotSalvo && origem === 'tanque' && fifoResult.litrosSemSuprimento > 0 && (
            <div className="text-xs text-amber-700 mt-2 p-2 rounded bg-amber-50 border border-amber-200">
              ⚠ {fifoResult.litrosSemSuprimento.toFixed(2)} L sem suprimento na linha do tempo.
              Vai ser registrado em <code>saidas_sem_suprimento</code> pra revisão.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-400">Preencha litros e preço pra ver cálculo</div>
        </div>
      )}

      {/* Preview de impacto financeiro — só quando há linhas */}
      {previewImpacto.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="text-xs text-amber-800 uppercase tracking-wide mb-2 font-semibold">
            Impacto financeiro
          </div>
          <div className="space-y-1">
            {previewImpacto.map((linha, i) => {
              const corClass =
                linha.cor === 'verde'
                  ? 'text-green-700'
                  : linha.cor === 'vermelho'
                    ? 'text-red-700'
                    : 'text-gray-700';
              return (
                <div key={i} className={`text-sm font-mono flex items-center gap-2 ${corClass}`}>
                  <span className="font-bold">{linha.sinal}</span>
                  <span>{linha.texto}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Observações */}
      <div>
        <label htmlFor="saidaObs" className="block text-sm font-medium text-gray-700 mb-1">
          Observações
        </label>
        <textarea
          id="saidaObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          {...register('observacoes')}
          placeholder="Opcional"
        />
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Anexos (opcional)
        </label>
        <AnexosUploader
          fotoUrls={fotoUrls}
          arquivoUrls={arquivoUrls}
          onChangeFotos={setFotoUrls}
          onChangeArquivos={setArquivoUrls}
          pastaId={`saida/${initial?.id ?? 'novo'}`}
        />
      </div>

      {/* Pago/PagoEm — só requisição */}
      {origem === 'requisicao' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <Controller
            name="pago"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                Pago
              </label>
            )}
          />
          <Input
            label="Pago em"
            id="saidaPagoEm"
            type="datetime-local"
            {...register('pagoEm')}
            disabled={!pago}
          />
        </div>
      )}

      {/* F5.B.2 — sanity warnings */}
      {sanityWarnings.length > 0 && (
        <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-3 space-y-1">
          {sanityWarnings.map((w, i) => (
            <div
              key={i}
              className="text-xs text-[var(--color-warning-fg)] flex items-start gap-1.5"
            >
              <span aria-hidden>!</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* F5.B.1 — feedback do que falta preencher */}
      {camposFaltantes.length > 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-1.5">
            Para salvar, preencha:
          </p>
          <p className="text-sm text-[var(--color-fg)]">{camposFaltantes.join(' · ')}</p>
        </div>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <SubmitButton loading={isSubmitting} disabled={!isValid || !canAct}>
          {initial ? 'Salvar Alterações' : 'Registrar Saída'}
        </SubmitButton>
      </div>
    </form>
  );
}
