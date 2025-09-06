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
  keys: async (prefix: string) =>
    Object.keys(store).filter((k) => k.startsWith(prefix)),
}));

import {
  savePublishedShift,
  getShiftByDate,
  indexStaffAssignments,
  findShiftsByStaff,
  saveHuddle,
  getHuddle,
  submitHuddle,
  listHuddles,
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

  it('updates audit when snapshot mutated', async () => {
    await savePublishedShift(base, 'tester');
    const updated = { ...base, comments: 'x' };
    await savePublishedShift(updated, 'tester', 'fix');
    const loaded = await getShiftByDate('2024-01-01', 'day');
    expect(loaded?.audit.mutatedBy).toBe('tester');
    expect(loaded?.audit.reason).toBe('fix');
  });

  it('defaults audit when existing snapshot lacks audit', async () => {
    const key = 'history:shift:2024-01-01:day';
    const legacy = { ...base } as any;
    delete legacy.audit;
    store[key] = legacy;
    const updated = { ...legacy, comments: 'y' };
    await savePublishedShift(updated, 'tester', 'legacy');
    const loaded = await getShiftByDate('2024-01-01', 'day');
    expect(loaded?.audit.mutatedBy).toBe('tester');
    expect(loaded?.audit.createdAtISO).toBeDefined();
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

  it('handles assignments without endISO', async () => {
    const snap: PublishedShiftSnapshot = {
      ...base,
      zoneAssignments: [
        {
          staffId: '1',
          displayName: 'Alice',
          role: 'nurse',
          zone: 'A',
          startISO: '2024-01-01T07:00:00.000Z',
        },
      ],
    };
    await indexStaffAssignments(snap);
    const rows = await findShiftsByStaff('1');
    expect(rows[0].endISO).toBeUndefined();
  });

  it('records previous zone when nurse moves', async () => {
    const first: PublishedShiftSnapshot = {
      ...base,
      zoneAssignments: [
        {
          staffId: '1',
          displayName: 'Alice',
          role: 'nurse',
          zone: 'A',
          startISO: '2024-01-01T07:00:00.000Z',
          endISO: '2024-01-01T10:00:00.000Z',
        },
      ],
    };
    const second: PublishedShiftSnapshot = {
      ...base,
      zoneAssignments: [
        {
          staffId: '1',
          displayName: 'Alice',
          role: 'nurse',
          zone: 'B',
          startISO: '2024-01-01T10:00:00.000Z',
          endISO: '2024-01-01T19:00:00.000Z',
        },
      ],
    };
    await indexStaffAssignments(first);
    await indexStaffAssignments(second);
    const rows = await findShiftsByStaff('1');
    expect(rows.length).toBe(2);
    expect(rows[0].zone).toBe('B');
    expect(rows[0].previousZone).toBe('A');
  });

  it('omits previous zone when unchanged', async () => {
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
        },
      ],
    };
    await indexStaffAssignments(snap);
    const rows = await findShiftsByStaff('1');
    expect(rows[0].previousZone).toBeUndefined();
  });

  it('skips assignments shorter than 20 minutes', async () => {
    const snap: PublishedShiftSnapshot = {
      ...base,
      zoneAssignments: [
        {
          staffId: '1',
          displayName: 'Alice',
          role: 'nurse',
          zone: 'A',
          startISO: '2024-01-01T07:00:00.000Z',
          endISO: '2024-01-01T07:10:00.000Z',
        },
      ],
    };
    await indexStaffAssignments(snap);
    const rows = await findShiftsByStaff('1');
    expect(rows.length).toBe(0);
  });

  it('saves and fetches huddles', async () => {
    const rec: HuddleRecord = {
      dateISO: '2024-01-01',
      shift: 'day',
      recordedAtISO: '2024-01-01T08:00:00.000Z',
      recordedBy: 'me',
      nedocs: 0,
      checklist: [{ id: 'airway', label: 'Airway', checked: true }],
      notes: 'all good',
    };
    await saveHuddle(rec);
    const loaded = await getHuddle('2024-01-01', 'day');
    expect(loaded?.notes).toBe('all good');
  });

  it('submits huddle to history and clears draft', async () => {
    const rec: HuddleRecord = {
      dateISO: '2024-01-02',
      shift: 'night',
      recordedAtISO: '2024-01-02T20:00:00.000Z',
      recordedBy: 'me',
      nedocs: 0,
      checklist: [{ id: 'airway', label: 'Airway', checked: true }],
      notes: 'done',
    };
    await saveHuddle(rec);
    await submitHuddle(rec);
    const draft = await getHuddle('2024-01-02', 'night');
    expect(draft).toBeUndefined();
    const all = await listHuddles();
    expect(all.find((r) => r.notes === 'done')).toBeTruthy();
  });

  it('overrides snapshot with audit trail', async () => {
    await savePublishedShift(base);
    await adminOverrideShift('2024-01-01', 'day', { comments: 'fixed' }, 'test');
    const loaded = await getShiftByDate('2024-01-01', 'day');
    expect(loaded?.audit.reason).toBe('test');
    expect(loaded?.comments).toBe('fixed');
  });
});

