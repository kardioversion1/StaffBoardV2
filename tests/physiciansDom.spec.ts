import { describe, it, expect, vi, afterEach } from 'vitest';
/** @vitest-environment happy-dom */

import { renderPhysicians, renderPhysicianPopup } from '@/ui/physicians';

describe('physician schedule rendering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows only top three physicians on the board', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr DiMeo\\nDr Cohen\\nDr Rassi\\nDr Fischer',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    const el = document.createElement('div');
    await renderPhysicians(el, '2024-01-01');
    expect(el.querySelectorAll('tr')).toHaveLength(3);
    const text = el.textContent || '';
    expect(text).toContain('Day');
    expect(text).toContain('Dr DiMeo');
    expect(text).toContain('6a – 2p');
    expect(text).toContain('Mid');
    expect(text).toContain('Dr Cohen');
    expect(text).toContain('noon – 10p');
    expect(text).toContain('Evening');
    expect(text).toContain('Dr Rassi');
    expect(text).toContain('2p – 11:59p');
    expect(text).not.toContain('Dr Fischer');
  });

  it('includes the full schedule in the popup', async () => {
    const sample = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20240101T070000',
      'LOCATION:Jewish Downtown',
      'DESCRIPTION:Dr DiMeo\\nDr Cohen\\nDr Rassi\\nDr Fischer',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sample),
      } as unknown as Response)
    );

    await renderPhysicianPopup('2024-01-01', 1);
    const overlay = document.querySelector('.phys-overlay');
    expect(overlay?.textContent).toContain('Dr Fischer');
  });
});

