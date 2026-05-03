import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import EquipamentoCard from '../cards/EquipamentoCard';
import ManutencaoEmptyState from '../shared/ManutencaoEmptyState';
import type { EquipamentoComStatusManutencao } from '../../types';
import type { StatusManutencao } from '../badges/StatusManutencaoBadge';

export interface FrotaListProps {
  equipamentos: EquipamentoComStatusManutencao[];
  onSelect?: (id: string) => void;
  emptyMessage?: string;
  className?: string;
}

type FiltroStatus = 'todos' | StatusManutencao;

const OPCOES_STATUS: Array<{ value: FiltroStatus; label: string }> = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'em_manutencao', label: 'Em manutenção' },
  { value: 'sem_dados', label: 'Sem dados' },
];

function statusDe(eq: EquipamentoComStatusManutencao): StatusManutencao {
  if (!eq.horimetroFuncional && eq.horimetroAtual === undefined) return 'sem_dados';
  if (eq.manutencoesAtrasadas > 0 || eq.alertasCriticos > 0) return 'atrasada';
  const dias = eq.proximaManutencao?.diasRestantes;
  if (dias !== undefined && dias <= 7 && dias >= 0) return 'atencao';
  return 'em_dia';
}

export function FrotaList({
  equipamentos,
  onSelect,
  emptyMessage,
  className = '',
}: FrotaListProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipamentos.filter((eq) => {
      if (filtroStatus !== 'todos' && statusDe(eq) !== filtroStatus) return false;
      if (!termo) return true;
      return (
        eq.patrimony.toLowerCase().includes(termo) ||
        eq.nome.toLowerCase().includes(termo) ||
        (eq.modeloNome ?? '').toLowerCase().includes(termo)
      );
    });
  }, [equipamentos, busca, filtroStatus]);

  return (
    <div className={'flex flex-col gap-4 ' + className}>
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(180px,220px)]">
        <Input
          id="frota-busca"
          label="Buscar"
          placeholder="Patrimônio, nome ou modelo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select
          id="frota-status"
          label="Status"
          options={OPCOES_STATUS.map((o) => ({ value: o.value, label: o.label }))}
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
        />
      </div>

      {filtrados.length === 0 ? (
        <ManutencaoEmptyState
          titulo="Nenhum equipamento"
          mensagem={
            emptyMessage ??
            (equipamentos.length === 0
              ? 'A frota está vazia.'
              : 'Nenhum equipamento corresponde aos filtros aplicados.')
          }
          icone={<Truck />}
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((eq) => (
            <EquipamentoCard
              key={eq.equipamentoId}
              equipamento={eq}
              onClick={onSelect ? () => onSelect(eq.equipamentoId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FrotaList;
