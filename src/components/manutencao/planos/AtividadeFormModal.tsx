// Marco 3 / PR15 — Modal para criar/editar atividade de um plano preventivo.
//
// Atividade: peça/serviço a executar periodicamente. Pelo menos UMA das três
// periodicidades (horímetro, km ou dias) deve ser informada — o backend tem
// constraint disso. UI valida antes pra evitar erro feio.

import { useState, type FormEvent } from 'react';
import type { PlanoAtividade, CategoriaAtividade } from '../../../types';
import { CATEGORIA_ATIVIDADE_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import { useSalvarAtividade } from '../../../hooks/usePlanosPreventivos';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  planoId: string;
  atividadeExistente?: PlanoAtividade;
  proximaOrdem: number;
}

const CATEGORIA_OPTIONS: { value: CategoriaAtividade | ''; label: string }[] = [
  { value: '', label: '— Sem categoria —' },
  ...(Object.keys(CATEGORIA_ATIVIDADE_LABEL) as CategoriaAtividade[]).map((k) => ({
    value: k,
    label: CATEGORIA_ATIVIDADE_LABEL[k],
  })),
];

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function numOrNull(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function AtividadeFormModal({
  open, onClose, planoId, atividadeExistente, proximaOrdem,
}: Props) {
  const { usuario } = useAuth();
  const salvar = useSalvarAtividade();

  const [nome, setNome] = useState(atividadeExistente?.nome ?? '');
  const [categoria, setCategoria] = useState<CategoriaAtividade | ''>(
    atividadeExistente?.categoria ?? ''
  );
  const [periodicidadeHorimetro, setPeriodicidadeHorimetro] = useState(
    atividadeExistente?.periodicidadeHorimetro?.toString() ?? ''
  );
  const [periodicidadeKm, setPeriodicidadeKm] = useState(
    atividadeExistente?.periodicidadeKm?.toString() ?? ''
  );
  const [periodicidadeDias, setPeriodicidadeDias] = useState(
    atividadeExistente?.periodicidadeDias?.toString() ?? ''
  );
  const [toleranciaPercentual, setToleranciaPercentual] = useState(
    atividadeExistente?.toleranciaPercentual?.toString() ?? '10'
  );
  const [tempoEstimadoH, setTempoEstimadoH] = useState(
    atividadeExistente?.tempoEstimadoH?.toString() ?? ''
  );
  const [custoEstimado, setCustoEstimado] = useState(
    atividadeExistente?.custoEstimado?.toString() ?? ''
  );
  const [procedimento, setProcedimento] = useState(atividadeExistente?.procedimento ?? '');
  const [obrigatoria, setObrigatoria] = useState(atividadeExistente?.obrigatoria ?? true);
  const [exigeOficinaExterna, setExigeOficinaExterna] = useState(
    atividadeExistente?.exigeOficinaExterna ?? false
  );
  const [epiInput, setEpiInput] = useState((atividadeExistente?.epiNecessario ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temPeriodicidade =
    !!periodicidadeHorimetro.trim() ||
    !!periodicidadeKm.trim() ||
    !!periodicidadeDias.trim();
  const podeSalvar = !!nome.trim() && temPeriodicidade;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      const epi = epiInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const atividade: PlanoAtividade = {
        id: atividadeExistente?.id ?? gerarId(),
        planoId,
        nome: nome.trim(),
        categoria: categoria || null,
        periodicidadeHorimetro: numOrNull(periodicidadeHorimetro),
        periodicidadeKm: numOrNull(periodicidadeKm),
        periodicidadeDias: numOrNull(periodicidadeDias),
        toleranciaPercentual: numOrNull(toleranciaPercentual) ?? 10,
        tempoEstimadoH: numOrNull(tempoEstimadoH),
        custoEstimado: numOrNull(custoEstimado),
        procedimento: procedimento.trim(),
        obrigatoria,
        ordem: atividadeExistente?.ordem ?? proximaOrdem,
        exigeOficinaExterna,
        epiNecessario: epi,
        arquivoUrls: atividadeExistente?.arquivoUrls ?? [],
        createdAt: atividadeExistente?.createdAt ?? new Date().toISOString(),
        createdBy: atividadeExistente?.createdBy ?? (usuario?.nome ?? ''),
      };
      await salvar.mutateAsync(atividade);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar atividade');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={atividadeExistente ? 'Editar atividade' : 'Nova atividade'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome da atividade"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Troca de óleo do motor + filtros"
        />

        <Select
          label="Categoria"
          id="atvCategoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaAtividade | '')}
          options={CATEGORIA_OPTIONS}
        />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Periodicidade (preencha pelo menos UMA)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Horímetro (h)"
              type="number"
              min="0"
              step="any"
              value={periodicidadeHorimetro}
              onChange={(e) => setPeriodicidadeHorimetro(e.target.value)}
              placeholder="Ex.: 250"
            />
            <Input
              label="Km"
              type="number"
              min="0"
              step="any"
              value={periodicidadeKm}
              onChange={(e) => setPeriodicidadeKm(e.target.value)}
              placeholder="Ex.: 10000"
            />
            <Input
              label="Dias"
              type="number"
              min="0"
              step="1"
              value={periodicidadeDias}
              onChange={(e) => setPeriodicidadeDias(e.target.value)}
              placeholder="Ex.: 90"
            />
          </div>
          {!temPeriodicidade && (
            <p className="mt-1.5 text-xs text-[var(--color-warning-fg)]">
              Defina pelo menos uma das três periodicidades. A primeira que
              vencer dispara a atividade.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Tolerância (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            value={toleranciaPercentual}
            onChange={(e) => setToleranciaPercentual(e.target.value)}
          />
          <Input
            label="Tempo estimado (h)"
            type="number"
            min="0"
            step="any"
            value={tempoEstimadoH}
            onChange={(e) => setTempoEstimadoH(e.target.value)}
            placeholder="Ex.: 2"
          />
          <Input
            label="Custo estimado (R$)"
            type="number"
            min="0"
            step="any"
            value={custoEstimado}
            onChange={(e) => setCustoEstimado(e.target.value)}
            placeholder="Ex.: 850"
          />
        </div>

        <div>
          <label htmlFor="atvProc" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Procedimento
          </label>
          <textarea
            id="atvProc"
            rows={4}
            value={procedimento}
            onChange={(e) => setProcedimento(e.target.value)}
            placeholder="Passo a passo para o mecânico. Ex.: 1) Drenar óleo a quente. 2) Trocar filtro principal. 3) Abastecer com 15W40 SAE 13L."
            className="w-full min-h-[100px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <Input
          label="EPIs necessários (separar por vírgula)"
          value={epiInput}
          onChange={(e) => setEpiInput(e.target.value)}
          placeholder="Ex.: luva nitrílica, óculos de proteção, botina"
        />

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={obrigatoria}
              onChange={(e) => setObrigatoria(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            Obrigatória (bloqueia operação se vencer)
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={exigeOficinaExterna}
              onChange={(e) => setExigeOficinaExterna(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            Exige oficina externa
          </label>
        </div>

        {erro && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Salvando…' : atividadeExistente ? 'Salvar alterações' : 'Adicionar atividade'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
