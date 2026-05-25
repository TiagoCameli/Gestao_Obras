import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { clearCache, getDescritor, setDescritor } from './descritorCache'

describe('descritorCache (IndexedDB)', () => {
  afterEach(() => clearCache())

  it('retorna undefined em cache miss', async () => {
    expect(await getDescritor('path/foo.jpg')).toBeUndefined()
  })

  it('persiste e recupera Float32Array', async () => {
    const d = new Float32Array(128).map((_, i) => i / 128)
    await setDescritor('path/foo.jpg', d)
    const out = await getDescritor('path/foo.jpg')
    expect(out).toBeInstanceOf(Float32Array)
    expect(out!.length).toBe(128)
    expect(out![0]).toBeCloseTo(0)
    expect(out![127]).toBeCloseTo(127 / 128)
  })

  it('overwrite no mesmo path', async () => {
    await setDescritor('p', new Float32Array(128).fill(0.1))
    await setDescritor('p', new Float32Array(128).fill(0.9))
    const out = await getDescritor('p')
    expect(out![0]).toBeCloseTo(0.9)
  })

  it('preserva floats sem perda no roundtrip', async () => {
    const d = new Float32Array([0.123456789, -0.5, 1.0, 0.0, -0.0])
    await setDescritor('exact', d)
    const out = await getDescritor('exact')
    expect(out![0]).toBe(d[0])
    expect(out![1]).toBe(d[1])
    expect(out![2]).toBe(d[2])
    expect(Object.is(out![3], 0)).toBe(true)
  })

  it('persiste corretamente quando o input é view de um buffer maior', async () => {
    const bigBuffer = new Float32Array(256)
    for (let i = 0; i < 256; i++) bigBuffer[i] = i / 256
    const view = bigBuffer.subarray(100, 228) // 128 elementos a partir do offset 100
    await setDescritor('view', view)
    const out = await getDescritor('view')
    expect(out).toBeInstanceOf(Float32Array)
    expect(out!.length).toBe(128)
    expect(out![0]).toBe(100 / 256)
    expect(out![127]).toBe(227 / 256)
  })

  it('tolera IndexedDB indisponível silenciosamente', async () => {
    const original = globalThis.indexedDB
    // @ts-expect-error força delete
    delete globalThis.indexedDB
    try {
      await expect(setDescritor('x', new Float32Array(128))).resolves.toBeUndefined()
      await expect(getDescritor('x')).resolves.toBeUndefined()
    } finally {
      globalThis.indexedDB = original
    }
  })
})
