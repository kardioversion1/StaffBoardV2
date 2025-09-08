import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/utils/format';

describe('formatDuration', () => {
  it('formats positive durations', () => {
    const start = '2024-01-01T07:00:00.000Z';
    const end = '2024-01-01T08:30:00.000Z';
    expect(formatDuration(start, end)).toBe('1:30');
  });

  it('returns empty string for invalid ranges', () => {
    const start = '2024-01-01T07:00:00.000Z';
    expect(formatDuration(start, start)).toBe('');
    expect(formatDuration(start, 'bad')).toBe('');
  });
});
