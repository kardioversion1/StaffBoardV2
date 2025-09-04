import { describe, it, expect, vi } from 'vitest';

vi.mock('@/state', () => ({
  getConfig: () => ({
    zones: [
      { name: 'Charge Nurse', pct: true },
      { name: 'Triage Nurse', pct: true },
    ],
  }),
}));

import { buildSeedBoard, DEFAULT_SEED_SETTINGS } from '@/seed';

describe('buildSeedBoard with all PCT zones', () => {
  it('adds an Unassigned zone for unplaced staff', () => {
    const roster = [
      { id: 'n1', name: 'n1', role: 'nurse', type: 'other' } as any,
    ];
    const board = buildSeedBoard(roster, {
      ...DEFAULT_SEED_SETTINGS,
      assignChargeTriage: false,
    });
    expect(board.zones.Unassigned).toBeDefined();
    expect(board.zones.Unassigned[0]).toEqual({ nurseId: 'n1' });
  });
});
