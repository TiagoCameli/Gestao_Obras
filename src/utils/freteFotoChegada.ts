/**
 * Helper puro pra calcular o payload de update do frete quando a foto
 * da chegada muda no drawer. Comportamento espelha o do FreteForm:
 *   - Se foto subiu E dataChegada estava vazia → preenche dataChegada = hoje
 *   - Se foto subiu E dataChegada já existe → não mexe em dataChegada
 *   - Se foto removida (null/'') → só zera fotoChegadaUrl, dataChegada intacta
 */
export interface CalcularUpdateInput {
  novaUrl: string | null
  dataChegadaAtual: string | undefined
  /** Data de hoje em formato YYYY-MM-DD (injetada pra testabilidade). */
  hoje: string
}

export interface UpdatePayload {
  fotoChegadaUrl: string | null
  dataChegada?: string
}

export function calcularUpdateFotoChegada({
  novaUrl,
  dataChegadaAtual,
  hoje,
}: CalcularUpdateInput): UpdatePayload {
  const normalizada = novaUrl && novaUrl.length > 0 ? novaUrl : null

  if (normalizada && !dataChegadaAtual) {
    return { fotoChegadaUrl: normalizada, dataChegada: hoje }
  }
  return { fotoChegadaUrl: normalizada }
}
