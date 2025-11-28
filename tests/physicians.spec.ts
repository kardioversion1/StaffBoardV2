import { describe, it, expect, vi, afterEach } from 'vitest';
import * as state from '@/state';
import { __test, getUpcomingDoctors } from '@/ui/physicians';

const { parseICS, normalizeTime, parseAssignmentsFromSection } = __test;

describe('physician schedule parsing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses ICS events and preserves descriptions', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20241201',
      'DESCRIPTION:--- Jewish Hospital ---\\nDay | Huff | 6a – 2p',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const events = parseICS(sample);
    expect(events).toEqual([
      {
        date: '2024-12-01',
        description: '--- Jewish Hospital ---\nDay | Huff | 6a – 2p',
      },
    ]);
  });

  it('normalizes shorthand times', () => {
    expect(normalizeTime('6a')).toBe('06:00');
    expect(normalizeTime('noon')).toBe('12:00');
    expect(normalizeTime('11:59p')).toBe('23:59');
  });

  it('extracts assignments from a section including overnight shifts', () => {
    const section = 'Day | Huff | 6a – 2p, Nite | Bequer | 10p – 6a';
    const res = parseAssignmentsFromSection(section, '2024-12-01', 'Jewish Hospital');
    expect(res).toEqual([
      {
        date: '2024-12-01',
        endDate: '2024-12-01',
        location: 'Jewish Hospital',
        shift: 'Day',
        name: 'Huff',
        start: '06:00',
        end: '14:00',
        crossesMidnight: false,
      },
      {
        date: '2024-12-01',
        endDate: '2024-12-02',
        location: 'Jewish Hospital',
        shift: 'Nite',
        name: 'Bequer',
        start: '22:00',
        end: '06:00',
        crossesMidnight: true,
      },
    ]);
  });

  it('groups upcoming assignments from description sections', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20241201',
      'DESCRIPTION:--- Jewish Hospital ---\\nDay | Huff | 6a – 2p\\n--- Med South ---\\nSouthday | Stephens | noon – 10p',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20241202',
      'DESCRIPTION:--- Jewish Hospital ---\\nNite | Bequer | 10p – 6a',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/calendar' },
      text: () => Promise.resolve(sample),
    } as unknown as Response);
    vi.spyOn(state, 'getConfig').mockReturnValue({ physicians: { calendarUrl: 'https://example.com/phys.ics' } } as any);
    vi.stubGlobal('fetch', fetchMock);

    const result = await getUpcomingDoctors('2024-12-01', 2);
    expect(result).toEqual({
      '2024-12-01': {
        'Jewish Hospital': [
          {
            date: '2024-12-01',
            endDate: '2024-12-01',
            location: 'Jewish Hospital',
            shift: 'Day',
            name: 'Huff',
            start: '06:00',
            end: '14:00',
            crossesMidnight: false,
          },
        ],
        'Med South': [
          {
            date: '2024-12-01',
            endDate: '2024-12-01',
            location: 'Med South',
            shift: 'Southday',
            name: 'Stephens',
            start: '12:00',
            end: '22:00',
            crossesMidnight: false,
          },
        ],
      },
      '2024-12-02': {
        'Jewish Hospital': [
          {
            date: '2024-12-02',
            endDate: '2024-12-03',
            location: 'Jewish Hospital',
            shift: 'Nite',
            name: 'Bequer',
            start: '22:00',
            end: '06:00',
            crossesMidnight: true,
          },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/phys.ics', {});
  });
});
