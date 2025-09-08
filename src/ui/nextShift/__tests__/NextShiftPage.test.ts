/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderNextShiftPage } from '../NextShiftPage';

vi.mock('@/state/config', () => ({
  loadConfig: vi.fn().mockResolvedValue({ zones: [{ id: 'a', name: 'A' }] }),
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
    endAtISO: undefined,
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
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders zone drop and saves draft with default times', async () => {
    vi.setSystemTime(new Date('2024-01-01T08:00:00'));
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);

    const zone = root.querySelector('#zone-a') as HTMLElement;
    expect(zone).toBeTruthy();

    zone.dataset.nurseId = 'n1';
    (root.querySelector('#next-save') as HTMLButtonElement).click();
    await Promise.resolve();

    const { saveNextDraft } = await import('@/state/nextShift');
    const saved = (saveNextDraft as any).mock.calls[0][0];
    expect(saved.zones['A'][0].nurseId).toBe('n1');
    expect(saved.publishAtISO).toBe('2024-01-01T11:00');
    expect(saved.endAtISO).toBe('2024-01-01T23:00');
    expect(saved.dateISO).toBe('2024-01-01');
    expect(saved.shift).toBe('day');
  });

  it('rolls default times to next morning after evening', async () => {
    vi.setSystemTime(new Date('2024-01-01T21:00:00'));
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);
    const goLive = root.querySelector('#next-go-live') as HTMLInputElement;
    const end = root.querySelector('#next-end') as HTMLInputElement;
    expect(goLive.value).toBe('2024-01-02T07:00');
    expect(end.value).toBe('2024-01-02T19:00');
  });

  it('publishes draft (no history append expected here)', async () => {
    vi.setSystemTime(new Date('2024-01-01T08:00:00'));
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);

    (root.querySelector('#next-publish') as HTMLButtonElement).click();
    await Promise.resolve();

    const { publishNextDraft } = await import('@/state/nextShift');
    expect(publishNextDraft).toHaveBeenCalled();
  });

  it('filters staff list', async () => {
    vi.setSystemTime(new Date('2024-01-01T08:00:00'));
    const root = document.getElementById('root') as HTMLElement;
    await renderNextShiftPage(root);

    const search = root.querySelector('#next-search') as HTMLInputElement;
    expect(search).toBeTruthy();

    search.value = 'ali';
    search.dispatchEvent(new Event('input'));

    const item = root.querySelector('.assign-item[data-id="n1"]') as HTMLElement;
    expect(item).toBeTruthy();

    item.click();
    expect(item.classList.contains('selected')).toBe(true);
  });
});

