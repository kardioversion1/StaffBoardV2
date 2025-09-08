/**
 * Simple cross-tab synchronization using BroadcastChannel.
 * Falls back to `localStorage` events when unavailable.
 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('staffboard-sync');

const FALLBACK_KEY = 'staffboard-sync';

/**
 * Notify other tabs that a key has been updated.
 * @param key Storage key that changed.
 */
export function notifyUpdate(key: string): void {
  if (channel) {
    channel.postMessage({ key });
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FALLBACK_KEY, `${key}:${Date.now()}`);
    } catch {
      // ignore storage quota errors
    }
  }
}

/**
 * Listen for updates to a given key.
 * @param key Storage key to watch.
 * @param handler Callback when the key is updated.
 */
export function onUpdate(key: string, handler: () => void): void {
  if (channel) {
    channel.addEventListener('message', (ev) => {
      if (ev.data?.key === key) handler();
    });
  } else if (typeof window !== 'undefined') {
    window.addEventListener('storage', (ev) => {
      if (ev.key === FALLBACK_KEY && ev.newValue?.startsWith(`${key}:`)) {
        handler();
      }
    });
  }
}
