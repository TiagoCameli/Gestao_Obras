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

import { useCallback, useMemo, useState, useEffect, type FormEvent } from 'react';
import { Truck, Settings2, Camera } from 'lucide-react';
import type {
  SaidaCombustivel,
  TipoConsumidorSaida,
  OrigemCombustivel,
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
import FotoCaptureUploader from './FotoCaptureUploader';
import { useAdicionarInsumo } from '../../hooks/useInsumos';

interface Props {
  initial?: SaidaCombustivel | null;
  onSubmit: (s: SaidaCombustivel) => Promise<void> | void;
  onCancel: () => void;

  obras: Obra[];
  etapas: EtapaObra[];
  /** Todos os depósitos. Form filtra por obra escolhida e por contexto
   *  (tanque externo só aparece quando tipo='carreta'). */
  depositos: Deposito[];
  /** Equipamentos ativos. Sentinel 'desconhecido' deve ser filtrado fora. */
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** Pra cálculo de preço médio do tanque. */
  entradasCombustivel: EntradaCombustivel[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const ORIGEM_OPTIONS: { value: OrigemCombustivel; label: string }[] = [
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
  combustiveis,
  entradasCombustivel,
}: Props) {
  // ── Estado: tipo de consumidor (radio cards grandes) ──
  // Persiste do initial em modo edição (não força reset).
  const [tipoConsumidor, setTipoConsumidor] = useState<TipoConsumidorSaida>(
    initial?.tipoConsumidor ?? 'equipamento_proprio'
  );

  // ── Estado: origem ──
  const [origem, setOrigem] = useState<OrigemCombustivel>(initial?.origem ?? 'tanque');

  // ── Estado comum ──
  // initial.data vem do DB como ISO completo ("2026-05-05T08:01:00+00:00").
  // Input datetime-local exige formato truncado YYYY-MM-DDTHH:MM (16 chars) —
  // sem truncar, o input rejeita o valor e fica vazio em modo edição.
  const [data, setData] = useState(
    (initial?.data ?? new Date().toISOString()).slice(0, 16)
  );
  const [obraId, setObraId] = useState(initial?.obraId ?? '');
  const [etapaId, setEtapaId] = useState(initial?.etapaId ?? '');
  const [tanqueId, setTanqueId] = useState(initial?.tanqueId ?? '');
  const [tipoCombustivel, setTipoCombustivel] = useState(initial?.tipoCombustivel ?? '');
  const [litrosStr, setLitrosStr] = useState(initial?.litros?.toString() ?? '');
  const [precoUnitarioManualStr, setPrecoUnitarioManualStr] = useState(
    initial?.precoUnitario?.toString() ?? ''
  );
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);

  // ── Estado: equipamento próprio ──
  const [equipamentoId, setEquipamentoId] = useState(
    initial?.equipamentoId === 'desconhecido' ? '' : (initial?.equipamentoId ?? '')
  );

  // ── Estado: carreta ──
  const [transportadoraId, setTransportadoraId] = useState(initial?.transportadoraId ?? '');
  const [placa, setPlaca] = useState(initial?.placa ?? '');
  const [motorista, setMotorista] = useState(initial?.motorista ?? '');
  const [taxaLitroStr, setTaxaLitroStr] = useState(
    initial?.taxaLitro != null ? String(initial.taxaLitro) : '0'
  );
  const [precoCombustivelStr, setPrecoCombustivelStr] = useState(
    initial?.precoCombustivel != null ? String(initial.precoCombustivel) : ''
  );
  const [precoCombustivelAreacreStr, setPrecoCombustivelAreacreStr] = useState(
    initial?.precoCombustivelAreacre != null ? String(initial.precoCombustivelAreacre) : ''
  );

  // ── Estado: requisição ──
  const [pago, setPago] = useState<boolean>(initial?.pago ?? false);
  const [pagoEm, setPagoEm] = useState(initial?.pagoEm ?? '');

  // ── Combustível inline (criar novo) ──
  const [listaCombustiveis, setListaCombustiveis] = useState<Insumo[]>(combustiveis);
  const [novoCombustivelAberto, setNovoCombustivelAberto] = useState(false);
  const [novoCombustivelNome, setNovoCombustivelNome] = useState('');
  const adicionarInsumoMut = useAdicionarInsumo();

  useEffect(() => {
    setListaCombustiveis(combustiveis);
  }, [combustiveis]);

  // ── Pre-fill: taxa default da transportadora quando muda transp ──
  useEffect(() => {
    if (tipoConsumidor !== 'carreta_transportadora' || !transportadoraId) return;
    if (initial) return; // edição — não sobrescreve
    const t = transportadoras.find((x) => x.id === transportadoraId);
    // taxaLitroPadrao não está no tipo Fornecedor TS atual (é flag DB).
    // Se um dia subir pro tipo TS, popular aqui. Por enquanto deixa o
    // input do user ou o default '0' que veio do useState.
    if (t && (t as unknown as { taxaLitroPadrao?: number }).taxaLitroPadrao != null) {
      setTaxaLitroStr(String((t as unknown as { taxaLitroPadrao?: number }).taxaLitroPadrao));
    }
  }, [transportadoraId, tipoConsumidor, transportadoras, initial]);

  // ── Listas filtradas ──
  // Equipamentos: ativos + ocultar sentinel 'desconhecido'.
  const equipamentosVisiveis = useMemo(
    () => equipamentos.filter((e) => e.ativo !== false && e.id !== 'desconhecido'),
    [equipamentos]
  );

  // Transportadoras: já filtradas eh_transportadora=true pelo container (assumido).
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
  const litros = parseFloat(litrosStr.replace(',', '.')) || 0;
  const taxaLitro = tipoConsumidor === 'carreta_transportadora'
    ? parseFloat(taxaLitroStr.replace(',', '.')) || 0
    : 0;

  // Preço médio do tanque (só faz sentido pra origem=tanque).
  const precoMedioTanque = useMemo(() => {
    if (origem !== 'tanque' || !tanqueId) return 0;
    const ents = entradasCombustivel.filter((e) => e.depositoId === tanqueId);
    if (ents.length === 0) return 0;
    const totalValor = ents.reduce((s, e) => s + e.valorTotal, 0);
    const totalLitros = ents.reduce((s, e) => s + e.quantidadeLitros, 0);
    return totalLitros > 0 ? totalValor / totalLitros : 0;
  }, [origem, tanqueId, entradasCombustivel]);

  // Combustível disponível no tanque:
  //   - Tanque externo (Transterra): hardcode Diesel S10 (nunca recebe entradas).
  //   - Tanque interno: ditado pela entrada mais recente.
  // Misturar combustíveis no mesmo tanque é erro operacional (não suportado).
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
  // Em edição (initial !== undefined) preserva o valor salvo — caso o
  // tanque já tenha trocado de combustível desde a saída, não sobrescreve.
  useEffect(() => {
    if (initial) return;
    if (tipoCombustivelDoTanque) setTipoCombustivel(tipoCombustivelDoTanque);
  }, [tipoCombustivelDoTanque, initial]);

  // Carreta + tanque: precoCombustivel default = preço médio do tanque (usuário sobrescreve).
  useEffect(() => {
    if (tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && precoMedioTanque > 0 && !precoCombustivelStr) {
      setPrecoCombustivelStr(precoMedioTanque.toFixed(4));
    }
  }, [tipoConsumidor, origem, precoMedioTanque, precoCombustivelStr]);

  // Preço unitário final:
  //   - origem='tanque': preco_medio + taxa (taxa só carreta).
  //   - outras: input manual.
  const precoUnitarioManual = parseFloat(precoUnitarioManualStr.replace(',', '.')) || 0;
  const precoCombustivelNum = parseFloat(precoCombustivelStr.replace(',', '.')) || 0;
  const precoCombustivelAreacreNum = parseFloat(precoCombustivelAreacreStr.replace(',', '.')) || 0;
  const precoUnitario =
    tipoConsumidor === 'carreta_transportadora' && origem === 'tanque'
      ? precoCombustivelNum + taxaLitro
      : origem === 'tanque'
        ? precoMedioTanque + taxaLitro
        : precoUnitarioManual;

  const valorTotal = litros * precoUnitario;

  // Tanque info pra preview de impacto financeiro
  const tanqueSelecionado = tanquesVisiveis.find((d) => d.id === tanqueId)
    ?? depositos.find((d) => d.id === tanqueId)
    ?? null;

  // Tanque com proprietária externa (Transterra/Areacre): split de preço Areacre vs cobrado.
  const tanqueExterno = !!tanqueSelecionado?.transportadoraProprietariaId;
  const proprietariaNomeAtual = tanqueExterno
    ? (transportadoras.find((t) => t.id === tanqueSelecionado!.transportadoraProprietariaId)?.nome ?? '?')
    : '';
  const creditoAreacreValor = tanqueExterno
    ? litros * (precoCombustivelAreacreNum + taxaLitro)
    : 0;
  const margemEmt = tanqueExterno ? valorTotal - creditoAreacreValor : 0;

  // Tanque externo: precoAreacre default = mesmo do precoCombustivel (paridade).
  // Usuário sobrescreve pra criar margem EMT (preco_transp − preco_areacre).
  useEffect(() => {
    if (tipoConsumidor === 'carreta_transportadora' && tanqueExterno && precoCombustivelNum > 0 && !precoCombustivelAreacreStr) {
      setPrecoCombustivelAreacreStr(precoCombustivelNum.toString());
    }
  }, [tipoConsumidor, tanqueExterno, precoCombustivelNum, precoCombustivelAreacreStr]);

  // Preview de impacto financeiro:
  //   - carreta + tanque externo (proprietária preenchida) → crédito proprietária + débito transportadora.
  //   - carreta + tanque EMT (proprietária NULL) → débito transportadora + nota estoque.
  //   - equipamento_proprio + tanque interno → ▼ estoque (sem movimento financeiro).
  type PreviewLinha = { sinal: '▲' | '▼'; texto: string; cor: 'verde' | 'vermelho' | 'cinza' };
  const previewImpacto: PreviewLinha[] = useMemo(() => {
    if (litros <= 0 || valorTotal <= 0) return [];

    const linhas: PreviewLinha[] = [];

    if (tipoConsumidor === 'carreta_transportadora') {
      if (!transportadoraId || !tanqueSelecionado) return [];
      const transpNome = transportadoras.find((t) => t.id === transportadoraId)?.nome ?? '?';
      if (tanqueSelecionado.transportadoraProprietariaId) {
        const proprietariaNome = transportadoras.find(
          (t) => t.id === tanqueSelecionado.transportadoraProprietariaId
        )?.nome ?? '?';
        linhas.push({ sinal: '▲', texto: `Crédito ${proprietariaNome}: ${fmtBRL(creditoAreacreValor)}`, cor: 'verde' });
        linhas.push({ sinal: '▼', texto: `Débito ${transpNome}: ${fmtBRL(valorTotal)}`, cor: 'vermelho' });
        if (Math.abs(margemEmt) > 0.005) {
          linhas.push({
            sinal: margemEmt > 0 ? '▲' : '▼',
            texto: `Margem EMT (combustível): ${fmtBRL(margemEmt)}`,
            cor: margemEmt > 0 ? 'verde' : 'vermelho',
          });
        }
      } else {
        // Tanque EMT
        linhas.push({ sinal: '▼', texto: `Débito ${transpNome}: ${fmtBRL(valorTotal)}`, cor: 'vermelho' });
        linhas.push({ sinal: '▼', texto: `Estoque tanque ${tanqueSelecionado.nome}: −${litros.toLocaleString('pt-BR')} L`, cor: 'cinza' });
      }
    } else if (tipoConsumidor === 'equipamento_proprio') {
      // Só mostra impacto de estoque quando origem=tanque e tanque interno escolhido
      if (origem === 'tanque' && tanqueSelecionado && !tanqueSelecionado.ehExterno) {
        linhas.push({ sinal: '▼', texto: `Estoque tanque ${tanqueSelecionado.nome}: −${litros.toLocaleString('pt-BR')} L`, cor: 'cinza' });
      }
    }

    return linhas;
  }, [tipoConsumidor, transportadoraId, transportadoras, tanqueSelecionado, litros, valorTotal, origem, creditoAreacreValor, margemEmt]);

  // ── Validação ──
  const isValid = useMemo(() => {
    if (!data) return false;
    if (!obraId) return false; // paridade com legado
    if (!tipoCombustivel) return false;
    if (litros <= 0) return false;
    if (precoUnitario <= 0) return false;

    if (tipoConsumidor === 'equipamento_proprio') {
      if (!equipamentoId) return false;
    } else {
      if (!transportadoraId) return false;
    }

    if (origem === 'tanque' && !tanqueId) return false;
    return true;
  }, [data, obraId, tipoCombustivel, litros, precoUnitario, tipoConsumidor, equipamentoId, transportadoraId, origem, tanqueId]);

  // ── Submit ──
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!isValid) return;

      const alocacoes: AlocacaoEtapa[] | null = etapaId
        ? [{ etapaId, percentual: 100 }]
        : null;

      const payload: SaidaCombustivel = {
        id: initial?.id ?? gerarId(),
        data: data.length === 16 ? `${data}:00` : data, // garante seconds
        origem,
        tipoConsumidor,
        tanqueId: origem === 'tanque' ? tanqueId || null : null,
        equipamentoId: tipoConsumidor === 'equipamento_proprio' ? equipamentoId || null : null,
        transportadoraId: tipoConsumidor === 'carreta_transportadora' ? transportadoraId || null : null,
        placa: tipoConsumidor === 'carreta_transportadora' ? (placa || null) : null,
        motorista: tipoConsumidor === 'carreta_transportadora' ? motorista.trim() : '',
        obraId: obraId || null,
        etapaId: etapaId || null,
        alocacoes,
        tipoCombustivel,
        litros,
        precoMedioTanqueSnapshot: origem === 'tanque' ? precoMedioTanque : null,
        taxaLitro,
        precoCombustivel:
          tipoConsumidor === 'carreta_transportadora'
            ? precoCombustivelNum
            : origem === 'tanque' ? precoMedioTanque : precoUnitarioManual,
        precoCombustivelAreacre: tanqueExterno ? precoCombustivelAreacreNum : null,
        precoUnitario,
        valorTotal,
        fotoUrls: fotoUrls.length > 0 ? fotoUrls : null,
        observacoes: observacoes || null,
        pago: origem === 'requisicao' ? pago : null,
        pagoEm: origem === 'requisicao' && pagoEm ? pagoEm : null,
        movimentoId: initial?.movimentoId ?? null,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: initial?.createdBy ?? null,
      };

      await onSubmit(payload);
    },
    [
      isValid, initial, data, origem, tipoConsumidor, tanqueId, equipamentoId,
      transportadoraId, placa, motorista, obraId, etapaId, tipoCombustivel,
      litros, precoMedioTanque, taxaLitro, precoUnitario, valorTotal,
      precoCombustivelNum, precoCombustivelAreacreNum, precoUnitarioManual,
      tanqueExterno,
      fotoUrls, observacoes, pago, pagoEm, onSubmit,
    ]
  );

  // ── Render ──
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de consumidor — radio cards grandes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Consumidor
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipoConsumidor('equipamento_proprio')}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              tipoConsumidor === 'equipamento_proprio'
                ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              tipoConsumidor === 'equipamento_proprio' ? 'bg-emt-verde text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Settings2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${
                tipoConsumidor === 'equipamento_proprio' ? 'text-emt-verde-escuro' : 'text-gray-800'
              }`}>
                Equipamento Próprio
              </div>
              <div className="text-xs text-gray-500">Saída pra equipamento da EMT</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTipoConsumidor('carreta_transportadora')}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all text-left ${
              tipoConsumidor === 'carreta_transportadora'
                ? 'border-emt-verde bg-emt-verde/10 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              tipoConsumidor === 'carreta_transportadora' ? 'bg-emt-verde text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Truck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${
                tipoConsumidor === 'carreta_transportadora' ? 'text-emt-verde-escuro' : 'text-gray-800'
              }`}>
                Carreta de Transportadora
              </div>
              <div className="text-xs text-gray-500">Carreta abastece — gera saldo conta-corrente</div>
            </div>
          </button>
        </div>
      </div>

      {/* Origem do combustível — radio inline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Origem do Combustível
        </label>
        <div className="flex gap-2 flex-wrap">
          {ORIGEM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setOrigem(opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                origem === opt.value
                  ? 'border-emt-verde bg-emt-verde text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-emt-verde'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bloco condicional: equipamento ou carreta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora"
          id="saidaData"
          type="datetime-local"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />

        <Select
          label="Obra"
          id="saidaObra"
          value={obraId}
          onChange={(e) => { setObraId(e.target.value); setEtapaId(''); setTanqueId(''); }}
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          placeholder="Selecione"
          required
        />

        {tipoConsumidor === 'equipamento_proprio' ? (
          <div>
            <label htmlFor="saidaEquip" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Equipamento <span className="text-red-500">*</span>
            </label>
            <FilterCombobox
              value={equipamentoId}
              onChange={setEquipamentoId}
              options={equipamentosVisiveis.map((eq) => ({
                value: eq.id,
                label: eq.codigoPatrimonio
                  ? `${eq.codigoPatrimonio} — ${eq.nome}`
                  : eq.nome,
              }))}
              placeholder="Buscar equipamento por código ou nome"
            />
          </div>
        ) : (
          <>
            <Select
              label="Transportadora"
              id="saidaTransp"
              value={transportadoraId}
              onChange={(e) => setTransportadoraId(e.target.value)}
              options={transportadoras.map((t) => ({ value: t.id, label: t.nome }))}
              placeholder="Selecione transportadora"
              required
            />
            <Input
              label="Placa da Carreta"
              id="saidaPlaca"
              type="text"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC-1234"
            />
            <Input
              label="Motorista"
              id="saidaMotorista"
              type="text"
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
              placeholder="Nome do motorista (opcional)"
            />
          </>
        )}

        {origem === 'tanque' && (
          <Select
            label="Tanque"
            id="saidaTanque"
            value={tanqueId}
            onChange={(e) => setTanqueId(e.target.value)}
            options={tanquesVisiveis.map((t) => ({
              value: t.id,
              label: t.apelido ? `${t.apelido} (${t.nome})` : t.nome,
            }))}
            placeholder={obraId ? 'Selecione tanque' : 'Selecione obra primeiro'}
            disabled={!obraId}
            required
          />
        )}

        <div>
          <label htmlFor="saidaEtapa" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Etapa
          </label>
          {obraId ? (
            <FilterCombobox
              value={etapaId}
              onChange={setEtapaId}
              options={etapasDaObra.map((et) => ({ value: et.id, label: et.nome }))}
              placeholder="Buscar etapa por código ou nome (opcional)"
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
        </div>

        <div>
          {origem === 'tanque' && tanqueId && tanqueExterno ? (
            // Tanque externo (Transterra): Select habilitado — fornece múltiplos
            // combustíveis (Diesel S10 + Arla). Default sugerido = Diesel S10
            // via tipoCombustivelDoTanque, mas usuário troca pra Arla quando
            // for o caso.
            <Select
              label="Tipo de Combustível"
              id="saidaCombustivel"
              value={tipoCombustivel}
              onChange={(e) => setTipoCombustivel(e.target.value)}
              options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Selecione combustível"
              required
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
            <Select
              label="Tipo de Combustível"
              id="saidaCombustivel"
              value={tipoCombustivel}
              onChange={(e) => setTipoCombustivel(e.target.value)}
              options={listaCombustiveis.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Selecione combustível"
              required
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
                    setTipoCombustivel(novo.id);
                    setNovoCombustivelNome('');
                    setNovoCombustivelAberto(false);
                  }}
                >
                  Salvar
                </Button>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => { setNovoCombustivelAberto(false); setNovoCombustivelNome(''); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Quantidade (litros)"
          id="saidaLitros"
          type="number"
          step="0.001"
          min="0"
          value={litrosStr}
          onChange={(e) => setLitrosStr(e.target.value)}
          required
        />

        {/* Preço unitário: input manual quando origem != tanque */}
        {origem !== 'tanque' && (
          <Input
            label="Preço Unitário (R$/L)"
            id="saidaPrecoUnit"
            type="number"
            step="0.0001"
            min="0"
            value={precoUnitarioManualStr}
            onChange={(e) => setPrecoUnitarioManualStr(e.target.value)}
            required
          />
        )}

        {/* Tanque externo (Transterra): preço Areacre cobra (vai pro crédito proprietária) */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && tanqueExterno && (
          <Input
            label={`Preço ${proprietariaNomeAtual} cobra (R$/L)`}
            id="saidaPrecoAreacre"
            type="number"
            step="any"
            min="0"
            value={precoCombustivelAreacreStr}
            onChange={(e) => setPrecoCombustivelAreacreStr(e.target.value)}
            required
          />
        )}

        {/* Preço combustível: cobrado da transportadora (default = preço médio) */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && (
          <Input
            label={tanqueExterno ? "Preço cobrado da transportadora (R$/L)" : "Preço Combustível (R$/L)"}
            id="saidaPrecoCombustivel"
            type="number"
            step="any"
            min="0"
            value={precoCombustivelStr}
            onChange={(e) => setPrecoCombustivelStr(e.target.value)}
            placeholder={precoMedioTanque > 0 ? precoMedioTanque.toFixed(4) : '0,0000'}
            required
          />
        )}

        {/* Taxa por litro: só carreta + origem=tanque */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && (
          <Input
            label={tanqueExterno ? `Taxa ${proprietariaNomeAtual} (R$/L)` : "Taxa por Litro (R$/L)"}
            id="saidaTaxa"
            type="number"
            step="any"
            min="0"
            value={taxaLitroStr}
            onChange={(e) => setTaxaLitroStr(e.target.value)}
            placeholder="0,0000"
          />
        )}

        {/* Preview da soma cobrada */}
        {tipoConsumidor === 'carreta_transportadora' && origem === 'tanque' && (precoCombustivelNum > 0 || taxaLitro > 0) && (
          <p className="md:col-span-2 text-sm text-gray-600 dark:text-slate-400">
            Preço unitário cobrado: <strong>{fmtBRL(precoUnitario, 4)}/L</strong>
            {' '}({fmtBRL(precoCombustivelNum, 4)} combustível + {fmtBRL(taxaLitro, 4)} taxa)
          </p>
        )}
      </div>

      {/* Preview de cálculo — só renderiza quando tem dado */}
      {litros > 0 && precoUnitario > 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Cálculo
          </div>
          <div className="text-sm font-mono text-gray-800">
            {litros.toLocaleString('pt-BR')} L &nbsp;×&nbsp;
            R$ {precoUnitario.toFixed(4)} &nbsp;=&nbsp;
            <span className="font-bold text-emt-verde-escuro">{fmtBRL(valorTotal)}</span>
          </div>
          {origem === 'tanque' && precoMedioTanque > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              (preço médio do tanque R$ {precoMedioTanque.toFixed(4)}
              {taxaLitro > 0 && ` + taxa R$ ${taxaLitro.toFixed(4)}`})
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
              const corClass = linha.cor === 'verde'
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
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Opcional"
        />
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Foto (opcional)
        </label>
        <FotoCaptureUploader
          fotosUrls={fotoUrls}
          onChange={setFotoUrls}
          pastaId={initial?.id ?? 'novo'}
        />
      </div>

      {/* Pago/PagoEm — só requisição */}
      {origem === 'requisicao' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={pago}
              onChange={(e) => setPago(e.target.checked)}
            />
            Pago
          </label>
          <Input
            label="Pago em"
            id="saidaPagoEm"
            type="datetime-local"
            value={pagoEm.length >= 16 ? pagoEm.slice(0, 16) : pagoEm}
            onChange={(e) => setPagoEm(e.target.value ? `${e.target.value}:00` : '')}
            disabled={!pago}
          />
        </div>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Saída'}
        </Button>
      </div>
    </form>
  );
}
