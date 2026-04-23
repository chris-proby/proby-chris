/* ── Binary file storage (IndexedDB: chaos-pm-files) ── */
const FILES_DB = 'chaos-pm-files';
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

/* ── Zustand state storage (IndexedDB: chaos-pm-state) ── */
const STATE_DB = 'chaos-pm-state';
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
    try {
      const db = await openStateDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        tx.objectStore(STATE_STORE).put(value, name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      // Mirror a compact backup to localStorage (stripping large data fields)
      try {
        const parsed = JSON.parse(value);
        const backup = JSON.stringify({
          ...parsed,
          state: {
            ...parsed.state,
            // Strip binary data from backup to stay within localStorage quota
            widgets: (parsed.state?.widgets ?? []).map((w: { type: string; data: { src?: string; html?: string; attachments?: unknown[]; files?: unknown[] } }) => {
              if (w.type === 'image') return { ...w, data: { ...w.data, src: '' } };
              if (w.type === 'html') return { ...w, data: { ...w.data, html: '' } };
              if (w.type === 'task') return { ...w, data: { ...w.data, attachments: [] } };
              if (w.type === 'fileupload') return { ...w, data: { ...w.data, files: [] } };
              return w;
            }),
          },
        });
        localStorage.setItem(LS_FALLBACK_PREFIX + name, backup);
      } catch { /* quota exceeded on backup is ok */ }
    } catch {
      localStorage.setItem(LS_FALLBACK_PREFIX + name, value);
    }
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
