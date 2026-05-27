import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useEngenhariaPastasRaizes } from '../hooks/useEngenhariaPastas';
import { FolderCard } from '../components/FolderCard';
import { CriarPastaDialog } from '../components/CriarPastaDialog';

export default function EngenhariaPage() {
  const { temAcao } = useAuth();
  const [criarOpen, setCriarOpen] = useState(false);
  const { data: raizes, isLoading } = useEngenhariaPastasRaizes();

  const obras = raizes?.filter((p) => p.tipo === 'obra') ?? [];
  const avulsas = raizes?.filter((p) => p.tipo === 'avulsa') ?? [];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engenharia</h1>
          <p className="text-sm text-muted-foreground">
            Workspace de obras: pastas, notas, cálculos e arquivos.
          </p>
        </div>
        {temAcao('criar_engenharia_pasta') && (
          <Button onClick={() => setCriarOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> Nova pasta avulsa
          </Button>
        )}
      </header>

      {/* Seção: Obras */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Obras</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : obras.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma obra cadastrada. Cadastre uma em{' '}
            <a href="/obras" className="underline">
              /obras
            </a>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {obras.map((p) => (
              <FolderCard key={p.id} pasta={p} />
            ))}
          </div>
        )}
      </section>

      {/* Seção: Avulsas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Avulsas</h2>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : avulsas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pasta avulsa ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {avulsas.map((p) => (
              <FolderCard key={p.id} pasta={p} />
            ))}
          </div>
        )}
      </section>

      <CriarPastaDialog open={criarOpen} onOpenChange={setCriarOpen} parentId={null} />
    </div>
  );
}
