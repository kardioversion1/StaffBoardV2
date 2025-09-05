import { describe, it, expect, vi } from 'vitest';
import { buildTimeWindow } from '@/weather/meteomatics';

describe('buildTimeWindow', () => {
  it('formats times in local time with offset', () => {
    vi.useFakeTimers();
    const base = new Date('2023-09-04T14:30:00Z');
    vi.setSystemTime(base);
    const spy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(240);
    const { startISO, endISO } = buildTimeWindow(0, 0);
    spy.mockRestore();
    vi.useRealTimers();
    expect(startISO).toBe('2023-09-04T10:00:00-04:00');
    expect(endISO).toBe('2023-09-04T10:00:00-04:00');
  });
});
