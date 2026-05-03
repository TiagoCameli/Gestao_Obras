import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload, AlertCircle } from 'lucide-react';
import Button from '../../../../components/ui/Button';

const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
const QTD_MAX = 10;

export interface FotoSelecionada {
  file: File;
  url: string;
  legenda: string;
}

export interface FotoUploaderProps {
  fotos: FotoSelecionada[];
  onChange: (fotos: FotoSelecionada[]) => void;
  className?: string;
}

function formatarBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function FotoUploader({ fotos, onChange, className = '' }: FotoUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Liberar object URLs ao desmontar
  useEffect(() => {
    return () => {
      fotos.forEach((f) => URL.revokeObjectURL(f.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adicionarFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const novosErros: string[] = [];
    const validos: FotoSelecionada[] = [];
    const espacoLivre = QTD_MAX - fotos.length;

    if (arr.length > espacoLivre) {
      novosErros.push(
        `Limite de ${QTD_MAX} fotos. Você tentou adicionar ${arr.length}, mas só restam ${espacoLivre} espaço(s).`
      );
    }

    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_VALIDOS.includes(f.type)) {
        novosErros.push(
          `${f.name}: tipo "${f.type || 'desconhecido'}" não permitido (use JPEG, PNG ou WebP)`
        );
        continue;
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede o limite de 10 MB`);
        continue;
      }
      validos.push({ file: f, url: URL.createObjectURL(f), legenda: '' });
    }

    setErros(novosErros);
    if (validos.length > 0) onChange([...fotos, ...validos]);
  }

  function remover(i: number) {
    URL.revokeObjectURL(fotos[i].url);
    onChange(fotos.filter((_, j) => j !== i));
  }

  function setLegenda(i: number, l: string) {
    onChange(fotos.map((f, j) => (j === i ? { ...f, legenda: l } : f)));
  }

  return (
    <div className={'flex flex-col gap-3 ' + className}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) adicionarFiles(e.dataTransfer.files);
        }}
        className={
          'flex flex-col items-center justify-center gap-2 px-4 py-8 ' +
          'rounded-2xl border-2 border-dashed cursor-pointer transition-colors ' +
          (dragOver
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]')
        }
        aria-label="Solte arquivos aqui ou clique para selecionar"
      >
        <Upload aria-hidden className="w-8 h-8 text-[var(--color-fg-subtle)]" />
        <p className="text-sm text-[var(--color-fg)] font-medium text-center">
          Solte fotos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-[var(--color-fg-muted)] text-center">
          JPEG, PNG ou WebP — até 10 MB cada — máximo {QTD_MAX} fotos
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MIME_VALIDOS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionarFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {erros.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30"
        >
          {erros.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-[var(--color-danger-fg)]"
            >
              <AlertCircle aria-hidden className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}

      {fotos.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-[var(--color-surface-2)] relative">
                <img
                  src={f.url}
                  alt={f.legenda || `Foto ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => remover(i)}
                  aria-label={`Remover foto ${i + 1}`}
                  className="!absolute top-1 right-1 !min-h-0 !px-1.5 !py-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-2 flex flex-col gap-1">
                <input
                  type="text"
                  value={f.legenda}
                  onChange={(e) => setLegenda(i, e.target.value)}
                  placeholder="Legenda (opcional)"
                  className="w-full h-8 rounded px-2 text-xs bg-[var(--color-surface-1)] border border-[var(--color-border)]"
                />
                <div className="text-[10px] text-[var(--color-fg-subtle)] flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {formatarBytes(f.file.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-[var(--color-fg-subtle)]">
        {fotos.length} de {QTD_MAX} foto(s)
      </div>
    </div>
  );
}

export default FotoUploader;
