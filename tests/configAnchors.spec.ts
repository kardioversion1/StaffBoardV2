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
  load: vi.fn().mockResolvedValue({
    dateISO: '2024-01-01',
    zones: [],
    pin: '4911',
    relockMin: 0,
    widgets: {},
    // anchors intentionally omitted to simulate older configs
  }),
  save: vi.fn(),
  softDeleteStaff: vi.fn(),
  exportHistoryCSV: vi.fn(),
}));

import { loadConfig } from '@/state/config';

describe('config anchors defaults', () => {
  it('adds day/night defaults when anchors missing', async () => {
    const cfg = await loadConfig();
    expect(cfg.anchors.day).toBe('07:00');
    expect(cfg.anchors.night).toBe('19:00');
  });
});

