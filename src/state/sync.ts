/**
 * Simple cross-tab synchronization using BroadcastChannel.
 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('staffboard-sync');

/**
 * Notify other tabs that a key has been updated.
 * @param key Storage key that changed.
 */
export function notifyUpdate(key: string): void {
  channel?.postMessage({ key });
}

/**
 * Listen for updates to a given key.
 * @param key Storage key to watch.
 * @param handler Callback when the key is updated.
 */
export function onUpdate(key: string, handler: () => void): void {
  channel?.addEventListener('message', (ev) => {
    if (ev.data?.key === key) handler();
  });
}
