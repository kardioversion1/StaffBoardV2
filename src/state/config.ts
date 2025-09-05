import * as DB from '@/db';
import { DEFAULT_WEATHER_COORDS } from '@/config/weather';
import { normalizeZones, type ZoneDef } from '@/utils/zones';
import type { UIThemeConfig } from '@/state/theme';
import { THEME_PRESETS } from '@/state/theme';
import * as Server from '@/server';
import { KS } from './keys';
import { STATE } from './board';

export type WidgetsConfig = {
  show?: boolean;
  weather: {
    mode: 'manual' | 'meteomatics';
    units: 'F' | 'C';
    lat?: number;
    lon?: number;
    params?: string;
    step?: string;
    hoursBack?: number;
    hoursFwd?: number;
    model?: string;
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

export const WIDGETS_DEFAULTS: WidgetsConfig = {
  show: true,
  weather: {
    mode: 'manual',
    units: 'F',
    lat: DEFAULT_WEATHER_COORDS.lat,
    lon: DEFAULT_WEATHER_COORDS.lon,
    params: 't_2m:C,relative_humidity_2m:p,t_wet_bulb_globe:F,prob_precip_1h:p',
    step: 'PT1H',
    hoursBack: 0,
    hoursFwd: 24,
    model: 'mix',
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
  },
};

let ZONES_INVALID = false;
/** Whether the configured zones failed to normalize */
export function zonesInvalid(): boolean {
  return ZONES_INVALID;
}

/** Get the in-memory configuration */
export function getConfig(): Config {
  return CONFIG_CACHE;
}

/** Load configuration from server or local DB */
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

/** Persist configuration changes */
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

/** Apply defaults and clean up configuration */
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
      current: cfg.widgets.weather?.current
        ? { ...cfg.widgets.weather.current }
        : undefined,
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
    const normalized = normalizeZones((cfg.zones as any) ?? []);
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

  // Theme defaults
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
  };

  // Misc
  cfg.pin = cfg.pin || '4911';
  cfg.relockMin = typeof cfg.relockMin === 'number' ? cfg.relockMin : 0;
  cfg.dateISO = cfg.dateISO || STATE.dateISO;

  CONFIG_CACHE = cfg as Config;
  return CONFIG_CACHE;
}
