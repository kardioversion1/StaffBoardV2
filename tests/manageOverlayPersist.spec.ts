/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';

let resolveSave: () => void;
vi.mock('@/state', () => {
  const KS = {
    STAFF: 'STAFF',
    HISTORY: 'HISTORY',
    ACTIVE: (d: string, s: string) => `ACTIVE:${d}:${s}`,
    DRAFT: (d: string, s: string) => `DRAFT:${d}:${s}`,
  };
  const STATE = { dateISO: '2024-01-01', shift: 'day', clockHHMM: '07:00', locked: false };
  const store: Record<string, any> = {
    [KS.ACTIVE(STATE.dateISO, STATE.shift)]: {
      dateISO: STATE.dateISO,
      shift: STATE.shift,
      charge: undefined,
      triage: undefined,
      admin: undefined,
      zones: { 'Zone A': [{ nurseId: 'n1' }] },
      incoming: [],
      offgoing: [],
      comments: '',
      huddle: '',
      handoff: '',
      version: 1,
    },
  };
  return {
    STATE,
    KS,
    CURRENT_SCHEMA_VERSION: 1,
    migrateActiveBoard: (a: any) => a,
    setActiveBoardCache: () => {},
    getActiveBoardCache: (d: string, s: string) => store[KS.ACTIVE(d, s)],
    mergeBoards: (remote: any, local: any) => ({ ...remote, ...local }),
    DB: {
      get: async (k: string) => store[k],
      set: async (k: string, v: any) => { store[k] = v; },
    },
    getConfig: () => ({ zones: [{ name: 'Zone A', color: 'var(--panel)' }] }),
    saveConfig: async () => {},
  };
});

vi.mock('@/state/staff', () => ({
  rosterStore: {
    load: async () => [{ id: 'n1', name: 'Alice', role: 'nurse', type: 'home' }],
    save: vi.fn(() => new Promise<void>((r) => { resolveSave = r; })),
  },
}));

vi.mock('@/server', () => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/ui/widgets', () => ({ renderWeather: vi.fn() }));
vi.mock('@/ui/physicians', () => ({ renderPhysicians: vi.fn(), renderPhysicianPopup: vi.fn() }));
vi.mock('@/ui/assignDialog', () => ({ openAssignDialog: vi.fn() }));
vi.mock('@/ui/banner', () => ({ showBanner: vi.fn(), showToast: vi.fn() }));

import { renderBoard } from '@/ui/board';
import { rosterStore } from '@/state/staff';

describe('manage overlay', () => {
  it('waits for roster save before closing', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    await renderBoard(root, { dateISO: '2024-01-01', shift: 'day' });

    const manageBtn = root.querySelector('.zone-card .btn') as HTMLButtonElement;
    manageBtn.click();

    const overlay = document.querySelector('.manage-overlay')!;
    const saveBtn = overlay.querySelector('#mg-save') as HTMLButtonElement;
    saveBtn.click();
    expect(document.querySelector('.manage-overlay')).toBeTruthy();
    resolveSave();
    await Promise.resolve();
    expect((rosterStore.save as any)).toHaveBeenCalled();
    expect(document.querySelector('.manage-overlay')).toBeNull();
  });
});
