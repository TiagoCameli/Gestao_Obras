import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { uploadArquivo } from '../services/arquivosService';

interface FileDropZoneProps {
  pastaId: string;
  onUploaded?: () => void;
}

/**
 * Zona de upload com drag-and-drop + botão "Selecionar arquivos". Cada arquivo
 * é validado pelo `arquivosService.uploadArquivo` (tamanho, MIME, extensão).
 * Erros aparecem inline; um único motivo bloqueia o lote para evitar
 * subir parcial silenciosamente.
 */
export function FileDropZone({ pastaId, onUploaded }: FileDropZoneProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setErro(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadArquivo({ pastaId, file });
        if (!result.ok) {
          setErro(`${file.name}: ${result.motivo}`);
          break;
        }
      }
      onUploaded?.();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOver(true);
      }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDraggingOver(false);
        if (e.dataTransfer.files) await handleFiles(e.dataTransfer.files);
      }}
      className={
        'rounded-lg border-2 border-dashed p-6 text-center transition-colors ' +
        (draggingOver
          ? 'border-primary bg-accent'
          : 'border-border bg-muted/30')
      }
    >
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        {draggingOver ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique abaixo'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Enviando…' : 'Selecionar arquivos'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) await handleFiles(e.target.files);
          // Reset para permitir reupload do mesmo arquivo.
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}

export default FileDropZone;
