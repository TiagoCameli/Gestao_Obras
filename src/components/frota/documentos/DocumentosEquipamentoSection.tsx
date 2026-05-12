// Marco 0 / PR3 — Lista de documentos do equipamento + botões adicionar/editar/excluir.
// Renderiza dentro do FrotaDetalhe abaixo da seção "Operação".

import { useState } from 'react';
import {
  FileText, Pencil, Trash2, Plus, AlertTriangle, Paperclip,
} from 'lucide-react';
import type { DocumentoEquipamento, Fornecedor } from '../../../types';
import { TIPO_DOCUMENTO_LABEL } from '../../../types';
import {
  useDocumentosEquipamento,
  useAdicionarDocumento,
  useAtualizarDocumento,
  useExcluirDocumento,
} from '../../../hooks/useDocumentosEquipamento';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import DocumentoFormModal from './DocumentoFormModal';

interface Props {
  equipamentoId: string;
  fornecedores: Fornecedor[];
}

function formatarData(s: string | null): string {
  if (!s) return '—';
  const [a, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function diasParaVencer(vencimento: string | null): number | null {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(vencimento);
  v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function badgeVencimento(vencimento: string | null): { texto: string; classe: string } | null {
  const dias = diasParaVencer(vencimento);
  if (dias === null) return null;
  if (dias < 0) {
    return {
      texto: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`,
      classe: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border-[var(--color-danger)]/30',
    };
  }
  if (dias === 0) {
    return {
      texto: 'Vence hoje',
      classe: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border-[var(--color-danger)]/30',
    };
  }
  if (dias <= 7) {
    return {
      texto: `${dias} dia${dias === 1 ? '' : 's'} pro vencimento`,
      classe: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] border-[var(--color-warning)]/30',
    };
  }
  if (dias <= 30) {
    return {
      texto: `${dias} dias pro vencimento`,
      classe: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] border-[var(--color-warning)]/30',
    };
  }
  return null;
}

export default function DocumentosEquipamentoSection({ equipamentoId, fornecedores }: Props) {
  const { data: documentos = [], isLoading } = useDocumentosEquipamento(equipamentoId);
  const { temAcao, usuario } = useAuth();
  const adicionar = useAdicionarDocumento();
  const atualizar = useAtualizarDocumento();
  const excluir = useExcluirDocumento();

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<DocumentoEquipamento | null>(null);
  const [excluindo, setExcluindo] = useState<DocumentoEquipamento | null>(null);

  const canEdit = temAcao('editar_cadastros');
  const canDelete = temAcao('excluir_cadastros');

  const fornecedorNome = (id: string | null) =>
    id ? fornecedores.find((f) => f.id === id)?.nome ?? '—' : '—';

  async function handleSubmit(doc: DocumentoEquipamento) {
    if (editando) {
      await atualizar.mutateAsync(doc);
    } else {
      await adicionar.mutateAsync(doc);
    }
    setEditando(null);
  }

  async function handleConfirmarExclusao() {
    if (!excluindo) return;
    await excluir.mutateAsync({
      id: excluindo.id,
      equipamentoId,
      deletedBy: usuario?.nome ?? '',
    });
    setExcluindo(null);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Documentos
          {documentos.length > 0 && (
            <span className="ml-2 text-[var(--color-fg-subtle)] font-normal">
              ({documentos.length})
            </span>
          )}
        </h3>
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setEditando(null); setFormOpen(true); }}
          >
            <Plus aria-hidden className="w-3.5 h-3.5" />
            Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-2">Carregando documentos…</p>
      ) : documentos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center">
          <FileText
            aria-hidden
            className="w-6 h-6 text-[var(--color-fg-subtle)] mx-auto mb-1.5"
          />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhum documento cadastrado.
          </p>
          {canEdit && (
            <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
              Adicione CRLV, IPVA, seguro, manual, NF de aquisição etc.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {documentos.map((d) => {
            const badge = badgeVencimento(d.vencimento);
            const anexosQtd = d.fotoUrls.length + d.arquivoUrls.length;
            return (
              <li
                key={d.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText
                        aria-hidden
                        className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0"
                      />
                      <span className="text-sm font-medium text-[var(--color-fg)]">
                        {TIPO_DOCUMENTO_LABEL[d.tipo]}
                      </span>
                      {d.numero && (
                        <span className="text-xs text-[var(--color-fg-muted)] font-mono">
                          #{d.numero}
                        </span>
                      )}
                      {badge && (
                        <span
                          className={
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ' +
                            badge.classe
                          }
                        >
                          <AlertTriangle aria-hidden className="w-3 h-3" />
                          {badge.texto}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[var(--color-fg-muted)]">
                      {d.emissao && <span>Emissão: {formatarData(d.emissao)}</span>}
                      {d.vencimento && <span>Vencimento: {formatarData(d.vencimento)}</span>}
                      {d.valor > 0 && (
                        <span>
                          Valor:{' '}
                          {d.valor.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      )}
                      {d.fornecedorId && <span>Emissor: {fornecedorNome(d.fornecedorId)}</span>}
                      {anexosQtd > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip aria-hidden className="w-3 h-3" />
                          {anexosQtd} anexo{anexosQtd === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {d.observacoes && (
                      <p className="text-xs text-[var(--color-fg-muted)] mt-1.5">
                        {d.observacoes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => { setEditando(d); setFormOpen(true); }}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
                        aria-label="Editar documento"
                      >
                        <Pencil aria-hidden className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setExcluindo(d)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] transition-colors"
                        aria-label="Excluir documento"
                      >
                        <Trash2 aria-hidden className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen && (
        <DocumentoFormModal
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditando(null); }}
          equipamentoId={equipamentoId}
          fornecedores={fornecedores}
          initial={editando}
          onSubmit={handleSubmit}
          usuarioNome={usuario?.nome ?? ''}
        />
      )}

      {excluindo && (
        <ConfirmDialog
          open={!!excluindo}
          title="Excluir documento?"
          message={`${TIPO_DOCUMENTO_LABEL[excluindo.tipo]}${excluindo.numero ? ` #${excluindo.numero}` : ''} será removido.`}
          onConfirm={handleConfirmarExclusao}
          onClose={() => setExcluindo(null)}
          requirePassword={false}
        />
      )}
    </section>
  );
}
