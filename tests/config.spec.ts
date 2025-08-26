import { describe, it, expect, vi } from 'vitest';

vi.mock('@/db', () => {
  const store: Record<string, any> = {};
  return {
    get: async (k: string) => store[k],
    set: async (k: string, v: any) => {
      store[k] = v;
    },
    del: async (k: string) => {
      delete store[k];
    },
    keys: async () => Object.keys(store),
  };
});

import { saveConfig, loadConfig } from '@/state';

describe('config round trip', () => {
  it('persists new keys', async () => {
    await saveConfig({
      zoneColors: { A: '#fff' },
      dtoMinutes: 50,
      showPinned: { charge: false, triage: true },
      rss: { url: 'http://x', enabled: true },
      privacy: false,
      ui: { signoutMode: 'legacySignout', rightSidebarWidthPx: 350 },
    });
    const cfg = await loadConfig();
    expect(cfg.zoneColors?.A).toBe('#fff');
    expect(cfg.dtoMinutes).toBe(50);
    expect(cfg.showPinned?.charge).toBe(false);
    expect(cfg.rss?.url).toBe('http://x');
    expect(cfg.privacy).toBe(false);
    expect(cfg.ui?.signoutMode).toBe('legacySignout');
    expect(cfg.ui?.rightSidebarWidthPx).toBe(350);
  });
});
