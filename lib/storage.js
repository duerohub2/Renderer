// Penyimpanan audio per proyek di IndexedDB (file audio terlalu besar untuk localStorage).
const DB_NAME = 'renderizer';
const STORE = 'audio';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Transaksi dibatalkan'));
    };
  });
}

export const saveAudio = (projectId, record) => run('readwrite', (store) => store.put(record, projectId));
export const loadAudio = (projectId) => run('readonly', (store) => store.get(projectId));
export const removeAudio = (projectId) => run('readwrite', (store) => store.delete(projectId));

export async function copyAudio(fromId, toId) {
  const record = await loadAudio(fromId);
  if (record) await saveAudio(toId, record);
}
