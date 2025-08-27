import { describe, it, expect, vi } from 'vitest';
import { loadStaff } from '@/state';
import * as DB from '@/db';

vi.mock('@/db', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe('loadStaff', () => {
  it('defaults nurse type to home when missing', async () => {
    (DB.get as any).mockResolvedValue([{ id: 'id1', role: 'nurse' }]);
    const list = await loadStaff();
    expect(list[0].type).toBe('home');
  });
});
