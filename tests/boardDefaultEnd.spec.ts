import { describe, it, expect } from 'vitest';
import { upsertSlot, type Board, type Slot } from '@/slots';
import { defaultEnd } from '@/ui/board/assignments';

describe('default end time', () => {
  it('adds 12 hours when end time omitted', () => {
    const board: Board = { charge: undefined, triage: undefined, admin: undefined, zones: { A: [] } };
    const start = '07:00';
    const slot: Slot = { nurseId: 'n1', startHHMM: start };
    slot.endTimeOverrideHHMM = defaultEnd(start);
    upsertSlot(board, { zone: 'A' }, slot);
    const added = board.zones.A[0];
    expect(added.startHHMM).toBe(start);
    expect(added.endTimeOverrideHHMM).toBe('19:00');
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const diff = (toMin(added.endTimeOverrideHHMM!) - toMin(start) + 1440) % 1440;
    expect(diff).toBe(12 * 60);
  });
});

