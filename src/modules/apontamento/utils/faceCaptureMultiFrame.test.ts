import { describe, expect, it } from 'vitest'
import { melhorDe3 } from './faceCaptureMultiFrame'

describe('melhorDe3', () => {
  it('retorna o índice da menor distância', () => {
    expect(melhorDe3([0.6, 0.3, 0.5])).toEqual({ indice: 1, distancia: 0.3 })
  })

  it('empate: pega o primeiro', () => {
    expect(melhorDe3([0.4, 0.4, 0.4])).toEqual({ indice: 0, distancia: 0.4 })
  })

  it('ignora NaN', () => {
    expect(melhorDe3([NaN, 0.4, NaN])).toEqual({ indice: 1, distancia: 0.4 })
  })

  it('tudo NaN/Infinity → indice -1', () => {
    expect(melhorDe3([NaN, Infinity, NaN])).toEqual({ indice: -1, distancia: Infinity })
  })

  it('array vazio → indice -1', () => {
    expect(melhorDe3([])).toEqual({ indice: -1, distancia: Infinity })
  })
})
