import { describe, it, expect, vi } from 'vitest';
/** @vitest-environment happy-dom */

vi.mock('@/db', () => {
  const store: Record<string, any> = {};
  return {
    get: async (k: string) => store[k],
    set: async (k: string, v: any) => {
      store[k] = v;
    },
    del: async (k: string) => {
      delete store[k];
    },
    keys: async () => Object.keys(store),
  };
});

import { saveConfig } from '@/state';
import { getThemeConfig } from '@/state/theme';

describe('theme config presets', () => {
  it('falls back to defaults for unknown preset ids', async () => {
    await saveConfig({ uiTheme: { lightPreset: 'fog', darkPreset: 'midnight' } as any });
    const cfg = getThemeConfig();
    expect(cfg.lightPreset).toBe('light-soft-gray');
    expect(cfg.darkPreset).toBe('dark-charcoal-navy');
  });

  it('persists icon and comment sizes', async () => {
    await saveConfig({ uiTheme: { iconSize: 1.2, commentSize: 0.9 } as any });
    const cfg = getThemeConfig();
    expect(cfg.iconSize).toBe(1.2);
    expect(cfg.commentSize).toBe(0.9);
  });
});
