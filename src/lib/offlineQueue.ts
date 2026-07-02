// Marco 5 / PR27 — Fila offline genérica do mobile (IndexedDB 'emt-obras-offline').
//
// Stores:
//   - 'medicoes': apontamentos de horímetro/km
//   - 'os_novas': OSs criadas pelo mobile (defeito + foto opcional)
//   - 'batidas_ponto': batidas de ponto manuais em lote

import type { OrigemMedicao, TipoMedicao, TipoOS, PrioridadeOS } from '../types';

const DB_NAME = 'emt-obras-offline';
const DB_VERSION = 3;
const STORE_MEDICOES = 'medicoes';
const STORE_OS = 'os_novas';
const STORE_BATIDAS = 'batidas_ponto'; // PR-PWA1 — fila de batidas manuais em lote

/** Conveniência: verifica suporte a IndexedDB (usado pelo mobile e pelo sync). */
export function indexedDBSuportado(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

// ── Tipos das filas ──────────────────────────────────────────────

export interface MedicaoQueueItem {
  localId: string;
  criadoEm: string;
  ultimaTentativaEm: string;
  ultimoErro: string;
  tentativas: number;
  // Payload
  equipamentoId: string;
  equipamentoNome: string;
  tipoMedicao: TipoMedicao;
  valor: number;
  data: string;          // YYYY-MM-DD
  observacoes: string;
  origem: OrigemMedicao;
  operadorNome: string;
}

/**
 * PR-PWA1 — Batida de ponto manual em lote.
 * O Encarregado bate ponto para vários funcionários offline; ao voltar online,
 * cada item gera um `registrarBatida` com origem='manual' e status='pendente_aprovacao'.
 */
export interface BatidaPontoQueueItem {
  localId: string;
  criadoEm: string;
  ultimaTentativaEm: string;
  ultimoErro: string;
  tentativas: number;
  // Payload
  funcionarioId: string;
  funcionarioNome: string;
  data: string; // YYYY-MM-DD
  hora: string; // ISO completo do timestamp da batida
  tipoBatida: 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';
  motivo: string;
}

export interface OSNovaQueueItem {
  localId: string;
  criadoEm: string;
  ultimaTentativaEm: string;
  ultimoErro: string;
  tentativas: number;
  // Payload
  equipamentoId: string;
  equipamentoNome: string;
  tipo: TipoOS;
  prioridade: PrioridadeOS;
  defeitoReportado: string;
  sintomas: string[];
  observacoes: string;
  /** PR34: agora aceita múltiplas fotos. Mantém compat com fotoBlob legado. */
  fotoBlobs: Blob[];
  /** @deprecated use fotoBlobs. Mantido pra migração suave da fila. */
  fotoBlob?: Blob | null;
  medicaoAbertura: number | null;
  operadorFuncionarioId: string | null;
  operadorNome: string;
}

// ── DB ──────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEDICOES)) {
        db.createObjectStore(STORE_MEDICOES, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains(STORE_OS)) {
        db.createObjectStore(STORE_OS, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains(STORE_BATIDAS)) {
        db.createObjectStore(STORE_BATIDAS, { keyPath: 'localId' });
      }
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function gerarLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Operações por store ──────────────────────────────────────────────

async function add<T extends { localId: string }>(store: string, item: T): Promise<void> {
  const db = await openDB();
  try {
    await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).add(item));
  } finally {
    db.close();
  }
}

async function list<T>(store: string): Promise<T[]> {
  const db = await openDB();
  try {
    const all = await reqToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
    return all as T[];
  } finally {
    db.close();
  }
}

async function count(store: string): Promise<number> {
  const db = await openDB();
  try {
    return await reqToPromise(db.transaction(store, 'readonly').objectStore(store).count());
  } finally {
    db.close();
  }
}

async function remove(store: string, localId: string): Promise<void> {
  const db = await openDB();
  try {
    await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(localId));
  } finally {
    db.close();
  }
}

async function markAttempt<T extends { localId: string; ultimaTentativaEm: string; ultimoErro: string; tentativas: number }>(
  store: string,
  localId: string,
  err: string
): Promise<void> {
  const db = await openDB();
  try {
    const s = db.transaction(store, 'readwrite').objectStore(store);
    const item = await reqToPromise(s.get(localId)) as T | undefined;
    if (!item) return;
    item.ultimaTentativaEm = new Date().toISOString();
    item.ultimoErro = err;
    item.tentativas = (item.tentativas ?? 0) + 1;
    await reqToPromise(s.put(item));
  } finally {
    db.close();
  }
}

// ── API pública: Medições ──────────────────────────────────────────────

export async function enqueueMedicao(
  item: Omit<MedicaoQueueItem, 'localId' | 'criadoEm' | 'ultimaTentativaEm' | 'ultimoErro' | 'tentativas'>
): Promise<string> {
  const full: MedicaoQueueItem = {
    ...item,
    localId: gerarLocalId('m'),
    criadoEm: new Date().toISOString(),
    ultimaTentativaEm: '',
    ultimoErro: '',
    tentativas: 0,
  };
  await add(STORE_MEDICOES, full);
  return full.localId;
}

export const listPendingMedicoes = () => list<MedicaoQueueItem>(STORE_MEDICOES);
export const countPendingMedicoes = () => count(STORE_MEDICOES);
export const removeMedicao = (localId: string) => remove(STORE_MEDICOES, localId);
export const markMedicaoAttempt = (localId: string, err: string) =>
  markAttempt<MedicaoQueueItem>(STORE_MEDICOES, localId, err);

// ── API pública: OS Novas ──────────────────────────────────────────────

export async function enqueueOSNova(
  item: Omit<OSNovaQueueItem, 'localId' | 'criadoEm' | 'ultimaTentativaEm' | 'ultimoErro' | 'tentativas'>
): Promise<string> {
  const full: OSNovaQueueItem = {
    ...item,
    localId: gerarLocalId('os'),
    criadoEm: new Date().toISOString(),
    ultimaTentativaEm: '',
    ultimoErro: '',
    tentativas: 0,
  };
  await add(STORE_OS, full);
  return full.localId;
}

export const listPendingOSNovas = () => list<OSNovaQueueItem>(STORE_OS);
export const countPendingOSNovas = () => count(STORE_OS);
export const removeOSNova = (localId: string) => remove(STORE_OS, localId);
export const markOSNovaAttempt = (localId: string, err: string) =>
  markAttempt<OSNovaQueueItem>(STORE_OS, localId, err);

// ── API pública: Batidas de Ponto (PR-PWA1) ──────────────────────────────────

export async function enqueueBatidaPonto(
  item: Omit<BatidaPontoQueueItem, 'localId' | 'criadoEm' | 'ultimaTentativaEm' | 'ultimoErro' | 'tentativas'>
): Promise<string> {
  const full: BatidaPontoQueueItem = {
    ...item,
    localId: gerarLocalId('b'),
    criadoEm: new Date().toISOString(),
    ultimaTentativaEm: '',
    ultimoErro: '',
    tentativas: 0,
  };
  await add(STORE_BATIDAS, full);
  return full.localId;
}

export const listPendingBatidas = () => list<BatidaPontoQueueItem>(STORE_BATIDAS);
export const countPendingBatidas = () => count(STORE_BATIDAS);
export const removeBatida = (localId: string) => remove(STORE_BATIDAS, localId);
export const markBatidaAttempt = (localId: string, err: string) =>
  markAttempt<BatidaPontoQueueItem>(STORE_BATIDAS, localId, err);
