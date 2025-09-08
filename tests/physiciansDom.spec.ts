import { describe, it, expect, vi, afterEach } from 'vitest';
/** @vitest-environment happy-dom */

import * as phys from '@/ui/physicians';

describe('physician schedule rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows start times and last names on the board', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T060000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr DiMeo',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240101T120000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr Cohen',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240101T140000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr Rassi',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240101T220000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr Fischer',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    const el = document.createElement('div');
    await phys.renderPhysicians(el, '2024-01-01');
    expect(el.querySelectorAll('li')).toHaveLength(4);
    const text = el.textContent || '';
    expect(text).toContain('6am Dr. DiMeo');
    expect(text).toContain('12pm Dr. Cohen');
    expect(text).toContain('2pm Dr. Rassi');
    expect(text).toContain('10pm Dr. Fischer');
  });

  it('handles events without explicit start times', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T000000',
      'ATTENDEE;CN="Dr Bayers":mailto:bayers@example.com',
      'ATTENDEE;CN="Dr Fox":mailto:fox@example.com',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    const el = document.createElement('div');
    await phys.renderPhysicians(el, '2024-01-01');
    const items = Array.from(el.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(items).toEqual(['Dr. Bayers', 'Dr. Fox']);
  });

  it('aggregates upcoming physicians without locations', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T000000',
      'ATTENDEE;CN="Dr Bayers":mailto:bayers@example.com',
      'ATTENDEE;CN="Dr Fox":mailto:fox@example.com',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    const data = await phys.getUpcomingDoctors('2024-01-01', 1);
    expect(data).toEqual({ '2024-01-01': { Downtown: ['Dr. Bayers', 'Dr. Fox'] } });
  });

  // Popup rendering is indirectly covered via renderPhysicians tests.
});

