
export type Slot = {
  nurseId: string;
  student?: string | boolean;
  comment?: string;
  bad?: boolean;
  break?: {
    active: boolean;
    startISO?: string;
    plannedEndHHMM?: string;
    relievedBy?: { id?: string; rf?: string; name?: string };
  };
  endTimeOverrideHHMM?: string;
  dto?: boolean;
};

export interface Board {
  charge?: Slot;
  triage?: Slot;
  admin?: Slot;
  zones: Record<string, Slot[]>;
}

type SlotTarget = "charge" | "triage" | "admin" | { zone: string; index?: number };

export function ensureUniqueAssignment(board: Board, nurseId: string): void {
  if (board.charge?.nurseId === nurseId) board.charge = undefined;
  if (board.triage?.nurseId === nurseId) board.triage = undefined;
  if (board.admin?.nurseId === nurseId) board.admin = undefined;
  for (const zone of Object.keys(board.zones)) {
    board.zones[zone] = board.zones[zone].filter((s) => s.nurseId !== nurseId);
  }
}

export function upsertSlot(board: Board, target: SlotTarget, slot: Slot): void {
  ensureUniqueAssignment(board, slot.nurseId);
  if (target === "charge") {
    board.charge = slot;
  } else if (target === "triage") {
    board.triage = slot;
  } else if (target === "admin") {
    board.admin = slot;
  } else {
    const arr = board.zones[target.zone] || (board.zones[target.zone] = []);
    if (target.index === undefined || target.index >= arr.length) {
      arr.push(slot);
    } else {
      arr.splice(target.index, 0, slot);
    }
  }
}

export function removeSlot(
  board: Board,
  target: "charge" | "triage" | "admin" | { zone: string; index: number }
): void {
  if (target === "charge") board.charge = undefined;
  else if (target === "triage") board.triage = undefined;
  else if (target === "admin") board.admin = undefined;
  else {
    const arr = board.zones[target.zone];
    if (arr) arr.splice(target.index, 1);
  }
}

export function moveSlot(
  board: Board,
  from: "charge" | "triage" | "admin" | { zone: string; index: number },
  to: SlotTarget
): void {
  let slot: Slot | undefined;
  if (from === "charge") {
    slot = board.charge;
    board.charge = undefined;
  } else if (from === "triage") {
    slot = board.triage;
    board.triage = undefined;
  } else if (from === "admin") {
    slot = board.admin;
    board.admin = undefined;
  } else {
    slot = board.zones[from.zone]?.splice(from.index, 1)[0];
  }
  if (slot) upsertSlot(board, to, slot);
}

export function startBreak(
  slot: Slot,
  relievedBy: { id?: string; rf?: string; name?: string },
  plannedEndHHMM?: string,
  nowISO: string = new Date().toISOString()
): void {
  slot.break = {
    active: true,
    startISO: nowISO,
    plannedEndHHMM,
    relievedBy,
  };
}

export function endBreak(slot: Slot): void {
  if (slot.break) slot.break.active = false;
}

export function coveringDisplay(slot: Slot): string | undefined {
  if (!slot.break?.active) return undefined;
  const rb = slot.break.relievedBy;
  return rb?.rf || rb?.id || rb?.name;
}

