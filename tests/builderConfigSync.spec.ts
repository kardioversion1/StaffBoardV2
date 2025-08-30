/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/db', () => {
  const store: Record<string, any> = {};
  return {
    get: async (k: string) => store[k],
    set: async (k: string, v: any) => {
      store[k] = v;
    },
    del: async (k: string) => {
      delete store[k];
    },
    keys: async () => Object.keys(store),
  };
});

vi.mock('@/server', () => ({
  load: vi.fn().mockImplementation((key: string) => {
    if (key === 'roster') {
      return Promise.resolve([{ id: 'n1', role: 'nurse', type: 'home' }]);
    }
    return Promise.resolve({});
  }),
  save: vi.fn(),
  softDeleteStaff: vi.fn(),
  exportHistoryCSV: vi.fn(),
}));

import { renderBuilder } from '@/ui/builder';
import { saveConfig, getConfig } from '@/state/config';
import { STATE } from '@/state/board';

beforeEach(() => {
  STATE.dateISO = '2024-01-01';
  STATE.shift = 'day';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('builder config sync', () => {
  it('re-renders when configuration changes', async () => {
    await saveConfig({ zones: [{ id: 'z1', name: 'Zone A', color: 'var(--panel)' }] });
    const root = document.createElement('div');
    document.body.appendChild(root);
    await renderBuilder(root);
    expect(root.innerHTML).toContain('Zone A');
    const cfg = getConfig();
    cfg.zones[0].name = 'Zone B';
    await saveConfig({ zones: cfg.zones });
    document.dispatchEvent(new Event('config-changed'));
    expect(root.innerHTML).toContain('Zone B');
  });

  it('dispatches config-changed after zone edit', async () => {
    await saveConfig({ zones: [{ id: 'z1', name: 'Zone A', color: 'var(--panel)' }] });
    const root = document.createElement('div');
    document.body.appendChild(root);
    await renderBuilder(root);
    const handler = vi.fn();
    document.addEventListener('config-changed', handler);
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('Zone B'));
    const editBtn = root.querySelector('.zone-card__actions .btn') as HTMLButtonElement;
    editBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalled();
    document.removeEventListener('config-changed', handler);
  });
});
