import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Lightweight in-memory mocks for DB/server used across suites.
 * Safe to keep hoisted for this whole file.
 */
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

/**
 * Suite 1: buildSeedBoard behavior when all zones are PCT and
 * charge/triage auto-assignment is disabled. We spy on state.getConfig()
 * instead of mocking the whole module to avoid cross-suite conflicts.
 */
describe('buildSeedBoard with all PCT zones', () => {
  it('adds an Unassigned zone for unplaced staff', async () => {
    const state = await import('@/state');
    // Spy so we don't permanently replace the whole module
    const getConfigSpy = vi
      .spyOn(state, 'getConfig')
      .mockReturnValue({
        zones: [
          { name: 'Charge Nurse', pct: true },
          { name: 'Triage Nurse', pct: true },
        ],
      } as any);

    const { buildSeedBoard, DEFAULT_SEED_SETTINGS } = await import('@/seed');

    const roster = [
      { id: 'n1', name: 'n1', role: 'nurse', type: 'other' } as any,
    ];
    const board = buildSeedBoard(roster, {
      ...DEFAULT_SEED_SETTINGS,
      assignChargeTriage: false,
    });

    expect(board.zones.Unassigned).toBeDefined();
    expect(board.zones.Unassigned[0]).toEqual({ nurseId: 'n1' });

    getConfigSpy.mockRestore();
  });
});

/**
 * Suite 2: seeding default zones when none exist.
 */
describe('seedZonesIfNeeded', () => {
  beforeEach(async () => {
    // Clear in-memory DB between tests
    const { del, keys } = await import('@/db');
    const all = await keys();
    await Promise.all(all.map((k) => del(k)));
    vi.restoreAllMocks(); // reset any spies from previous tests
  });

  it('seeds default zones when none exist', async () => {
    const { set } = await import('@/db');
    const { loadConfig, getConfig } = await import('@/state');
    const { seedZonesIfNeeded, buildEDDefaultZones } = await import('@/seed');

    await set('CONFIG', { zones: [] });
    await loadConfig();
    await seedZonesIfNeeded();

    const cfg = getConfig();
    expect(cfg.zones.map((z) => z.name)).toEqual(
      buildEDDefaultZones().map((z) => z.name),
    );
  });
});

