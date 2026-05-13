// Marco 5 / PR25b — Fila offline de checklists em IndexedDB.
//
// Operador às vezes opera em obra sem internet (BR-364 tem áreas mortas).
// Solução: gravamos o checklist completo num store local; quando o sinal
// volta (ou o operador volta pro escritório), sincronizamos.
//
// IndexedDB suporta Blob nativamente → fotos vão direto pro store, sem
// base64. Schema simples: 1 store 'checklists' com value = ChecklistPayload.

import type { StatusExecucaoChecklist, RespostaChecklist } from '../types';

const DB_NAME = 'emt-obras-offline';
// v2: alinhado com offlineQueue.ts (PR27 acrescentou 'medicoes' e 'os_novas').
// Esse arquivo continua só mexendo no store 'checklists'.
const DB_VERSION = 2;
const STORE = 'checklists';

export interface RespostaQueue {
  perguntaId: string;
  perguntaSnapshot: string;
  resposta: RespostaChecklist;
  observacao: string;
  fotoBlob: Blob | null;
}

export interface ChecklistQueueItem {
  /** ID local (uuid simples) */
  localId: string;
  /** Quando o operador finalizou no celular */
  criadoEm: string;
  /** Última tentativa de sync (vazio se nunca tentou) */
  ultimaTentativaEm: string;
  /** Mensagem de erro da última tentativa (vazio se sucesso ou nunca tentou) */
  ultimoErro: string;
  /** Quantas tentativas falharam */
  tentativas: number;
  // Payload original
  templateId: string;
  templateVersao: number;
  equipamentoId: string;
  equipamentoNome: string;  // pra exibir na fila sem precisar query
  operadorFuncionarioId: string | null;
  operadorNome: string;
  medicaoAtual: number | null;
  status: StatusExecucaoChecklist;
  observacoesGerais: string;
  respostas: RespostaQueue[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Cria todos os stores conhecidos (idempotente). Mantém sincronia
      // com offlineQueue.ts caso a app abra checklistsQueue primeiro.
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains('medicoes')) {
        db.createObjectStore('medicoes', { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains('os_novas')) {
        db.createObjectStore('os_novas', { keyPath: 'localId' });
      }
    };
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function gerarLocalId(): string {
  return 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** Adiciona um checklist na fila (não-bloqueante; falha silenciosa se IDB indisponível). */
export async function enqueueChecklist(
  item: Omit<ChecklistQueueItem, 'localId' | 'criadoEm' | 'ultimaTentativaEm' | 'ultimoErro' | 'tentativas'>
): Promise<string> {
  const db = await openDB();
  try {
    const full: ChecklistQueueItem = {
      ...item,
      localId: gerarLocalId(),
      criadoEm: new Date().toISOString(),
      ultimaTentativaEm: '',
      ultimoErro: '',
      tentativas: 0,
    };
    await reqToPromise(txStore(db, 'readwrite').add(full));
    return full.localId;
  } finally {
    db.close();
  }
}

/** Lista checklists pendentes ordenados por data de criação asc. */
export async function listPendingChecklists(): Promise<ChecklistQueueItem[]> {
  const db = await openDB();
  try {
    const all = await reqToPromise(txStore(db, 'readonly').getAll());
    return (all as ChecklistQueueItem[]).sort((a, b) =>
      a.criadoEm.localeCompare(b.criadoEm)
    );
  } finally {
    db.close();
  }
}

/** Conta itens pendentes (cheap pra header). */
export async function countPendingChecklists(): Promise<number> {
  const db = await openDB();
  try {
    return await reqToPromise(txStore(db, 'readonly').count());
  } finally {
    db.close();
  }
}

/** Remove item após sync bem-sucedido. */
export async function removeChecklist(localId: string): Promise<void> {
  const db = await openDB();
  try {
    await reqToPromise(txStore(db, 'readwrite').delete(localId));
  } finally {
    db.close();
  }
}

/** Marca tentativa falha. */
export async function markChecklistAttempt(
  localId: string,
  err: string
): Promise<void> {
  const db = await openDB();
  try {
    const store = txStore(db, 'readwrite');
    const item = await reqToPromise(store.get(localId)) as ChecklistQueueItem | undefined;
    if (!item) return;
    item.ultimaTentativaEm = new Date().toISOString();
    item.ultimoErro = err;
    item.tentativas = (item.tentativas ?? 0) + 1;
    await reqToPromise(store.put(item));
  } finally {
    db.close();
  }
}

/** Conveniência: verifica suporte. */
export function indexedDBSuportado(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}
