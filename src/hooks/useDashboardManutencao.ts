// Marco 2 / PR13 — Hook que agrega KPIs e gráficos do dashboard de manutenção.
//
// Carrega todas as OS (não-deletadas) + apontamentos do período + equipamentos
// e calcula client-side:
//   - OS abertas / críticas / atrasadas
//   - Custo total e % corretivo
//   - MTTR (médio em horas)
//   - Top equipamentos por custo
//   - Top equipamentos por indisponibilidade (horas paradas)
//   - Custo mensal por tipo de equipamento (últimos 12 meses)
//
// Volume típico: 100s de OS no ano. Carga client-side aceitável.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { dbToOrdemServico } from '../lib/mappers';
import type { OrdemServico, Equipamento } from '../types';

export interface DashboardManutencao {
  kpis: {
    osAbertas: number;
    osCriticas: number;
    osAtrasadas: number;
    custoMes: number;
    custoAno: number;
    percCorretivoAno: number;
    mttrHoras: number | null;
    osConcluidasMes: number;
  };
  topPorCusto: { equipamentoId: string; equipamentoNome: string; tipo: string; custoTotal: number; numOS: number }[];
  topPorIndisponibilidade: { equipamentoId: string; equipamentoNome: string; tipo: string; horasParado: number; numOS: number }[];
  custoMensalPorTipo: { mes: string; [tipo: string]: number | string }[];
  ordens: OrdemServico[];
}

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function horasEntre(inicio: string | null, fim: string | null): number {
  if (!inicio || !fim) return 0;
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  return Math.max(0, ms / 3_600_000);
}

export function useDashboardManutencao(equipamentos: Equipamento[]) {
  return useQuery<DashboardManutencao>({
    queryKey: ['dashboard_manutencao', equipamentos.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .is('deleted_at', null)
        .order('data_abertura', { ascending: false })
        .limit(2000);
      if (error) throw error;
      const ordens = (data ?? []).map(dbToOrdemServico);

      const equipMap = new Map<string, Equipamento>();
      for (const e of equipamentos) equipMap.set(e.id, e);

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      // ── KPIs ─────────────────────────────────────────────────
      const abertas = ordens.filter((o) => !['concluida', 'cancelada'].includes(o.status));
      const criticas = abertas.filter((o) => o.prioridade === 'critica');
      const atrasadas = abertas.filter((o) => o.prazoAtendimento && new Date(o.prazoAtendimento) < agora);
      const concluidas = ordens.filter((o) => o.status === 'concluida');

      const concluidasMes = concluidas.filter((o) =>
        o.dataConclusao && new Date(o.dataConclusao) >= inicioMes
      );
      const custoMes = concluidasMes.reduce((s, o) => s + o.custoTotal, 0);

      const concluidasAno = concluidas.filter((o) =>
        o.dataConclusao && new Date(o.dataConclusao).getFullYear() === anoAtual
      );
      const custoAno = concluidasAno.reduce((s, o) => s + o.custoTotal, 0);
      const custoCorretivoAno = concluidasAno
        .filter((o) => o.tipo === 'corretiva')
        .reduce((s, o) => s + o.custoTotal, 0);
      const percCorretivoAno = custoAno > 0 ? (custoCorretivoAno / custoAno) * 100 : 0;

      // MTTR: tempo médio entre abertura e conclusão das concluídas
      const tempos = concluidas
        .map((o) => horasEntre(o.dataAbertura, o.dataConclusao))
        .filter((h) => h > 0);
      const mttrHoras = tempos.length > 0
        ? tempos.reduce((s, h) => s + h, 0) / tempos.length
        : null;

      // ── Top por custo (ano) ──────────────────────────────────
      const custoPorEq = new Map<string, { total: number; numOS: number }>();
      for (const o of concluidasAno) {
        const v = custoPorEq.get(o.equipamentoId) ?? { total: 0, numOS: 0 };
        v.total += o.custoTotal;
        v.numOS += 1;
        custoPorEq.set(o.equipamentoId, v);
      }
      const topPorCusto = Array.from(custoPorEq.entries())
        .map(([eqId, v]) => {
          const eq = equipMap.get(eqId);
          return {
            equipamentoId: eqId,
            equipamentoNome: eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : eqId,
            tipo: eq?.tipo ?? '—',
            custoTotal: v.total,
            numOS: v.numOS,
          };
        })
        .sort((a, b) => b.custoTotal - a.custoTotal)
        .slice(0, 10);

      // ── Top por indisponibilidade (horas paradas) ────────────
      const horasPorEq = new Map<string, { horas: number; numOS: number }>();
      for (const o of ordens) {
        if (!o.paradaInicio) continue;
        const h = horasEntre(o.paradaInicio, o.paradaFim ?? agora.toISOString());
        if (h <= 0) continue;
        const v = horasPorEq.get(o.equipamentoId) ?? { horas: 0, numOS: 0 };
        v.horas += h;
        v.numOS += 1;
        horasPorEq.set(o.equipamentoId, v);
      }
      const topPorIndisponibilidade = Array.from(horasPorEq.entries())
        .map(([eqId, v]) => {
          const eq = equipMap.get(eqId);
          return {
            equipamentoId: eqId,
            equipamentoNome: eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : eqId,
            tipo: eq?.tipo ?? '—',
            horasParado: v.horas,
            numOS: v.numOS,
          };
        })
        .sort((a, b) => b.horasParado - a.horasParado)
        .slice(0, 10);

      // ── Custo mensal por tipo (últimos 12 meses) ──────────────
      // Estrutura pra Recharts: array com {mes:'2026-05', 'Caminhão Basculante': 1500, ...}
      const meses: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        meses.push(mesKey(d));
      }
      const tiposSet = new Set<string>();
      const custoMensal = new Map<string, Map<string, number>>(); // mes → tipo → custo
      for (const o of concluidas) {
        if (!o.dataConclusao) continue;
        const mk = mesKey(new Date(o.dataConclusao));
        if (!meses.includes(mk)) continue;
        const tipo = equipMap.get(o.equipamentoId)?.tipo ?? 'Outros';
        tiposSet.add(tipo);
        if (!custoMensal.has(mk)) custoMensal.set(mk, new Map());
        const mes = custoMensal.get(mk)!;
        mes.set(tipo, (mes.get(tipo) ?? 0) + o.custoTotal);
      }
      const custoMensalPorTipo = meses.map((mk) => {
        const row: { mes: string; [tipo: string]: number | string } = { mes: mk };
        for (const tipo of tiposSet) {
          row[tipo] = custoMensal.get(mk)?.get(tipo) ?? 0;
        }
        return row;
      });

      return {
        kpis: {
          osAbertas: abertas.length,
          osCriticas: criticas.length,
          osAtrasadas: atrasadas.length,
          custoMes,
          custoAno,
          percCorretivoAno,
          mttrHoras,
          osConcluidasMes: concluidasMes.length,
        },
        topPorCusto,
        topPorIndisponibilidade,
        custoMensalPorTipo,
        ordens,
      };
    },
  });
}
