import { describe, it, expect } from 'vitest';
import { migrateActiveBoard, CURRENT_SCHEMA_VERSION } from '@/state';

describe('migrateActiveBoard', () => {
  it('fills defaults and sets version', () => {
    const board = migrateActiveBoard({});
    expect(board.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(board.comments).toBe('');
    expect(board.huddle).toBe('');
    expect(board.handoff).toBe('');
    expect(board.zones).toEqual({});
    expect(Array.isArray(board.incoming)).toBe(true);
    expect(Array.isArray(board.offgoing)).toBe(true);
  });
});
