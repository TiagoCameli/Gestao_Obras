// Marco 7 / PR33 — Saída de combustível pelo mobile.
//
// Operador escaneia o QR, escolhe "Saída de combustível", seleciona o
// tanque/depósito de onde está saindo o combustível, informa litros,
// medição do horímetro/odômetro (opcional) e foto da bomba (opcional).
// Online: insert via useAdicionarSaidaCombustivel (invalida 5 query keys).
// Offline: TODO em PR posterior se houver demanda.
//
// HF.5 — Fix bugs S1-S6 da auditoria:
//   S1: tipo_consumidor='equipamento_proprio' (era 'equipamento', violava CHECK)
//   S2: preco_unitario e valor_total calculados via precoMedioTanque (era 0)
//   S3: tipo_combustivel = combustivelAtualId do depósito (era 'diesel' hardcoded)
//   S4: preco_medio_tanque_snapshot persistido (era null)
//   S5: usa hook (invalida cache React Query — era insert direto)
//   S6: alocacoes=[{etapaId, percentual:100}] quando etapa preenchida (era [])

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Droplet, CheckCircle2, AlertTriangle, Gauge, Fuel } from 'lucide-react';
import Button from '../../components/ui/Button';
import SmartSelect from '../../components/ui/SmartSelect';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useDepositos } from '../../hooks/useDepositos';
import { useObras } from '../../hooks/useObras';
import { useEtapas } from '../../hooks/useEtapas';
import { useInsumos } from '../../hooks/useInsumos';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import AnexosUploader from '../../components/combustivel/AnexosUploader';
import { useRegistrarSaidaFIFO, useSaidasCombustivel } from '../../hooks/useSaidasCombustivel';
import { useEntradasCombustivel } from '../../hooks/useEntradasCombustivel';
import { useTransferenciasCombustivel } from '../../hooks/useTransferenciasCombustivel';
import { calcularPrecoFIFO } from '../../utils/fifoCombustivel';
import { calcularEstoqueCombustivelNaData } from '../../hooks/useEstoque';
import { nowAsLocalInput, inputLocalToWallClock, fmtBRL } from '../../components/combustivel/v2/shared/formatters';

function gerarId(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function numOrZero(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default function MSaidaCombustivelPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);
  const { data: depositos = [] } = useDepositos();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: entradasCombustivel = [] } = useEntradasCombustivel();
  const { data: transferencias = [] } = useTransferenciasCombustivel();
  const { data: insumos = [] } = useInsumos();
  // FI.5 — saídas existentes pro replay FIFO + mutation atômica via RPC.
  const { data: saidasExistentes = [] } = useSaidasCombustivel();
  const registrarSaidaFIFOMut = useRegistrarSaidaFIFO();

  const tanquesAtivos = useMemo(
    () => depositos.filter((d) => d.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [depositos]
  );
  const obrasOrdenadas = useMemo(
    () => [...obras].sort((a, b) => a.nome.localeCompare(b.nome)),
    [obras]
  );

  const [tanqueId, setTanqueId] = useState('');
  const [obraId, setObraId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [litros, setLitros] = useState('');
  const [medicaoLeitura, setMedicaoLeitura] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Etapas da obra selecionada
  const etapasDaObra = useMemo(
    () => etapas.filter((e) => e.obraId === obraId).sort((a, b) => a.nome.localeCompare(b.nome)),
    [etapas, obraId]
  );

  // Tanque selecionado e preço médio (antes do early return, Rules of Hooks)
  const tanqueSelecionado = useMemo(
    () => tanquesAtivos.find((t) => t.id === tanqueId),
    [tanquesAtivos, tanqueId],
  );

  // FI.5 — Preço FIFO real (custeio por lote). Substitui média vitalícia.
  // Preview reativo: usa litros digitados + "agora" como data. No submit
  // a gente recalcula pra garantir consistência com o timestamp final.
  const fifoPreview = useMemo(() => {
    if (!tanqueId) {
      return { precoMedio: 0, detalhamento: [] as ReturnType<typeof calcularPrecoFIFO>['detalhamento'], litrosSemSuprimento: 0 };
    }
    const litrosNum = Number(litros.replace(',', '.'));
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
      return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 };
    }
    return calcularPrecoFIFO({
      tanqueId,
      dataHora: new Date().toISOString().slice(0, 19),
      litros: litrosNum,
      entradas: entradasCombustivel,
      transferencias,
      tipoCombustivel: tanqueSelecionado?.combustivelAtualId ?? '',
      saidasAnteriores: saidasExistentes.filter((s) => s.tanqueId === tanqueId),
    });
  }, [tanqueId, litros, entradasCombustivel, transferencias, saidasExistentes, tanqueSelecionado?.combustivelAtualId]);
  const precoMedioTanque = fifoPreview.precoMedio;

  const combustivelDoTanque = tanqueSelecionado?.combustivelAtualId ?? '';

  // Nome amigável do combustível pra exibir no card de resumo.
  const combustivelNome = useMemo(() => {
    if (!combustivelDoTanque) return null;
    return insumos.find((i) => i.id === combustivelDoTanque)?.nome ?? null;
  }, [combustivelDoTanque, insumos]);

  // HF.5 — Saldo atual do tanque (mobile usa "agora" como data da saída,
  // então o cálculo point-in-time é equivalente ao nível atual; mantemos
  // a RPC pra consistência com o web e pro caso da regra do tanque
  // mudar pra permitir backdate no mobile).
  const [saldoTanque, setSaldoTanque] = useState(0);
  useEffect(() => {
    if (!tanqueId) {
      setSaldoTanque(tanqueSelecionado?.nivelAtualLitros ?? 0);
      return;
    }
    const agora = new Date().toISOString();
    calcularEstoqueCombustivelNaData(tanqueId, agora)
      .then(setSaldoTanque)
      .catch((err) => {
        console.error('[MSaidaCombustivelPage] saldo na data falhou', err);
        setSaldoTanque(tanqueSelecionado?.nivelAtualLitros ?? 0);
      });
  }, [tanqueId, tanqueSelecionado?.nivelAtualLitros]);

  // Pre-seleciona tanque se só houver 1 ativo
  useEffect(() => {
    if (!tanqueId && tanquesAtivos.length === 1) {
      setTanqueId(tanquesAtivos[0].id);
    }
  }, [tanqueId, tanquesAtivos]);

  // Quando troca de obra, limpa etapa (pode ser de outra obra)
  useEffect(() => {
    setEtapaId('');
  }, [obraId]);

  if (!equipamento) {
    return (
      <div className="space-y-3">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <p className="text-sm text-[var(--color-danger-fg)]">Equipamento não encontrado.</p>
      </div>
    );
  }

  const litrosNum = numOrZero(litros);
  const valorTotalAtual = litrosNum * precoMedioTanque;
  const saldoInsuficiente = !!tanqueSelecionado
    && !tanqueSelecionado.ehExterno
    && litrosNum > saldoTanque;
  const podeSalvar = !!tanqueId && !!obraId && !!etapaId && litrosNum > 0 && !saldoInsuficiente;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !equipamentoId || !equipamento || !tanqueSelecionado) return;
    setErro(null);
    setSubmitting(true);
    try {
      const saidaId = gerarId('saida');
      const medicaoNum = medicaoLeitura.trim() ? numOrZero(medicaoLeitura) : null;
      // Wall-clock: timestamp digitado/registrado pelo operador é o que vai pro DB.
      // Mobile não tem campo editável de data — usa "agora" do device como wall-clock.
      const agoraWallClock = inputLocalToWallClock(nowAsLocalInput());
      const agoraSistema = new Date().toISOString(); // pra createdAt/updatedAt (metadata)

      // FI.5 — Recalcula FIFO com timestamp final (consistência).
      const fifo = calcularPrecoFIFO({
        tanqueId,
        dataHora: agoraWallClock,
        litros: litrosNum,
        entradas: entradasCombustivel,
        transferencias,
        tipoCombustivel: combustivelDoTanque,
        saidasAnteriores: saidasExistentes.filter((s) => s.tanqueId === tanqueId),
      });
      const precoFIFO = fifo.precoMedio;
      const valorTotal = litrosNum * precoFIFO;

      await registrarSaidaFIFOMut.mutateAsync({
        saida: {
          id: saidaId,
          data: agoraWallClock,
          origem: 'tanque',
          tipoConsumidor: 'equipamento_proprio',   // S1: fix enum
          tanqueId,
          equipamentoId,
          transportadoraId: null,
          placa: null,
          obraId,
          etapaId,
          alocacoes: etapaId ? [{ etapaId, percentual: 100 }] : null,  // S6: fix alocacoes
          tipoCombustivel: combustivelDoTanque,    // S3: UUID do insumo do tanque
          litros: litrosNum,
          precoMedioTanqueSnapshot: precoFIFO,     // S4: snapshot FIFO persistido
          taxaLitro: 0,
          precoUnitario: precoFIFO,                // S2: preco calculado (FIFO)
          precoCombustivel: null,
          precoCombustivelAreacre: null,
          valorTotal,                              // S2: valor calculado
          observacoes: observacoes.trim() || `Saída via mobile · ${usuario?.nome ?? ''}`,
          pago: false,
          pagoEm: null,
          movimentoId: null,
          fotoUrls: fotoUrls,
          arquivoUrls: [],
          motorista: usuario?.nome ?? '',
          medicaoNoAbastecimento: medicaoNum,
          tipoMedicaoSnapshot: equipamento.tipoMedicao ?? null,
          createdAt: agoraSistema,
          updatedAt: agoraSistema,
          createdBy: usuario?.nome ?? null,
          updatedBy: null,
        },
        lotes: fifo.detalhamento.map((p) => ({
          fonteTipo: p.fonteTipo,
          fonteId: p.fonteId,
          litros: p.litros,
          precoLote: p.preco,
        })),
        litrosSemSuprimento: fifo.litrosSemSuprimento,
      });

      showToast({
        kind: 'success',
        message: `Saída de ${litrosNum.toLocaleString('pt-BR')}L registrada.`,
      });
      navigate(`/m/eq/${equipamentoId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar saída');
    } finally {
      setSubmitting(false);
    }
  }

  const unidade = equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km';

  return (
    <div className="space-y-4 pb-24">
      <Link to={`/m/eq/${equipamento.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
        {equipamento.codigoPatrimonio && (
          <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
            {equipamento.codigoPatrimonio}
          </div>
        )}
        <h1 className="text-base font-semibold text-[var(--color-fg)] mt-0.5">
          {equipamento.nome}
        </h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
          Registrar saída de combustível
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tanqueSel" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Tanque de origem <span className="text-[var(--color-danger)]">*</span>
          </label>
          <SmartSelect
            id="tanqueSel"
            value={tanqueId}
            onChange={(e) => setTanqueId(e.target.value)}
            required
            className="w-full h-12 rounded-xl px-3 text-base text-left bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center"
          >
            <option value="">Selecione…</option>
            {tanquesAtivos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.nivelAtualLitros != null && ` · ${t.nivelAtualLitros.toLocaleString('pt-BR')}L`}
              </option>
            ))}
          </SmartSelect>
        </div>

        {tanqueId && (
          <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg-muted)]">
              <Fuel className="w-4 h-4" />
              Resumo da saída
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">Combustível</div>
                <div className="text-sm font-semibold text-[var(--color-fg)] mt-0.5 truncate">
                  {combustivelNome ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">R$ / litro</div>
                <div className="text-sm font-semibold text-[var(--color-fg)] mt-0.5 font-mono">
                  {precoMedioTanque > 0 ? fmtBRL(precoMedioTanque) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">Total</div>
                <div className="text-sm font-semibold text-[var(--color-accent)] mt-0.5 font-mono">
                  {valorTotalAtual > 0 ? fmtBRL(valorTotalAtual) : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="obraSel" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Obra <span className="text-[var(--color-danger)]">*</span>
          </label>
          <SmartSelect
            id="obraSel"
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            required
            className="w-full h-12 rounded-xl px-3 text-base text-left bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center"
          >
            <option value="">Selecione…</option>
            {obrasOrdenadas.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </SmartSelect>
        </div>

        <div>
          <label htmlFor="etapaSel" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Etapa <span className="text-[var(--color-danger)]">*</span>
          </label>
          <SmartSelect
            id="etapaSel"
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            required
            disabled={!obraId}
            className="w-full h-12 rounded-xl px-3 text-base text-left bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center disabled:opacity-50"
          >
            <option value="">
              {!obraId ? 'Selecione a obra primeiro' : etapasDaObra.length === 0 ? 'Sem etapas cadastradas' : 'Selecione…'}
            </option>
            {etapasDaObra.map((et) => (
              <option key={et.id} value={et.id}>{et.nome}</option>
            ))}
          </SmartSelect>
        </div>

        <div>
          <label htmlFor="litros" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Litros abastecidos <span className="text-[var(--color-danger)]">*</span>
          </label>
          <div className="relative">
            <Droplet className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <input
              id="litros"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={litros}
              onChange={(e) => setLitros(e.target.value)}
              placeholder="Ex.: 80"
              className="w-full h-12 rounded-xl pl-10 pr-12 text-lg font-mono bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-fg-muted)]">L</span>
          </div>
          {saldoInsuficiente && (
            <div className="mt-1.5 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger-fg)]">
              Saldo insuficiente: {saldoTanque.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}L disponíveis no tanque.
            </div>
          )}
          {/* FI.5 — Warning: litros sem suprimento na linha do tempo. */}
          {fifoPreview.litrosSemSuprimento > 0 && (
            <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ {fifoPreview.litrosSemSuprimento.toFixed(2)} L sem suprimento registrado neste tanque.
            </div>
          )}
        </div>

        <div>
          <label htmlFor="medL" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Leitura do {equipamento.tipoMedicao === 'horimetro' ? 'horímetro' : 'odômetro'} ({unidade}) <span className="text-[var(--color-fg-subtle)]">(opcional)</span>
          </label>
          <div className="relative">
            <Gauge className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <input
              id="medL"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={medicaoLeitura}
              onChange={(e) => setMedicaoLeitura(e.target.value)}
              placeholder={medicaoAtual ? `Atual: ${medicaoAtual.medicaoAtual.toLocaleString('pt-BR')}` : `Ex.: 12345`}
              className="w-full h-12 rounded-xl pl-10 pr-3 text-base font-mono bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Fotos (bomba, hodômetro, equipamento) — até 8, opcional
          </label>
          <AnexosUploader
            fotoUrls={fotoUrls}
            arquivoUrls={[]}
            onChangeFotos={setFotoUrls}
            onChangeArquivos={() => {}}
            pastaId={`saida/${equipamentoId}`}
            hideArquivos
          />
        </div>

        <div>
          <label htmlFor="obs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Observações
          </label>
          <textarea
            id="obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
            className="w-full min-h-[56px] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {erro && (
          <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
          <Button type="submit" disabled={!podeSalvar || submitting} className="w-full h-12 text-base font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {submitting ? 'Registrando…' : 'Registrar saída'}
          </Button>
        </div>
      </form>
    </div>
  );
}
