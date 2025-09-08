/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';

const store: Record<string, any> = {};
vi.mock('@/state', () => {
  const KS = {
    ACTIVE: (d: string, s: string) => `ACTIVE:${d}:${s}`,
  };
  const STATE = {
    dateISO: '2024-01-01',
    shift: 'day',
    clockHHMM: '07:00',
    locked: false,
  };
  const loadStaff = async () => [];
  return {
    STATE,
    KS,
    loadStaff,
    saveStaff: vi.fn(),
    CURRENT_SCHEMA_VERSION: 1,
    migrateActiveBoard: (a: any) => a,
    setActiveBoardCache: vi.fn(),
    DB: {
      get: async (k: string) => store[k],
      set: async (k: string, v: any) => {
        store[k] = v;
      },
    },
    getConfig: () => ({ zones: [] }),
    saveConfig: async () => {},
  };
});

vi.mock('@/server', () => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/state/sync', () => ({ notifyUpdate: vi.fn(), onUpdate: vi.fn() }));
vi.mock('@/ui/widgets', () => ({ renderWeather: vi.fn() }));
vi.mock('@/ui/physicians', () => ({ renderPhysicians: vi.fn(), renderPhysicianPopup: vi.fn() }));
vi.mock('@/ui/assignDialog', () => ({ openAssignDialog: vi.fn() }));
vi.mock('@/ui/banner', () => ({ showBanner: vi.fn(), showToast: vi.fn() }));
vi.mock('@/utils/names', () => ({ setNurseCache: vi.fn(), labelFromId: (id: string) => id }));

import { renderBoard } from '@/ui/board';
import { DB, KS } from '@/state';
import { load as serverLoad } from '@/server';
import { notifyUpdate } from '@/state/sync';

describe('renderBoard server persistence', () => {
  it('writes fetched board to IndexedDB', async () => {
    const saveKey = KS.ACTIVE('2024-01-01', 'day');
    store[saveKey] = { comments: 'stale' } as any;

    const remote = {
      dateISO: '2024-01-01',
      shift: 'day',
      charge: undefined,
      triage: undefined,
      admin: undefined,
      zones: {},
      incoming: [],
      offgoing: [],
      comments: 'fresh',
      huddle: '',
      handoff: '',
      version: 1,
    };
    (serverLoad as vi.Mock).mockResolvedValue(remote);

    const root = document.createElement('div');
    document.body.appendChild(root);
    await renderBoard(root, { dateISO: '2024-01-01', shift: 'day' });

    const saved = await DB.get(saveKey);
    expect(saved?.comments).toBe('fresh');
    expect(notifyUpdate).toHaveBeenCalledWith(saveKey);
  });
});
