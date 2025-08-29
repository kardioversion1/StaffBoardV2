import { describe, it, expect, vi } from 'vitest';
/** @vitest-environment happy-dom */

import { signOut } from '@/signout';

describe('signOut', () => {
  it('clears sessionStorage data', () => {
    sessionStorage.setItem('staffboard:test', '1');
    signOut();
    expect(sessionStorage.getItem('staffboard:test')).toBeNull();
  });
});

