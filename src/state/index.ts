// state/index.ts (merged & cleaned)

import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import * as Server from '@/server';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import { normalizeZones, type ZoneDef } from '@/utils/zones';
import { DEFAULT_WEATHER_COORDS } from '@/config/weather';
import {
  savePublishedShift,
  indexStaffAssignments,
  getHuddle,
  type ShiftKind,
  type PublishedShiftSnapshot,
  type Assignment,
} from '@/state/history';
import type { UIThemeConfig } from '@/state/theme';
import { THEME_PRESETS } from '@/state/theme';

export type WidgetsConfig = {
  show?: boolean;
  weather: {
    units: 'F' | 'C';
    lat?: number;
    lon?: number;
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
  physicians?: { calendarUrl: string };
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

import { ensureUniqueAssignment, type Slot } from '@/slots';
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
  endAtISO?: string;
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
  locked: false,
  clockHHMM: _clock,
  shift: deriveShift(_clock),
};

export function initState() {
  STATE.dateISO = toDateISO(new Date());
  STATE.locked = false;
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
}

const ACTIVE_BOARD_CACHE: Record<string, ActiveBoard> = {};
export function setActiveBoardCache(board: ActiveBoard): void {
  ACTIVE_BOARD_CACHE[KS.ACTIVE(board.dateISO, board.shift)] = board;
}
export function getActiveBoardCache(
  dateISO: string,
  shift: Shift
): ActiveBoard | undefined {
  return ACTIVE_BOARD_CACHE[KS.ACTIVE(dateISO, shift)];
}

/** Merge a local board into the remote one without overwriting remote edits. */
export function mergeBoards(remote: ActiveBoard, local: ActiveBoard): ActiveBoard {
  const merged: ActiveBoard = { ...remote, zones: { ...remote.zones } };

  merged.comments = remote.comments || local.comments;
  merged.huddle = remote.huddle || local.huddle;
  merged.handoff = remote.handoff || local.handoff;

  const mergeArr = <T extends Record<string, unknown>>(
    a: T[],
    b: T[],
    key: (item: T) => string
  ): T[] => {
    const map = new Map<string, T>();
    // Insert remote items first so their order is preserved when merging.
    for (const item of a) {
      map.set(key(item), item);
    }
    for (const item of b) {
      const k = key(item);
      const existing = map.get(k);
      map.set(k, existing ? { ...existing, ...item } : item);
    }
    return Array.from(map.values());
  };

  merged.incoming = mergeArr(
    remote.incoming,
    local.incoming,
    (i) => `${i.nurseId}|${i.eta}`
  );
  merged.offgoing = mergeArr(
    remote.offgoing,
    local.offgoing,
    (o) => `${o.nurseId}|${o.ts}`
  );

  if (local.charge) {
    ensureUniqueAssignment(merged, local.charge.nurseId);
    merged.charge = local.charge;
  }
  if (local.triage) {
    ensureUniqueAssignment(merged, local.triage.nurseId);
    merged.triage = local.triage;
  }
  if (local.admin) {
    ensureUniqueAssignment(merged, local.admin.nurseId);
    merged.admin = local.admin;
  }

  for (const [zone, slots] of Object.entries(local.zones)) {
    for (const slot of slots) {
      ensureUniqueAssignment(merged, slot.nurseId);
      const arr = merged.zones[zone] || (merged.zones[zone] = []);
      arr.push(slot);
    }
  }

  return merged;
}

// ------- Config defaults / loaders (single-source implementation) -------

export const WIDGETS_DEFAULTS: WidgetsConfig = {
  show: true,
  weather: {
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
  physicians: { calendarUrl: '' },
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
    lightPreset: 'light-soft-gray',
    darkPreset: 'dark-charcoal-navy',
    highContrast: false,
    compact: false,
    iconSize: 1,
    commentSize: 0.85,
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
    const cfg = await Server.load('config');
    CONFIG_CACHE = cfg;
    await DB.set(KS.CONFIG, CONFIG_CACHE);
  } catch {
    const existing = await DB.get<Config>(KS.CONFIG);
    if (existing) CONFIG_CACHE = existing as Config;
  }
  return mergeConfigDefaults();
}

export async function saveConfig(
  partial: Partial<Omit<Config, 'zones'>> & { zones?: Array<string | Partial<ZoneDef>> }
): Promise<Config> {
  const updated: Config = { ...CONFIG_CACHE, ...partial } as Config;
  if (partial.zones) {
    updated.zones = normalizeZones(partial.zones);
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

  // Widgets defaults
  if (!cfg.widgets) {
    cfg.widgets = structuredClone(WIDGETS_DEFAULTS);
  } else {
    cfg.widgets.show = cfg.widgets.show === false ? false : true;
    cfg.widgets.weather = {
      ...WIDGETS_DEFAULTS.weather,
      ...(cfg.widgets.weather || {}),
    };
  }

  // Anchors: ensure HH:MM format with safe fallback
  const safeTime = (s: unknown, fallback: string) =>
    typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) ? s : fallback;

  cfg.anchors = {
    day: safeTime(cfg.anchors?.day, '07:00'),
    night: safeTime(cfg.anchors?.night, '19:00'),
  };

  // Zone colors map
  cfg.zoneColors = cfg.zoneColors || {};

  // Normalize zones & flag validity
  try {
    const normalized = normalizeZones(cfg.zones ?? []);
    // Apply color overrides
    for (const z of normalized) {
      if (cfg.zoneColors && cfg.zoneColors[z.name]) z.color = cfg.zoneColors[z.name];
    }
    cfg.zones = normalized;
    ZONES_INVALID = false;
  } catch {
    cfg.zones = [];
    ZONES_INVALID = true;
  }

  // Shift durations
  cfg.shiftDurations = {
    day: typeof cfg.shiftDurations?.day === 'number' ? cfg.shiftDurations.day : 12,
    night: typeof cfg.shiftDurations?.night === 'number' ? cfg.shiftDurations.night : 12,
  };

  // DTO minutes
  cfg.dtoMinutes = typeof cfg.dtoMinutes === 'number' ? cfg.dtoMinutes : 60;

  // Pinned roles visibility
  cfg.showPinned = {
    charge: cfg.showPinned?.charge !== false,
    triage: cfg.showPinned?.triage !== false,
  };

  // RSS
  cfg.rss = {
    url: cfg.rss?.url || '',
    enabled: cfg.rss?.enabled === true,
  };

  // Physicians calendar
  cfg.physicians = {
    calendarUrl: cfg.physicians?.calendarUrl || '',
  };

  // Privacy (default true)
  cfg.privacy = cfg.privacy !== false;

  // UI layout
  cfg.ui = {
    signoutMode: cfg.ui?.signoutMode || 'shiftHuddle',
    rightSidebarWidthPx:
      typeof cfg.ui?.rightSidebarWidthPx === 'number' ? cfg.ui.rightSidebarWidthPx : 300,
    rightSidebarMinPx:
      typeof cfg.ui?.rightSidebarMinPx === 'number' ? cfg.ui.rightSidebarMinPx : 260,
    rightSidebarMaxPx:
      typeof cfg.ui?.rightSidebarMaxPx === 'number' ? cfg.ui.rightSidebarMaxPx : 420,
  };

  // Theme defaults (validate against preset catalog)
  const lightDefault = 'light-soft-gray';
  const darkDefault = 'dark-charcoal-navy';
  const light = cfg.uiTheme?.lightPreset;
  const dark = cfg.uiTheme?.darkPreset;
  const validLight = THEME_PRESETS.some((p) => p.id === light && p.mode === 'light');
  const validDark = THEME_PRESETS.some((p) => p.id === dark && p.mode === 'dark');
  cfg.uiTheme = {
    mode: cfg.uiTheme?.mode || 'system',
    scale: cfg.uiTheme?.scale ?? 1,
    lightPreset: validLight ? (light as string) : lightDefault,
    darkPreset: validDark ? (dark as string) : darkDefault,
    highContrast: cfg.uiTheme?.highContrast === true,
    compact: cfg.uiTheme?.compact === true,
    iconSize: typeof cfg.uiTheme?.iconSize === 'number' ? cfg.uiTheme.iconSize : 1,
    commentSize:
      typeof cfg.uiTheme?.commentSize === 'number' ? cfg.uiTheme.commentSize : 0.85,
  };

  // Misc
  cfg.pin = cfg.pin || '4911';
  cfg.relockMin = typeof cfg.relockMin === 'number' ? cfg.relockMin : 0;
  cfg.dateISO = cfg.dateISO || STATE.dateISO;

  CONFIG_CACHE = cfg as Config;
  return CONFIG_CACHE;
}

// ------- Active board migration -------

export function migrateActiveBoard(raw: unknown): ActiveBoard {
  const r = raw as Partial<ActiveBoard> | undefined;
  const zones = r?.zones && typeof r.zones === 'object' ? r.zones : {};
  return {
    dateISO: r?.dateISO ?? toDateISO(new Date()),
    shift: r?.shift === 'night' ? 'night' : 'day',
    endAtISO:
      typeof r?.endAtISO === 'string'
        ? r.endAtISO
        : (() => {
            const startHH = r?.shift === 'night' ? '19:00' : '07:00';
            const d = new Date(`${r?.dateISO ?? toDateISO(new Date())}T${startHH}`);
            d.setHours(d.getHours() + 12);
            return d.toISOString();
          })(),
    charge: r?.charge ?? undefined,
    triage: r?.triage ?? undefined,
    admin: r?.admin ?? undefined,
    zones: Object.fromEntries(
      Object.entries(zones).map(([k, v]) => [k, Array.isArray(v) ? (v as Slot[]) : []])
    ),
    incoming: Array.isArray(r?.incoming)
      ? r.incoming.filter(
          (i): i is ActiveBoard['incoming'][number] =>
            typeof i?.nurseId === 'string'
        )
      : [],
    offgoing: Array.isArray(r?.offgoing)
      ? r.offgoing.filter(
          (o): o is ActiveBoard['offgoing'][number] =>
            typeof o?.nurseId === 'string' && typeof o?.ts === 'number'
        )
      : [],
    comments: typeof r?.comments === 'string' ? r.comments : '',
    huddle: typeof r?.huddle === 'string' ? r.huddle : '',
    handoff: typeof r?.handoff === 'string' ? r.handoff : '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

// ------- Keyspace -------

export const KS = {
  CONFIG: 'CONFIG',
  STAFF: 'STAFF',
  HISTORY: 'HISTORY',
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  ONBAT: (dateISO: string, shift: Shift) => `ONBAT:${dateISO}:${shift}`,
  DRAFT: (dateISO: string, shift: Shift) => `DRAFT:${dateISO}:${shift}`,
} as const;

// ------- Staff load/save -------

export async function loadStaff(): Promise<Staff[]> {
  try {
    const remote = await Server.load('roster');
    await DB.set(KS.STAFF, remote);
  } catch {}
  const list = (await DB.get<Staff[]>(KS.STAFF)) || [];
  let changed = false;
  const normalized = list.map((s) => {
    ensureRole(s);
    const id = ensureStaffId(s.id);
    const rawType = (s as { type?: string | null }).type;
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

// ------- History import / apply draft -------

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
      const start = new Date();
      const startISO = start.toISOString();
      const endISO = new Date(start.getTime() + 12 * 60 * 60 * 1000).toISOString();
      assignments.push({
        staffId: slot.nurseId,
        displayName: info?.name || slot.nurseId,
        role: info?.role || 'nurse',
        zone,
        startISO,
        endISO,
        dto: slot.dto
          ? { effectiveISO: startISO, offgoingUntilISO: startISO }
          : undefined,
      });
    }
  }

  const baseStart = new Date();
  const baseStartISO = baseStart.toISOString();
  const baseEndISO = new Date(baseStart.getTime() + 12 * 60 * 60 * 1000).toISOString();
  if (draft.charge?.nurseId) {
    const info = staffMap[draft.charge.nurseId];
    assignments.push({
      staffId: draft.charge.nurseId,
      displayName: info?.name || draft.charge.nurseId,
      role: info?.role || 'nurse',
      zone: 'Charge',
      startISO: baseStartISO,
      endISO: baseEndISO,
    });
  }
  if (draft.triage?.nurseId) {
    const info = staffMap[draft.triage.nurseId];
    assignments.push({
      staffId: draft.triage.nurseId,
      displayName: info?.name || draft.triage.nurseId,
      role: info?.role || 'nurse',
      zone: 'Triage',
      startISO: baseStartISO,
      endISO: baseEndISO,
    });
  }
  if (draft.admin?.nurseId) {
    const info = staffMap[draft.admin.nurseId];
    assignments.push({
      staffId: draft.admin.nurseId,
      displayName: info?.name || draft.admin.nurseId,
      role: info?.role || 'nurse',
      zone: 'Secretary',
      startISO: baseStartISO,
      endISO: baseEndISO,
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

  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event('history-saved'));
  }
}

export { DB };
