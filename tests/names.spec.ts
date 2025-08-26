import { describe, it, expect } from 'vitest';
import { formatName } from '@/utils/names';

describe('formatName', () => {
  it('respects privacy flag', () => {
    expect(formatName('Alice Jones', true)).toBe('Alice J.');
    expect(formatName('Alice Jones', false)).toBe('Alice Jones');
    expect(formatName('Alice', true)).toBe('Alice');
  });
});
