import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, any>();
vi.mock('@/db', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: any) => {
    store.set(k, v);
  },
  del: async (k: string) => {
    store.delete(k);
  },
  keys: async (prefix = '') =>
    Array.from(store.keys()).filter((k) => k.startsWith(prefix)),
}));

import { applyPendingToActive, KS, DB, type PendingShift } from '@/state';

async function clearDB() {
  store.clear();
}

describe('applyPendingToActive', () => {
  beforeEach(async () => {
    await clearDB();
  });

  it('moves pending roster into active and clears pending entry', async () => {
    const board: PendingShift = {
      dateISO: '2024-01-01',
      shift: 'day',
      charge: { nurseId: '1' },
      triage: undefined,
      zones: { A: [{ nurseId: '2' }] },
      incoming: [],
      offgoing: [],
      support: { techs: [], vols: [], sitters: [] },
    };
    const key = KS.PENDING(board.dateISO, board.shift);
    await DB.set(key, board);

    await applyPendingToActive(board.dateISO, board.shift);

    expect(await DB.get(KS.ACTIVE(board.dateISO, board.shift))).toEqual(board);
    expect(await DB.get(KS.PENDING(board.dateISO, board.shift))).toBeUndefined();
  });
});
