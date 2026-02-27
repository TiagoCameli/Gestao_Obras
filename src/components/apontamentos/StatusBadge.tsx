import type { Apontamento, TipoApontamento } from '../../types';

export default function StatusBadge({ status }: { status: 'pendente' | 'ativo' | 'concluido' }) {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Ativo
      </span>
    );
  }
  if (status === 'concluido') {
    return (
      <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
        Concluído
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Pendente
    </span>
  );
}

export function getStatusEntidade(apontamentos: Apontamento[], tipo: TipoApontamento, entidadeId: string, hoje: string): 'pendente' | 'ativo' | 'concluido' {
  const registros = apontamentos.filter((a) =>
    a.tipo === tipo && a.data === hoje &&
    (tipo === 'equipamento' ? a.equipamentoId === entidadeId : a.colaboradorId === entidadeId)
  );
  if (registros.length === 0) return 'pendente';
  if (registros.some((a) => a.status === 'aberto')) return 'ativo';
  return 'concluido';
}
