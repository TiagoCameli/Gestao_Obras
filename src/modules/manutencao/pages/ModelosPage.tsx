import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Box } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import { useEquipamentoModelos } from '../hooks/useEquipamentoModelos';
import { useManutencaoTarefas } from '../hooks/useManutencaoTarefas';
import { useContagemEquipamentosPorModelo } from '../hooks/useContagemEquipamentosPorModelo';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import ManutencaoEmptyState from '../components/shared/ManutencaoEmptyState';
import { ACOES_MANUTENCAO } from '../types';

export default function ModelosPage() {
  const { temAcao } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  const [busca, setBusca] = useState('');
  const [fabricante, setFabricante] = useState('');

  const filtros = useMemo(
    () => ({
      ativo: true,
      search: busca.trim() || undefined,
      fabricante: fabricante.trim() || undefined,
    }),
    [busca, fabricante]
  );
  const { data, isLoading, error, refetch } = useEquipamentoModelos(filtros);
  const contagem = useContagemEquipamentosPorModelo();

  const fabricantes = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((m) => set.add(m.fabricante));
    return Array.from(set).sort();
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid sm:grid-cols-[1fr_220px] gap-3 flex-1 min-w-0">
          <Input
            id="modelos-busca"
            label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou família..."
          />
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Fabricante
            </label>
            <select
              value={fabricante}
              onChange={(e) => setFabricante(e.target.value)}
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
            >
              <option value="">Todos</option>
              {fabricantes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        {podeGerenciar && (
          <Link
            to="novo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-medium hover:bg-[var(--color-accent-hover)]"
          >
            <Plus aria-hidden className="w-4 h-4" />
            Novo modelo
          </Link>
        )}
      </div>

      {isLoading && <ManutencaoLoadingState />}
      {error && <ManutencaoErrorState erro={error} onRetry={() => refetch()} />}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <ManutencaoEmptyState
          titulo="Nenhum modelo"
          mensagem="Cadastre o primeiro modelo do catálogo para começar."
          icone={<Box />}
        />
      )}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((m) => (
          <Link
            key={m.id}
            to={m.id}
            className="block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <Card className="!p-4 h-full">
              <div className="text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
                {m.fabricante}
              </div>
              <div className="text-lg font-semibold text-[var(--color-fg)]">{m.modeloNome}</div>
              <div className="text-sm text-[var(--color-fg-muted)] mt-0.5">{m.familia}</div>
              <ContagemTarefasInline modeloId={m.id} />
              {(() => {
                const n = contagem.data?.[m.id] ?? 0;
                if (n === 0) {
                  return (
                    <div className="text-xs text-[var(--color-fg-subtle)] italic mt-1">
                      Nenhum equipamento usa este modelo
                    </div>
                  );
                }
                return (
                  <div className="text-xs text-[var(--color-fg-muted)] mt-1">
                    {n} equipamento{n === 1 ? '' : 's'} na frota
                  </div>
                );
              })()}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ContagemTarefasInline({ modeloId }: { modeloId: string }) {
  const { data } = useManutencaoTarefas(modeloId);
  return (
    <div className="text-xs text-[var(--color-fg-muted)] mt-2">
      {data?.length ?? 0} tarefa(s) cadastrada(s)
    </div>
  );
}

export { ModelosPage };
