/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/state', () => {
  const KS = {
    STAFF: 'STAFF',
    HISTORY: 'HISTORY',
    ACTIVE: (d: string, s: string) => `ACTIVE:${d}:${s}`,
    DRAFT: (d: string, s: string) => `DRAFT:${d}:${s}`,
  };
  const STATE = {
    dateISO: '2024-01-01',
    shift: 'day',
    clockHHMM: '07:00',
    locked: false,
  };
  const store: Record<string, any> = {
    [KS.ACTIVE(STATE.dateISO, STATE.shift)]: {
      dateISO: STATE.dateISO,
      shift: STATE.shift,
      charge: undefined,
      triage: undefined,
      admin: undefined,
      zones: { 'Zone A': [] },
      incoming: [],
      offgoing: [],
      comments: '',
      huddle: '',
      handoff: '',
      version: 1,
    },
    [KS.STAFF]: [
      { id: 'n1', name: 'Alice', role: 'nurse', type: 'home' },
    ],
  };
  const loadStaff = async () => store[KS.STAFF];
  return {
    STATE,
    KS,
    loadStaff,
    saveStaff: vi.fn(),
    migrateActiveBoard: (a: any) => a,
    setActiveBoardCache: () => {},
    getActiveBoardCache: (d: string, s: string) => store[KS.ACTIVE(d, s)],
    mergeBoards: (remote: any, local: any) => ({ ...remote, ...local }),
    DB: {
      get: async (k: string) => store[k],
      set: async (k: string, v: any) => {
        store[k] = v;
      },
      del: async (k: string) => {
        delete store[k];
      },
    },
    getConfig: () => ({ zones: [{ name: 'Zone A', color: 'var(--panel)' }] }),
    saveConfig: async () => {},
  };
});

vi.mock('@/server', () => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/ui/widgets', () => ({ renderWeather: vi.fn() }));
vi.mock('@/ui/physicians', () => ({ renderPhysicians: vi.fn(), renderPhysicianPopup: vi.fn() }));
vi.mock('@/ui/assignDialog', () => ({ openAssignDialog: vi.fn() }));
vi.mock('@/ui/banner', () => ({ showBanner: vi.fn(), showToast: vi.fn() }));

import { renderBoard } from '@/ui/board';
import { openAssignDialog } from '@/ui/assignDialog';
import { save as serverSave } from '@/server';

describe('offline save queue', () => {
  it('flushes queued saves when back online', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.appendChild(root);

    (openAssignDialog as any).mockImplementation((_staff: any, cb: (id: string) => void) => cb('n1'));

    (serverSave as vi.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);

    await renderBoard(root, { dateISO: '2024-01-01', shift: 'day' });

    const addBtn = root.querySelector('.zone-card__add') as HTMLButtonElement;
    addBtn.click();

    await vi.runAllTimersAsync();
    expect((serverSave as vi.Mock).mock.calls.length).toBe(1);

    window.dispatchEvent(new Event('online'));
    await Promise.resolve();

    expect((serverSave as vi.Mock).mock.calls.length).toBe(2);
    const board = (serverSave as vi.Mock).mock.calls[1][1];
    expect(board.zones['Zone A'][0].nurseId).toBe('n1');
  });
});
