// IndexedDB cache de descritores faciais. Key = path do storage Supabase
// (não signed URL — pra cache hit estável entre sessões).
// Tolera IndexedDB indisponível (Safari incognito, quota) silenciosamente.

const DB_NAME = 'apontamento-face-cache'
const STORE = 'descriptors'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

interface Row {
  url: string
  descriptor: ArrayBuffer
  createdAt: number
}

export async function getDescritor(url: string): Promise<Float32Array | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(url)
      req.onsuccess = () => {
        const row = req.result as Row | undefined
        if (!row) return resolve(undefined)
        resolve(new Float32Array(row.descriptor))
      }
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

export async function setDescritor(url: string, descriptor: Float32Array): Promise<void> {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const row: Row = {
        url,
        // Copia respeitando byteOffset/byteLength — funciona com Float32Array
        // criado via subarray() de um buffer maior. Cast pra ArrayBuffer
        // é seguro: descriptor.buffer só seria SharedArrayBuffer se o caller
        // construísse Float32Array sobre SAB (não acontece aqui).
        descriptor: descriptor.buffer.slice(
          descriptor.byteOffset,
          descriptor.byteOffset + descriptor.byteLength,
        ) as ArrayBuffer,
        createdAt: Date.now(),
      }
      tx.objectStore(STORE).put(row)
      tx.oncomplete = () => resolve()
      tx.onabort = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearCache(): Promise<void> {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onabort = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
