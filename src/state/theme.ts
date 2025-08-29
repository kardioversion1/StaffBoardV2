import { getConfig, saveConfig } from './config';

export type UIMode = 'system' | 'light' | 'dark';
export interface UIThemeConfig {
  mode: UIMode;
  scale: number;
  lightPreset: 'paper' | 'fog' | 'pearl';
  darkPreset: 'ink' | 'midnight' | 'plum';
  highContrast?: boolean;
  compact?: boolean;
}

const DEFAULT_THEME: UIThemeConfig = {
  mode: 'system',
  scale: 1,
  lightPreset: 'fog',
  darkPreset: 'midnight',
};

export function getThemeConfig(): UIThemeConfig {
  return { ...DEFAULT_THEME, ...(getConfig().uiTheme || {}) };
}

export async function saveThemeConfig(partial: Partial<UIThemeConfig>): Promise<UIThemeConfig> {
  const next = { ...getThemeConfig(), ...partial };
  await saveConfig({ uiTheme: next });
  applyTheme(next);
  document.dispatchEvent(new Event('config-changed'));
  return next;
}

export function applyTheme(cfg: UIThemeConfig = getThemeConfig()): void {
  const r = document.documentElement;
  r.style.setProperty('--scale', String(cfg?.scale ?? 1));
  const mode = cfg?.mode ?? 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  r.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const lightPresets = {
    paper: { '--bg': '#fdfdfd', '--panel': '#ffffff' },
    fog: { '--bg': '#f7f9fc', '--panel': '#ffffff' },
    pearl: { '--bg': '#f6f7fb', '--panel': '#ffffff' },
  } as Record<string, Record<string, string>>;
  const darkPresets = {
    ink: { '--bg': '#0b0e14', '--panel': '#121826' },
    midnight: { '--bg': '#0e1117', '--panel': '#141925' },
    plum: { '--bg': '#0e0b12', '--panel': '#171327' },
  } as Record<string, Record<string, string>>;

  const preset = isDark
    ? darkPresets[cfg?.darkPreset || 'midnight']
    : lightPresets[cfg?.lightPreset || 'fog'];
  if (preset) {
    for (const [k, v] of Object.entries(preset)) r.style.setProperty(k, v);
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
