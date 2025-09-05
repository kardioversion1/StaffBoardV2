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
    publishAtISO: undefined,
  }),
  loadNextDraft: vi.fn().mockResolvedValue(null),
  saveNextDraft: vi.fn(),
  publishNextDraft: vi.fn(),
}));

vi.mock('@/state/staff', () => ({
  loadStaff: vi.fn().mockResolvedValue([{ id: 'n1', name: 'Alice', role: 'nurse' }]),
}));

vi.mock('@/seed', () => ({
  seedZonesIfNeeded: vi.fn().mockResolvedValue(undefined),
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

    const goLive = root.querySelector('#next-go-live') as HTMLInputElement;
    goLive.value = '2024-01-01T07:00';

    zoneSel.value = 'n1';
    (root.querySelector('#next-save') as HTMLButtonElement).click();
    await Promise.resolve();

    const { saveNextDraft } = await import('@/state/nextShift');
    const saved = (saveNextDraft as any).mock.calls[0][0];
    expect(saved.zones['A'][0].nurseId).toBe('n1');
    expect(saved.publishAtISO).toBe('2024-01-01T07:00');
    expect(saved.dateISO).toBe('2024-01-01');
    expect(saved.shift).toBe('day');
  });

  it('publishes draft (no history append expected here)', async () => {
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);

    (root.querySelector('#next-publish') as HTMLButtonElement).click();
    await Promise.resolve();

    const { publishNextDraft } = await import('@/state/nextShift');
    expect(publishNextDraft).toHaveBeenCalled();
  });

  it('filters staff and assigns to the focused select', async () => {
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);

    const search = root.querySelector('#next-search') as HTMLInputElement;
    expect(search).toBeTruthy();

    search.value = 'ali';
    search.dispatchEvent(new Event('input'));

    const zoneSel = root.querySelector('select#zone-a') as HTMLSelectElement;
    zoneSel.focus();

    const item = root.querySelector('.assign-item[data-id="n1"]') as HTMLElement;
    expect(item).toBeTruthy();

    item.click();
    expect(zoneSel.value).toBe('n1');
  });
});

