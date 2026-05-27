import { useNavigate } from 'react-router-dom';
import { Folder, FolderKanban } from 'lucide-react';
import { Card } from '@/components/shadcn/card';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderCardProps {
  pasta: EngenhariaPasta;
  /** Opcional — mostra "N itens" abaixo do nome. */
  contagemFilhos?: number;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * Card grande de pasta usado na home /engenharia e em listings dentro de
 * /engenharia/pasta/:id. Click navega para a pasta. Estilo segue tokens
 * shadcn (bg-card, text-foreground, text-muted-foreground) para dark mode.
 */
export function FolderCard({ pasta, contagemFilhos, onClick, onContextMenu }: FolderCardProps) {
  const navigate = useNavigate();
  const Icon = pasta.tipo === 'obra' ? FolderKanban : Folder;

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      navigate(`/engenharia/pasta/${pasta.id}`);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onContextMenu={onContextMenu}
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
              <span> · {contagemFilhos} {contagemFilhos === 1 ? 'item' : 'itens'}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default FolderCard;
