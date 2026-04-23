import { idbStorage } from './fileStorage';

const CURRENT_KEY = 'chaos-pm-v1';

async function readOldIdb(dbName: string, storeName: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve(null); return; }
        try {
          const r = db.transaction(storeName).objectStore(storeName).get(key);
          r.onsuccess = () => { db.close(); resolve(r.result ?? null); };
          r.onerror = () => { db.close(); resolve(null); };
        } catch { db.close(); resolve(null); }
      };
    } catch { resolve(null); }
  });
}

export async function runMigrations(): Promise<void> {
  try {
    // If current key already has data, no migration needed
    const current = await idbStorage.getItem(CURRENT_KEY);
    if (current) return;

    // 1. Try old IDB: canvas-pm-state DB, key "canvas-pm-v2"
    const fromOldIdb = await readOldIdb('canvas-pm-state', 'state', 'canvas-pm-v2');
    if (fromOldIdb) {
      await idbStorage.setItem(CURRENT_KEY, fromOldIdb);
      console.info('[chaos-pm] migrated from canvas-pm-state IDB');
      return;
    }

    // 2. Try old localStorage key "canvas-pm-v2"
    const fromLS = localStorage.getItem('canvas-pm-v2');
    if (fromLS) {
      await idbStorage.setItem(CURRENT_KEY, fromLS);
      localStorage.removeItem('canvas-pm-v2');
      console.info('[chaos-pm] migrated from localStorage canvas-pm-v2');
      return;
    }
  } catch (e) {
    console.warn('[chaos-pm] migration error (non-fatal):', e);
  }
}
