import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFrotaComStatus } from '../hooks/useFrotaComStatus';
import FrotaList from '../components/lists/FrotaList';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import { ACOES_MANUTENCAO } from '../types';

export default function FrotaPage() {
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const { data, isLoading, error, refetch } = useFrotaComStatus();

  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--color-fg-muted)]">
          {data?.length ?? 0} equipamento(s)
        </div>
        {podeEditar && (
          <Link
            to="novo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-medium hover:bg-[var(--color-accent-hover)]"
          >
            <Plus aria-hidden className="w-4 h-4" />
            Cadastrar equipamento
          </Link>
        )}
      </div>

      {isLoading && <ManutencaoLoadingState mensagem="Carregando frota..." />}
      {error && <ManutencaoErrorState erro={error} onRetry={() => refetch()} />}
      {!isLoading && !error && (
        <FrotaList
          equipamentos={data ?? []}
          onSelect={(id) => navigate(id)}
          emptyMessage="A frota está vazia. Cadastre o primeiro equipamento."
        />
      )}
    </div>
  );
}

export { FrotaPage };
