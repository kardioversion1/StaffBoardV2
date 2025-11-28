import { describe, it, expect, vi, afterEach } from 'vitest';
/** @vitest-environment happy-dom */

import * as state from '@/state';
import * as phys from '@/ui/physicians';

describe('physician schedule rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders fallback when no physician schedule URL is configured', async () => {
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: '' } } as any);
    const el = document.createElement('div');

    await phys.renderPhysicians(el, '2024-12-01');

    expect(el.textContent).toContain('Physician schedule unavailable');
  });

  it('renders fallback when fetching fails', async () => {
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: 'http://phys' } } as any);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const el = document.createElement('div');

    await phys.renderPhysicians(el, '2024-12-01');

    expect(el.textContent).toContain('Physician schedule unavailable');
  });

  it('renders schedule items from JSON when available', async () => {
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: 'http://phys' } } as any);
    const payload = [
      { date: '2024-12-01', name: 'Dr. Smith', start: '7:00', end: '15:00', location: 'ED', shift: 'Day' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    const el = document.createElement('div');

    await phys.renderPhysicians(el, '2024-12-01');

    expect(el.querySelectorAll('li')).toHaveLength(1);
    expect(el.textContent).toContain('Dr. Smith');
    expect(el.textContent).not.toContain('Physician schedule unavailable');
  });

  const sampleIcs = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20241201',
    'DESCRIPTION:--- Jewish Hospital ---\\nDay | Huffstickler | 6a – 2p, Nite | Bequer | 10p – 6a\\n--- Med South ---\\nsouthday8 | Stephens | noon – 10p',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20241202',
    'DESCRIPTION:--- Jewish Hospital ---\\nDay | Cohen | 7a – 3p',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');

  it('renders a seven-day list with parsed times and locations', async () => {
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: 'http://phys' } } as any);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sampleIcs),
      } as unknown as Response)
    );

    const el = document.createElement('div');
    await phys.renderPhysicians(el, '2024-12-01');
    const items = Array.from(el.querySelectorAll('li')).map((li) => li.textContent || '');

    expect(items).toHaveLength(4);
    expect(items[0]).toContain('Dec');
    expect(items.join(' ')).toContain('Jewish Hospital');
    expect(items.join(' ')).toContain('Med South');
    expect(items.join(' ')).toContain('06:00–14:00');
    expect(items.join(' ')).toContain('22:00–06:00 (+1d)');
  });

  it('renders popup grouped by date and location with 24-hour ranges', async () => {
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: 'http://phys' } } as any);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sampleIcs),
      } as unknown as Response)
    );

    await phys.renderPhysicianPopup('2024-12-01', 2);
    const overlay = document.querySelector('.phys-overlay') as HTMLElement;
    const text = overlay.textContent || '';

    expect(text).toContain('Upcoming Physicians');
    expect(text).toContain('Jewish Hospital');
    expect(text).toContain('Med South');
    expect(text).toContain('06:00–14:00');
    expect(text).toContain('22:00–06:00 (+1d)');
  });
});
