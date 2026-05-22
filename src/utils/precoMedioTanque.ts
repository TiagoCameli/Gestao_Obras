import type { EntradaCombustivel, TransferenciaCombustivel } from '../types'

/**
 * Calcula o preço médio ponderado de combustível em um tanque, incluindo:
 * - Entradas (compras) com depositoId === tanqueId
 * - Transferências recebidas (depositoDestinoId === tanqueId)
 *
 * Retorna 0 se não houver dados (em vez de NaN) — tanque vazio bloqueia
 * o submit naturalmente via validação client.
 *
 * Bug C2 do audit: antes só somava entradas, então tanque que só recebia
 * por transferência retornava 0 e bloqueava saídas.
 *
 * Spec: combustivel-audit.md / HF.5
 */
export function calcularPrecoMedioTanque(
  tanqueId: string,
  entradas: EntradaCombustivel[],
  transferencias: TransferenciaCombustivel[],
): number {
  let totalLitros = 0
  let totalValor = 0

  for (const e of entradas) {
    if (e.depositoId === tanqueId) {
      totalLitros += e.quantidadeLitros
      totalValor += e.valorTotal
    }
  }

  for (const t of transferencias) {
    if (t.depositoDestinoId === tanqueId) {
      totalLitros += t.quantidadeLitros
      totalValor += t.valorTotal
    }
  }

  return totalLitros > 0 ? totalValor / totalLitros : 0
}
