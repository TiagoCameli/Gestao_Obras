import type {
  EntradaCombustivel,
  TransferenciaCombustivel,
  SaidaCombustivel,
  EsvaziamentoTanque,
} from '../types'

export type FonteTipo = 'entrada' | 'transferencia'

export interface PorcaoConsumida {
  fonteTipo: FonteTipo
  fonteId: string
  fonteDataHora: string
  /** Saldo do lote imediatamente antes desta saída consumir dele (após o
   *  replay dos consumos anteriores). */
  saldoAntesDoConsumo: number
  litros: number
  preco: number
}

/**
 * Qualquer evento anterior que DRENOU o tanque e precisa reduzir o saldo dos
 * lotes no replay FIFO. Três tipos:
 *  - 'saida'            → abastecimento (saidas_combustivel)
 *  - 'transferencia_out'→ transferência SAINDO do tanque (origem)
 *  - 'esvaziamento'     → descarte explícito (esvaziamentos_tanque)
 *
 * Não carrega tipo de combustível: o CALLER é responsável por passar só os
 * consumos do combustível relevante (saídas/transferências filtradas por tipo;
 * esvaziamento drena o tanque inteiro).
 */
export interface ConsumoAnterior {
  tipo: 'saida' | 'transferencia_out' | 'esvaziamento'
  tanqueId: string
  data: string
  litros: number
}

export interface FIFOInput {
  tanqueId: string
  dataHora: string          // ISO wall-clock da saída
  litros: number            // solicitados
  entradas: EntradaCombustivel[]
  /** Transferências ENTRANDO no tanque (viram lote). */
  transferenciasIn: TransferenciaCombustivel[]
  /** Tudo que já drenou o tanque antes desta saída (saída/transf-out/esvaz). */
  consumosAnteriores: ConsumoAnterior[]
  // FIFO é segmentado por tipo de combustível: uma saída de S500 só consome
  // lotes de S500, etc. Quando omitido, não filtra lotes por tipo (compat).
  // Deve corresponder ao tipo_combustivel da saída. Só filtra ENTRADAS e
  // transferências-IN (lotes); os consumosAnteriores já chegam filtrados.
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
 * 1. Lista todos os lotes do tanque (entradas + transferências-IN) ATÉ a data
 *    desta saída.
 * 2. Ordena lotes por data ASC (FIFO).
 * 3. Replay dos consumos anteriores (saída + transferência-out + esvaziamento)
 *    em ordem cronológica → reduz saldo dos lotes.
 * 4. Consome esta saída dos lotes restantes em ordem.
 * 5. Retorna {precoMedio (média ponderada das porções), detalhamento,
 *    litrosSemSuprimento}.
 *
 * Wall-clock string comparison (ISO sem TZ): `<=` e `localeCompare` funcionam
 * porque ambos os lados são strings ISO ordenáveis lexicograficamente. NÃO usa
 * `new Date(...)` pra evitar TZ shift / perda de precisão.
 */
export function calcularPrecoFIFO(input: FIFOInput): FIFOResult {
  const { tanqueId, dataHora, litros, entradas, transferenciasIn, consumosAnteriores, tipoCombustivel } = input

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
  for (const t of transferenciasIn) {
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

  // 3. Replay dos consumos anteriores (drenam o saldo) em ordem cronológica
  const consumosOrdenados = consumosAnteriores
    .filter((c) => c.tanqueId === tanqueId && c.data < dataHora)
    .sort((a, b) => a.data.localeCompare(b.data))

  for (const c of consumosOrdenados) {
    let restante = c.litros
    for (const lote of saldos) {
      if (restante <= 0) break
      if (lote.saldoRestante <= 0) continue
      // Um consumo não pode drenar um lote que chegou DEPOIS dele. Sem isso, um
      // esvaziamento de troca de combustível (que drenou o combustível antigo)
      // reduziria por engano os lotes do combustível novo, que entraram depois.
      if (lote.dataHora > c.data) continue
      const consome = Math.min(restante, lote.saldoRestante)
      lote.saldoRestante -= consome
      restante -= consome
    }
    // Sobra (consumo anterior sem suprimento) não interfere nesta saída.
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
      fonteDataHora: lote.dataHora,
      saldoAntesDoConsumo: lote.saldoRestante,
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

/**
 * Monta a lista de consumosAnteriores dum tanque (pros callers do FIFO), unindo
 * os três drenos: saídas, transferências-OUT e esvaziamentos.
 *
 * Segmentação por tipo: saídas e transferências-out são filtradas pelo
 * `tipoCombustivel` da saída em cálculo (transferência sem tipo entra sempre).
 * Esvaziamento drena o tanque inteiro, então entra sem filtro de tipo — a
 * guarda de data no calcularPrecoFIFO evita que ele reduza lotes posteriores.
 *
 * `excluirSaidaId`: em modo edição, exclui a própria saída do replay (senão
 * ela se consumiria).
 */
export function montarConsumosAnteriores(input: {
  tanqueId: string
  tipoCombustivel?: string
  saidas: SaidaCombustivel[]
  transferencias: TransferenciaCombustivel[]
  esvaziamentos: EsvaziamentoTanque[]
  excluirSaidaId?: string
}): ConsumoAnterior[] {
  const { tanqueId, tipoCombustivel, saidas, transferencias, esvaziamentos, excluirSaidaId } = input
  const out: ConsumoAnterior[] = []

  for (const s of saidas) {
    if (s.tanqueId !== tanqueId) continue
    if (excluirSaidaId && s.id === excluirSaidaId) continue
    if (tipoCombustivel && s.tipoCombustivel !== tipoCombustivel) continue
    out.push({ tipo: 'saida', tanqueId, data: s.data, litros: s.litros })
  }

  for (const t of transferencias) {
    if (t.depositoOrigemId !== tanqueId) continue
    if (tipoCombustivel && t.tipoCombustivel && t.tipoCombustivel !== tipoCombustivel) continue
    out.push({ tipo: 'transferencia_out', tanqueId, data: t.dataHora, litros: t.quantidadeLitros })
  }

  for (const e of esvaziamentos) {
    if (e.depositoId !== tanqueId) continue
    out.push({ tipo: 'esvaziamento', tanqueId, data: e.dataHora, litros: e.litrosDescartados })
  }

  return out
}
