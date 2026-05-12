// Marco 3 / PR15 — Modal para criar/editar plano preventivo.
//
// Campos: nome, tipo de equipamento (autocomplete a partir dos tipos existentes
// na frota), fabricante (opcional), modelo de referência (opcional), ativo,
// observações. O dono do plano (createdBy) vem do usuário logado.

import { useState, useMemo, type FormEvent } from 'react';
import type { PlanoPreventivo } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { useSalvarPlano } from '../../../hooks/usePlanosPreventivos';
import { useEquipamentos } from '../../../hooks/useEquipamentos';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  planoExistente?: PlanoPreventivo;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function NovoPlanoModal({ open, onClose, planoExistente }: Props) {
  const { usuario } = useAuth();
  const salvar = useSalvarPlano();
  const { data: equipamentos = [] } = useEquipamentos();

  const [nome, setNome] = useState(planoExistente?.nome ?? '');
  const [tipoEquipamento, setTipoEquipamento] = useState(planoExistente?.tipoEquipamento ?? '');
  const [fabricante, setFabricante] = useState(planoExistente?.fabricante ?? '');
  const [modeloReferencia, setModeloReferencia] = useState(planoExistente?.modeloReferencia ?? '');
  const [ativo, setAtivo] = useState(planoExistente?.ativo ?? true);
  const [observacoes, setObservacoes] = useState(planoExistente?.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tipos de equipamento que existem na frota — sugestões de tipoEquipamento
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const eq of equipamentos) {
      if (eq.tipo) set.add(eq.tipo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map((t) => ({
      value: t,
      label: t,
    }));
  }, [equipamentos]);

  const podeSalvar = !!nome.trim() && !!tipoEquipamento.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const plano: PlanoPreventivo = {
        id: planoExistente?.id ?? gerarId(),
        nome: nome.trim(),
        tipoEquipamento: tipoEquipamento.trim(),
        fabricante: fabricante.trim(),
        modeloReferencia: modeloReferencia.trim(),
        ativo,
        observacoes: observacoes.trim(),
        createdAt: planoExistente?.createdAt ?? now,
        createdBy: planoExistente?.createdBy ?? (usuario?.nome ?? ''),
        updatedAt: now,
        updatedBy: usuario?.nome ?? '',
      };
      await salvar.mutateAsync(plano);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar plano');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={planoExistente ? 'Editar plano' : 'Novo plano preventivo'} size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome do plano"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Plano Cat 320C — Padrão"
        />

        <div>
          <label htmlFor="planoTipo" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Tipo de equipamento <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            id="planoTipo"
            list="planoTiposDisponiveis"
            value={tipoEquipamento}
            onChange={(e) => setTipoEquipamento(e.target.value)}
            placeholder="Ex.: Escavadeira hidráulica"
            required
            className="w-full h-[36px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <datalist id="planoTiposDisponiveis">
            {tiposDisponiveis.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </datalist>
          <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
            Decide a quais equipamentos este plano se aplica. Sugestões vêm da
            frota cadastrada.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Fabricante (opcional)"
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            placeholder="Ex.: Caterpillar"
          />
          <Input
            label="Modelo de referência (opcional)"
            value={modeloReferencia}
            onChange={(e) => setModeloReferencia(e.target.value)}
            placeholder="Ex.: 320C"
          />
        </div>

        <div>
          <label htmlFor="planoObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observações
          </label>
          <textarea
            id="planoObs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas internas (ex.: baseado no manual técnico do fabricante)"
            className="w-full min-h-[80px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="rounded border-[var(--color-border)]"
          />
          Plano ativo (aparece nas sugestões para aplicar a equipamentos)
        </label>

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
            {submitting ? 'Salvando…' : planoExistente ? 'Salvar alterações' : 'Criar plano'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
