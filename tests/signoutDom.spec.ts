import { describe, it, expect, beforeEach, vi } from 'vitest';
/** @vitest-environment happy-dom */
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
vi.mock('@/main', () => ({ manualHandoff: () => {} }));

import { saveUIConfig, applyUI } from '@/state/uiConfig';
import { saveConfig } from '@/state/config';
import { saveStaff } from '@/state/staff';
import { STATE, initState } from '@/state';
import { renderHeader } from '@/ui/header';
import { renderBoard } from '@/ui/board';

beforeEach(async () => {
  initState();
  await saveConfig({});
  await saveStaff([]);
  document.body.innerHTML = '<div id="app"></div><div id="panel"></div>';
});

describe('signout button modes', () => {
  it('renders huddle button when mode=shiftHuddle', async () => {
    await saveUIConfig({ signoutMode: 'shiftHuddle' });
    renderHeader();
    expect(document.getElementById('huddle-btn')).toBeTruthy();
  });
  it('renders huddle button when mode=disabled', async () => {
    await saveConfig({ ui: { signoutMode: 'disabled' } });
    renderHeader();
    expect(document.getElementById('huddle-btn')).toBeTruthy();
    expect(document.getElementById('handoff')).toBeNull();
  });
});

describe('layout and clock', () => {
  it('applies sidebar width and no small clock', async () => {
    await saveUIConfig({ rightSidebarWidthPx: 260 });
    applyUI();
    expect(
      getComputedStyle(document.documentElement).getPropertyValue('--right-sidebar-w').trim()
    ).toContain('260');
    const root = document.createElement('div');
    document.body.appendChild(root);
    await renderBoard(root, { dateISO: STATE.dateISO, shift: STATE.shift });
    expect(document.getElementById('clock')).toBeNull();
  });
});
