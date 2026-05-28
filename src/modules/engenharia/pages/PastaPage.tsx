import { useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Plus, FilePlus, FolderPlus, Calculator } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  useEngenhariaPasta,
  useEngenhariaPastasFilhas,
  useEngenhariaPastasRaizes,
} from '../hooks/useEngenhariaPastas';
import { useCriarNota } from '../hooks/useEngenhariaNotas';
import { FolderBreadcrumb } from '../components/FolderBreadcrumb';
import { FolderTree } from '../components/FolderTree';
import { FolderCard } from '../components/FolderCard';
import { FileDropZone } from '../components/FileDropZone';
import { CriarPastaDialog } from '../components/CriarPastaDialog';
import type { EngenhariaPasta } from '../types/pasta';

export default function PastaPage() {
  const { id } = useParams<{ id: string }>();
  const { temAcao } = useAuth();
  const navigate = useNavigate();
  const criarNota = useCriarNota();
  const { showToast } = useToast();
  const [criarOpen, setCriarOpen] = useState(false);

  const { data: pasta, isLoading: loadingPasta } = useEngenhariaPasta(id ?? '');
  const { data: filhas, isLoading: loadingFilhas } = useEngenhariaPastasFilhas(id ?? null);
  const { data: raizes } = useEngenhariaPastasRaizes();

  if (!id) return <Navigate to="/engenharia" replace />;

  // v1: breadcrumb mostra apenas "Engenharia / <pasta atual>". Cadeia completa
  // de ancestrais (a partir do `caminho`) é um refinamento futuro.
  const ancestrais: EngenhariaPasta[] = [];

  if (loadingPasta) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!pasta) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Pasta não encontrada ou sem permissão.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)]">
      {/* Sidebar: tree */}
      <aside className="w-72 shrink-0 border-r border-border bg-muted/30 p-3 overflow-y-auto">
        {raizes && <FolderTree raizes={raizes} />}
      </aside>

      {/* Main: breadcrumb + listing + dropzone */}
      <main className="flex-1 p-6 space-y-4 overflow-y-auto">
        <FolderBreadcrumb atual={pasta} ancestrais={ancestrais} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{pasta.nome}</h1>
          {temAcao('criar_engenharia_pasta') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCriarOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Subpasta
                </DropdownMenuItem>
                {temAcao('criar_engenharia_nota') && (
                  <DropdownMenuItem
                    disabled={criarNota.isPending}
                    onClick={async () => {
                      try {
                        const nota = await criarNota.mutateAsync({ pastaId: pasta.id, titulo: 'Nova nota' });
                        navigate(`/engenharia/nota/${nota.id}`);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'erro desconhecido';
                        showToast({ kind: 'error', message: `Falha ao criar nota: ${msg}` });
                      }
                    }}
                  >
                    <FilePlus className="mr-2 h-4 w-4" /> Nota
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled>
                  <Calculator className="mr-2 h-4 w-4" /> Cálculo (Onda 5)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Listing das subpastas */}
        {loadingFilhas ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (filhas?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Pasta vazia. Crie uma subpasta ou suba arquivos.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filhas!.map((f) => (
              <FolderCard key={f.id} pasta={f} />
            ))}
          </div>
        )}

        {/* Drop zone */}
        {temAcao('upload_engenharia_arquivo') && <FileDropZone pastaId={pasta.id} />}
      </main>

      <CriarPastaDialog open={criarOpen} onOpenChange={setCriarOpen} parentId={pasta.id} />
    </div>
  );
}
