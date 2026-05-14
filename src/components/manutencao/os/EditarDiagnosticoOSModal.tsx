// Marco 2 / PR11 — Modal para editar diagnóstico técnico da OS:
// sistemas afetados, causa raiz, solução aplicada, recomendações.

import { useState, useCallback, type FormEvent } from 'react';
import type { OrdemServico } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  os: OrdemServico;
  onSubmit: (patch: Partial<OrdemServico>) => Promise<void>;
}

const SISTEMAS = [
  'motor', 'transmissao', 'hidraulico', 'eletrico', 'freios',
  'pneumatico', 'estrutural', 'cabine', 'lubrificacao', 'arrefecimento',
];

export default function EditarDiagnosticoOSModal({ open, onClose, os, onSubmit }: Props) {
  const [sistemasAfetados, setSistemasAfetados] = useState<string[]>(os.sistemasAfetados);
  const [causaRaiz, setCausaRaiz] = useState(os.causaRaiz);
  const [solucaoAplicada, setSolucaoAplicada] = useState(os.solucaoAplicada);
  const [recomendacoes, setRecomendacoes] = useState(os.recomendacoes);
  const [submitting, setSubmitting] = useState(false);

  function toggleSistema(s: string) {
    setSistemasAfetados((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  }

  const { temAcao } = useAuth();
  const canEditarDiag = temAcao('editar_diagnostico_os');
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditarDiag) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        sistemasAfetados,
        causaRaiz: causaRaiz.trim(),
        solucaoAplicada: solucaoAplicada.trim(),
        recomendacoes: recomendacoes.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, sistemasAfetados, causaRaiz, solucaoAplicada, recomendacoes, onSubmit, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Editar diagnóstico" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Sistemas afetados
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SISTEMAS.map((s) => {
              const ativo = sistemasAfetados.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSistema(s)}
                  className={
                    'text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ' +
                    (ativo
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]')
                  }
                >
                  {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="causaRaiz" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Causa raiz
          </label>
          <textarea
            id="causaRaiz"
            rows={3}
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            placeholder="Ex.: O'ring envelhecido na conexão do cilindro principal causou vazamento sob pressão."
            className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div>
          <label htmlFor="solucao" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Solução aplicada
          </label>
          <textarea
            id="solucao"
            rows={3}
            value={solucaoAplicada}
            onChange={(e) => setSolucaoAplicada(e.target.value)}
            placeholder="Ex.: Troca de O'ring e vedação. Teste de pressão a 200 bar OK."
            className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div>
          <label htmlFor="recomendacoes" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Recomendações
          </label>
          <textarea
            id="recomendacoes"
            rows={2}
            value={recomendacoes}
            onChange={(e) => setRecomendacoes(e.target.value)}
            placeholder="Próxima troca preventiva, peças que devem ser monitoradas, etc."
            className="w-full min-h-[56px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar diagnóstico'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
