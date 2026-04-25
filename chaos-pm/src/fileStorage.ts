/* ── Binary file storage (IndexedDB: chaospm-files) ── */
const FILES_DB = 'chaospm-files';
const FILES_STORE = 'files';

function openFilesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILES_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FILES_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(id: string, data: string): Promise<void> {
  const db = await openFilesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFile(id: string): Promise<string | null> {
  const db = await openFilesDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(FILES_STORE).objectStore(FILES_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFiles(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openFilesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    ids.forEach((id) => tx.objectStore(FILES_STORE).delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ── Zustand state storage (IndexedDB: chaospm-state) ── */
const STATE_DB = 'chaospm-state';
const STATE_STORE = 'state';

function openStateDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STATE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STATE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const LS_FALLBACK_PREFIX = '__idb_fallback__';

// Debounced setItem: rapid store updates coalesce into one IDB write.
// Without this, every drag frame could queue an IDB transaction.
const pendingWrites = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 400;

async function flushPendingWrites(): Promise<void> {
  if (pendingWrites.size === 0) return;
  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();
  try {
    const db = await openStateDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      for (const [name, value] of entries) {
        tx.objectStore(STATE_STORE).put(value, name);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    for (const [name, value] of entries) {
      try { localStorage.setItem(LS_FALLBACK_PREFIX + name, value); } catch { /* quota */ }
    }
  }
}

// Flush on page hide / unload so the last write isn't lost.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushPendingWrites(); });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPendingWrites();
  });
}

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await openStateDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STATE_STORE).objectStore(STATE_STORE).get(name);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return localStorage.getItem(LS_FALLBACK_PREFIX + name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Coalesce rapid writes. Last value wins; one IDB transaction per debounce window.
    pendingWrites.set(name, value);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { flushTimer = null; void flushPendingWrites(); }, FLUSH_DELAY_MS);
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await openStateDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        tx.objectStore(STATE_STORE).delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
    localStorage.removeItem(LS_FALLBACK_PREFIX + name);
  },
};
