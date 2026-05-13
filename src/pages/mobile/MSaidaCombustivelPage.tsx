// Marco 7 / PR33 — Saída de combustível pelo mobile.
//
// Operador escaneia o QR, escolhe "Saída de combustível", seleciona o
// tanque/depósito de onde está saindo o combustível, informa litros,
// medição do horímetro/odômetro (opcional) e foto da bomba (opcional).
// Online: insert direto em saidas_combustivel. Offline: TODO em PR
// posterior se houver demanda.

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Droplet, Camera, X, CheckCircle2, AlertTriangle, Gauge } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useDepositos } from '../../hooks/useDepositos';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

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

  const tanquesAtivos = useMemo(
    () => depositos.filter((d) => d.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [depositos]
  );

  const [tanqueId, setTanqueId] = useState('');
  const [litros, setLitros] = useState('');
  const [medicaoLeitura, setMedicaoLeitura] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pre-seleciona tanque se só houver 1 ativo
  useEffect(() => {
    if (!tanqueId && tanquesAtivos.length === 1) {
      setTanqueId(tanquesAtivos[0].id);
    }
  }, [tanqueId, tanquesAtivos]);

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

  const tanqueSelecionado = tanquesAtivos.find((t) => t.id === tanqueId);
  const litrosNum = numOrZero(litros);
  const podeSalvar = !!tanqueId && litrosNum > 0;

  function setFoto(file: File | null) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    if (!file) {
      setFotoFile(null);
      setFotoPreview(null);
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !equipamentoId || !equipamento || !tanqueSelecionado) return;
    setErro(null);
    setSubmitting(true);
    try {
      const saidaId = gerarId('saida');

      // Upload da foto se houver
      let fotoUrl: string | null = null;
      if (fotoFile) {
        const ext = (fotoFile.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const path = `saida/${saidaId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('abastecimento-fotos')
          .upload(path, fotoFile, { contentType: fotoFile.type });
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('abastecimento-fotos')
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          fotoUrl = signed?.signedUrl ?? null;
        }
      }

      // Preço médio do tanque (snapshot) — usado pra calcular valor_total
      // Se o tanque tem nivelAtualLitros > 0 e algum preco médio salvo, usa.
      // Caso contrário, deixa 0 (operador pode revisar depois pelo desktop).
      // Como nao temos o preco médio direto no Deposito interface, usamos 0.
      const precoUnitario = 0;
      const taxaLitro = 0;
      const valorTotal = litrosNum * precoUnitario;
      const medicaoNum = medicaoLeitura.trim() ? numOrZero(medicaoLeitura) : null;
      const agora = new Date().toISOString();

      const { error } = await supabase.from('saidas_combustivel').insert({
        id: saidaId,
        data: agora,
        origem: 'tanque',
        tipo_consumidor: 'equipamento',
        tanque_id: tanqueId,
        equipamento_id: equipamentoId,
        transportadora_id: null,
        placa: null,
        obra_id: null,
        etapa_id: null,
        alocacoes: [],
        tipo_combustivel: 'diesel',  // default; tanque pode ter outro mas operador raramente vai precisar mudar
        litros: litrosNum,
        preco_medio_tanque_snapshot: null,
        taxa_litro: taxaLitro,
        preco_unitario: precoUnitario,
        valor_total: valorTotal,
        observacoes: observacoes.trim() || `Saída via mobile · ${usuario?.nome ?? ''}`,
        pago: false,
        foto_urls: fotoUrl ? [fotoUrl] : [],
        arquivo_urls: [],
        motorista: usuario?.nome ?? '',
        medicao_no_abastecimento: medicaoNum,
        tipo_medicao_snapshot: equipamento.tipoMedicao,
        created_by: usuario?.nome ?? '',
        updated_by: usuario?.nome ?? '',
      });
      if (error) throw error;

      if (fotoPreview) URL.revokeObjectURL(fotoPreview);

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
          <select
            id="tanqueSel"
            value={tanqueId}
            onChange={(e) => setTanqueId(e.target.value)}
            required
            className="w-full h-12 rounded-xl px-3 text-base bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          >
            <option value="">Selecione…</option>
            {tanquesAtivos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.nivelAtualLitros != null && ` · ${t.nivelAtualLitros.toLocaleString('pt-BR')}L`}
              </option>
            ))}
          </select>
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
            Foto (bomba, hodômetro) — opcional
          </label>
          {fotoPreview ? (
            <div className="relative">
              <img
                src={fotoPreview}
                alt="Foto"
                className="w-full max-h-64 object-contain rounded-lg border border-[var(--color-border)] bg-black/30"
              />
              <button
                type="button"
                onClick={() => setFoto(null)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                aria-label="Remover foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] text-sm font-medium text-[var(--color-fg)] cursor-pointer">
              <Camera className="w-5 h-5" />
              Tirar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
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
