import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Folder, FolderKanban } from 'lucide-react';
import { Skeleton } from '@/components/shadcn/skeleton';
import { useEngenhariaPastasFilhas } from '../hooks/useEngenhariaPastas';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderTreeProps {
  /** Pastas raiz a serem renderizadas no topo da árvore. */
  raizes: EngenhariaPasta[];
}

/**
 * Árvore recursiva de pastas com expansão lazy: cada nó só busca seus filhos
 * via `useEngenhariaPastasFilhas` quando é expandido pela primeira vez.
 */
export function FolderTree({ raizes }: FolderTreeProps) {
  return (
    <nav className="text-sm" aria-label="Árvore de pastas">
      <ul className="space-y-0.5">
        {raizes.map((p) => (
          <FolderNode key={p.id} pasta={p} nivel={0} />
        ))}
      </ul>
    </nav>
  );
}

interface FolderNodeProps {
  pasta: EngenhariaPasta;
  nivel: number;
}

function FolderNode({ pasta, nivel }: FolderNodeProps) {
  const [aberto, setAberto] = useState(false);
  const { id: pastaAtivaId } = useParams<{ id: string }>();
  const ativa = pastaAtivaId === pasta.id;

  // Lazy: só busca filhas quando expande.
  const { data: filhas, isLoading } = useEngenhariaPastasFilhas(aberto ? pasta.id : null);
  const semFilhas = aberto && !isLoading && (filhas?.length ?? 0) === 0;

  const Icon = pasta.tipo === 'obra' ? FolderKanban : Folder;

  return (
    <li>
      <div
        className={
          'flex items-center gap-1 rounded px-2 py-1 ' +
          (ativa
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-muted')
        }
        style={{ paddingLeft: `${0.5 + nivel * 0.75}rem` }}
      >
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="p-0.5"
          aria-label={aberto ? 'Recolher' : 'Expandir'}
          aria-expanded={aberto}
        >
          <ChevronRight
            className={'h-3.5 w-3.5 transition-transform ' + (aberto ? 'rotate-90' : '')}
          />
        </button>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Link
          to={`/engenharia/pasta/${pasta.id}`}
          className="truncate flex-1"
          title={pasta.nome}
        >
          {pasta.nome}
        </Link>
      </div>

      {aberto && (
        <ul className="space-y-0.5">
          {isLoading && (
            <li className="pl-8 py-1">
              <Skeleton className="h-4 w-32" />
            </li>
          )}
          {semFilhas && (
            <li className="pl-8 py-1 text-xs text-muted-foreground italic">vazia</li>
          )}
          {filhas?.map((f) => (
            <FolderNode key={f.id} pasta={f} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default FolderTree;
