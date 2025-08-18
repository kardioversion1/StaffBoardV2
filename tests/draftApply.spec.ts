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

import { applyDraftToActive, KS, DB, type DraftShift } from '@/state';

async function clearDB() {
  store.clear();
}

describe('applyDraftToActive', () => {
  beforeEach(async () => {
    await clearDB();
  });

  it('moves draft roster into active and clears draft entry', async () => {
    const board: DraftShift = {
      dateISO: '2024-01-01',
      shift: 'day',
      charge: { nurseId: '1' },
      triage: undefined,
      zones: { A: [{ nurseId: '2' }] },
      incoming: [],
      offgoing: [],
      support: { techs: [], vols: [], sitters: [] },
    };
    const key = KS.DRAFT(board.dateISO, board.shift);
    await DB.set(key, board);

    await applyDraftToActive(board.dateISO, board.shift);

    expect(await DB.get(KS.ACTIVE(board.dateISO, board.shift))).toEqual(board);
    expect(await DB.get(KS.DRAFT(board.dateISO, board.shift))).toBeUndefined();
  });
});
