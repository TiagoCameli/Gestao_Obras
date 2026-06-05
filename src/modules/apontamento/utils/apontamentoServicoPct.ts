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
