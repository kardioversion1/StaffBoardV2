import { describe, it, expect } from 'vitest';
import { formatShortName } from '@/utils/names';

describe('formatShortName', () => {
  it('shows first name when no last provided', () => {
    expect(formatShortName('Alice')).toBe('Alice');
  });
  it('shows last initial', () => {
    expect(formatShortName('Alice Baker')).toBe('Alice B.');
  });
});
