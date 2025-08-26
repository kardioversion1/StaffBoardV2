import { getConfig, saveConfig } from '@/state';

export type UIConfig = {
  signoutMode: 'shiftHuddle' | 'disabled' | 'legacySignout';
  rightSidebarWidthPx: number;
  rightSidebarMinPx: number;
  rightSidebarMaxPx: number;
};

const DEFAULTS: UIConfig = {
  signoutMode: 'shiftHuddle',
  rightSidebarWidthPx: 300,
  rightSidebarMinPx: 260,
  rightSidebarMaxPx: 420,
};

export function getUIConfig(): UIConfig {
  const cfg = getConfig().ui || {};
  return { ...DEFAULTS, ...cfg } as UIConfig;
}

export async function saveUIConfig(partial: Partial<UIConfig>): Promise<UIConfig> {
  const next = { ...getUIConfig(), ...partial } as UIConfig;
  await saveConfig({ ui: next });
  applyUI(next);
  document.dispatchEvent(new Event('config-changed'));
  return next;
}

export function applyUI(cfg: UIConfig = getUIConfig()): void {
  const root = document.documentElement;
  root.style.setProperty(
    '--right-sidebar-w',
    `clamp(${cfg.rightSidebarMinPx}px, ${cfg.rightSidebarWidthPx}px, ${cfg.rightSidebarMaxPx}px)`
  );
}
