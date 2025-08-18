import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';

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
  shift: Shift;
}

const _clock = hhmmNowLocal();
export const STATE: AppState = {
  dateISO: toDateISO(new Date()),
  locked: true,
  clockHHMM: _clock,
  shift: deriveShift(_clock),
};

export function initState() {
  STATE.dateISO = toDateISO(new Date());
  STATE.locked = true;
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
}

let CONFIG_CACHE: Config = {
  dateISO: STATE.dateISO,
  anchors: { day: '07:00', night: '19:00' },
  zones: [],
  pin: '4911',
  relockMin: 0,
};

export function getConfig(): Config {
  return CONFIG_CACHE;
}

export async function loadConfig(): Promise<Config> {
  const existing = await DB.get<Config>(KS.CONFIG);
  if (existing) CONFIG_CACHE = existing;
  return CONFIG_CACHE;
}

export async function saveConfig(partial: Partial<Config>): Promise<Config> {
  const updated: Config = { ...CONFIG_CACHE, ...partial };
  CONFIG_CACHE = updated;
  await DB.set(KS.CONFIG, updated);
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

export { DB };
