import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { __test, getUpcomingDoctors } from '@/ui/physicians';

describe('physician schedule parsing', () => {
  it('extracts events from ICS', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'SUMMARY:Dr A',
      'LOCATION:Jewish Downtown',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'SUMMARY:Dr B',
      'LOCATION:Other',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const events = __test.parseICS(sample);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      date: '2024-01-01',
      summary: 'Dr A',
      location: 'Jewish Downtown',
    });
  });

  it('groups upcoming physicians by date', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'SUMMARY:Dr A',
      'LOCATION:Jewish Downtown',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240105T070000',
      'SUMMARY:Dr B',
      'LOCATION:Jewish Downtown',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240108T070000',
      'SUMMARY:Dr C',
      'LOCATION:Jewish Downtown',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240103T070000',
      'SUMMARY:Dr D',
      'LOCATION:Other',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const original = (global as any).fetch;
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sample),
    });
    const res = await getUpcomingDoctors('2024-01-01', 7);
    expect(res).toEqual({
      '2024-01-01': ['Dr A'],
      '2024-01-05': ['Dr B'],
    });
    (global as any).fetch = original;
  });
});
