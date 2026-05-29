import type { EntradaCombustivel, TransferenciaCombustivel, SaidaCombustivel } from '../types'

export type FonteTipo = 'entrada' | 'transferencia'

export interface PorcaoConsumida {
  fonteTipo: FonteTipo
  fonteId: string
  litros: number
  preco: number
}

export interface FIFOInput {
  tanqueId: string
  dataHora: string          // ISO wall-clock da saída
  litros: number            // solicitados
  entradas: EntradaCombustivel[]
  transferencias: TransferenciaCombustivel[]
  saidasAnteriores: SaidaCombustivel[]
  // FIFO é segmentado por tipo de combustível: uma saída de S500 só consome
  // lotes de S500 (e replay só de saídas de S500), etc. Quando omitido, não
  // filtra por tipo (compat). Deve corresponder ao tipo_combustivel da saída.
  tipoCombustivel?: string
}

export interface FIFOResult {
  precoMedio: number            // média ponderada das porções
  detalhamento: PorcaoConsumida[]
  litrosSemSuprimento: number   // > 0 se faltou lote
}

interface LoteSaldo {
  fonteTipo: FonteTipo
  fonteId: string
  dataHora: string
  litrosOriginal: number
  precoUnitario: number
  saldoRestante: number
}

/**
 * Calcula preço FIFO real consumindo lotes em ordem cronológica.
 *
 * Algoritmo:
 * 1. Lista todos os lotes do tanque (entradas + transferências recebidas) ATÉ
 *    a data desta saída.
 * 2. Ordena lotes por data ASC (FIFO).
 * 3. Replay das saídas anteriores em ordem cronológica → reduz saldo dos lotes.
 * 4. Consome esta saída dos lotes restantes em ordem.
 * 5. Retorna {precoMedio (média ponderada das porções consumidas), detalhamento,
 *    litrosSemSuprimento}.
 *
 * Wall-clock string comparison (ISO sem TZ): `<=` e `localeCompare` funcionam
 * porque ambos os lados são strings ISO ordenáveis lexicograficamente. NÃO usa
 * `new Date(...)` pra evitar TZ shift / perda de precisão.
 */
export function calcularPrecoFIFO(input: FIFOInput): FIFOResult {
  const { tanqueId, dataHora, litros, entradas, transferencias, saidasAnteriores, tipoCombustivel } = input

  // 1. Monta lista de lotes ATÉ a data da saída (wall-clock string comparison),
  //    filtrando pelo tipo de combustível quando informado.
  const saldos: LoteSaldo[] = []
  for (const e of entradas) {
    if (
      e.depositoId === tanqueId &&
      e.dataHora <= dataHora &&
      (!tipoCombustivel || e.tipoCombustivel === tipoCombustivel)
    ) {
      saldos.push({
        fonteTipo: 'entrada',
        fonteId: e.id,
        dataHora: e.dataHora,
        litrosOriginal: e.quantidadeLitros,
        precoUnitario: e.quantidadeLitros > 0 ? e.valorTotal / e.quantidadeLitros : 0,
        saldoRestante: e.quantidadeLitros,
      })
    }
  }
  for (const t of transferencias) {
    if (
      t.depositoDestinoId === tanqueId &&
      t.dataHora <= dataHora &&
      (!tipoCombustivel || t.tipoCombustivel === tipoCombustivel)
    ) {
      saldos.push({
        fonteTipo: 'transferencia',
        fonteId: t.id,
        dataHora: t.dataHora,
        litrosOriginal: t.quantidadeLitros,
        precoUnitario: t.quantidadeLitros > 0 ? t.valorTotal / t.quantidadeLitros : 0,
        saldoRestante: t.quantidadeLitros,
      })
    }
  }

  // 2. Ordena lotes por dataHora ASC, desempata por fonteId pra determinismo
  saldos.sort((a, b) => {
    const cmp = a.dataHora.localeCompare(b.dataHora)
    return cmp !== 0 ? cmp : a.fonteId.localeCompare(b.fonteId)
  })

  // 3. Replay saídas anteriores (consomem do saldo) em ordem cronológica
  const saidasOrdenadas = saidasAnteriores
    .filter(
      (s) =>
        s.tanqueId === tanqueId &&
        s.data < dataHora &&
        (!tipoCombustivel || s.tipoCombustivel === tipoCombustivel),
    )
    .sort((a, b) => a.data.localeCompare(b.data))

  for (const s of saidasOrdenadas) {
    let restante = s.litros
    for (const lote of saldos) {
      if (restante <= 0) break
      if (lote.saldoRestante <= 0) continue
      const consome = Math.min(restante, lote.saldoRestante)
      lote.saldoRestante -= consome
      restante -= consome
    }
    // Sobra (saída anterior sem suprimento) não interfere nesta saída.
  }

  // 4. Consome ESTA saída
  let faltando = litros
  const detalhamento: PorcaoConsumida[] = []
  for (const lote of saldos) {
    if (faltando <= 0) break
    if (lote.saldoRestante <= 0) continue
    const consome = Math.min(faltando, lote.saldoRestante)
    detalhamento.push({
      fonteTipo: lote.fonteTipo,
      fonteId: lote.fonteId,
      litros: consome,
      preco: lote.precoUnitario,
    })
    lote.saldoRestante -= consome
    faltando -= consome
  }

  // 5. Média ponderada das porções consumidas
  const litrosSupridos = detalhamento.reduce((s, p) => s + p.litros, 0)
  const valorSuprido = detalhamento.reduce((s, p) => s + p.litros * p.preco, 0)
  const precoMedio = litrosSupridos > 0 ? valorSuprido / litrosSupridos : 0

  return {
    precoMedio,
    detalhamento,
    litrosSemSuprimento: faltando,
  }
}
