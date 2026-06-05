import type { TipoApontamento } from './apontamentoServicoApi'

/** Arredonda pra 2 casas decimais. */
export function arred2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Dado um vetor de porcentagens (0..100) e um total de horas, devolve as horas
 * de cada posição (round2). A ÚLTIMA posição com pct > 0 absorve o drift de
 * arredondamento, garantindo que a soma seja exatamente round2(totalHoras).
 * Posições com pct <= 0 recebem 0.
 */
export function ratearHorasPorPct(pcts: number[], totalHoras: number): number[] {
  const total = arred2(Math.max(0, totalHoras))
  const horas = pcts.map((p) => (p > 0 ? arred2((p / 100) * total) : 0))
  if (total <= 0) return horas
  let ultimaAtiva = -1
  for (let i = 0; i < pcts.length; i++) if (pcts[i] > 0) ultimaAtiva = i
  if (ultimaAtiva >= 0) {
    const soma = horas.reduce((s, h) => s + h, 0)
    horas[ultimaAtiva] = arred2(horas[ultimaAtiva] + (total - soma))
  }
  return horas
}

/** Uma linha de serviço definida por porcentagem do dia (0..100). */
export interface LinhaServicoPct {
  servicoId: string | null
  pct: number
  tipo: TipoApontamento
  motivoImprodutivo?: string | null
  observacao?: string | null
}

/**
 * Monta as rows de apont_apontamentos_servico para um lançamento em lote por %.
 * Para cada funcionário, rateia as horas dele (horasPorFunc) entre as linhas
 * conforme a pct de cada uma. Pula funcionário sem horas e linhas que ficaram 0h.
 * Função pura — não toca no banco.
 */
export function montarRowsApontamentoPorPct(input: {
  funcionarioIds: string[]
  data: string
  linhas: LinhaServicoPct[]
  horasPorFunc: Record<string, number>
  registradoPorId: string | null
}): Record<string, unknown>[] {
  const pcts = input.linhas.map((l) => l.pct)
  const rows: Record<string, unknown>[] = []
  for (const fid of input.funcionarioIds) {
    const hf = input.horasPorFunc[fid] ?? 0
    if (hf <= 0) continue
    const horas = ratearHorasPorPct(pcts, hf)
    input.linhas.forEach((l, i) => {
      if (horas[i] <= 0) return
      rows.push({
        funcionario_id: fid,
        data: input.data,
        servico_id: l.tipo === 'improdutivo' ? null : l.servicoId,
        estaca_inicial: null,
        estaca_final: null,
        lado: null,
        horas: horas[i],
        tipo: l.tipo,
        motivo_improdutivo: l.tipo === 'improdutivo' ? l.motivoImprodutivo ?? null : null,
        observacao: l.observacao ?? null,
        registrado_por_id: input.registradoPorId,
      })
    })
  }
  return rows
}
