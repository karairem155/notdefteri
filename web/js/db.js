// IndexedDB katmanı. Üç depo: notebooks (defter JSON), assets (görsel/PDF blob), settings (anahtar-değer).
// Her şey cihazda kalır; sunucu yok. Safari yer açmak için veriyi silebilir, o yüzden Yedekle düğmesi var.

const DB_NAME = "notdefteri";
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("notebooks")) db.createObjectStore("notebooks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(storeName, mode, action) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const db = {
  getAll(storeName) {
    return run(storeName, "readonly", (store) => store.getAll());
  },
  get(storeName, key) {
    return run(storeName, "readonly", (store) => store.get(key));
  },
  put(storeName, value) {
    return run(storeName, "readwrite", (store) => store.put(value));
  },
  delete(storeName, key) {
    return run(storeName, "readwrite", (store) => store.delete(key));
  },
  clear(storeName) {
    return run(storeName, "readwrite", (store) => store.clear());
  },
  async getSetting(key, fallback) {
    const row = await this.get("settings", key);
    return row === undefined ? fallback : row.value;
  },
  setSetting(key, value) {
    return this.put("settings", { key, value });
  }
};

/** Depolamanın kalıcı olmasını ister; Safari ana ekran uygulamalarında genelde kabul eder. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (error) {
    console.warn("Kalıcı depolama istenemedi", error);
  }
  return false;
}
