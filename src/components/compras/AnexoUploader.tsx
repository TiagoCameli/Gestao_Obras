/**
 * AnexoUploader — drag-drop + click + câmera (capture="environment")
 *
 * Em mobile, o botão "Tirar foto" abre direto a câmera traseira via input file.
 * Em desktop, o mesmo input vira um seletor de arquivo de imagem.
 *
 * Quando entidadeId está vazio (modo "novo"), guarda os arquivos em buffer
 * local e expõe via prop `onPendingChange` — o caller faz o upload assim que
 * o registro principal for salvo (e ele tiver um id).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, FileText, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import {
  useAnexosCompras,
  useUploadAnexoCompras,
  useExcluirAnexoCompras,
  obterUrlAnexo,
} from '../../hooks/useComprasAnexos';
import type { ComprasAnexo, EntidadeCompra } from '../../types';
import { useToast } from '../ui/Toast';

interface Props {
  entidade: EntidadeCompra;
  /** Vazio = modo "pendente" (buffer local). Preenchido = upload imediato. */
  entidadeId: string;
  enviadoPor: string;
  /** Anexos pendentes (modo novo) */
  pendentes?: File[];
  onPendingChange?: (files: File[]) => void;
  /** Apenas leitura (sem upload nem exclusão) */
  readOnly?: boolean;
}

const TAMANHO_MAX = 20 * 1024 * 1024; // 20 MB

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function ehImagem(mime: string): boolean {
  return mime.startsWith('image/');
}

export default function AnexoUploader({
  entidade,
  entidadeId,
  enviadoPor,
  pendentes = [],
  onPendingChange,
  readOnly = false,
}: Props) {
  const { showToast } = useToast();
  const { data: anexosSalvos = [], isLoading } = useAnexosCompras(entidade, entidadeId);
  const uploadMut = useUploadAnexoCompras();
  const excluirMut = useExcluirAnexoCompras();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const adicionarArquivos = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;

      const validos: File[] = [];
      for (const f of arr) {
        if (f.size > TAMANHO_MAX) {
          showToast({
            kind: 'error',
            message: `"${f.name}" excede 20 MB e não pode ser anexado.`,
          });
          continue;
        }
        validos.push(f);
      }
      if (validos.length === 0) return;

      // Modo "novo" — armazena no buffer
      if (!entidadeId) {
        onPendingChange?.([...pendentes, ...validos]);
        return;
      }

      // Modo "edição" — upload imediato
      for (const file of validos) {
        try {
          await uploadMut.mutateAsync({ entidade, entidadeId, file, enviadoPor });
        } catch (err) {
          showToast({
            kind: 'error',
            message: `Falha ao enviar "${file.name}": ${(err as Error).message}`,
          });
        }
      }
      if (validos.length > 0) {
        showToast({ kind: 'success', message: `${validos.length} anexo(s) enviado(s).` });
      }
    },
    [entidade, entidadeId, enviadoPor, pendentes, onPendingChange, uploadMut, showToast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (readOnly) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        adicionarArquivos(e.dataTransfer.files);
      }
    },
    [adicionarArquivos, readOnly]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!readOnly) setDragOver(true);
  }, [readOnly]);

  const removerPendente = (idx: number) => {
    const novo = pendentes.filter((_, i) => i !== idx);
    onPendingChange?.(novo);
  };

  const removerSalvo = async (anexo: ComprasAnexo) => {
    if (!confirm(`Remover anexo "${anexo.nomeArquivo}"?`)) return;
    try {
      await excluirMut.mutateAsync(anexo);
      showToast({ kind: 'success', message: 'Anexo removido.' });
    } catch (err) {
      showToast({ kind: 'error', message: 'Falha ao remover anexo: ' + (err as Error).message });
    }
  };

  const totalAnexos = anexosSalvos.length + pendentes.length;

  return (
    <div className="space-y-3">
      {/* Botões de ação */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            <Camera className="w-4 h-4" /> Tirar foto
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            <Upload className="w-4 h-4" /> Selecionar arquivos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => e.target.files && adicionarArquivos(e.target.files)}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files && adicionarArquivos(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {/* Drop zone */}
      {!readOnly && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          className={
            'rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center text-sm ' +
            (dragOver
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-fg)]'
              : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]')
          }
        >
          <Upload className="w-5 h-5 mx-auto mb-1.5 opacity-60" />
          {dragOver ? 'Solte para anexar' : 'ou arraste arquivos aqui'}
          <div className="text-xs opacity-70 mt-0.5">JPG · PNG · PDF · DOCX · XLSX · até 20 MB</div>
        </div>
      )}

      {/* Lista de anexos */}
      {(isLoading || totalAnexos > 0) && (
        <div className="space-y-1.5">
          {isLoading && <div className="text-xs text-[var(--color-fg-subtle)]">Carregando anexos…</div>}

          {/* Pendentes (ainda não enviados) */}
          {pendentes.map((file, idx) => (
            <AnexoItemPendente
              key={`pendente-${idx}`}
              file={file}
              onRemove={() => removerPendente(idx)}
              readOnly={readOnly}
            />
          ))}

          {/* Salvos */}
          {anexosSalvos.map((a) => (
            <AnexoItemSalvo
              key={a.id}
              anexo={a}
              onRemove={() => removerSalvo(a)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item pendente (buffer local, ainda sem upload) ────────────────────────
function AnexoItemPendente({
  file,
  onRemove,
  readOnly,
}: {
  file: File;
  onRemove: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
      <span className="shrink-0">
        {ehImagem(file.type) ? (
          <ImageIcon className="w-4 h-4 text-amber-700" />
        ) : (
          <FileText className="w-4 h-4 text-amber-700" />
        )}
      </span>
      <span className="flex-1 min-w-0 text-sm text-[var(--color-fg)] truncate">
        {file.name}
        <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
          {formatarTamanho(file.size)} · pendente
        </span>
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[var(--color-fg-subtle)] hover:text-rose-600 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Item salvo (já no Storage) ────────────────────────────────────────────
function AnexoItemSalvo({
  anexo,
  onRemove,
  readOnly,
}: {
  anexo: ComprasAnexo;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    obterUrlAnexo(anexo.storagePath).then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [anexo.storagePath]);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors">
      <span className="shrink-0">
        {ehImagem(anexo.tipoMime) ? (
          <ImageIcon className="w-4 h-4 text-[var(--color-fg-muted)]" />
        ) : (
          <FileText className="w-4 h-4 text-[var(--color-fg-muted)]" />
        )}
      </span>
      <span className="flex-1 min-w-0 text-sm text-[var(--color-fg)] truncate">
        {anexo.nomeArquivo}
        <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
          {formatarTamanho(anexo.tamanhoBytes)}
        </span>
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[var(--color-fg-subtle)] hover:text-[var(--color-accent)] transition-colors"
          aria-label="Abrir"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[var(--color-fg-subtle)] hover:text-rose-600 transition-colors"
          aria-label="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
