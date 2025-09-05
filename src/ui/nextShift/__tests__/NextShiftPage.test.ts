/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderNextShiftPage } from '../NextShiftPage';

vi.mock('@/state/config', () => ({
  getConfig: () => ({ zones: [{ id: 'a', name: 'A' }] }),
}));

vi.mock('@/state/nextShift', () => ({
  buildEmptyDraft: (dateISO: string, shift: 'day' | 'night', zones: any[]) => ({
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(zones.map((z: any) => [z.name, []])),
    incoming: [],
    offgoing: [],
    huddle: '',
    handoff: '',
    version: 2,
  }),
  loadNextDraft: vi.fn().mockResolvedValue(null),
  saveNextDraft: vi.fn(),
  publishNextDraft: vi.fn(),
}));

vi.mock('@/state/staff', () => ({
  loadStaff: vi.fn().mockResolvedValue([{ id: 'n1', name: 'Alice', role: 'nurse' }]),
}));

describe('renderNextShiftPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('renders zone select and saves draft', async () => {
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);
    const zoneSel = root.querySelector('select#zone-a') as HTMLSelectElement;
    expect(zoneSel).toBeTruthy();
    zoneSel.value = 'n1';
    (root.querySelector('#next-save') as HTMLButtonElement).click();
    await Promise.resolve();
    const { saveNextDraft } = await import('@/state/nextShift');
    expect((saveNextDraft as any).mock.calls[0][0].zones['A'][0].nurseId).toBe('n1');
  });

  it('filters staff and assigns to focused select', async () => {
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);
    const search = root.querySelector('#next-search') as HTMLInputElement;
    search.value = 'ali';
    search.dispatchEvent(new Event('input'));
    const zoneSel = root.querySelector('select#zone-a') as HTMLSelectElement;
    zoneSel.focus();
    const item = root.querySelector('.assign-item[data-id="n1"]') as HTMLElement;
    item.click();
    expect(zoneSel.value).toBe('n1');
  });
});
