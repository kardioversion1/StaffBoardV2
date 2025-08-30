/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { openWelcomeModal } from '@/ui/welcome';

describe('openWelcomeModal', () => {
  it('creates the welcome overlay', () => {
    openWelcomeModal();
    const el = document.getElementById('welcome-overlay');
    expect(el).toBeTruthy();
  });
});
