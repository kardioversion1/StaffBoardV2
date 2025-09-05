import { getConfig, saveConfig } from '.';

export type UIMode = 'system' | 'light' | 'dark';

/** Tokens used to populate CSS variables for theming. */
export interface ThemeTokens {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  ok: string;
  warn: string;
  danger: string;
  line: string;
  slot: string;
  control: string;
  tab: string;
}

/** Preset definition including its color tokens. */
export interface ThemePreset {
  id: string;
  label: string;
  mode: 'light' | 'dark';
  note?: string;
  tokens: ThemeTokens;
}

/** Persisted theme configuration. */
export interface UIThemeConfig {
  mode: UIMode;
  scale: number;
  lightPreset: string;
  darkPreset: string;
  custom?: Partial<ThemeTokens>;
  highContrast?: boolean;
  compact?: boolean;
}

/** Available light and dark presets. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'light-soft-gray',
    label: 'Soft Gray + Charcoal',
    mode: 'light',
    note: 'Fluorescent-friendly',
    tokens: {
      bg: '#F3F4F6',
      panel: '#FFFFFF',
      text: '#111827',
      muted: '#6B7280',
      accent: '#0072B2',
      ok: '#009E73',
      warn: '#E69F00',
      danger: '#D55E00',
      line: '#E5E7EB',
      slot: '#F8FAFC',
      control: '#E5E7EB',
      tab: '#E5E7EB',
    },
  },
  {
    id: 'light-warm-beige',
    label: 'Warm Beige + Charcoal',
    mode: 'light',
    note: 'Reduced glare',
    tokens: {
      bg: '#F7F3E8',
      panel: '#FFFFFF',
      text: '#2C2C2C',
      muted: '#6B6B6B',
      accent: '#8B5CF6',
      ok: '#22C55E',
      warn: '#D97706',
      danger: '#B91C1C',
      line: '#E9E5DA',
      slot: '#FAF9F6',
      control: '#E9E5DA',
      tab: '#E9E5DA',
    },
  },
  {
    id: 'light-pale-blue',
    label: 'Pale Blue + Navy',
    mode: 'light',
    note: 'My pick for TVs',
    tokens: {
      bg: '#EAF2FB',
      panel: '#FFFFFF',
      text: '#0B2545',
      muted: '#4B5563',
      accent: '#1D4ED8',
      ok: '#16A34A',
      warn: '#D97706',
      danger: '#B91C1C',
      line: '#D9E3F2',
      slot: '#F7FAFE',
      control: '#D9E3F2',
      tab: '#D9E3F2',
    },
  },
  {
    id: 'light-soft-sage',
    label: 'Soft Sage + Deep Green',
    mode: 'light',
    tokens: {
      bg: '#EEF5EF',
      panel: '#FFFFFF',
      text: '#1B4332',
      muted: '#4B6B61',
      accent: '#2E7D32',
      ok: '#22C55E',
      warn: '#CA8A04',
      danger: '#B91C1C',
      line: '#DCE8DF',
      slot: '#F6FAF7',
      control: '#DCE8DF',
      tab: '#DCE8DF',
    },
  },
  {
    id: 'light-muted-cream',
    label: 'Muted Cream + Slate',
    mode: 'light',
    tokens: {
      bg: '#FFF9E6',
      panel: '#FFFFFF',
      text: '#2F4F4F',
      muted: '#667A7A',
      accent: '#D97706',
      ok: '#16A34A',
      warn: '#D97706',
      danger: '#B91C1C',
      line: '#F2E8C8',
      slot: '#FFFBEE',
      control: '#F2E8C8',
      tab: '#F2E8C8',
    },
  },
  {
    id: 'dark-charcoal-navy',
    label: 'Charcoal + Navy',
    mode: 'dark',
    tokens: {
      bg: '#0E1117',
      panel: '#141925',
      text: '#E6EDF3',
      muted: '#AEB9CF',
      accent: '#4AA3FF',
      ok: '#28C990',
      warn: '#F5A524',
      danger: '#EF5B5B',
      line: '#273044',
      slot: '#111726',
      control: '#1A2030',
      tab: '#1A2435',
    },
  },
  {
    id: 'dark-ink-slate',
    label: 'Ink + Slate',
    mode: 'dark',
    tokens: {
      bg: '#111827',
      panel: '#1F2937',
      text: '#E5E7EB',
      muted: '#9CA3AF',
      accent: '#60A5FA',
      ok: '#34D399',
      warn: '#F59E0B',
      danger: '#F87171',
      line: '#374151',
      slot: '#111827',
      control: '#1F2937',
      tab: '#1F2937',
    },
  },
  {
    id: 'dark-plum',
    label: 'Deep Plum + Lavender',
    mode: 'dark',
    tokens: {
      bg: '#1B0E1E',
      panel: '#2A1530',
      text: '#F3E8FF',
      muted: '#C4B5FD',
      accent: '#A78BFA',
      ok: '#34D399',
      warn: '#F59E0B',
      danger: '#F87171',
      line: '#3A2540',
      slot: '#1B0E1E',
      control: '#2A1530',
      tab: '#2A1530',
    },
  },
  {
    id: 'dark-forest',
    label: 'Forest Night + Mint',
    mode: 'dark',
    tokens: {
      bg: '#0F1A14',
      panel: '#142219',
      text: '#E8F5E9',
      muted: '#A7DCC3',
      accent: '#34D399',
      ok: '#34D399',
      warn: '#F59E0B',
      danger: '#F87171',
      line: '#1E2C23',
      slot: '#0F1A14',
      control: '#142219',
      tab: '#142219',
    },
  },
  {
    id: 'dark-graphite-amber',
    label: 'Graphite + Amber',
    mode: 'dark',
    tokens: {
      bg: '#121212',
      panel: '#1E1E1E',
      text: '#F5F5F5',
      muted: '#CFCFCF',
      accent: '#F5A524',
      ok: '#34D399',
      warn: '#F5A524',
      danger: '#EF5B5B',
      line: '#2A2A2A',
      slot: '#131313',
      control: '#1E1E1E',
      tab: '#1E1E1E',
    },
  },
];

const DEFAULT_THEME: UIThemeConfig = {
  mode: 'system',
  scale: 1,
  lightPreset: 'light-soft-gray',
  darkPreset: 'dark-charcoal-navy',
};

/** Get the current theme configuration merged with defaults. */
export function getThemeConfig(): UIThemeConfig {
  return { ...DEFAULT_THEME, ...(getConfig().uiTheme || {}) };
}

/** Persist theme settings and apply them. */
export async function saveThemeConfig(partial: Partial<UIThemeConfig>): Promise<UIThemeConfig> {
  const next = { ...getThemeConfig(), ...partial };
  await saveConfig({ uiTheme: next });
  applyTheme(next);
  document.dispatchEvent(new Event('config-changed'));
  return next;
}

/** Apply the theme configuration to the document root. */
export function applyTheme(cfg: UIThemeConfig = getThemeConfig()): void {
  const r = document.documentElement;
  r.style.setProperty('--scale', String(cfg?.scale ?? 1));
  const mode = cfg?.mode ?? 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  r.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const presetId = isDark ? cfg.darkPreset : cfg.lightPreset;
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  const tokens = { ...(preset?.tokens || {}), ...(cfg.custom || {}) } as ThemeTokens;
  for (const [k, v] of Object.entries(tokens)) {
    r.style.setProperty(`--${k}`, v);
    if (k === 'text') {
      r.style.setProperty('--text-high', v);
      r.style.setProperty('--text', v);
    }
    if (k === 'muted') {
      r.style.setProperty('--text-muted', v);
      r.style.setProperty('--muted', v);
      r.style.setProperty('--text-med', v);
    }
  }

  if (cfg?.highContrast) {
    r.setAttribute('data-contrast', 'high');
  } else {
    r.removeAttribute('data-contrast');
  }

  if (cfg?.compact) {
    r.style.setProperty('--gap', '12px');
  } else {
    r.style.removeProperty('--gap');
  }
}

