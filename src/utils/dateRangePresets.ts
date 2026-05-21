/**
 * Helpers puros pra calcular ranges de data dos quick-presets da Frete.
 * Datas em formato YYYY-MM-DD (string).
 */

export interface DateRange {
  dataInicio?: string
  dataFim?: string
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * "Esta semana" — segunda da semana atual até hoje.
 * Segunda = dayOfWeek 1. Domingo = 0 (treat como fim de semana).
 */
export function presetEstaSemana(hoje: Date = new Date()): DateRange {
  const d = new Date(hoje.getTime())
  const day = d.getDay() // 0=domingo, 1=segunda, ... 6=sábado
  const diasParaSegunda = day === 0 ? 6 : day - 1
  const segunda = new Date(d.getTime() - diasParaSegunda * 24 * 60 * 60 * 1000)
  return {
    dataInicio: toISODate(segunda),
    dataFim: toISODate(d),
  }
}

/**
 * "Este mês" — primeiro dia do mês atual até hoje.
 */
export function presetEsteMes(hoje: Date = new Date()): DateRange {
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return {
    dataInicio: toISODate(primeiroDoMes),
    dataFim: toISODate(hoje),
  }
}

/**
 * "Mês passado" — primeiro dia até último dia do mês anterior.
 */
export function presetMesPassado(hoje: Date = new Date()): DateRange {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() // 0-indexed; mês anterior = mes-1
  const primeiroDoMesAnterior = new Date(ano, mes - 1, 1)
  const ultimoDoMesAnterior = new Date(ano, mes, 0) // dia 0 do mês atual = último do anterior
  return {
    dataInicio: toISODate(primeiroDoMesAnterior),
    dataFim: toISODate(ultimoDoMesAnterior),
  }
}

/**
 * "Sem chegada" — sem range de datas; é um filtro de coluna
 * (dataChegada IS NULL) que o consumer aplica separadamente.
 */
export function presetSemChegada(): DateRange {
  return {}
}
