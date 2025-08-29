const DB_NAME = "edb-v28";
const STORE = "kv";
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database.
 * @returns {Promise<IDBDatabase>} Resolves with the open database.
 * @rejects {Error | DOMException} If the database cannot be opened.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Reads and parses a value from the key-value store.
 * @param key - Key to retrieve.
 * @returns The stored value, or undefined if not present.
 * @rejects {Error | DOMException} If opening the database or the get operation fails.
 */
export async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const val = req.result;
      resolve(val === undefined ? undefined : (JSON.parse(val) as T));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Serializes and stores a value under the given key.
 * @param key - Storage key.
 * @param val - Value to store.
 * @rejects {Error | DOMException} If opening the database or the put operation fails.
 */
export async function set<T>(key: string, val: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(JSON.stringify(val), key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Removes a key from the store.
 * @param key - Key to delete.
 * @rejects {Error | DOMException} If opening the database or the delete operation fails.
 */
export async function del(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lists all keys in the store with an optional prefix filter.
 * @param prefix - Optional key prefix to match.
 * @returns Array of keys that start with the prefix.
 * @rejects {Error | DOMException} If opening the database or the getAllKeys operation fails.
 */
export async function keys(prefix = ""): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const all: string[] = req.result as any;
      resolve(all.filter((k) => k.startsWith(prefix)));
    };
    req.onerror = () => reject(req.error);
  });
}
