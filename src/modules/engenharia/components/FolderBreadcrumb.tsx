import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/breadcrumb';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderBreadcrumbProps {
  /** Pasta atual (último item, sem link). */
  atual: EngenhariaPasta;
  /** Cadeia de ancestrais ordenada da raiz até o pai imediato (sem incluir `atual`). */
  ancestrais: EngenhariaPasta[];
}

export function FolderBreadcrumb({ atual, ancestrais }: FolderBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/engenharia">Engenharia</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {ancestrais.map((p) => (
          <span key={p.id} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/engenharia/pasta/${p.id}`}>{p.nome}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </span>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{atual.nome}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default FolderBreadcrumb;
