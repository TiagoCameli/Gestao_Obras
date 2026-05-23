// FI.7 — Aba "Sem Suprimento" (relatório de auditoria FIFO).
//
// Lista linhas em `saidas_sem_suprimento` populadas pelo backfill FIFO
// (FI.6) e por novos registros do helper `calcularPrecoFIFO`. Caso
// típico: saídas anteriores a qualquer entrada/transferência no tanque
// (saldo inicial não formalizado em `entradas_combustivel`).
//
// Usuário pode revisar caso a caso e — se aplicável — criar uma
// entrada retroativa pra suprir o saldo inicial faltante.
//
// QueryKey ['saidas_sem_suprimento'] é invalidada por
// useRegistrarSaidaFIFO.onSuccess (useSaidasCombustivel.ts), então
// novas saídas órfãs aparecem aqui automaticamente.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { fmtDataHora } from '../shared/formatters';

interface SemSuprimentoRow {
  id: string;
  saida_id: string;
  tanque_id: string;
  data_saida: string;
  litros_solicitados: number;
  litros_supridos: number;
  litros_sem_suprimento: number;
  observacao: string | null;
  detectado_em: string;
  revisado: boolean;
}

export default function SemSuprimentoTab() {
  const { data = [], isLoading, error } = useQuery<SemSuprimentoRow[]>({
    queryKey: ['saidas_sem_suprimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_sem_suprimento')
        .select('*')
        .order('data_saida', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SemSuprimentoRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-[var(--color-fg-muted)]">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Erro ao carregar: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-[var(--color-warning-soft)] p-4">
        <h2 className="font-semibold text-[var(--color-warning-fg)]">
          Saídas sem suprimento na linha do tempo
        </h2>
        <p className="text-xs mt-1 text-[var(--color-fg-muted)]">
          {data.length} saída(s) foram registradas antes de qualquer entrada
          ou transferência ter sido lançada no tanque. Provável causa: saldo
          inicial dos tanques não foi formalizado em{' '}
          <code>entradas_combustivel</code>. Revise e — se aplicável — crie
          uma entrada retroativa pra suprir o saldo inicial.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="text-center text-[var(--color-fg-muted)] p-8">
          Nenhuma saída sem suprimento.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)]">
              <tr>
                <th className="text-left p-2 font-medium">Saída ID</th>
                <th className="text-left p-2 font-medium">Data</th>
                <th className="text-right p-2 font-medium">Solicitados</th>
                <th className="text-right p-2 font-medium">Supridos</th>
                <th className="text-right p-2 font-medium">Sem suprimento</th>
                <th className="text-left p-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]/40">
                  <td className="p-2 font-mono text-xs">
                    {r.saida_id.slice(0, 12)}...
                  </td>
                  <td className="p-2">{fmtDataHora(r.data_saida)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {Number(r.litros_solicitados).toFixed(2)} L
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {Number(r.litros_supridos).toFixed(2)} L
                  </td>
                  <td className="p-2 text-right tabular-nums text-[var(--color-warning-fg)]">
                    {Number(r.litros_sem_suprimento).toFixed(2)} L
                  </td>
                  <td className="p-2">{r.revisado ? 'Revisado' : 'Pendente'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
