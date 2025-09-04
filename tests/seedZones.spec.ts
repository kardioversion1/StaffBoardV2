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

vi.mock('@/server', () => ({
  load: vi.fn().mockRejectedValue(new Error('no server')),
  save: vi.fn().mockResolvedValue(null),
  softDeleteStaff: vi.fn(),
  exportHistoryCSV: vi.fn(),
}));

import { set } from '@/db';
import { loadConfig, getConfig } from '@/state';
import { seedZonesIfNeeded, buildEDDefaultZones } from '@/seed';

describe('seedZonesIfNeeded', () => {
  it('seeds default zones when none exist', async () => {
    await set('CONFIG', { zones: [] });
    await loadConfig();
    await seedZonesIfNeeded();
    const cfg = getConfig();
    expect(cfg.zones.map((z) => z.name)).toEqual(
      buildEDDefaultZones().map((z) => z.name)
    );
  });
});

