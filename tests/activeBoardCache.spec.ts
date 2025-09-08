import { describe, it, expect } from 'vitest';
import { setActiveBoardCache, getActiveBoardCache } from '@/state';

import type { ActiveBoard } from '@/state';

describe('active board cache', () => {
  it('returns board only for matching date and shift', () => {
    const board: ActiveBoard = {
      dateISO: '2024-01-01',
      shift: 'day',
      charge: undefined,
      triage: undefined,
      admin: undefined,
      zones: {},
      incoming: [],
      offgoing: [],
      comments: '',
      huddle: '',
      handoff: '',
      version: 1,
    };
    setActiveBoardCache(board);
    expect(getActiveBoardCache('2024-01-01', 'day')).toBe(board);
    expect(getActiveBoardCache('2024-01-02', 'day')).toBeUndefined();
    expect(getActiveBoardCache('2024-01-01', 'night')).toBeUndefined();
  });
});
