/**
 * CategoriaFinanceiraQuickModal — Cadastro rápido de categoria financeira
 * a partir do formulário de Lançamento Financeiro.
 *
 * Quando o usuário não encontra a categoria certa na lista, clica em
 * "+ Nova categoria" e cria uma direto, sem precisar ir até a aba
 * Categorias. O lançamento atual vincula automaticamente após salvar.
 */
import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import { useAdicionarCategoriaFinanceira } from '../../hooks/useCategoriasFinanceiras';
import { useToast } from '../ui/Toast';
import type { CategoriaFinanceira } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nome inicial — pode vir do que o usuário digitou em um combobox. */
  nomeInicial?: string;
  /** Próxima ordem sugerida (last + 10). */
  ordemSugerida?: number;
  /** Callback após salvar com sucesso — recebe a categoria criada. */
  onCriada: (cat: CategoriaFinanceira) => void;
}

function gerarId(): string {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function CategoriaFinanceiraQuickModal({
  open, onClose, nomeInicial = '', ordemSugerida = 0, onCriada,
}: Props) {
  const adicionar = useAdicionarCategoriaFinanceira();
  const { showToast } = useToast();

  const [nome, setNome] = useState(nomeInicial);
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [ordem, setOrdem] = useState<number>(ordemSugerida || 999);
  const [submitting, setSubmitting] = useState(false);

  const podeSalvar = nome.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setSubmitting(true);
    try {
      const cat: CategoriaFinanceira = {
        id: gerarId(),
        nome: nome.trim(),
        tipo,
        ordem,
        ativo: true,
      };
      await adicionar.mutateAsync(cat);
      showToast({ kind: 'success', message: `Categoria "${cat.nome}" criada.` });
      onCriada(cat);
      setNome('');
      setTipo('despesa');
      setOrdem(999);
      onClose();
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao criar categoria.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastro rápido de categoria financeira" size="default">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[var(--color-fg-subtle)] -mt-1">
          Crie a categoria agora e use direto no lançamento. Você pode editar
          depois em <strong>Financeiro → Categorias</strong>.
        </p>

        <Input
          label="Nome da categoria"
          required
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Honorários contábeis · Multa de trânsito · Aluguel"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
              Tipo
            </label>
            <SmartSelect
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'despesa' | 'receita')}
              className="w-full h-[42px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-accent)] flex items-center"
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </SmartSelect>
          </div>
          <Input
            label="Ordem"
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value))}
            placeholder="999"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Salvando…' : 'Cadastrar categoria'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
