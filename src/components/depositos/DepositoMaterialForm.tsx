/**
 * DepositoMaterialForm — formulário premium de depósito de material.
 *
 * Suporta criação e edição. Multi-select de obras (N:N) — depósito sem
 * obras = avulso/central.
 */
import { useCallback, useMemo, useState } from 'react';
import { Building2, AlertCircle, X, Check, Plus, Wrench } from 'lucide-react';
import type { DepositoMaterial, Obra } from '../../types';
import Button from '../ui/Button';
import SubmitButton from '../ui/SubmitButton';
import Input from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  initial: DepositoMaterial | null;
  obras: Obra[];
  onSubmit: (deposito: DepositoMaterial, obrasIds: string[]) => Promise<void>;
  onCancel: () => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function DepositoMaterialForm({ initial, obras, onSubmit, onCancel }: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const [nome, setNome] = useState(initial?.nome || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [responsavel, setResponsavel] = useState(initial?.responsavel || '');
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [ehAlmoxarifadoPecas, setEhAlmoxarifadoPecas] = useState(initial?.ehAlmoxarifadoPecas ?? false);
  const [obrasIds, setObrasIds] = useState<string[]>(initial?.obrasIds ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeSalvar = nome.trim().length >= 2;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (!podeSalvar) {
        setErro('Informe o nome do depósito (mínimo 2 caracteres).');
        return;
      }
      setSubmitting(true);
      try {
        const dep: DepositoMaterial = {
          id: initial?.id || genId(),
          nome: nome.trim(),
          // obraId legado: 1ª obra (compat com v1)
          obraId: obrasIds[0] || '',
          endereco: endereco.trim(),
          responsavel: responsavel.trim(),
          ativo,
          ehAlmoxarifadoPecas,
          criadoPor: initial?.criadoPor || usuario?.nome || '',
          atualizadoPor: usuario?.nome || '',
          obrasIds,
        };
        await onSubmit(dep, obrasIds);
        showToast({
          kind: 'success',
          message: initial ? `Depósito "${dep.nome}" atualizado.` : `Depósito "${dep.nome}" criado.`,
        });
      } catch (err) {
        setErro((err as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [podeSalvar, nome, endereco, responsavel, ativo, ehAlmoxarifadoPecas, obrasIds, initial, usuario, onSubmit, showToast]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cabeçalho com info importante */}
      {obrasIds.length === 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/60 dark:bg-violet-950/20 text-sm text-violet-900 dark:text-violet-200">
          <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Sem obras vinculadas — este será um <strong>depósito central/avulso</strong>.
            Materiais aqui podem ser usados em qualquer obra.
          </span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Nome do depósito <span className="text-rose-500">*</span></Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Almoxarifado Central, Canteiro BR-364" required autoFocus />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <Label>Responsável</Label>
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do almoxarife" />
        </div>
      </div>

      {/* Multi-select de obras */}
      <section>
        <Label>Obras vinculadas</Label>
        <p className="text-xs text-[var(--color-fg-subtle)] mb-2 -mt-1">
          Materiais deste depósito poderão ser alocados nas etapas dessas obras. Vazio = depósito central.
        </p>
        <ObrasMultiSelect obras={obras} selected={obrasIds} onChange={setObrasIds} />
      </section>

      {/* Tipo: almoxarifado de peças? */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5">
        <label className="inline-flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={ehAlmoxarifadoPecas}
            onChange={(e) => setEhAlmoxarifadoPecas(e.target.checked)}
            className="accent-[var(--color-accent)] w-4 h-4 mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-[var(--color-fg)] flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[var(--color-fg-muted)]" />
              Almoxarifado de peças (manutenção)
            </span>
            <p className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
              Marque se este depósito guarda peças/insumos pra Ordens de Serviço de equipamentos.
              Só esses depósitos aparecem em OCs com destino <strong>Manutenção de equipamento</strong>.
            </p>
          </div>
        </label>
      </div>

      {/* Status */}
      <div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="accent-[var(--color-accent)] w-4 h-4"
          />
          <span className="text-sm text-[var(--color-fg)]">Depósito ativo</span>
        </label>
        <p className="text-[11px] text-[var(--color-fg-subtle)] ml-6 mt-0.5">
          Inativos não aparecem em formulários de entrada/saída/transferência.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-900 dark:text-rose-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <SubmitButton loading={submitting} disabled={!podeSalvar}>
          {initial ? 'Salvar alterações' : 'Criar depósito'}
        </SubmitButton>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

// ─── Multi-select inline de obras ────────────────────────────────────────
function ObrasMultiSelect({
  obras, selected, onChange,
}: { obras: Obra[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [busca, setBusca] = useState('');
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  const obrasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return obras
      .filter((o) => !selected.includes(o.id))
      .filter((o) => !q || o.nome.toLowerCase().includes(q));
  }, [obras, selected, busca]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="space-y-2">
      {/* Chips das obras já selecionadas */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((id) => {
            const obra = obrasMap.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] text-sm"
              >
                {obra?.nome ?? id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  aria-label="Remover"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Busca + lista */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={obrasFiltradas.length > 0 ? 'Buscar obra…' : 'Todas as obras já adicionadas'}
          disabled={obrasFiltradas.length === 0 && selected.length > 0}
          className="w-full px-3 py-2 text-sm bg-transparent border-b border-[var(--color-border)] focus:outline-none disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-fg-subtle)]"
        />
        <div className="max-h-44 overflow-y-auto">
          {obrasFiltradas.length === 0 ? (
            <div className="text-xs text-[var(--color-fg-subtle)] text-center py-4 italic">
              {selected.length === 0 ? 'Nenhuma obra cadastrada' : 'Nada mais a adicionar'}
            </div>
          ) : (
            obrasFiltradas.slice(0, 10).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { toggle(o.id); setBusca(''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--color-fg-subtle)]" />
                <span className="text-[var(--color-fg)] truncate">{o.nome}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> {selected.length} obra{selected.length > 1 ? 's' : ''} vinculada{selected.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
