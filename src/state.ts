import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import { DEFAULT_WEATHER_COORDS } from '@/config/weather';

export type WidgetsConfig = {
  show?: boolean;
  weather: {
    mode: 'manual' | 'openweather';
    units: 'F' | 'C';
    city?: string;
    lat?: number;
    lon?: number;
    apiKey?: string;
    current?: {
      temp: number;
      condition: string;
      icon?: 'sun' | 'cloud' | 'rain' | 'storm' | 'snow' | 'mist';
      location?: string;
      updatedISO?: string;
    };
  };
  headlines: {
    internal: string;
    external: string;
  };
};

export type Config = {
  dateISO: string;
  anchors: { day: string; night: string };
  zones: string[];
  pin: string;
  relockMin: number;
  widgets: WidgetsConfig;
};

export type Staff = {
  id: string;
  name: string;
  rf?: string;
  type: 'home' | 'travel' | 'float' | 'charge' | 'triage' | 'other';
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

const WIDGETS_DEFAULTS: WidgetsConfig = {
  show: true,
  weather: {
    mode: 'manual',
    units: 'F',
    lat: DEFAULT_WEATHER_COORDS.lat,
    lon: DEFAULT_WEATHER_COORDS.lon,
  },
  headlines: {
    internal: 'Congrats to RN Katie for Daisy Award',
    external: 'I-65 S Shutdown for repair',
  },
};

let CONFIG_CACHE: Config = {
  dateISO: STATE.dateISO,
  anchors: { day: '07:00', night: '19:00' },
  zones: [],
  pin: '4911',
  relockMin: 0,
  widgets: structuredClone(WIDGETS_DEFAULTS),
};

export function getConfig(): Config {
  return CONFIG_CACHE;
}

export async function loadConfig(): Promise<Config> {
  const existing = await DB.get<Config>(KS.CONFIG);
  if (existing) CONFIG_CACHE = existing as Config;
  return mergeConfigDefaults();
}

export async function saveConfig(partial: Partial<Config>): Promise<Config> {
  const updated: Config = { ...CONFIG_CACHE, ...partial } as Config;
  CONFIG_CACHE = updated;
  mergeConfigDefaults();
  await DB.set(KS.CONFIG, CONFIG_CACHE);
  return CONFIG_CACHE;
}

export function mergeConfigDefaults(): Config {
  const cfg: any = CONFIG_CACHE;
  if (!cfg.widgets) cfg.widgets = structuredClone(WIDGETS_DEFAULTS);
  else {
    cfg.widgets.show = cfg.widgets.show === false ? false : true;
    cfg.widgets.weather = {
      ...WIDGETS_DEFAULTS.weather,
      ...cfg.widgets.weather,
      current: cfg.widgets.weather.current ? { ...cfg.widgets.weather.current } : undefined,
    };
    cfg.widgets.headlines = {
      ...WIDGETS_DEFAULTS.headlines,
      ...cfg.widgets.headlines,
    };
  }
  CONFIG_CACHE = cfg as Config;
  return CONFIG_CACHE;
}

export const KS = {
  CONFIG: "CONFIG",
  STAFF: "STAFF",
  HISTORY: "HISTORY",
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  PENDING: (dateISO: string, shift: Shift) => `PENDING:${dateISO}:${shift}`,
} as const;

export async function importHistoryFromJSON(json: string): Promise<PendingShift[]> {
  const data = JSON.parse(json) as PendingShift[];
  await DB.set(KS.HISTORY, data);
  return data;
}

export { DB };
