
export type Slot = {
  nurseId: string;
  /** Optional scheduled start time in HH:MM */
  startHHMM?: string | undefined;
  student?: string | boolean | undefined;
  comment?: string | undefined;
  highAcuityUntil?: number | undefined;
  break?: {
    active: boolean;
    startISO?: string | undefined;
    plannedEndHHMM?: string | undefined;
    relievedBy?: { id?: string; rf?: string; name?: string } | undefined;
  } | undefined;
  endTimeOverrideHHMM?: string | undefined;
  dto?: boolean | undefined;
  assignedTs?: number | undefined;
};

export interface Board {
  charge?: Slot | undefined;
  triage?: Slot | undefined;
  admin?: Slot | undefined;
  zones: Record<string, Slot[]>;
}

type SlotTarget = "charge" | "triage" | "admin" | { zone: string; index?: number };

/**
 * Remove any other assignments for the given nurse. Returns `true` if a
 * previously occupied slot was cleared.
 */
export function ensureUniqueAssignment(board: Board, nurseId: string): boolean {
  let removed = false;
  if (board.charge?.nurseId === nurseId) {
    board.charge = undefined;
    removed = true;
  }
  if (board.triage?.nurseId === nurseId) {
    board.triage = undefined;
    removed = true;
  }
  if (board.admin?.nurseId === nurseId) {
    board.admin = undefined;
    removed = true;
  }
  for (const zone of Object.keys(board.zones)) {
    const before = board.zones[zone].length;
    board.zones[zone] = board.zones[zone].filter((s) => s.nurseId !== nurseId);
    if (board.zones[zone].length !== before) removed = true;
  }
  return removed;
}

/**
 * Insert or move a slot, clearing any existing assignments for the nurse.
 * Returns `true` if the nurse was moved from another slot.
 */
export function upsertSlot(
  board: Board,
  target: SlotTarget,
  slot: Slot
): boolean {
  slot.assignedTs = Date.now();
  const removed = ensureUniqueAssignment(board, slot.nurseId);
  if (target === "charge") {
    board.charge = slot;
  } else if (target === "triage") {
    board.triage = slot;
  } else if (target === "admin") {
    board.admin = slot;
  } else if (typeof target === "object" && target && "zone" in target) {
    const arr = board.zones[target.zone] || (board.zones[target.zone] = []);
    if (target.index === undefined || target.index >= arr.length) {
      arr.push(slot);
    } else {
      arr.splice(target.index, 0, slot);
    }
  }
  return removed;
}

/** Remove a slot and return whether anything was removed. */
export function removeSlot(
  board: Board,
  target: "charge" | "triage" | "admin" | { zone: string; index: number }
): boolean {
  let removed = false;
  if (target === "charge") {
    if (board.charge) {
      board.charge = undefined;
      removed = true;
    }
  } else if (target === "triage") {
    if (board.triage) {
      board.triage = undefined;
      removed = true;
    }
  } else if (target === "admin") {
    if (board.admin) {
      board.admin = undefined;
      removed = true;
    }
  } else if (typeof target === "object" && target && "zone" in target && "index" in target) {
    const arr = board.zones[target.zone];
    if (arr && arr.splice(target.index, 1).length) removed = true;
  }
  return removed;
}

export function moveSlot(
  board: Board,
  from: "charge" | "triage" | "admin" | { zone: string; index: number },
  to: SlotTarget
): boolean {
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
  } else if (typeof from === "object" && from && "zone" in from && "index" in from) {
    slot = board.zones[from.zone]?.splice(from.index, 1)[0];
  }
  return slot ? upsertSlot(board, to, slot) : false;
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

