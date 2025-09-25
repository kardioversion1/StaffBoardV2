import { describe, it, expect, vi } from 'vitest';
import { rosterStore } from '@/state/staff';
import * as DB from '@/db';

vi.mock('@/db', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/state/staff/service', () => ({
  fetchRoster: vi.fn().mockResolvedValue([]),
  pushRoster: vi.fn(),
}));

describe('loadStaff', () => {
  it('defaults nurse type to home when missing', async () => {
    (DB.get as any).mockResolvedValue([{ id: 'id1', role: 'nurse' }]);
    const list = await rosterStore.load();
    expect(list[0].type).toBe('home');
  });
});
