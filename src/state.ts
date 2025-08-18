import { Shift, hhmmNowLocal, toDateISO } from "./utils/time";
import { get, set } from "./db";

export type Config = {
  dateISO: string;
  anchors: { day: string; night: string };
  zones: string[];
  pin: string;
  relockMin: number;
};

export type Staff = {
  id: string;
  name: string;
  rf?: string;
  class: "jewish" | "travel" | "float" | "other";
};

import type { Slot } from "./slots";
export type { Slot } from "./slots";

export interface ActiveShift {
  dateISO: string;
  shift: Shift;
  charge?: Slot;
  triage?: Slot;
  zones: Record<string, Slot[]>;
  incoming: { nurseId: string; eta: string; arrived?: boolean }[];
  offgoing: { nurseId: string; ts: number }[];
  support: { techs: string[]; vols: string[]; sitters: string[] };
  comments: string;
}

export type PendingShift = Omit<ActiveShift, "comments">;

export interface AppState {
  dateISO: string;
  locked: boolean;
  clockHHMM: string;
}

export const STATE: AppState = {
  dateISO: toDateISO(new Date()),
  locked: true,
  clockHHMM: hhmmNowLocal(),
};

export function initState() {
  STATE.dateISO = toDateISO(new Date());
  STATE.locked = true;
  STATE.clockHHMM = hhmmNowLocal();
}

export async function saveConfig(partial: Partial<Config>): Promise<Config> {
  const existing: Config =
    (await get<Config>(KS.CONFIG)) ||
    ({
      dateISO: STATE.dateISO,
      anchors: { day: "07:00", night: "19:00" },
      zones: [],
      pin: "4911",
      relockMin: 0,
    } as Config);
  const updated: Config = { ...existing, ...partial };
  await set(KS.CONFIG, updated);
  return updated;
}

export const KS = {
  CONFIG: "CONFIG",
  STAFF: "STAFF",
  HISTORY: "HISTORY",
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  PENDING: (dateISO: string, shift: Shift) => `PENDING:${dateISO}:${shift}`,
} as const;
