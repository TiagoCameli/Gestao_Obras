// F9.2 — Componente generalista pra anexos (Fotos + Arquivos) em Saídas,
// Entradas, Transferências e Tanques. Estende o padrão FotoCaptureUploader
// adicionando suporte a documentos (PDF, xlsx, docx, csv).
//
// Comportamento:
// - 2 sections separadas: "Fotos" (imagens) + "Arquivos" (documentos)
// - Câmera: reusa stamp GPS + timestamp da FotoCaptureUploader (overlay
//   forense na imagem)
// - Upload via Supabase Storage no mesmo bucket abastecimento-fotos
//   (caminho semantically agnostic — pasta = id da entidade)
// - Limite individual 10 MB; agregado 8 fotos + 8 arquivos
// - HEIC pula stamp (incompat browser)

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, AlertCircle, Loader2, MapPin, FileText, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { pathFromSignedUrl, fileNameFromUrl, thumbStoragePath, previewStoragePath } from '../../utils/signedUrl';
import { uploadFotoComDerivados } from '../../utils/fotoStorage';

const BUCKET = 'abastecimento-fotos';
const SIGNED_URL_TTL_SECS = 60 * 60; // 1 hora (re-mint on demand)

// Imagens — categoria "Fotos"
const MIME_FOTOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
// Documentos — categoria "Arquivos"
const MIME_ARQUIVOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'text/csv',
  'text/plain',
];
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
const QTD_MAX_FOTOS = 8;
const QTD_MAX_ARQUIVOS = 8;

// ────────────────────────────────────────────────────────────────────
// Helpers de stamp (copiados de FotoCaptureUploader — F5.B.3)
// ────────────────────────────────────────────────────────────────────

interface GeoData {
  lat: number;
  lon: number;
  accuracy: number;
}

function getGeoOrNull(timeoutMs = 8000): Promise<GeoData | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const fallback = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallback);
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        clearTimeout(fallback);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

function fmtDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function stampImage(file: File, geo: GeoData | null, time: Date): Promise<File> {
  try {
    if (file.type === 'image/heic') return file;
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);
    const timeStr = fmtDateTimeLocal(time);
    const geoStr = geo
      ? `GPS: ${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)} (precisao ${Math.round(geo.accuracy)}m)`
      : 'GPS: indisponivel';
    const fontSize = Math.max(20, Math.round(canvas.width / 50));
    const padding = Math.round(fontSize * 0.6);
    const lineHeight = Math.round(fontSize * 1.35);
    const totalH = lineHeight * 2 + padding * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvas.height - totalH, canvas.width, totalH);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(timeStr, padding, canvas.height - totalH + padding);
    ctx.fillText(geoStr, padding, canvas.height - totalH + padding + lineHeight);
    ctx.shadowBlur = 0;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[AnexosUploader] stamp falhou, salvando original:', e);
    return file;
  }
}

// ────────────────────────────────────────────────────────────────────
// Hook reutilizável: upload de fotos pra Supabase (com stamp opcional)
// ────────────────────────────────────────────────────────────────────

interface UseUploadFotosOpts {
  fotoUrls: string[]
  onChange: (urls: string[]) => void
  pastaId: string
}

// eslint-disable-next-line react-refresh/only-export-components -- transitional: hook lives here alongside its consumer component; extract to own file when duplication with default AnexosUploader is consolidated.
export function useUploadFotos({ fotoUrls, onChange, pastaId }: UseUploadFotosOpts) {
  const [erros, setErros] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [stamping, setStamping] = useState(false)

  useEffect(() => {
    if (erros.length === 0) return
    const t = setTimeout(() => setErros([]), 6000)
    return () => clearTimeout(t)
  }, [erros])

  async function handleFotos(files: FileList | File[], fromCamera: boolean) {
    const arr = Array.from(files)
    const novosErros: string[] = []
    const validos: File[] = []
    const espacoLivre = QTD_MAX_FOTOS - fotoUrls.length
    if (arr.length > espacoLivre) {
      novosErros.push(`Limite de ${QTD_MAX_FOTOS} fotos. Tentou adicionar ${arr.length}, restam ${espacoLivre}.`)
    }
    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_FOTOS.includes(f.type)) {
        novosErros.push(`${f.name}: tipo "${f.type || 'desconhecido'}" não é foto válida (use JPEG/PNG/WebP)`)
        continue
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede limite 10 MB`)
        continue
      }
      validos.push(f)
    }
    setErros(novosErros)
    if (validos.length === 0) return

    let toUpload: File[] = validos
    if (fromCamera) {
      setStamping(true)
      try {
        const geo = await getGeoOrNull()
        const now = new Date()
        toUpload = await Promise.all(validos.map((f) => stampImage(f, geo, now)))
      } finally {
        setStamping(false)
      }
    }

    setUploading(true)
    try {
      const novasUrls: string[] = []
      for (const file of toUpload) {
        const ts = Date.now()
        const path = `${pastaId}/${ts}-${sanitizeNome(file.name)}`
        const { signedUrl, error } = await uploadFotoComDerivados(BUCKET, path, file, SIGNED_URL_TTL_SECS)
        if (error || !signedUrl) {
          setErros((p) => [...p, `Falha no upload de ${file.name}: ${error ?? 'URL não gerada'}`])
          continue
        }
        novasUrls.push(signedUrl)
      }
      if (novasUrls.length > 0) onChange([...fotoUrls, ...novasUrls])
    } finally {
      setUploading(false)
    }
  }

  return { handleFotos, erros, uploading, stamping }
}

interface UploadFotosButtonsProps {
  fotoUrls: string[]
  onChange: (urls: string[]) => void
  pastaId: string
  className?: string
}

/**
 * Sub-componente que renderiza só os botões "Tirar foto" + "Da galeria"
 * (sem o grid de display). Usado quando o display é responsabilidade de outro componente
 * (ex: FotoGaleria com lightbox próprio).
 */
export function UploadFotosButtons({ fotoUrls, onChange, pastaId, className = '' }: UploadFotosButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const { handleFotos, erros, uploading, stamping } = useUploadFotos({ fotoUrls, onChange, pastaId })
  const isBusy = uploading || stamping
  const cheio = fotoUrls.length >= QTD_MAX_FOTOS

  return (
    <div className={'flex flex-col gap-2 ' + className}>
      {erros.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30">
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-danger-fg)]">
              <AlertCircle aria-hidden className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFotos(e.target.files, true); e.target.value = '' }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept={MIME_FOTOS.join(',')}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFotos(e.target.files, false); e.target.value = '' }}
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={isBusy || cheio}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {(uploading || stamping) ? <Loader2 aria-hidden className="w-4 h-4 animate-spin" /> : <Camera aria-hidden className="w-4 h-4" />}
          {stamping ? 'Marcando local...' : uploading ? 'Enviando...' : 'Tirar foto'}
        </button>
        <button
          type="button"
          onClick={() => galeriaRef.current?.click()}
          disabled={isBusy || cheio}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ImagePlus aria-hidden className="w-4 h-4" />
          Da galeria
        </button>
        <span className="text-xs text-[var(--color-fg-muted)] tabular-nums ml-1">
          {fotoUrls.length}/{QTD_MAX_FOTOS}
        </span>
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-fg-muted)] leading-tight">
        <MapPin aria-hidden className="w-3 h-3 shrink-0 mt-0.5" />
        <span>"Tirar foto" carimba data/hora e GPS no rodapé. Galeria preserva o original.</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────

interface Props {
  /** URLs já existentes — lado fotos (imagens). */
  fotoUrls: string[];
  /** URLs já existentes — lado arquivos (PDF, xlsx, docx). */
  arquivoUrls: string[];
  onChangeFotos: (urls: string[]) => void;
  onChangeArquivos: (urls: string[]) => void;
  /** Pasta no bucket — geralmente id da entidade (saida_xxx, entrada_yyy). */
  pastaId: string;
  className?: string;
  /** Esconde a section de fotos (caso use só pra arquivos). */
  hideFotos?: boolean;
  /** Esconde a section de arquivos (caso use só pra fotos). */
  hideArquivos?: boolean;
}

function sanitizeNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatarBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}


export default function AnexosUploader({
  fotoUrls,
  arquivoUrls,
  onChangeFotos,
  onChangeArquivos,
  pastaId,
  className = '',
  hideFotos = false,
  hideArquivos = false,
}: Props) {
  const [erros, setErros] = useState<string[]>([]);
  const [uploading, setUploading] = useState<'fotos' | 'arquivos' | null>(null);
  const [stamping, setStamping] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (erros.length === 0) return;
    const t = setTimeout(() => setErros([]), 6000);
    return () => clearTimeout(t);
  }, [erros]);

  async function handleFotos(files: FileList | File[], fromCamera: boolean) {
    const arr = Array.from(files);
    const novosErros: string[] = [];
    const validos: File[] = [];
    const espacoLivre = QTD_MAX_FOTOS - fotoUrls.length;
    if (arr.length > espacoLivre) {
      novosErros.push(
        `Limite de ${QTD_MAX_FOTOS} fotos. Tentou adicionar ${arr.length}, restam ${espacoLivre}.`,
      );
    }
    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_FOTOS.includes(f.type)) {
        novosErros.push(`${f.name}: tipo "${f.type || 'desconhecido'}" não é foto válida (use JPEG/PNG/WebP)`);
        continue;
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede limite 10 MB`);
        continue;
      }
      validos.push(f);
    }
    setErros(novosErros);
    if (validos.length === 0) return;

    let toUpload: File[] = validos;
    if (fromCamera) {
      setStamping(true);
      try {
        const geo = await getGeoOrNull();
        const now = new Date();
        toUpload = await Promise.all(validos.map((f) => stampImage(f, geo, now)));
      } finally {
        setStamping(false);
      }
    }

    setUploading('fotos');
    try {
      const novasUrls: string[] = [];
      for (const file of toUpload) {
        const ts = Date.now();
        const path = `${pastaId}/${ts}-${sanitizeNome(file.name)}`;
        const { signedUrl, error } = await uploadFotoComDerivados(BUCKET, path, file, SIGNED_URL_TTL_SECS);
        if (error || !signedUrl) {
          setErros((p) => [...p, `Falha no upload de ${file.name}: ${error ?? 'URL não gerada'}`]);
          continue;
        }
        novasUrls.push(signedUrl);
      }
      if (novasUrls.length > 0) onChangeFotos([...fotoUrls, ...novasUrls]);
    } finally {
      setUploading(null);
    }
  }

  async function handleArquivos(files: FileList | File[]) {
    const arr = Array.from(files);
    const novosErros: string[] = [];
    const validos: File[] = [];
    const espacoLivre = QTD_MAX_ARQUIVOS - arquivoUrls.length;
    if (arr.length > espacoLivre) {
      novosErros.push(
        `Limite de ${QTD_MAX_ARQUIVOS} arquivos. Tentou ${arr.length}, restam ${espacoLivre}.`,
      );
    }
    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_ARQUIVOS.includes(f.type)) {
        novosErros.push(`${f.name}: tipo "${f.type || 'desconhecido'}" não é arquivo válido (use PDF/Excel/Word/CSV)`);
        continue;
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede limite 10 MB`);
        continue;
      }
      validos.push(f);
    }
    setErros(novosErros);
    if (validos.length === 0) return;

    setUploading('arquivos');
    try {
      const novasUrls: string[] = [];
      for (const file of validos) {
        const ts = Date.now();
        const path = `${pastaId}/${ts}-${sanitizeNome(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          setErros((p) => [...p, `Falha no upload de ${file.name}: ${upErr.message}`]);
          continue;
        }
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECS);
        if (signErr) {
          setErros((p) => [...p, `Falha ao assinar URL: ${signErr.message}`]);
          continue;
        }
        novasUrls.push(signed.signedUrl);
      }
      if (novasUrls.length > 0) onChangeArquivos([...arquivoUrls, ...novasUrls]);
    } finally {
      setUploading(null);
    }
  }

  async function removerFoto(idx: number) {
    const url = fotoUrls[idx];
    const path = pathFromSignedUrl(url);
    if (path) {
      try {
        await supabase.storage
          .from(BUCKET)
          .remove([path, thumbStoragePath(path), previewStoragePath(path)]);
      } catch (e) {
        console.warn('Falha ao remover do bucket:', e);
      }
    }
    onChangeFotos(fotoUrls.filter((_, j) => j !== idx));
  }

  async function removerArquivo(idx: number) {
    const url = arquivoUrls[idx];
    const path = pathFromSignedUrl(url);
    if (path) {
      try {
        await supabase.storage.from(BUCKET).remove([path]);
      } catch (e) {
        console.warn('Falha ao remover do bucket:', e);
      }
    }
    onChangeArquivos(arquivoUrls.filter((_, j) => j !== idx));
  }

  const isBusy = uploading !== null || stamping;

  return (
    <div className={'flex flex-col gap-4 ' + className}>
      {erros.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30"
        >
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-danger-fg)]">
              <AlertCircle aria-hidden className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* ── Fotos ── */}
      {!hideFotos && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Fotos ({fotoUrls.length}/{QTD_MAX_FOTOS})
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFotos(e.target.files, true);
                e.target.value = '';
              }}
            />
            <input
              ref={galeriaRef}
              type="file"
              accept={MIME_FOTOS.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFotos(e.target.files, false);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={isBusy || fotoUrls.length >= QTD_MAX_FOTOS}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(uploading === 'fotos' || stamping) ? (
                <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
              ) : (
                <Camera aria-hidden className="w-4 h-4" />
              )}
              {stamping ? 'Marcando local...' : uploading === 'fotos' ? 'Enviando...' : 'Tirar foto'}
            </button>
            <button
              type="button"
              onClick={() => galeriaRef.current?.click()}
              disabled={isBusy || fotoUrls.length >= QTD_MAX_FOTOS}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ImagePlus aria-hidden className="w-4 h-4" />
              Da galeria
            </button>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-fg-muted)] leading-tight mt-1.5">
            <MapPin aria-hidden className="w-3 h-3 shrink-0 mt-0.5" />
            <span>"Tirar foto" carimba data/hora e GPS no rodapé. Galeria preserva o original.</span>
          </div>

          {fotoUrls.length > 0 && (
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 mt-3">
              {fotoUrls.map((url, i) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-lg border border-[var(--color-border)] overflow-hidden group"
                >
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => removerFoto(i)}
                    aria-label={`Remover foto ${i + 1}`}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger)] transition-all flex items-center justify-center"
                  >
                    <Trash2 aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Arquivos ── */}
      {!hideArquivos && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Arquivos ({arquivoUrls.length}/{QTD_MAX_ARQUIVOS})
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={arquivoRef}
              type="file"
              accept={MIME_ARQUIVOS.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleArquivos(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={isBusy || arquivoUrls.length >= QTD_MAX_ARQUIVOS}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading === 'arquivos' ? (
                <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip aria-hidden className="w-4 h-4" />
              )}
              {uploading === 'arquivos' ? 'Enviando...' : 'Adicionar arquivo'}
            </button>
          </div>
          <div className="text-[11px] text-[var(--color-fg-muted)] mt-1.5">
            PDF · Excel · Word · CSV · até 10 MB cada
          </div>

          {arquivoUrls.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {arquivoUrls.map((url, i) => (
                <li
                  key={url}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors group"
                >
                  <FileText aria-hidden className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] truncate"
                    title={fileNameFromUrl(url)}
                  >
                    {fileNameFromUrl(url)}
                  </a>
                  <button
                    type="button"
                    onClick={() => removerArquivo(i)}
                    aria-label={`Remover arquivo ${i + 1}`}
                    className="w-7 h-7 rounded-md text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shrink-0"
                  >
                    <Trash2 aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
