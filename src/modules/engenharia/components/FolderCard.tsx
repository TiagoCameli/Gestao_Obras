import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderKanban, FolderOpen, Pencil, Move, Trash2 } from 'lucide-react';
import { Card } from '@/components/shadcn/card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/shadcn/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSoftDeletePasta } from '../hooks/useEngenhariaPastas';
import { RenomearPastaDialog } from './RenomearPastaDialog';
import { MoverPastaDialog } from './MoverPastaDialog';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderCardProps {
  pasta: EngenhariaPasta;
  /** Opcional — mostra "N itens" abaixo do nome. */
  contagemFilhos?: number;
}

type DialogAberto = 'renomear' | 'mover' | 'excluir' | null;

/**
 * Card grande de pasta com ContextMenu (right-click) embutido para
 * Renomear / Mover / Excluir. Gate por temAcao; rename é desabilitado
 * para pastas de obra (sincronizadas via trigger SQL).
 */
export function FolderCard({ pasta, contagemFilhos }: FolderCardProps) {
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const [dialog, setDialog] = useState<DialogAberto>(null);
  const softDelete = useSoftDeletePasta();

  const Icon = pasta.tipo === 'obra' ? FolderKanban : Folder;
  const podeEditar = temAcao('editar_engenharia_pasta');
  const podeExcluir = temAcao('excluir_engenharia_pasta');
  const ehPastaDeObra = pasta.tipo === 'obra';

  function abrir() {
    navigate(`/engenharia/pasta/${pasta.id}`);
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrir();
    }
  }

  async function confirmarExcluir() {
    await softDelete.mutateAsync(pasta.id);
    setDialog(null);
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            role="button"
            tabIndex={0}
            onClick={abrir}
            onKeyDown={handleKey}
            className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            aria-label={`Abrir pasta ${pasta.nome}`}
          >
            <div className="flex items-start gap-3 px-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground" title={pasta.nome}>
                  {pasta.nome}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {pasta.tipo === 'obra' && 'Obra'}
                  {pasta.tipo === 'avulsa' && 'Avulsa'}
                  {pasta.tipo === 'subpasta' && 'Subpasta'}
                  {typeof contagemFilhos === 'number' && (
                    <span>
                      {' · '}
                      {contagemFilhos} {contagemFilhos === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onSelect={abrir}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Abrir
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!podeEditar || ehPastaDeObra}
            onSelect={() => setDialog('renomear')}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
            {ehPastaDeObra && (
              <span className="ml-auto text-xs text-muted-foreground">via Obras</span>
            )}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!podeEditar}
            onSelect={() => setDialog('mover')}
          >
            <Move className="mr-2 h-4 w-4" />
            Mover
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!podeExcluir}
            onSelect={() => setDialog('excluir')}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <RenomearPastaDialog
        open={dialog === 'renomear'}
        onOpenChange={(open) => !open && setDialog(null)}
        pasta={pasta}
      />

      <MoverPastaDialog
        open={dialog === 'mover'}
        onOpenChange={(open) => !open && setDialog(null)}
        pasta={pasta}
      />

      <AlertDialog
        open={dialog === 'excluir'}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{pasta.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A pasta vai pra lixeira da Engenharia. Conteúdo dentro dela
              (subpastas, notas, cálculos, arquivos) também ficam ocultos.
              Você pode restaurar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FolderCard;
