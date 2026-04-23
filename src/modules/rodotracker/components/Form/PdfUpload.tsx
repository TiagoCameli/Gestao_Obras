import { useCallback, useRef, useState } from "react";
import { FileText, Upload, X, Eye, Download } from "lucide-react";
import { generateId } from "../../utils/format";

export interface PdfItem {
  id: string;
  name: string;
  size: number;
  data: string; // base64 data URL
}

interface PdfUploadProps {
  pdfs: PdfItem[];
  onChange: (pdfs: PdfItem[]) => void;
}

function readPdfs(files: FileList): Promise<PdfItem[]> {
  return Promise.all(
    Array.from(files)
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map(
        (file) =>
          new Promise<PdfItem>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: generateId(),
                name: file.name,
                size: file.size,
                data: reader.result as string,
              });
            };
            reader.readAsDataURL(file);
          })
      )
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/pdf";
  const binary = atob(body);
  const len = binary.length;
  const ua = new Uint8Array(len);
  for (let i = 0; i < len; i++) ua[i] = binary.charCodeAt(i);
  return new Blob([ua], { type: mime });
}

function openPdf(item: PdfItem) {
  const blob = dataUrlToBlob(item.data);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadPdf(item: PdfItem) {
  const blob = dataUrlToBlob(item.data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function PdfUpload({ pdfs, onChange }: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    async (files: FileList) => {
      const loaded = await readPdfs(files);
      if (loaded.length > 0) onChange([...pdfs, ...loaded]);
    },
    [pdfs, onChange]
  );

  const remove = (id: string) => {
    onChange(pdfs.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-[#9198ad] uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Documentos (PDF) {pdfs.length > 0 && (
            <span className="text-[#5c6380] normal-case tracking-normal">
              ({pdfs.length})
            </span>
          )}
        </label>
      </div>

      {pdfs.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {pdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="flex items-center gap-2.5"
              style={{
                padding: "8px 10px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: "rgba(255, 90, 114, 0.12)",
                  color: "#ff5a72",
                }}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="truncate"
                  style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}
                >
                  {pdf.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}
                >
                  {formatSize(pdf.size)}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openPdf(pdf)}
                  className="p-1.5 rounded-md"
                  style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--info)";
                    e.currentTarget.style.background = "var(--info-dim)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                  title="Abrir"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf(pdf)}
                  className="p-1.5 rounded-md"
                  style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent)";
                    e.currentTarget.style.background = "var(--accent-faint)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(pdf.id)}
                  className="p-1.5 rounded-md"
                  style={{ color: "var(--text-muted)", transition: "all 0.2s" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--danger)";
                    e.currentTarget.style.background = "var(--danger-dim)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-[#ff5a72] bg-[#ff5a72]/5"
            : "border-[#2e3345] hover:border-[#ff5a72] hover:bg-[#ff5a72]/5"
        }`}
      >
        <Upload className="h-5 w-5 mx-auto text-[#5c6380] mb-1.5" />
        <p className="text-xs text-[#9198ad]">Clique ou arraste PDFs aqui</p>
        <p className="text-[10px] text-[#5c6380] mt-1">Apenas arquivos .pdf</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
