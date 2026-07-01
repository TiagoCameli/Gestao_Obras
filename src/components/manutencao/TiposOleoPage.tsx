// Task 2.5 — Cadastro de Tipos de Óleo.
//
// CRUD simples: lista + form inline de criação/edição + inativar/excluir.
// Gated em 'gerenciar_tipos_oleo'. Usuários com apenas 'ver_manutencao' veem
// a lista somente-leitura (sem botões de ação).

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Droplets } from 'lucide-react';
import {
  useTiposOleo,
  useCriarTipoOleo,
  useAtualizarTipoOleo,
  useExcluirTipoOleo,
} from '../../hooks/useTiposOleo';
import { useAuth } from '../../contexts/AuthContext';
import type { TipoOleo } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeader from '../ui/PageHeader';

type AplicacaoOleo = TipoOleo['aplicacao'];

const APLICACAO_OPTIONS: { value: AplicacaoOleo; label: string }[] = [
  { value: 'motor',        label: 'Motor' },
  { value: 'hidraulico',   label: 'Hidráulico' },
  { value: 'transmissao',  label: 'Transmissão' },
  { value: 'diferencial',  label: 'Diferencial' },
  { value: 'graxa',        label: 'Graxa' },
  { value: 'outro',        label: 'Outro' },
];

const APLICACAO_LABEL: Record<AplicacaoOleo, string> = {
  motor:       'Motor',
  hidraulico:  'Hidráulico',
  transmissao: 'Transmissão',
  diferencial: 'Diferencial',
  graxa:       'Graxa',
  outro:       'Outro',
};

interface FormState {
  nome: string;
  aplicacao: AplicacaoOleo;
  intervaloMeses: string;
  ativo: boolean;
}

const FORM_VAZIO: FormState = {
  nome: '',
  aplicacao: 'motor',
  intervaloMeses: '',
  ativo: true,
};

function formParaTipoOleo(f: FormState, base?: Partial<TipoOleo>): Omit<TipoOleo, 'id' | 'createdAt'> {
  const meses = f.intervaloMeses.trim() === '' ? null : Number(f.intervaloMeses);
  return {
    nome: f.nome.trim(),
    aplicacao: f.aplicacao,
    intervaloMeses: meses === null || isNaN(meses) ? null : meses,
    ativo: f.ativo,
    createdBy: base?.createdBy ?? '',
  };
}

function tipoOleoParaForm(t: TipoOleo): FormState {
  return {
    nome: t.nome,
    aplicacao: t.aplicacao,
    intervaloMeses: t.intervaloMeses != null ? String(t.intervaloMeses) : '',
    ativo: t.ativo,
  };
}

export default function TiposOleoPage() {
  const { temAcao, usuario } = useAuth();
  const canGerenciar = temAcao('gerenciar_tipos_oleo');

  const { data: tipos = [], isLoading } = useTiposOleo();
  const criarMut = useCriarTipoOleo();
  const atualizarMut = useAtualizarTipoOleo();
  const excluirMut = useExcluirTipoOleo();

  // null = form fechado; string vazia = criando novo; string com id = editando
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setErro(null);
    setEditandoId('');
  }

  function abrirEditar(t: TipoOleo) {
    setForm(tipoOleoParaForm(t));
    setErro(null);
    setEditandoId(t.id);
  }

  function cancelar() {
    setEditandoId(null);
    setErro(null);
  }

  const podeSalvar = form.nome.trim().length > 0;

  async function salvar() {
    if (!podeSalvar || salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      if (editandoId === '') {
        // criação
        await criarMut.mutateAsync({
          ...formParaTipoOleo(form),
          createdBy: usuario?.nome ?? '',
        });
      } else if (editandoId) {
        // edição
        const original = tipos.find((t) => t.id === editandoId);
        await atualizarMut.mutateAsync({
          id: editandoId,
          ...formParaTipoOleo(form, original),
          createdBy: original?.createdBy ?? '',
        });
      }
      setEditandoId(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirId) return;
    try {
      await excluirMut.mutateAsync(excluirId);
    } finally {
      setExcluirId(null);
    }
  }

  const tiposAtivos = tipos.filter((t) => t.ativo);
  const tiposInativos = tipos.filter((t) => !t.ativo);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tipos de Óleo"
        description="Cadastro de óleos e lubrificantes usados nas trocas de manutenção."
        actions={canGerenciar && editandoId === null && (
          <Button onClick={abrirNovo}>
            <Plus aria-hidden className="w-4 h-4" />
            Novo tipo
          </Button>
        )}
      />

      {/* Formulário de criação/edição */}
      {editandoId !== null && (
        <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-surface-1)] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">
            {editandoId === '' ? 'Novo tipo de óleo' : 'Editar tipo de óleo'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome *"
              id="toNome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Óleo Motor 15W40"
              autoFocus
            />
            <Select
              label="Aplicação *"
              id="toAplicacao"
              value={form.aplicacao}
              onChange={(e) => setForm((f) => ({ ...f, aplicacao: e.target.value as AplicacaoOleo }))}
              options={APLICACAO_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <Input
              label="Intervalo de troca (meses)"
              id="toIntervalo"
              type="number"
              min="1"
              step="1"
              value={form.intervaloMeses}
              onChange={(e) => setForm((f) => ({ ...f, intervaloMeses: e.target.value }))}
              placeholder="Vazio = sem alerta"
            />
            <div className="flex items-center gap-2 pb-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
                className={
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ' +
                  (form.ativo ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]')
                }
                role="switch"
                aria-checked={form.ativo}
              >
                <span
                  className={
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ' +
                    (form.ativo ? 'translate-x-4' : 'translate-x-0')
                  }
                />
              </button>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {form.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          {erro && (
            <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={cancelar} disabled={salvando}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!podeSalvar || salvando}>
              <Check className="w-4 h-4" />
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-sm text-[var(--color-fg-muted)]">Carregando…</div>
      ) : tipos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-10 text-center">
          <Droplets className="w-8 h-8 mx-auto mb-2 text-[var(--color-fg-subtle)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum tipo cadastrado</p>
          {canGerenciar && (
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              Clique em "Novo tipo" para começar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tiposAtivos.length > 0 && (
            <TabelaTipos
              tipos={tiposAtivos}
              canGerenciar={canGerenciar}
              onEditar={abrirEditar}
              onExcluir={(id) => setExcluirId(id)}
            />
          )}

          {tiposInativos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                Inativos ({tiposInativos.length})
              </h4>
              <TabelaTipos
                tipos={tiposInativos}
                canGerenciar={canGerenciar}
                onEditar={abrirEditar}
                onExcluir={(id) => setExcluirId(id)}
                inativo
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={excluirId !== null}
        onClose={() => setExcluirId(null)}
        onConfirm={confirmarExclusao}
        title="Excluir tipo de óleo"
        message="Confirma a exclusão deste tipo? Registros de óleo já lançados não serão afetados."
        requirePassword={false}
      />
    </div>
  );
}

function TabelaTipos({
  tipos,
  canGerenciar,
  onEditar,
  onExcluir,
  inativo = false,
}: {
  tipos: TipoOleo[];
  canGerenciar: boolean;
  onEditar: (t: TipoOleo) => void;
  onExcluir: (id: string) => void;
  inativo?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Aplicação</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Intervalo</th>
              {canGerenciar && (
                <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {tipos.map((t) => (
              <tr key={t.id} className={'hover:bg-[var(--color-surface-2)] transition-colors' + (inativo ? ' opacity-60' : '')}>
                <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{t.nome}</td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)]">{APLICACAO_LABEL[t.aplicacao]}</td>
                <td className="px-4 py-3 text-[var(--color-fg-muted)]">
                  {t.intervaloMeses != null ? `${t.intervaloMeses} meses` : <span className="text-[var(--color-fg-subtle)]">—</span>}
                </td>
                {canGerenciar && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEditar(t)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcluir(t.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
