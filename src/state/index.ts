import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import { DEFAULT_WEATHER_COORDS } from '@/config/weather';
import { canonNurseType, type NurseType } from '@/domain/lexicon';

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
  theme?: 'light' | 'dark';
  fontScale?: number;
  highContrast?: boolean;
};

export type Staff = {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  rf?: number;
  role?: 'rn' | 'tech' | 'sitter' | 'ancillary' | 'admin';
  type: NurseType;
  active?: boolean;
  notes?: string;
  prefDay?: boolean;
  prefNight?: boolean;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[];
  defaultZone?: string;
  dtoEligible?: boolean;
};

import type { Slot } from "./slots";
export type { Slot } from "./slots";

export interface ActiveShift {
  dateISO: string;
  shift: Shift;
  charge?: Slot;
  triage?: Slot;
  admin?: Slot;
  zones: Record<string, Slot[]>;
  incoming: { nurseId: string; eta: string; arrived?: boolean }[];
  offgoing: { nurseId: string; ts: number }[];
  comments: string;
}

export type DraftShift = Omit<ActiveShift, 'comments'>;

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
  theme: 'dark',
  fontScale: 1,
  highContrast: false,
};

export function getConfig(): Config {
  return CONFIG_CACHE;
}

export function applyThemeAndScale(cfg: Config = CONFIG_CACHE) {
  const root = document.documentElement;
  root.setAttribute('data-theme', cfg.theme === 'light' ? 'light' : 'dark');
  root.style.setProperty('--scale', String(cfg.fontScale ?? 1));
  root.setAttribute('data-contrast', cfg.highContrast ? 'high' : 'normal');
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
  const cfg = { ...CONFIG_CACHE } as Config & { widgets?: WidgetsConfig | undefined };

  if (!cfg.widgets) {
    cfg.widgets = structuredClone(WIDGETS_DEFAULTS);
  } else {
    cfg.widgets.show = cfg.widgets.show === false ? false : true;
    cfg.widgets.weather = {
      ...WIDGETS_DEFAULTS.weather,
      ...cfg.widgets.weather,
      current: cfg.widgets.weather.current
        ? { ...cfg.widgets.weather.current }
        : undefined,
    };
    cfg.widgets.headlines = {
      ...WIDGETS_DEFAULTS.headlines,
      ...cfg.widgets.headlines,
    };
  }

  cfg.theme = cfg.theme === 'light' ? 'light' : 'dark';
  cfg.fontScale = cfg.fontScale && !isNaN(cfg.fontScale) ? cfg.fontScale : 1;
  cfg.highContrast = cfg.highContrast === true;

  CONFIG_CACHE = cfg as Config;
  return CONFIG_CACHE;
}

export const KS = {
  CONFIG: "CONFIG",
  STAFF: "STAFF",
  HISTORY: "HISTORY",
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  ONBAT: (dateISO: string, shift: Shift) => `ONBAT:${dateISO}:${shift}`,
  DRAFT: (dateISO: string, shift: Shift) => `DRAFT:${dateISO}:${shift}`,
} as const;

export async function loadStaff(): Promise<Staff[]> {
  const list = (await DB.get<Staff[]>(KS.STAFF)) || [];
  return list.map((s) => ({
    ...s,
    role: ['tech', 'sitter', 'ancillary', 'admin'].includes((s as any).role)
      ? ((s as any).role as Staff['role'])
      : 'rn',
    type: (canonNurseType((s as any).type) || (s as any).type) as NurseType,
  }));
}

export async function saveStaff(list: Staff[]): Promise<void> {
  await DB.set(KS.STAFF, list);
}

export async function importHistoryFromJSON(json: string): Promise<DraftShift[]> {
  const data = JSON.parse(json) as DraftShift[];
  await DB.set(KS.HISTORY, data);
  return data;
}

export async function applyDraftToActive(
  dateISO: string,
  shift: Shift
): Promise<void> {
  const draft = await DB.get<DraftShift>(KS.DRAFT(dateISO, shift));
  if (!draft) return;
  await DB.set(KS.ACTIVE(dateISO, shift), draft);
  await DB.del(KS.DRAFT(dateISO, shift));
}

export { DB };
