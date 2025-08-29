import { describe, it, expect, vi } from 'vitest';
import { createDebouncer } from '@/utils/debouncedSave';

describe('createDebouncer', () => {
  it('maintains independent timers', () => {
    vi.useFakeTimers();
    const fnA = vi.fn(() => 'a');
    const commitA = vi.fn();
    const debA = createDebouncer(fnA, commitA, 100);

    const fnB = vi.fn(() => 'b');
    const commitB = vi.fn();
    const debB = createDebouncer(fnB, commitB, 100);

    debA();
    vi.advanceTimersByTime(50);
    debB();
    vi.advanceTimersByTime(60);
    expect(commitA).toHaveBeenCalledTimes(1);
    expect(commitB).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(commitB).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

