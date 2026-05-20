import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BUCKET = 'abastecimento-fotos';
const SIGNED_URL_TTL_SECS = 60 * 60; // 1 hora (re-mint on demand)
const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;
const QTD_MAX = 8;

// F5.B.3 — stamp de geolocalização + timestamp em fotos da câmera.
// Fotos da galeria ficam intactas (preservam EXIF original e podem ser
// históricas — não faz sentido carimbar com data/local atual).

interface GeoData {
  lat: number;
  lon: number;
  accuracy: number; // metros
}

/** Pede geolocation com timeout. Retorna null em qualquer falha (permissão
 *  negada, sem GPS, timeout) — caller continua sem stamp de coords. */
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

/** Aplica stamp de timestamp + GPS no rodapé da imagem.
 *  HEIC/WebP convertidos pra JPEG no processo. Re-encode com qualidade 0.92
 *  pra balanço size×fidelity. Falha silenciosa retorna arquivo original. */
async function stampImage(file: File, geo: GeoData | null, time: Date): Promise<File> {
  try {
    // HEIC não decodifica em <img> de browsers fora Safari — pula stamp e mantém original
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

    // Tamanho proporcional à largura — funciona em fotos verticais e horizontais
    const fontSize = Math.max(20, Math.round(canvas.width / 50));
    const padding = Math.round(fontSize * 0.6);
    const lineHeight = Math.round(fontSize * 1.35);
    const totalH = lineHeight * 2 + padding * 2;

    // Faixa preta semi-transparente no rodapé
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvas.height - totalH, canvas.width, totalH);

    // Texto branco com leve sombra pra legibilidade em qualquer fundo
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

    // Renomeia pra .jpg pra refletir o re-encode (input pode ter sido .png/.webp)
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[FotoCaptureUploader] stamp falhou, salvando original:', e);
    return file;
  }
}

interface Props {
  /** URLs já existentes (signed) — em modo edit. */
  fotosUrls: string[];
  onChange: (urls: string[]) => void;
  /** ID/sessão pra agrupar uploads (ex.: id do abastecimento ou session id temp). */
  pastaId: string;
  className?: string;
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

function pathFromSignedUrl(url: string): string | null {
  const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function FotoCaptureUploader({ fotosUrls, onChange, pastaId, className = '' }: Props) {
  const [erros, setErros] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // F5.B.3 — exibe status do stamp no botão "Tirar foto" pro user saber que GPS
  // está sendo obtido (pode levar alguns segundos)
  const [stamping, setStamping] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  // Não revogamos signed URLs ao desmontar (são cacheáveis pelo browser)

  useEffect(() => {
    if (erros.length === 0) return;
    const t = setTimeout(() => setErros([]), 6000);
    return () => clearTimeout(t);
  }, [erros]);

  async function handleFiles(files: FileList | File[], fromCamera: boolean) {
    const arr = Array.from(files);
    const novosErros: string[] = [];
    const validos: File[] = [];
    const espacoLivre = QTD_MAX - fotosUrls.length;

    if (arr.length > espacoLivre) {
      novosErros.push(
        `Limite de ${QTD_MAX} fotos. Você tentou adicionar ${arr.length}, mas só restam ${espacoLivre} espaço(s).`
      );
    }

    for (const f of arr.slice(0, espacoLivre)) {
      if (!MIME_VALIDOS.includes(f.type)) {
        novosErros.push(`${f.name}: tipo "${f.type || 'desconhecido'}" não permitido (use JPEG/PNG/WebP)`);
        continue;
      }
      if (f.size > TAMANHO_MAX_BYTES) {
        novosErros.push(`${f.name}: ${formatarBytes(f.size)} excede o limite de 10 MB`);
        continue;
      }
      validos.push(f);
    }

    setErros(novosErros);
    if (validos.length === 0) return;

    // F5.B.3 — fotos via câmera ganham stamp de timestamp + GPS antes do upload.
    // Galeria preserva o original (foto pode ser histórica, EXIF original > stamp atual).
    let toUpload: File[] = validos;
    if (fromCamera) {
      setStamping(true);
      try {
        // Pede geo em paralelo ao processar imagem (ambos podem demorar)
        const geo = await getGeoOrNull();
        const now = new Date();
        toUpload = await Promise.all(validos.map((f) => stampImage(f, geo, now)));
      } finally {
        setStamping(false);
      }
    }

    setUploading(true);
    try {
      const novasUrls: string[] = [];
      for (const file of toUpload) {
        const ts = Date.now();
        const path = `${pastaId}/${ts}-${sanitizeNome(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          setErros((prev) => [...prev, `Falha no upload de ${file.name}: ${upErr.message}`]);
          continue;
        }
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECS);
        if (signErr) {
          setErros((prev) => [...prev, `Falha ao assinar URL de ${file.name}: ${signErr.message}`]);
          continue;
        }
        novasUrls.push(signed.signedUrl);
      }
      if (novasUrls.length > 0) onChange([...fotosUrls, ...novasUrls]);
    } finally {
      setUploading(false);
    }
  }

  async function removerFoto(idx: number) {
    const url = fotosUrls[idx];
    const path = pathFromSignedUrl(url);
    if (path) {
      try {
        await supabase.storage.from(BUCKET).remove([path]);
      } catch (e) {
        console.warn('Falha ao remover do bucket:', e);
      }
    }
    onChange(fotosUrls.filter((_, j) => j !== idx));
  }

  return (
    <div className={'flex flex-col gap-3 ' + className}>
      <div className="flex flex-wrap gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files, true);
            e.target.value = '';
          }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept={MIME_VALIDOS.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files, false);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading || stamping || fotosUrls.length >= QTD_MAX}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading || stamping ? (
            <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
          ) : (
            <Camera aria-hidden className="w-4 h-4" />
          )}
          {stamping ? 'Marcando local...' : uploading ? 'Enviando...' : 'Tirar foto'}
        </button>
        <button
          type="button"
          onClick={() => galeriaRef.current?.click()}
          disabled={uploading || stamping || fotosUrls.length >= QTD_MAX}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ImagePlus aria-hidden className="w-4 h-4" />
          Da galeria
        </button>
        <span className="text-xs text-[var(--color-fg-subtle)] self-center">
          {fotosUrls.length} de {QTD_MAX} foto(s) · até 10 MB cada
        </span>
      </div>

      {/* F5.B.3 — info textual sobre o stamp em fotos da câmera */}
      <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-fg-muted)] leading-tight">
        <MapPin aria-hidden className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          Fotos tiradas com "Tirar foto" recebem carimbo de data/hora e GPS no rodapé.
          Fotos da galeria mantêm o original.
        </span>
      </div>

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

      {fotosUrls.length > 0 && (
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
          {fotosUrls.map((url, i) => (
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
  );
}
