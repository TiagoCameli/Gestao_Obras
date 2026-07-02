// Marco 5 / PR27 — Apontamento de medição (horímetro/km) pelo mobile.
//
// Salva direto se online, enfileira se offline. Reaproveita o tipo de
// medição configurado no equipamento.

import { useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Gauge, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import {
  useMedicaoAtual, useAdicionarMedicao,
} from '../../hooks/useMedicoesEquipamento';
import { enqueueMedicao } from '../../lib/offlineQueue';
import { indexedDBSuportado } from '../../lib/offlineQueue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import type { MedicaoEquipamento } from '../../types';

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function gerarId(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function MMedicaoPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);
  const adicionarMedicao = useAdicionarMedicao();

  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeIso());
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  const valorNum = valor.trim() ? Number(valor.replace(',', '.')) : NaN;
  const podeSalvar = Number.isFinite(valorNum) && valorNum >= 0 && !!data;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !equipamentoId || !equipamento) return;
    setErro(null);
    setSubmitting(true);
    try {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      let usouFila = false;

      if (online) {
        try {
          const medicao: MedicaoEquipamento = {
            id: gerarId('med'),
            equipamentoId,
            data,
            tipoMedicao: equipamento.tipoMedicao,
            valor: valorNum,
            origem: 'apontamento',
            origemId: null,
            observacoes: observacoes.trim(),
            fotoUrls: [],
            arquivoUrls: [],
            createdAt: new Date().toISOString(),
            createdBy: usuario?.nome ?? '',
          };
          await adicionarMedicao.mutateAsync(medicao);
        } catch (err) {
          if (indexedDBSuportado()) {
            await enqueueMedicao({
              equipamentoId,
              equipamentoNome: equipamento.nome,
              tipoMedicao: equipamento.tipoMedicao,
              valor: valorNum,
              data,
              observacoes: observacoes.trim(),
              origem: 'apontamento',
              operadorNome: usuario?.nome ?? '',
            });
            usouFila = true;
          } else {
            throw err;
          }
        }
      } else if (indexedDBSuportado()) {
        await enqueueMedicao({
          equipamentoId,
          equipamentoNome: equipamento.nome,
          tipoMedicao: equipamento.tipoMedicao,
          valor: valorNum,
          data,
          observacoes: observacoes.trim(),
          origem: 'apontamento',
          operadorNome: usuario?.nome ?? '',
        });
        usouFila = true;
      } else {
        throw new Error('Sem internet e navegador sem suporte a fila offline.');
      }

      showToast({
        kind: 'success',
        message: usouFila ? 'Medição registrada (sincronizará depois).' : 'Medição registrada.',
      });
      navigate('/m');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar medição');
    } finally {
      setSubmitting(false);
    }
  }

  const unidade = equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km';
  const label = equipamento.tipoMedicao === 'horimetro' ? 'horímetro' : 'odômetro';

  return (
    <div className="space-y-4 pb-24">
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
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
          {equipamento.tipo} · Apontar leitura do {label}
        </p>
      </div>

      {medicaoAtual && (
        <div className="rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info-fg)] p-3 text-sm">
          <div className="text-[11px] uppercase tracking-wider opacity-80">Última leitura</div>
          <div className="text-base font-semibold mt-0.5">
            {medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} {unidade}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {new Date(medicaoAtual.dataUltimaLeitura).toLocaleDateString('pt-BR')}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="medValor" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Leitura atual do {label} ({unidade}) <span className="text-[var(--color-danger)]">*</span>
          </label>
          <div className="relative">
            <Gauge className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
            <input
              id="medValor"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 1234"
              className="w-full h-12 rounded-xl pl-10 pr-3 text-lg font-mono bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          {medicaoAtual && Number.isFinite(valorNum) && valorNum < medicaoAtual.medicaoAtual && (
            <p className="mt-1 text-xs text-[var(--color-warning-fg)]">
              Atenção: leitura abaixo da última registrada ({medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} {unidade}).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="medData" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Data
          </label>
          <input
            id="medData"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="w-full h-12 rounded-xl px-3 text-base bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div>
          <label htmlFor="medObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Observações
          </label>
          <textarea
            id="medObs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
            className="w-full min-h-[60px] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        {erro && (
          <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
          <Button type="submit" disabled={!podeSalvar || submitting} className="w-full h-12 text-base font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {submitting ? 'Salvando…' : 'Registrar medição'}
          </Button>
        </div>
      </form>
    </div>
  );
}
