import { describe, it, expect, vi, afterEach } from 'vitest';
/** @vitest-environment happy-dom */

import * as phys from '@/ui/physicians';

describe('physician schedule rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows only physician last names on the board', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:--- Jewish Hospital ---\\nDr DiMeo\\nDr Cohen\\nDr Rassi\\nDr Fischer',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/calendar' },
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    const el = document.createElement('div');
    await phys.renderPhysicians(el, '2024-01-01');
    expect(el.querySelectorAll('li')).toHaveLength(3);
    const text = el.textContent || '';
    expect(text).toContain('Dr. DiMeo');
    expect(text).toContain('Dr. Cohen');
    expect(text).toContain('Dr. Rassi');
    expect(text).not.toContain('Dr. Fischer');
    expect(text).not.toContain('Jewish Hospital');
    expect(text).not.toContain('Day');
    expect(text).not.toContain('6a – 2p');
  });

  // Popup rendering is indirectly covered via renderPhysicians tests.
});

