import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import { DEFAULT_WEATHER_COORDS } from '@/config/weather';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import { normalizeZones, type ZoneDef } from '@/utils/zones';
import {
  savePublishedShift,
  indexStaffAssignments,
  getHuddle,
  type ShiftKind,
  type PublishedShiftSnapshot,
  type Assignment,
} from '@/state/history';
import type { UIThemeConfig } from '@/state/theme';

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
};

export type Config = {
  dateISO: string;
  anchors: { day: string; night: string };
  zones: ZoneDef[];
  pin: string;
  relockMin: number;
  widgets: WidgetsConfig;
  zoneColors?: Record<string, string>;
  shiftDurations?: { day: number; night: number };
  dtoMinutes?: number;
  showPinned?: { charge: boolean; triage: boolean };
  rss?: { url: string; enabled: boolean };
  privacy?: boolean;
  ui?: {
    signoutMode?: 'shiftHuddle' | 'disabled' | 'legacySignout';
    rightSidebarWidthPx?: number;
    rightSidebarMinPx?: number;
    rightSidebarMaxPx?: number;
  };
  uiTheme?: UIThemeConfig;
};

export type Staff = {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  rf?: number;
  role: 'nurse' | 'tech';
  type: NurseType;
  active?: boolean;
  notes?: string;
  prefDay?: boolean;
  prefNight?: boolean;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[];
  defaultZone?: string;
  dtoEligible?: boolean;
};

import type { Slot } from '@/slots';
export type { Slot } from '@/slots';

export interface ZoneAssignment {
  id: string;
  role: 'nurse' | 'tech';
  start?: string;
  end?: string;
}

export const CURRENT_SCHEMA_VERSION = 2;

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
  huddle: string;
  handoff: string;
  version: number;
}

export type ActiveBoard = ActiveShift;

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
};

let CONFIG_CACHE: Config = {
  dateISO: STATE.dateISO,
  anchors: { day: '07:00', night: '19:00' },
  zones: [],
  pin: '4911',
  relockMin: 0,
  widgets: structuredClone(WIDGETS_DEFAULTS),
  zoneColors: {},
  shiftDurations: { day: 12, night: 12 },
  dtoMinutes: 60,
  showPinned: { charge: true, triage: true },
  rss: { url: '', enabled: false },
  privacy: true,
  ui: {
    signoutMode: 'shiftHuddle',
    rightSidebarWidthPx: 300,
    rightSidebarMinPx: 260,
    rightSidebarMaxPx: 420,
  },
  uiTheme: {
    mode: 'system',
    scale: 1,
    lightPreset: 'fog',
    darkPreset: 'midnight',
    highContrast: false,
    compact: false,
  },
};

let ZONES_INVALID = false;
export function zonesInvalid(): boolean {
  return ZONES_INVALID;
}

export function getConfig(): Config {
  return CONFIG_CACHE;
}


export async function loadConfig(): Promise<Config> {
  try {
    const cfg = (await Server.load('config')) as Config;
    CONFIG_CACHE = cfg;
    await DB.set(KS.CONFIG, CONFIG_CACHE);
  } catch {
    const existing = await DB.get<Config>(KS.CONFIG);
    if (existing) CONFIG_CACHE = existing as Config;
  }
  return mergeConfigDefaults();
}

export async function saveConfig(partial: Partial<Config>): Promise<Config> {
  const updated: Config = { ...CONFIG_CACHE, ...partial } as Config;
  if (partial.zones) {
    updated.zones = normalizeZones(partial.zones as any);
  }
  CONFIG_CACHE = updated;
  mergeConfigDefaults();
  try {
    await Server.save('config', CONFIG_CACHE);
  } catch {}
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
  }

  cfg.anchors = {
    day:
      typeof cfg.anchors?.day === 'string' && cfg.anchors.day
        ? cfg.anchors.day
        : '07:00',
    night:
      typeof cfg.anchors?.night === 'string' && cfg.anchors.night
        ? cfg.anchors.night
        : '19:00',
  };

  cfg.zoneColors = cfg.zoneColors || {};
  ZONES_INVALID = false;
  const normalized = normalizeZones(cfg.zones as any);
  if (!Array.isArray(cfg.zones) || normalized.length !== cfg.zones.length) {
    ZONES_INVALID = true;
  }
  for (const z of normalized) {
    if (cfg.zoneColors && cfg.zoneColors[z.name]) z.color = cfg.zoneColors[z.name];
  }
  cfg.zones = normalized;
  cfg.shiftDurations = {
    day: cfg.shiftDurations?.day || 12,
    night: cfg.shiftDurations?.night || 12,
  };
  cfg.dtoMinutes = typeof cfg.dtoMinutes === 'number' ? cfg.dtoMinutes : 60;
  cfg.showPinned = {
    charge: cfg.showPinned?.charge !== false,
    triage: cfg.showPinned?.triage !== false,
  };
  cfg.rss = {
    url: cfg.rss?.url || '',
    enabled: cfg.rss?.enabled === true,
  };
  cfg.privacy = cfg.privacy !== false;

  cfg.ui = {
    signoutMode: cfg.ui?.signoutMode || 'shiftHuddle',
    rightSidebarWidthPx:
      typeof cfg.ui?.rightSidebarWidthPx === 'number'
        ? cfg.ui.rightSidebarWidthPx
        : 300,
    rightSidebarMinPx: cfg.ui?.rightSidebarMinPx || 260,
    rightSidebarMaxPx: cfg.ui?.rightSidebarMaxPx || 420,
  };

  cfg.uiTheme = {
    mode: cfg.uiTheme?.mode || 'system',
    scale: cfg.uiTheme?.scale ?? 1,
    lightPreset: cfg.uiTheme?.lightPreset || 'fog',
    darkPreset: cfg.uiTheme?.darkPreset || 'midnight',
    highContrast: cfg.uiTheme?.highContrast === true,
    compact: cfg.uiTheme?.compact === true,
  };

  CONFIG_CACHE = cfg as Config;
  return CONFIG_CACHE;
}

export function migrateActiveBoard(raw: any): ActiveBoard {
  const zones = raw?.zones && typeof raw.zones === 'object' ? raw.zones : {};
  return {
    dateISO: raw?.dateISO ?? toDateISO(new Date()),
    shift: raw?.shift === 'night' ? 'night' : 'day',
    charge: raw?.charge ?? undefined,
    triage: raw?.triage ?? undefined,
    admin: raw?.admin ?? undefined,
    zones: Object.fromEntries(
      Object.entries(zones).map(([k, v]) => [k, Array.isArray(v) ? v : []])
    ),
    incoming: Array.isArray(raw?.incoming)
      ? raw.incoming.filter((i: any) => typeof i?.nurseId === 'string')
      : [],
    offgoing: Array.isArray(raw?.offgoing)
      ? raw.offgoing.filter(
          (o: any) => typeof o?.nurseId === 'string' && typeof o?.ts === 'number'
        )
      : [],
    comments: typeof raw?.comments === 'string' ? raw.comments : '',
    huddle: typeof raw?.huddle === 'string' ? raw.huddle : '',
    handoff: typeof raw?.handoff === 'string' ? raw.handoff : '',
    version: CURRENT_SCHEMA_VERSION,
  };
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
  try {
    const remote = (await Server.load('roster')) as Staff[];
    await DB.set(KS.STAFF, remote);
  } catch {}
  const list = (await DB.get<Staff[]>(KS.STAFF)) || [];
  let changed = false;
  const normalized = list.map((s) => {
    ensureRole(s);
    const id = ensureStaffId(s.id);
    const rawType = (s as any).type;
    const type = (canonNurseType(rawType) || rawType || 'home') as NurseType;
    if (id !== s.id) changed = true;
    return { ...s, id, type } as Staff;
  });
  if (changed) await DB.set(KS.STAFF, normalized);
  return normalized;
}

export async function saveStaff(list: Staff[]): Promise<void> {
  try {
    await Server.save('roster', list);
  } catch {}
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

  // Build and persist a published snapshot for history.
  const staff = await loadStaff();
  const staffMap: Record<string, Staff> = Object.fromEntries(
    staff.map((s) => [s.id, s])
  );
  const assignments: Assignment[] = [];
  for (const [zone, slots] of Object.entries(draft.zones)) {
    for (const slot of slots) {
      const info = staffMap[slot.nurseId];
      const now = new Date().toISOString();
      assignments.push({
        staffId: slot.nurseId,
        displayName: info?.name || slot.nurseId,
        role: info?.role || 'nurse',
        zone,
        startISO: now,
        endISO: now,
        dto: slot.dto
          ? { effectiveISO: now, offgoingUntilISO: now }
          : undefined,
      });
    }
  }

  const now = new Date().toISOString();
  if (draft.charge?.nurseId) {
    const info = staffMap[draft.charge.nurseId];
    assignments.push({
      staffId: draft.charge.nurseId,
      displayName: info?.name || draft.charge.nurseId,
      role: info?.role || 'nurse',
      zone: 'Charge',
      startISO: now,
      endISO: now,
    });
  }
  if (draft.triage?.nurseId) {
    const info = staffMap[draft.triage.nurseId];
    assignments.push({
      staffId: draft.triage.nurseId,
      displayName: info?.name || draft.triage.nurseId,
      role: info?.role || 'nurse',
      zone: 'Triage',
      startISO: now,
      endISO: now,
    });
  }
  if (draft.admin?.nurseId) {
    const info = staffMap[draft.admin.nurseId];
    assignments.push({
      staffId: draft.admin.nurseId,
      displayName: info?.name || draft.admin.nurseId,
      role: info?.role || 'nurse',
      zone: 'Secretary',
      startISO: now,
      endISO: now,
    });
  }
  const huddle = await getHuddle(dateISO, shift as ShiftKind);
  const snapshot: PublishedShiftSnapshot = {
    version: 1,
    dateISO,
    shift: shift as ShiftKind,
    publishedAtISO: new Date().toISOString(),
    publishedBy: 'unknown',
    charge: draft.charge?.nurseId,
    triage: draft.triage?.nurseId,
    admin: draft.admin?.nurseId,
    zoneAssignments: assignments,
    incoming: draft.incoming.map((i) => i.nurseId),
    offgoing: draft.offgoing.map((o) => o.nurseId),
    comments: '',
    huddle: huddle,
    audit: {
      createdAtISO: new Date().toISOString(),
      createdBy: 'unknown',
    },
  };
  await savePublishedShift(snapshot);
  await indexStaffAssignments(snapshot);
}

export { DB };
