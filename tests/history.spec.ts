import { describe, it, expect, beforeEach, vi } from 'vitest';
/** @vitest-environment happy-dom */
const store: Record<string, any> = {};
vi.mock('@/db', () => ({
  get: async (k: string) => store[k],
  set: async (k: string, v: any) => {
    store[k] = v;
  },
  del: async (k: string) => {
    delete store[k];
  },
}));

import {
  savePublishedShift,
  getShiftByDate,
  indexStaffAssignments,
  findShiftsByStaff,
  saveHuddle,
  getHuddle,
  adminOverrideShift,
  type PublishedShiftSnapshot,
  type HuddleRecord,
} from '@/state/history';

describe('history persistence', () => {
  const base: PublishedShiftSnapshot = {
    version: 1,
    dateISO: '2024-01-01',
    shift: 'day',
    publishedAtISO: '2024-01-01T07:00:00.000Z',
    publishedBy: 'tester',
    zoneAssignments: [],
    incoming: [],
    offgoing: [],
    comments: '',
    audit: { createdAtISO: '2024-01-01T07:00:00.000Z', createdBy: 'tester' },
  };

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('saves and retrieves snapshots', async () => {
    await savePublishedShift(base);
    const loaded = await getShiftByDate('2024-01-01', 'day');
    expect(loaded?.publishedBy).toBe('tester');
  });

  it('indexes staff assignments', async () => {
    const snap: PublishedShiftSnapshot = {
      ...base,
      zoneAssignments: [
        {
          staffId: '1',
          displayName: 'Alice',
          role: 'nurse',
          zone: 'A',
          startISO: '2024-01-01T07:00:00.000Z',
          endISO: '2024-01-01T19:00:00.000Z',
          dto: { effectiveISO: '2024-01-01T18:00:00.000Z', offgoingUntilISO: '2024-01-01T19:00:00.000Z' },
        },
      ],
    };
    await indexStaffAssignments(snap);
    const rows = await findShiftsByStaff('1');
    expect(rows.length).toBe(1);
    expect(rows[0].dto).toBe(true);
  });

  it('saves and fetches huddles', async () => {
    const rec: HuddleRecord = {
      dateISO: '2024-01-01',
      shift: 'day',
      recordedAtISO: '2024-01-01T08:00:00.000Z',
      recordedBy: 'me',
      checklist: [{ id: 'airway', label: 'Airway', checked: true }],
      notes: 'all good',
    };
    await saveHuddle(rec);
    const loaded = await getHuddle('2024-01-01', 'day');
    expect(loaded?.notes).toBe('all good');
  });

  it('overrides snapshot with audit trail', async () => {
    await savePublishedShift(base);
    await adminOverrideShift('2024-01-01', 'day', { comments: 'fixed' }, 'test');
    const loaded = await getShiftByDate('2024-01-01', 'day');
    expect(loaded?.audit.reason).toBe('test');
    expect(loaded?.comments).toBe('fixed');
  });
});

