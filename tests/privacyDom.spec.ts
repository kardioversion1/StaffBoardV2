import { describe, it, expect, beforeEach } from 'vitest';
/** @vitest-environment happy-dom */
import { saveConfig } from '@/state/config';
import type { Staff } from '@/state/staff';
import { nurseTile } from '@/ui/nurseTile';
import { vi } from 'vitest';

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

beforeEach(async () => {
  await saveConfig({ privacy: true });
});

describe('privacy toggle', () => {
  it('updates rendered name', async () => {
    const slot: any = {};
    const staff: Staff = { id: '1', name: 'Alice Doe', role: 'nurse', type: 'home' };
    const wrap = document.createElement('div');
    wrap.innerHTML = nurseTile(slot, staff);
    expect(wrap.textContent).toContain('Alice D.');
    await saveConfig({ privacy: false });
    wrap.innerHTML = nurseTile(slot, staff);
    expect(wrap.textContent).toContain('Alice Doe');
  });
});
