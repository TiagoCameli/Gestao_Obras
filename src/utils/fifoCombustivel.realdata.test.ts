import { describe, it, expect } from 'vitest'
import { calcularPrecoFIFO } from './fifoCombustivel'
import type { EntradaCombustivel, SaidaCombustivel } from '../types'

// Dados REAIS do tanque mpllf6ahb5s9p (extraídos do banco em 2026-05-28).
// 2 lotes, sem transferências.
const TANQUE = 'mpllf6ahb5s9p'

const entradas = [
  { id: 'A', depositoId: TANQUE, dataHora: '2026-05-17 15:23:00', quantidadeLitros: 5000, valorTotal: 35500 },
  { id: 'B', depositoId: TANQUE, dataHora: '2026-05-25 11:28:00', quantidadeLitros: 5000, valorTotal: 35400 },
] as unknown as EntradaCombustivel[]

// (data, litros, preco_unitario armazenado)
const saidasRaw: [string, number, number][] = [
  ['2026-05-18 11:38:00', 1960, 7.10],
  ['2026-05-18 16:12:00', 260, 7.10],
  ['2026-05-18 16:13:00', 150, 7.10],
  ['2026-05-18 16:15:00', 170, 7.10],
  ['2026-05-19 16:15:00', 53, 7.10],
  ['2026-05-20 16:16:00', 200, 7.10],
  ['2026-05-20 16:17:00', 280, 7.10],
  ['2026-05-20 16:17:00', 100, 7.10],
  ['2026-05-20 16:18:00', 180, 7.10],
  ['2026-05-21 16:18:00', 160, 7.10],
  ['2026-05-21 16:19:00', 150, 7.10],
  ['2026-05-23 16:20:00', 280, 7.10],
  ['2026-05-23 16:25:00', 290, 7.10],
  ['2026-05-23 16:28:00', 49.999, 7.10],
  ['2026-05-23 16:29:00', 100, 7.10],
  ['2026-05-23 16:29:00', 100, 7.10],
  ['2026-05-23 16:30:00', 200, 7.10],
  ['2026-05-25 14:29:00', 55, 7.10],
  ['2026-05-25 16:30:00', 62, 7.10],
  ['2026-05-27 16:40:00', 240, 7.10],   // <-- boundary
  ['2026-05-27 16:41:00', 270, 7.10],
  ['2026-05-27 16:41:00', 130, 7.10],
  ['2026-05-27 16:42:00', 84, 7.10],
  ['2026-05-27 16:44:00', 92, 7.0824],
  ['2026-05-27 16:44:00', 92, 7.0824],
  ['2026-05-27 16:45:00', 100, 7.08],
  ['2026-05-27 16:45:00', 150, 7.08],
  ['2026-05-27 16:46:00', 200, 7.08],
  ['2026-05-28 16:46:00', 50, 7.08],
  ['2026-05-28 16:47:00', 41, 7.08],
  ['2026-05-28 16:49:00', 150, 7.08],
]

const todasSaidas = saidasRaw.map(([data, litros], i) => ({
  id: `s${i}`,
  tanqueId: TANQUE,
  data,
  litros,
})) as unknown as SaidaCombustivel[]

describe('FIFO real-data — tanque mpllf6ahb5s9p', () => {
  it('imprime FIFO correto vs armazenado', () => {
    const linhas: string[] = []
    for (let i = 0; i < saidasRaw.length; i++) {
      const [data, litros, armazenado] = saidasRaw[i]
      const r = calcularPrecoFIFO({
        tanqueId: TANQUE,
        dataHora: data,
        litros,
        entradas,
        transferencias: [],
        // como o form faz: todas exceto a própria; a função filtra data < dataHora
        saidasAnteriores: todasSaidas.filter((s) => s.id !== `s${i}`),
      })
      const fifo = Number(r.precoMedio.toFixed(4))
      const flag = Math.abs(fifo - armazenado) > 0.0001 ? '  <-- DIVERGE' : ''
      linhas.push(
        `${data}  ${String(litros).padStart(8)}L  FIFO=${fifo.toFixed(4)}  armazenado=${armazenado.toFixed(4)}  sem_supr=${r.litrosSemSuprimento.toFixed(3)}${flag}`,
      )
    }
    // eslint-disable-next-line no-console
    console.log('\n' + linhas.join('\n') + '\n')
    expect(linhas.length).toBe(saidasRaw.length)
  })
})
