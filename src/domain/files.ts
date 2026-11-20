/**
 * Ficheiros dos planos (nutricionista, treinador), guardados no IndexedDB do telemóvel.
 * O localStorage é pequeno demais para PDFs e folhas de cálculo.
 */
const DB = 'nefesh-life-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).finally(() => db.close());
}

export const saveFile = (key: string, file: Blob) => tx('readwrite', (s) => s.put(file, key));
export const loadFile = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key));
export const deleteFile = (key: string) => tx('readwrite', (s) => s.delete(key));
export const clearFiles = () => tx('readwrite', (s) => s.clear());

export const MAX_FILE_MB = 15;
export const ACCEPT_PLAN = '.pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.numbers,.pages,image/*,application/pdf';

export function fileKind(name: string, type: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('image/')) return 'Imagem';
  if (ext === 'pdf' || type === 'application/pdf') return 'PDF';
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'Folha de cálculo';
  if (['doc', 'docx', 'pages', 'txt'].includes(ext)) return 'Documento';
  return 'Ficheiro';
}
