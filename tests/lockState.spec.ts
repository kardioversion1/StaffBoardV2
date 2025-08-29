import { describe, it, expect } from 'vitest';
import { STATE, initState } from '@/state';

describe('initState lock', () => {
  it('unlocks board by default', () => {
    STATE.locked = true;
    initState();
    expect(STATE.locked).toBe(false);
  });
});
