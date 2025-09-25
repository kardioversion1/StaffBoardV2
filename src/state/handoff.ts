import {
  Handoff,
  Shift,
  loadActiveHandoff,
  saveActiveHandoff,
  loadShifts,
  saveShifts,
} from '@/types/shifts';
import { generateShiftCode, nextShiftWindow, ShiftSchedule } from '@/utils/shiftCodes';

export type HandoffState = {
  active?: Handoff | undefined;
  begin(): Promise<void>;
  saveUpdates(patch: Partial<Handoff['updates']>): Promise<void>;
  startInPerson(seconds: number): Promise<void>;
  createNextShift(overlapMinutes?: number): Promise<Shift>;
  endOverlap(): Promise<void>;
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
    active: undefined,
    async begin() {
      const h = createEmptyHandoff();
      this.active = h;
      await saveActiveHandoff(h);
    },
    async saveUpdates(patch) {
      if (!this.active) return;
      this.active.updates = { ...this.active.updates, ...patch };
      await saveActiveHandoff(this.active);
    },
    async startInPerson(seconds) {
      if (!this.active) return;
      this.active.inPersonSeconds = seconds;
      this.active.status = 'inPerson';
      await saveActiveHandoff(this.active);
    },
    async createNextShift(overlapMinutes = 30) {
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
      const list = await loadShifts();
      list.push(shift);
      await saveShifts(list);
      h.toShiftId = shift.id;
      h.overlapMinutes = overlapMinutes;
      h.overlapEndsAt = new Date(Date.now() + overlapMinutes * 60 * 1000).toISOString();
      h.status = 'overlap';
      this.active = h;
      await saveActiveHandoff(h);
      return shift;
    },
    async endOverlap() {
      if (!this.active) return;
      this.active.status = 'done';
      await saveActiveHandoff(this.active);
      this.active = undefined;
      await saveActiveHandoff(undefined);
    },
  },
};
let initialized = false;

export function useHandoff(): HandoffState {
  if (!initialized) {
    initialized = true;
    loadActiveHandoff().then((h) => {
      if (h) store.state.active = h;
    });
  }
  return store.state;
}
