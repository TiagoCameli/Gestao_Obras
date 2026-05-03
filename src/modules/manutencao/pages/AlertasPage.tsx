import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { useAlertasAtivos } from '../hooks/useAlertasAtivos';
import { useFrotaComStatus } from '../hooks/useFrotaComStatus';
import type { EquipamentoComStatusManutencao } from '../types';
import AlertaCard from '../components/cards/AlertaCard';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import ManutencaoEmptyState from '../components/shared/ManutencaoEmptyState';
import {
  reconhecerAlerta,
  gerarAlertasAtrasados,
} from '../utils/manutencaoAlertasApi';
import { ACOES_MANUTENCAO, type AlertaSeveridade } from '../types';

const SEVERIDADES: Array<{ value: '' | AlertaSeveridade; label: string }> = [
  { value: '', label: 'Todas as severidades' },
  { value: 'critical', label: 'Crítico' },
  { value: 'warning', label: 'Atenção' },
  { value: 'info', label: 'Informação' },
];

export default function AlertasPage() {
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();
  const podeExecutar = temAcao(ACOES_MANUTENCAO.executar);

  const [severidade, setSeveridade] = useState<'' | AlertaSeveridade>('');
  const [equipamentoId, setEquipamentoId] = useState<string>('');
  const [gerando, setGerando] = useState(false);

  const filtros = useMemo(
    () => ({
      severidade: severidade || undefined,
      equipamentoId: equipamentoId || undefined,
    }),
    [severidade, equipamentoId]
  );

  const alertas = useAlertasAtivos(filtros);
  const frota = useFrotaComStatus();

  const equipPorId = useMemo(() => {
    const m = new Map<string, EquipamentoComStatusManutencao>();
    (frota.data ?? []).forEach((e) => m.set(e.equipamentoId, e));
    return m;
  }, [frota.data]);

  async function handleReconhecer(id: string) {
    if (!usuario) return;
    try {
      await reconhecerAlerta(id, usuario.funcionarioId);
      await qc.invalidateQueries({ queryKey: ['manutencao', 'alertas-ativos'] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao reconhecer alerta');
    }
  }

  async function handleGerar() {
    if (!usuario) return;
    setGerando(true);
    try {
      const novos = await gerarAlertasAtrasados(usuario.funcionarioId);
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      alert(`${novos.length} alerta(s) gerado(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar alertas');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid sm:grid-cols-2 gap-3 flex-1 min-w-0">
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Severidade
            </label>
            <select
              value={severidade}
              onChange={(e) => setSeveridade(e.target.value as '' | AlertaSeveridade)}
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
            >
              {SEVERIDADES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Equipamento
            </label>
            <select
              value={equipamentoId}
              onChange={(e) => setEquipamentoId(e.target.value)}
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
            >
              <option value="">Todos</option>
              {(frota.data ?? []).map((e) => (
                <option key={e.equipamentoId} value={e.equipamentoId}>
                  {e.patrimony} — {e.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {podeExecutar && (
          <Button variant="secondary" onClick={handleGerar} disabled={gerando}>
            <RefreshCw aria-hidden className="w-4 h-4" />
            {gerando ? 'Gerando...' : 'Atualizar alertas'}
          </Button>
        )}
      </div>

      {alertas.isLoading && <ManutencaoLoadingState />}
      {alertas.error && <ManutencaoErrorState erro={alertas.error} onRetry={() => alertas.refetch()} />}
      {!alertas.isLoading && !alertas.error && (alertas.data?.length ?? 0) === 0 && (
        <ManutencaoEmptyState
          titulo="Nenhum alerta ativo"
          mensagem="Nenhum alerta corresponde aos filtros aplicados."
        />
      )}
      <div className="grid gap-2">
        {(alertas.data ?? []).map((a) => (
          <AlertaCard
            key={a.id}
            alerta={a}
            equipamento={equipPorId.get(a.equipamentoId)}
            onReconhecer={handleReconhecer}
          />
        ))}
      </div>

      {!podeExecutar && (
        <Card className="!p-3 text-xs text-[var(--color-fg-muted)]">
          Para gerar novos alertas automaticamente, é necessário a permissão "Executar manutenção".
        </Card>
      )}
    </div>
  );
}

export { AlertasPage };
