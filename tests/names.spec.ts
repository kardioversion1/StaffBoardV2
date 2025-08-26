import { describe, it, expect } from 'vitest';
import { formatName, formatShortName } from '@/utils/names';

describe('formatName', () => {
  it('returns empty string when given empty input', () => {
    expect(formatName('', true)).toBe('');
    expect(formatName('', false)).toBe('');
  });

  it('trims extra whitespace', () => {
    expect(formatName('  Alice   Jones  ', true)).toBe('Alice J.');
    expect(formatName('  Alice   Jones  ', false)).toBe('Alice Jones');
  });

  it('shows first name when no last provided (privacy on)', () => {
    expect(formatName('Alice', true)).toBe('Alice');
  });

  it('shows last initial when privacy is on', () => {
    expect(formatName('Alice Baker', true)).toBe('Alice B.');
  });

  it('shows full last name when privacy is off', () => {
    expect(formatName('Alice Jones', false)).toBe('Alice Jones');
  });

  it('handles middle names gracefully', () => {
    expect(formatName('Alice Beth Carter', true)).toBe('Alice C.');
    expect(formatName('Alice Beth Carter', false)).toBe('Alice Carter');
  });

  it('handles hyphenated last names', () => {
    expect(formatName('Alice Smith-Jones', true)).toBe('Alice S.');
    expect(formatName('Alice Smith-Jones', false)).toBe('Alice Smith-Jones');
  });

  it('handles multi-word last names (e.g., de la Cruz)', () => {
    expect(formatName('Maria de la Cruz', true)).toBe('Maria C.');
    expect(formatName('Maria de la Cruz', false)).toBe('Maria Cruz');
  });
});

describe('formatShortName (alias for privacy-on)', () => {
  it('delegates to formatName with privacy=true', () => {
    expect(formatShortName('Alice Baker')).toBe('Alice B.');
    expect(formatShortName('Alice')).toBe('Alice');
  });
});
