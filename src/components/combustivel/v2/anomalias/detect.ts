// Detector de anomalias do módulo Combustível (F3.A).
//
// Função pura, stateless, client-side. Recalcula a cada filtro mudar
// (memoizada no caller via useMemo). Retorna lista de Anomalia[] —
// agnostic a UI/UX, ordenado pela severity desc + data desc no caller.
//
// 5 detectores no MVP:
//   D1 sentinel        equipamentoId='desconhecido'                              warning
//   D2 R$/L outlier    saída fora ±2σ por tipo de combustível no período         warning
//   D3 volume atípico  saída fora ±2σ vs média histórica (90d) do equipamento    warning
//   D4 duplicatas      mesma combinação eq+litros+valor em janela de 5 minutos   critical
//   D5 gap operacional equip ativo sem saída em 60d (janela fixa, não filtra)    info
//
// Severity é fixa por detector (não parametrizada — relação é estável).

import type { Equipamento, SaidaCombustivel } from '../../../../types';

export type Severidade = 'info' | 'warning' | 'critical';
export type DetectorId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

export interface Anomalia {
  /** ID determinístico — mesma anomalia recalculada vira o mesmo id.
   *  D1/D2/D3 single-saída, D4 grupo, D5 per-equipamento. Ver buildId() abaixo. */
  id: string;
  severity: Severidade;
  detector: DetectorId;
  title: string;
  description: string;
  /** IDs de saída envolvidas — drill-down futuro (F3.B). */
  affectedSaidaIds: string[];
  affectedEquipamentoId?: string;
  affectedObraId?: string;
  /** Data ISO YYYY-MM-DD da saída relacionada (ou hoje em D5 sem histórico). */
  data: string;
  acaoSugerida?: string;
}

export interface DetectInput {
  /** Saídas no período do filtro (recorte UI). D1, D2, D4 trabalham aqui. */
  saidasNoPeriodo: SaidaCombustivel[];
  /** Saídas TODAS (não filtradas). D3 precisa hist 90d, D5 precisa olhar 60d
   *  fixos do banco completo independente do filtro UI. */
  saidasTodas: SaidaCombustivel[];
  equipamentos: Equipamento[];
  /** id → nome amigável de combustíveis pra messages legíveis. */
  combustivelNome: Map<string, string>;
  /** id → nome amigável de obras pra messages. */
  obraNome: Map<string, string>;
}

const MIN_SAMPLES = 5;
const SIGMA_THRESHOLD = 2;
const DUP_WINDOW_MS = 5 * 60 * 1000;
const D5_GAP_DAYS = 60;
const D3_HIST_DAYS = 90;

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function meanStd(values: number[]): { mean: number; sigma: number } {
  if (values.length === 0) return { mean: 0, sigma: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, sigma: Math.sqrt(variance) };
}

function fmtNum(n: number, dec: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtBRL(n: number, dec = 2): string {
  return `R$ ${fmtNum(n, dec)}`;
}

// ────────────────────────────────────────────────────────────────────
// D1 — Sentinel sem equipamento (equipamento_proprio + sem ID)
// ────────────────────────────────────────────────────────────────────

function detectD1(input: DetectInput): Anomalia[] {
  const sentinels = input.saidasNoPeriodo.filter(
    (s) => s.tipoConsumidor === 'equipamento_proprio' && s.equipamentoId === 'desconhecido',
  );
  return sentinels.map((s) => {
    const obraNm = s.obraId ? (input.obraNome.get(s.obraId) ?? '—') : '—';
    return {
      id: `D1-${s.id}`,
      severity: 'warning' as const,
      detector: 'D1' as const,
      title: 'Saída sem equipamento identificado',
      description: `${fmtNum(s.litros, 0)} L · ${fmtBRL(s.valorTotal)} · obra ${obraNm}`,
      affectedSaidaIds: [s.id],
      affectedObraId: s.obraId ?? undefined,
      data: s.data.slice(0, 10),
      acaoSugerida: 'Atribuir equipamento via Saídas → filtro "Apenas sem equipamento"',
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// D2 — R$/L outlier por combustível (±2σ no período)
// ────────────────────────────────────────────────────────────────────

function detectD2(input: DetectInput): Anomalia[] {
  const byCombustivel = new Map<string, SaidaCombustivel[]>();
  for (const s of input.saidasNoPeriodo) {
    if (s.litros <= 0) continue;
    const list = byCombustivel.get(s.tipoCombustivel) ?? [];
    list.push(s);
    byCombustivel.set(s.tipoCombustivel, list);
  }

  const results: Anomalia[] = [];
  for (const [combId, saidas] of byCombustivel) {
    if (saidas.length < MIN_SAMPLES) continue;
    const rPorL = saidas.map((s) => s.valorTotal / s.litros);
    const { mean, sigma } = meanStd(rPorL);
    if (sigma < 0.0001) continue; // sem variância — todos iguais
    const lo = mean - SIGMA_THRESHOLD * sigma;
    const hi = mean + SIGMA_THRESHOLD * sigma;
    const combNm = input.combustivelNome.get(combId) ?? combId;

    for (const s of saidas) {
      const rpl = s.valorTotal / s.litros;
      if (rpl >= lo && rpl <= hi) continue;
      const direcao = rpl > hi ? 'acima' : 'abaixo';
      results.push({
        id: `D2-${s.id}`,
        severity: 'warning',
        detector: 'D2',
        title: `R$/L ${direcao} da média para ${combNm}`,
        description: `${fmtBRL(rpl, 4)}/L vs média ${fmtBRL(mean, 4)} (±2σ ${fmtBRL(SIGMA_THRESHOLD * sigma, 4)}, n=${saidas.length})`,
        affectedSaidaIds: [s.id],
        affectedEquipamentoId: s.equipamentoId ?? undefined,
        affectedObraId: s.obraId ?? undefined,
        data: s.data.slice(0, 10),
        acaoSugerida: 'Verificar se preço está correto na nota fiscal',
      });
    }
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────
// D3 — Volume atípico por equipamento (±2σ vs hist 90d)
// ────────────────────────────────────────────────────────────────────

function detectD3(input: DetectInput): Anomalia[] {
  const cutoff = daysAgoIso(D3_HIST_DAYS);
  // Histórico por equipamento (últimos 90d, ignora sentinel)
  const histByEquip = new Map<string, number[]>();
  for (const s of input.saidasTodas) {
    if (s.tipoConsumidor !== 'equipamento_proprio') continue;
    if (!s.equipamentoId || s.equipamentoId === 'desconhecido') continue;
    if (s.data.slice(0, 10) < cutoff) continue;
    const list = histByEquip.get(s.equipamentoId) ?? [];
    list.push(s.litros);
    histByEquip.set(s.equipamentoId, list);
  }

  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const results: Anomalia[] = [];
  for (const s of input.saidasNoPeriodo) {
    if (s.tipoConsumidor !== 'equipamento_proprio') continue;
    if (!s.equipamentoId || s.equipamentoId === 'desconhecido') continue;
    const hist = histByEquip.get(s.equipamentoId);
    if (!hist || hist.length < MIN_SAMPLES) continue;
    const { mean, sigma } = meanStd(hist);
    if (sigma < 0.001) continue;
    const lo = mean - SIGMA_THRESHOLD * sigma;
    const hi = mean + SIGMA_THRESHOLD * sigma;
    if (s.litros >= lo && s.litros <= hi) continue;
    const eq = eqMap.get(s.equipamentoId);
    const eqNome = eq?.nome ?? '—';
    const direcao = s.litros > hi ? 'acima' : 'abaixo';
    results.push({
      id: `D3-${s.id}`,
      severity: 'warning',
      detector: 'D3',
      title: `Volume ${direcao} do padrão de ${eqNome}`,
      description: `${fmtNum(s.litros, 0)} L vs média ${fmtNum(mean, 0)} L (±2σ ${fmtNum(SIGMA_THRESHOLD * sigma, 0)} L em 90d, n=${hist.length})`,
      affectedSaidaIds: [s.id],
      affectedEquipamentoId: s.equipamentoId,
      affectedObraId: s.obraId ?? undefined,
      data: s.data.slice(0, 10),
      acaoSugerida: 'Conferir leitura ou possível erro de digitação',
    });
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────
// D4 — Duplicatas em janela de 5 minutos
// ────────────────────────────────────────────────────────────────────

function detectD4(input: DetectInput): Anomalia[] {
  // Agrupa por (consumer, litros, valor, combustível) — saídas idênticas
  const groups = new Map<string, SaidaCombustivel[]>();
  for (const s of input.saidasNoPeriodo) {
    const consumer = s.tipoConsumidor === 'equipamento_proprio'
      ? `eq:${s.equipamentoId ?? 'unk'}`
      : `pl:${(s.placa ?? 'unk').toLowerCase()}`;
    const key = `${consumer}|${s.litros}|${s.valorTotal}|${s.tipoCombustivel}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const results: Anomalia[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.data.localeCompare(b.data));
    const used = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (used.has(list[i].id)) continue;
      const cluster: SaidaCombustivel[] = [list[i]];
      const tBase = new Date(list[i].data).getTime();
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(list[j].id)) continue;
        const tj = new Date(list[j].data).getTime();
        if (tj - tBase <= DUP_WINDOW_MS) {
          cluster.push(list[j]);
          used.add(list[j].id);
        } else {
          break;
        }
      }
      if (cluster.length >= 2) {
        used.add(list[i].id);
        const ids = cluster.map((c) => c.id).sort();
        results.push({
          id: `D4-${ids.join('-')}`,
          severity: 'critical',
          detector: 'D4',
          title: `${cluster.length} saídas idênticas em janela de 5 minutos`,
          description: `Mesmo consumidor + ${fmtNum(cluster[0].litros, 0)} L + ${fmtBRL(cluster[0].valorTotal)} — provável duplicata`,
          affectedSaidaIds: ids,
          affectedEquipamentoId: cluster[0].equipamentoId ?? undefined,
          data: cluster[0].data.slice(0, 10),
          acaoSugerida: 'Verificar e excluir registros duplicados',
        });
      }
    }
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────
// D5 — Gap operacional (equip ativo sem saída em 60d, janela fixa)
// ────────────────────────────────────────────────────────────────────

function detectD5(input: DetectInput): Anomalia[] {
  const today = isoToday();
  const cutoff = daysAgoIso(D5_GAP_DAYS);
  const equipsAtivos = input.saidasTodas.reduce(
    (acc, s) => {
      if (s.equipamentoId && s.equipamentoId !== 'desconhecido' && s.data.slice(0, 10) >= cutoff) {
        acc.add(s.equipamentoId);
      }
      return acc;
    },
    new Set<string>(),
  );

  // Map: equipId → última saída (qualquer época) pra contexto
  const ultimaPorEquip = new Map<string, SaidaCombustivel>();
  for (const s of input.saidasTodas) {
    if (!s.equipamentoId || s.equipamentoId === 'desconhecido') continue;
    const cur = ultimaPorEquip.get(s.equipamentoId);
    if (!cur || s.data.localeCompare(cur.data) > 0) {
      ultimaPorEquip.set(s.equipamentoId, s);
    }
  }

  const results: Anomalia[] = [];
  for (const eq of input.equipamentos) {
    if (eq.ativo === false) continue;
    if (equipsAtivos.has(eq.id)) continue;
    const ultima = ultimaPorEquip.get(eq.id);
    const ultimaData = ultima ? ultima.data.slice(0, 10) : null;
    const diasGap = ultimaData
      ? Math.floor(
          (new Date(today + 'T00:00:00').getTime() - new Date(ultimaData + 'T00:00:00').getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;
    results.push({
      id: `D5-${eq.id}`,
      severity: 'info',
      detector: 'D5',
      title: `${eq.nome} sem saída há ${diasGap !== null ? `${diasGap} dia(s)` : '60+ dias'}`,
      description: ultimaData
        ? `Última saída em ${ultimaData.split('-').reverse().join('/')}`
        : 'Nunca teve saída registrada',
      affectedSaidaIds: ultima ? [ultima.id] : [],
      affectedEquipamentoId: eq.id,
      data: ultimaData ?? today,
      acaoSugerida: 'Confirmar uso ou inativar no cadastro',
    });
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────
// detectAnomalias — entry point
// ────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severidade, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function detectAnomalias(input: DetectInput): Anomalia[] {
  const all: Anomalia[] = [
    ...detectD1(input),
    ...detectD2(input),
    ...detectD3(input),
    ...detectD4(input),
    ...detectD5(input),
  ];
  // Severity desc, depois data desc.
  all.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return b.data.localeCompare(a.data);
  });
  return all;
}

export const DETECTOR_LABEL: Record<DetectorId, string> = {
  D1: 'Sentinel sem equipamento',
  D2: 'R$/L outlier',
  D3: 'Volume atípico',
  D4: 'Duplicatas (5min)',
  D5: 'Gap operacional (60d)',
};

export const SEVERITY_LABEL: Record<Severidade, string> = {
  critical: 'Crítica',
  warning: 'Atenção',
  info: 'Informação',
};
