import { describe, it, expect, vi } from 'vitest';
import { importHistoryFromJSON, KS, DB } from '@/state/board';

describe('history import', () => {
  it('parses json and stores shifts', async () => {
    const spy = vi.spyOn(DB, 'set').mockResolvedValue();
    const json = JSON.stringify([
      {
        dateISO: '2024-01-01',
        shift: 'day',
        zones: { Alpha: [{ nurseId: 'robot-01' }] },
        incoming: [],
        offgoing: []
      }
    ]);
    const result = await importHistoryFromJSON(json);
    expect(result).toEqual([
      {
        dateISO: '2024-01-01',
        shift: 'day',
        zones: { Alpha: [{ nurseId: 'robot-01' }] },
        incoming: [],
        offgoing: []
      }
    ]);
    expect(spy).toHaveBeenCalledWith(KS.HISTORY, result);
  });
});
