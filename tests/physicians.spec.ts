import { describe, it, expect, vi, afterEach } from 'vitest';
import { __test, getUpcomingDoctors } from '@/ui/physicians';

describe('physician schedule parsing', () => {
  afterEach(() => {
    // Restore any mocked globals between tests
    vi.restoreAllMocks();
  });

  it('extracts events from ICS', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'ATTENDEE;CN=Dr A:mailto:a@example.com',
      'ATTENDEE;CN=Dr B:mailto:b@example.com',
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
    expect(events[1]).toEqual({
      date: '2024-01-01',
      summary: 'Dr B',
      location: 'Jewish Downtown',
    });
  });

  it('handles DTSTART with TZID parameter', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/New_York:20240101T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'ATTENDEE;CN=Dr A:mailto:a@example.com',
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

  it('falls back to DESCRIPTION when attendees missing', () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240102T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr A\\nDr B',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const events = __test.parseICS(sample);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      date: '2024-01-02',
      summary: 'Dr A',
      location: 'Jewish Downtown',
    });
    expect(events[1]).toEqual({
      date: '2024-01-02',
      summary: 'Dr B',
      location: 'Jewish Downtown',
    });
  });

  it('converts UTC timestamps to the local date', () => {
    const expected = (() => {
      const base = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
      const offset = base.getTimezoneOffset();
      const local = new Date(base.getTime() - offset * 60000);
      return local.toISOString().slice(0, 10);
    })();
    expect(__test.extractDateISO('20240101T000000Z')).toBe(expected);
  });

  it('groups upcoming physicians by date (range, location-filtered)', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'ATTENDEE;CN=Dr A:mailto:a@example.com',
      'ATTENDEE;CN=Dr B:mailto:b@example.com',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240105T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'ATTENDEE;CN=Dr C:mailto:c@example.com',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240108T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Jewish Downtown',
      'ATTENDEE;CN=Dr D:mailto:d@example.com',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20240103T070000',
      'SUMMARY:ER Main Schedule',
      'LOCATION:Other',
      'ATTENDEE;CN=Dr E:mailto:e@example.com',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    // Mock first fetch attempt (direct URL) to succeed and return sample ICS
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sample),
    } as unknown as Response);

    vi.stubGlobal('fetch', fetchMock);

    const res = await getUpcomingDoctors('2024-01-01', 7);
    expect(res).toEqual({
      '2024-01-01': ['Dr A', 'Dr B'],
      '2024-01-05': ['Dr C'],
    });

    // Ensure we used the direct fetch at least once
    expect(fetchMock).toHaveBeenCalled();
  });
});

