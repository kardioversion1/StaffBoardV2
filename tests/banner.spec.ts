/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { showBanner } from '@/ui/banner';

describe('showBanner', () => {
  it('removes banner after 10 seconds', () => {
    vi.useFakeTimers();
    showBanner('hello');
    const el = document.getElementById('app-banner');
    expect(el).toBeTruthy();
    vi.advanceTimersByTime(10_000);
    expect(document.getElementById('app-banner')).toBeNull();
    vi.useRealTimers();
  });
});
