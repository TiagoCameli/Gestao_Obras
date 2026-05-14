import { useCallback, useRef } from "react";
import { Upload, X, FolderPlus, FolderInput, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { generateId } from "../../utils/format";
import { useAuth } from "../../../../contexts/AuthContext";

export interface PhotoItem {
  id: string;
  data: string;
}

export interface FolderData {
  id: string;
  name: string;
  photos: PhotoItem[];
  subfolders?: FolderData[];
  collapsed?: boolean;
}

interface PhotoUploadProps {
  folders: FolderData[];
  onChange: (folders: FolderData[]) => void;
}

/* ──────────────────────────── Drag-drop area ──────────────────────────── */

function FolderUploadArea({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => {
        setIsDragging(false);
        handleDrop(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-[#f59e0b] bg-[#f59e0b]/5"
          : "border-[#2e3345] hover:border-[#f59e0b] hover:bg-[#f59e0b]/5"
      }`}
    >
      <Upload className="h-6 w-6 mx-auto text-[#5c6380] mb-1" />
      <p className="text-[11px] text-[#9198ad]">Clique ou arraste fotos aqui</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}

function readFiles(files: FileList | File[]): Promise<PhotoItem[]> {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<PhotoItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              data: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
        })
    )
  );
}

/* ───────────────────────── Tree import helpers ────────────────────────── */

interface ImportNode {
  name: string;
  files: File[];
  children: Map<string, ImportNode>;
}

function newNode(name: string): ImportNode {
  return { name, files: [], children: new Map() };
}

/**
 * Constrói uma árvore de pastas a partir do FileList retornado por um
 * `<input webkitdirectory>`. Usa `webkitRelativePath` para reconstruir a
 * hierarquia completa — raiz é a própria pasta que o usuário escolheu.
 */
function buildTreeFromFiles(files: FileList): ImportNode[] {
  const roots: Map<string, ImportNode> = new Map();
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) continue;
    const relPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = relPath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    // parts[0..n-2] são diretórios; parts[n-1] é o arquivo.
    const dirs = parts.slice(0, -1);
    // Se veio só o arquivo sem diretório, cai num grupo default "Fotos".
    const rootName = dirs[0] ?? "Fotos";
    let root = roots.get(rootName);
    if (!root) {
      root = newNode(rootName);
      roots.set(rootName, root);
    }

    let current = root;
    for (let i = 1; i < dirs.length; i++) {
      const childName = dirs[i];
      let next = current.children.get(childName);
      if (!next) {
        next = newNode(childName);
        current.children.set(childName, next);
      }
      current = next;
    }
    current.files.push(file);
  }
  return Array.from(roots.values());
}

/** Converte um nó de import em `FolderData`, recursivamente. */
async function importNodeToFolderData(node: ImportNode): Promise<FolderData> {
  const photos = await readFiles(node.files);
  const subfolders: FolderData[] = [];
  for (const child of node.children.values()) {
    subfolders.push(await importNodeToFolderData(child));
  }
  return {
    id: generateId(),
    name: node.name,
    photos,
    subfolders: subfolders.length > 0 ? subfolders : undefined,
  };
}

/** Mescla uma pasta importada dentro de uma existente com o mesmo nome. */
function mergeFolders(existing: FolderData, incoming: FolderData): FolderData {
  const subs = [...(existing.subfolders ?? [])];
  for (const newSub of incoming.subfolders ?? []) {
    const idx = subs.findIndex((s) => s.name === newSub.name);
    if (idx >= 0) {
      subs[idx] = mergeFolders(subs[idx], newSub);
    } else {
      subs.push(newSub);
    }
  }
  return {
    ...existing,
    photos: [...existing.photos, ...incoming.photos],
    subfolders: subs.length > 0 ? subs : undefined,
  };
}

/* ─────────────────────── Recursive tree operations ────────────────────── */

type Updater = (folder: FolderData) => FolderData;

/** Aplica uma transformação à pasta com `targetId` em qualquer profundidade. */
function updateFolderInTree(
  list: FolderData[],
  targetId: string,
  updater: Updater
): FolderData[] {
  return list.map((f) => {
    if (f.id === targetId) return updater(f);
    if (f.subfolders?.length) {
      return { ...f, subfolders: updateFolderInTree(f.subfolders, targetId, updater) };
    }
    return f;
  });
}

/** Remove uma pasta por id em qualquer profundidade. */
function removeFolderFromTree(list: FolderData[], targetId: string): FolderData[] {
  return list
    .filter((f) => f.id !== targetId)
    .map((f) =>
      f.subfolders?.length
        ? { ...f, subfolders: removeFolderFromTree(f.subfolders, targetId) }
        : f
    );
}

/** Remove uma foto `photoId` dentro de uma pasta específica. */
function removePhotoFromTree(
  list: FolderData[],
  folderId: string,
  photoId: string
): FolderData[] {
  return updateFolderInTree(list, folderId, (f) => ({
    ...f,
    photos: f.photos.filter((p) => p.id !== photoId),
  }));
}

/** Conta todas as fotos (recursivo). */
function countPhotos(folder: FolderData): number {
  return (
    folder.photos.length +
    (folder.subfolders ?? []).reduce((s, sf) => s + countPhotos(sf), 0)
  );
}

/* ────────────────────────────── Component ─────────────────────────────── */

export function PhotoUpload({ folders, onChange }: PhotoUploadProps) {
  const { temAcao } = useAuth();
  const canUpload = temAcao("upload_fotos_medicao");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Se não pode fazer upload, mostra modo somente-leitura
  if (!canUpload && folders.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-center text-xs text-[#94a3b8]">
        Sem permissão para upload de fotos.
      </div>
    );
  }

  const addFolder = () => {
    const newFolder: FolderData = {
      id: generateId(),
      name: `Pasta ${folders.length + 1}`,
      photos: [],
    };
    onChange([...folders, newFolder]);
  };

  const addSubfolder = (parentId: string) => {
    onChange(
      updateFolderInTree(folders, parentId, (p) => ({
        ...p,
        collapsed: false,
        subfolders: [
          ...(p.subfolders ?? []),
          {
            id: generateId(),
            name: `Subpasta ${(p.subfolders?.length ?? 0) + 1}`,
            photos: [],
          },
        ],
      }))
    );
  };

  const importFolders = async (files: FileList) => {
    const trees = buildTreeFromFiles(files);
    if (trees.length === 0) return;

    const incoming = await Promise.all(trees.map(importNodeToFolderData));

    const existingByName = new Map<string, FolderData>();
    for (const f of folders) existingByName.set(f.name, f);

    const updated: FolderData[] = [...folders];
    for (const f of incoming) {
      const existing = existingByName.get(f.name);
      if (existing) {
        const idx = updated.findIndex((u) => u.id === existing.id);
        updated[idx] = mergeFolders(existing, f);
      } else {
        updated.push(f);
      }
    }
    onChange(updated);
  };

  const removeFolder = (folderId: string) => {
    onChange(removeFolderFromTree(folders, folderId));
  };

  const addPhotosToFolder = async (folderId: string, files: FileList) => {
    const newPhotos = await readFiles(files);
    onChange(
      updateFolderInTree(folders, folderId, (f) => ({
        ...f,
        photos: [...f.photos, ...newPhotos],
      }))
    );
  };

  const removePhoto = (folderId: string, photoId: string) => {
    onChange(removePhotoFromTree(folders, folderId, photoId));
  };

  const startRename = (folder: FolderData) => {
    setEditingName(folder.id);
    setTempName(folder.name);
  };

  const commitRename = (folderId: string) => {
    if (tempName.trim()) {
      onChange(
        updateFolderInTree(folders, folderId, (f) => ({
          ...f,
          name: tempName.trim(),
        }))
      );
    }
    setEditingName(null);
  };

  const toggleCollapse = (folderId: string) => {
    onChange(
      updateFolderInTree(folders, folderId, (f) => ({
        ...f,
        collapsed: !f.collapsed,
      }))
    );
  };

  const totalPhotos = folders.reduce((sum, f) => sum + countPhotos(f), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-[#9198ad] uppercase tracking-wider">
          Fotos {totalPhotos > 0 && <span className="text-[#5c6380]">({totalPhotos})</span>}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1 text-[11px] text-[#5aa7ff] hover:text-[#3b82f6] transition-colors"
            title="Importar pastas prontas do computador (preserva estrutura de subpastas)"
          >
            <FolderInput className="h-3.5 w-3.5" />
            Importar Pastas
          </button>
          <button
            type="button"
            onClick={addFolder}
            className="flex items-center gap-1 text-[11px] text-[#f59e0b] hover:text-[#d97706] transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Nova Pasta
          </button>
        </div>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error webkitdirectory not in React types but widely supported
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files) importFolders(e.target.files);
          e.target.value = "";
        }}
      />

      {folders.length === 0 && (
        <div className="border border-dashed border-[#2e3345] rounded-lg p-6 text-center">
          <FolderPlus className="h-8 w-8 mx-auto text-[#2e3345] mb-2" />
          <p className="text-xs text-[#5c6380] mb-3">
            Crie pastas para organizar as fotos ou importe diretamente do seu computador (preserva subpastas)
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={addFolder}
              className="text-xs text-[#f59e0b] hover:text-[#d97706] font-semibold transition-colors"
            >
              + Criar Primeira Pasta
            </button>
            <span className="text-[#2e3345]">·</span>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1 text-xs text-[#5aa7ff] hover:text-[#3b82f6] font-semibold transition-colors"
            >
              <FolderInput className="h-3.5 w-3.5" />
              Importar Pastas do Computador
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {folders.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            depth={0}
            editingName={editingName}
            tempName={tempName}
            onSetTempName={setTempName}
            onStartRename={startRename}
            onCommitRename={commitRename}
            onCancelRename={() => setEditingName(null)}
            onToggleCollapse={toggleCollapse}
            onAddSubfolder={addSubfolder}
            onAddPhotos={addPhotosToFolder}
            onRemoveFolder={removeFolder}
            onRemovePhoto={removePhoto}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── FolderNode ─────────────────────────────── */

interface FolderNodeProps {
  folder: FolderData;
  depth: number;
  editingName: string | null;
  tempName: string;
  onSetTempName: (name: string) => void;
  onStartRename: (folder: FolderData) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onToggleCollapse: (id: string) => void;
  onAddSubfolder: (id: string) => void;
  onAddPhotos: (id: string, files: FileList) => void;
  onRemoveFolder: (id: string) => void;
  onRemovePhoto: (folderId: string, photoId: string) => void;
}

function FolderNode({
  folder,
  depth,
  editingName,
  tempName,
  onSetTempName,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleCollapse,
  onAddSubfolder,
  onAddPhotos,
  onRemoveFolder,
  onRemovePhoto,
}: FolderNodeProps) {
  const totalCount = countPhotos(folder);
  const hasSubfolders = (folder.subfolders?.length ?? 0) > 0;

  return (
    <div
      className="bg-[#0f1117] border border-[#2e3345] rounded-lg overflow-hidden"
      style={{ marginLeft: depth === 0 ? 0 : 12 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161820]">
        <button
          type="button"
          onClick={() => onToggleCollapse(folder.id)}
          className="text-[#5c6380] hover:text-[#9198ad] transition-colors"
        >
          {folder.collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {editingName === folder.id ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => onSetTempName(e.target.value)}
            onBlur={() => onCommitRename(folder.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename(folder.id);
              if (e.key === "Escape") onCancelRename();
            }}
            autoFocus
            className="flex-1 bg-transparent text-xs text-[#e8eaf0] font-semibold border-b border-[#f59e0b] outline-none py-0.5"
          />
        ) : (
          <span
            className="flex-1 text-xs text-[#e8eaf0] font-semibold truncate cursor-pointer"
            onClick={() => onStartRename(folder)}
            title="Clique para renomear"
          >
            {folder.name}
            {hasSubfolders && (
              <span className="ml-1 text-[9px] text-[#5c6380] font-normal">
                ({folder.subfolders!.length} {folder.subfolders!.length === 1 ? "subpasta" : "subpastas"})
              </span>
            )}
          </span>
        )}

        <span className="text-[10px] text-[#5c6380] font-mono">{totalCount}</span>

        {editingName !== folder.id && (
          <>
            <button
              type="button"
              onClick={() => onAddSubfolder(folder.id)}
              className="p-0.5 text-[#5c6380] hover:text-[#5aa7ff] transition-colors"
              title="Adicionar subpasta"
            >
              <FolderPlus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onStartRename(folder)}
              className="p-0.5 text-[#5c6380] hover:text-[#f59e0b] transition-colors"
              title="Renomear"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onRemoveFolder(folder.id)}
          className="p-0.5 text-[#5c6380] hover:text-[#ef4444] transition-colors"
          title="Remover pasta"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!folder.collapsed && (
        <div className="p-2 space-y-2">
          {/* Subpastas aninhadas */}
          {(folder.subfolders ?? []).map((sub) => (
            <FolderNode
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              editingName={editingName}
              tempName={tempName}
              onSetTempName={onSetTempName}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onToggleCollapse={onToggleCollapse}
              onAddSubfolder={onAddSubfolder}
              onAddPhotos={onAddPhotos}
              onRemoveFolder={onRemoveFolder}
              onRemovePhoto={onRemovePhoto}
            />
          ))}

          {/* Grade de fotos desta pasta */}
          {folder.photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {folder.photos.map((p) => (
                <div
                  key={p.id}
                  className="relative group aspect-square rounded-md overflow-hidden"
                >
                  <img src={p.data} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePhoto(folder.id, p.id);
                    }}
                    className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <FolderUploadArea onFiles={(files) => onAddPhotos(folder.id, files)} />
        </div>
      )}
    </div>
  );
}
