import { describe, it, expect } from 'vitest';
import { __test } from '@/ui/physicians';

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

  it('handles DTSTART with TZID parameter', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/New_York:20240101T070000',
      'SUMMARY:Dr A',
      'LOCATION:Jewish Downtown',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const events = __test.parseICS(sample);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      date: '2024-01-01',
      summary: 'Dr A',
      location: 'Jewish Downtown',
    });
  });
});
