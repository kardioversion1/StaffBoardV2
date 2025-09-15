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
  return {
    STATE,
    KS,
    migrateActiveBoard: (a: any) => a,
    setActiveBoardCache: () => {},
    getActiveBoardCache: (d: string, s: string) => store[KS.ACTIVE(d, s)],
    mergeBoards: (remote: any, local: any) => ({
      ...remote,
      ...local,
      comments: remote.comments || local.comments,
    }),
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

vi.mock('@/state/staff', () => ({
  rosterStore: {
    load: async () => [{ id: 'n1', name: 'Alice', role: 'nurse', type: 'home' }],
    save: vi.fn(),
  },
}));

vi.mock('@/server', () => ({ load: vi.fn(), save: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/ui/widgets', () => ({ renderWeather: vi.fn() }));
vi.mock('@/ui/physicians', () => ({ renderPhysicians: vi.fn(), renderPhysicianPopup: vi.fn() }));
vi.mock('@/ui/assignDialog', () => ({ openAssignDialog: vi.fn() }));
vi.mock('@/ui/banner', () => ({ showBanner: vi.fn(), showToast: vi.fn() }));

import { renderBoard } from '@/ui/board';
import { DB } from '@/state';
import { openAssignDialog } from '@/ui/assignDialog';

describe('board save', () => {
  it('flushes pending save when tab is hidden', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.appendChild(root);

    const spy = vi.spyOn(DB, 'set');
    (openAssignDialog as any).mockImplementation((_staff: any, cb: (id: string) => void) => cb('n1'));

    await renderBoard(root, { dateISO: '2024-01-01', shift: 'day' });
    spy.mockClear();

    const addBtn = root.querySelector('.zone-card__add') as HTMLButtonElement;
    addBtn.click();
    expect(spy).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
