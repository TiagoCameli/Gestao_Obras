/**
 * CategoriasList — CRUD enxuto do plano de contas (lista plana).
 *
 * Tabela única com inline-edit: clica numa categoria pra editar nome / tipo
 * / ordem / ativo. Botão "Nova categoria" abre uma linha vazia em modo
 * de edição. Tela única (sem rota filha) porque o CRUD é simples.
 */
import { useState } from 'react';
import { Plus, Pencil, Check, X, Power, AlertCircle } from 'lucide-react';
import {
  useCategoriasFinanceiras,
  useAdicionarCategoriaFinanceira,
  useAtualizarCategoriaFinanceira,
  useExcluirCategoriaFinanceira,
} from '../../hooks/useCategoriasFinanceiras';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SmartSelect from '../ui/SmartSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { CategoriaFinanceira } from '../../types';

function novoId(): string {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function CategoriasList() {
  const { data: categorias = [], isLoading } = useCategoriasFinanceiras();
  const addMut = useAdicionarCategoriaFinanceira();
  const updMut = useAtualizarCategoriaFinanceira();
  const delMut = useExcluirCategoriaFinanceira();
  const { showToast } = useToast();
  const { temAcao } = useAuth();
  const podeGerenciar = temAcao('gerenciar_categorias_financeiro');

  // Edição inline: id da categoria sendo editada (ou 'nova' pra uma linha
  // recém-adicionada que ainda não foi salva).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<CategoriaFinanceira | null>(null);
  // ConfirmDialog state pra exclusão (substitui window.confirm)
  const [excluindo, setExcluindo] = useState<CategoriaFinanceira | null>(null);

  function iniciarEdicao(cat: CategoriaFinanceira) {
    setEditandoId(cat.id);
    setRascunho({ ...cat });
  }

  function iniciarNovo() {
    const nova: CategoriaFinanceira = {
      id: novoId(),
      nome: '',
      tipo: 'despesa',
      ordem: (categorias[categorias.length - 1]?.ordem ?? 0) + 10,
      ativo: true,
    };
    setEditandoId('nova');
    setRascunho(nova);
  }

  async function salvar() {
    if (!rascunho) return;
    if (!rascunho.nome.trim()) {
      showToast({ kind: 'error', message: 'Informe o nome da categoria.' });
      return;
    }
    try {
      if (editandoId === 'nova') {
        await addMut.mutateAsync(rascunho);
        showToast({ kind: 'success', message: `Categoria "${rascunho.nome}" criada.` });
      } else {
        await updMut.mutateAsync(rascunho);
        showToast({ kind: 'success', message: `Categoria atualizada.` });
      }
      setEditandoId(null);
      setRascunho(null);
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar categoria.',
      });
    }
  }

  function cancelar() {
    setEditandoId(null);
    setRascunho(null);
  }

  async function toggleAtivo(cat: CategoriaFinanceira) {
    try {
      await updMut.mutateAsync({ ...cat, ativo: !cat.ativo });
      showToast({
        kind: 'success',
        message: cat.ativo ? `"${cat.nome}" desativada.` : `"${cat.nome}" reativada.`,
      });
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao atualizar.',
      });
    }
  }

  function excluir(cat: CategoriaFinanceira) {
    setExcluindo(cat);
  }

  async function executeExcluir() {
    if (!excluindo) return;
    try {
      await delMut.mutateAsync(excluindo.id);
      showToast({ kind: 'success', message: `"${excluindo.nome}" excluída.` });
      setExcluindo(null);
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao excluir.',
      });
    }
  }

  // Linha em edição (modo "nova") aparece no topo
  const linhasFinais = editandoId === 'nova' && rascunho
    ? [{ ...rascunho, ehNova: true } as CategoriaFinanceira & { ehNova: boolean }, ...categorias]
    : categorias;

  return (
    <div className="space-y-4">
      {/* Banner explicativo */}
      <div className="px-3.5 py-2.5 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-sky-50/70 dark:bg-sky-500/[0.06] text-[12px] text-sky-900 dark:text-sky-100 leading-relaxed flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-[1px] shrink-0" />
        <span>
          Categorias são usadas para classificar lançamentos financeiros (despesas e receitas).
          Você pode desativar uma categoria pra impedir novos lançamentos, sem afetar
          o histórico antigo. <strong>Ordem</strong> define a posição no dropdown dos formulários.
        </span>
      </div>

      {/* Header da lista com botão novo */}
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-fg)]">{categorias.filter((c) => c.ativo).length}</strong> ativas
          · <strong className="text-[var(--color-fg)]">{categorias.filter((c) => !c.ativo).length}</strong> inativas
        </div>
        {podeGerenciar && editandoId !== 'nova' && (
          <Button onClick={iniciarNovo} type="button">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nova categoria
            </span>
          </Button>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-3 py-2.5 text-right font-semibold w-[80px]">Ordem</th>
                <th className="px-3 py-2.5 text-left font-semibold">Nome</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[130px]">Tipo</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[100px]">Status</th>
                <th className="px-3 py-2.5 w-[140px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {linhasFinais.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[12.5px] text-[var(--color-fg-muted)]">
                    Nenhuma categoria cadastrada.
                  </td>
                </tr>
              )}
              {linhasFinais.map((cat) => {
                const emEdicao = editandoId === cat.id || (cat as { ehNova?: boolean }).ehNova;
                const draft = emEdicao && rascunho ? rascunho : cat;
                return (
                  <tr
                    key={cat.id}
                    className={
                      (emEdicao ? 'bg-[var(--color-accent)]/[0.06] ' : '') +
                      (!cat.ativo && !emEdicao ? 'opacity-60 ' : '')
                    }
                  >
                    <td className="px-3 py-2.5 text-right">
                      {emEdicao ? (
                        <Input
                          type="number"
                          value={draft.ordem}
                          onChange={(e) => setRascunho({ ...draft, ordem: Number(e.target.value) })}
                          className="h-8 text-right text-sm"
                        />
                      ) : (
                        <span className="text-[12px] text-[var(--color-fg-muted)] tabular-nums">{cat.ordem}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <Input
                          value={draft.nome}
                          onChange={(e) => setRascunho({ ...draft, nome: e.target.value })}
                          placeholder="Ex: Material de construção"
                          className="h-8 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-[var(--color-fg)]">{cat.nome}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <SmartSelect
                          value={draft.tipo}
                          onChange={(e) => setRascunho({ ...draft, tipo: e.target.value as 'despesa' | 'receita' })}
                          className="w-full h-8 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-left flex items-center"
                        >
                          <option value="despesa">Despesa</option>
                          <option value="receita">Receita</option>
                        </SmartSelect>
                      ) : (
                        <span
                          className={
                            'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ' +
                            (cat.tipo === 'receita'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800')
                          }
                        >
                          {cat.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <label className="inline-flex items-center gap-1.5 text-[12.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.ativo}
                            onChange={(e) => setRascunho({ ...draft, ativo: e.target.checked })}
                            className="accent-[var(--color-accent)]"
                          />
                          Ativo
                        </label>
                      ) : (
                        <span
                          className={
                            'inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium ' +
                            (cat.ativo
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')
                          }
                        >
                          {cat.ativo ? '● ativa' : '○ inativa'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {emEdicao ? (
                        <div className="inline-flex items-center gap-1">
                          <IconBtn title="Salvar" onClick={salvar} variant="success">
                            <Check className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn title="Cancelar" onClick={cancelar}>
                            <X className="w-3.5 h-3.5" />
                          </IconBtn>
                        </div>
                      ) : podeGerenciar ? (
                        <div className="inline-flex items-center gap-1">
                          <IconBtn title="Editar" onClick={() => iniciarEdicao(cat)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn
                            title={cat.ativo ? 'Desativar' : 'Reativar'}
                            onClick={() => toggleAtivo(cat)}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn title="Excluir" onClick={() => excluir(cat)} variant="danger">
                            <X className="w-3.5 h-3.5" />
                          </IconBtn>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        onConfirm={executeExcluir}
        title={`Excluir "${excluindo?.nome ?? ''}"`}
        message="Lançamentos antigos com essa categoria continuarão mostrando o nome — só não vai mais aparecer pra novas seleções."
        requirePassword={false}
      />
    </div>
  );
}

function IconBtn({
  title, onClick, children, variant = 'default',
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger';
}) {
  const colorMap = {
    default: 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
    success: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/15',
    danger: 'text-[var(--color-fg-subtle)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15',
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${colorMap[variant]}`}
    >
      {children}
    </button>
  );
}
