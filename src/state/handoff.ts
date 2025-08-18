import { Handoff, Shift, loadActiveHandoff, saveActiveHandoff, loadShifts, saveShifts } from '@/types/shifts';
import { generateShiftCode, nextShiftWindow, ShiftSchedule } from '@/utils/shiftCodes';

export type HandoffState = {
  active?: Handoff;
  begin(): void;
  saveUpdates(patch: Partial<Handoff['updates']>): void;
  startInPerson(seconds: number): void;
  createNextShift(overlapMinutes?: number): Shift;
  endOverlap(): void;
};

const defaultSched: ShiftSchedule = { dayStart: '07:00', nightStart: '19:00' };

function createEmptyHandoff(): Handoff {
  return {
    id: String(Date.now()),
    fromShiftId: '',
    toShiftId: null,
    startedAt: new Date().toISOString(),
    updates: {},
    inPersonSeconds: 600,
    overlapMinutes: 30,
    status: 'draft',
  };
}

const store: { state: HandoffState } = {
  state: {
    active: loadActiveHandoff(),
    begin() {
      const h = createEmptyHandoff();
      this.active = h;
      saveActiveHandoff(h);
    },
    saveUpdates(patch) {
      if (!this.active) return;
      this.active.updates = { ...this.active.updates, ...patch };
      saveActiveHandoff(this.active);
    },
    startInPerson(seconds) {
      if (!this.active) return;
      this.active.inPersonSeconds = seconds;
      this.active.status = 'inPerson';
      saveActiveHandoff(this.active);
    },
    createNextShift(overlapMinutes = 30) {
      const h = this.active || createEmptyHandoff();
      const { startAt, endAt } = nextShiftWindow(new Date(), defaultSched);
      const code = generateShiftCode(new Date(startAt), defaultSched);
      const shift: Shift = {
        id: String(Date.now()),
        code,
        dateISO: startAt.slice(0, 10),
        startAt,
        endAt,
        assignments: [],
        status: 'draft',
      };
      const list = loadShifts();
      list.push(shift);
      saveShifts(list);
      h.toShiftId = shift.id;
      h.overlapMinutes = overlapMinutes;
      h.overlapEndsAt = new Date(Date.now() + overlapMinutes * 60 * 1000).toISOString();
      h.status = 'overlap';
      this.active = h;
      saveActiveHandoff(h);
      return shift;
    },
    endOverlap() {
      if (!this.active) return;
      this.active.status = 'done';
      saveActiveHandoff(this.active);
      this.active = undefined;
      saveActiveHandoff(undefined);
    },
  },
};

export function useHandoff(): HandoffState {
  return store.state;
}
