/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';

describe('sync fallback', () => {
  it('uses storage events when BroadcastChannel is unavailable', async () => {
    const origBC = (globalThis as any).BroadcastChannel;
    // remove BroadcastChannel to trigger fallback
    // @ts-ignore
    delete (globalThis as any).BroadcastChannel;
    vi.resetModules();

    const { notifyUpdate, onUpdate } = await import('@/state/sync');

    const handler = vi.fn();
    onUpdate('foo', handler);
    notifyUpdate('foo');
    const val = window.localStorage.getItem('staffboard-sync');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'staffboard-sync', newValue: val ?? '' })
    );
    expect(handler).toHaveBeenCalled();

    (globalThis as any).BroadcastChannel = origBC;
  });
});
