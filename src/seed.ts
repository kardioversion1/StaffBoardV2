import { getConfig, saveConfig, Staff } from '@/state';
import type { Board, Slot } from '@/slots';

export type SeedStrategy = 'unassigned' | 'preassign';

export type SeedSettings = {
  strategy: SeedStrategy;
  includeTravelers: boolean;
  resetZonesIfEmpty: boolean;
  assignChargeTriage: boolean;
};

export const DEFAULT_SEED_SETTINGS: SeedSettings = {
  strategy: 'unassigned',
  includeTravelers: true,
  resetZonesIfEmpty: true,
  assignChargeTriage: true,
};

export function buildEDDefaultZones(): string[] {
  return [
    'Unassigned',
    ...Array.from({ length: 12 }, (_, i) => `A-${i + 1}`),
    ...Array.from({ length: 6 }, (_, i) => `HW-${i + 1}`),
    'WR',
    'T1',
    'T2',
    '2',
  ];
}

export async function seedZonesIfNeeded(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.zones || cfg.zones.length === 0) {
    const zones = buildEDDefaultZones();
    await saveConfig({ zones });
    return;
  }
  if (!cfg.zones.includes('Unassigned')) {
    await saveConfig({ zones: ['Unassigned', ...cfg.zones] });
  }
}

export function getDefaultRosterForLabel(
  staff: Staff[],
  label: 'day' | 'night'
): Staff[] {
  return staff.filter(
    (n) => n.active !== false && (label === 'day' ? n.prefDay : n.prefNight)
  );
}

export function buildSeedBoard(
  roster: Staff[],
  settings: SeedSettings = DEFAULT_SEED_SETTINGS
): Board {
  const cfg = getConfig();
  const board: Board = {
    charge: undefined,
    triage: undefined,
    zones: Object.fromEntries((cfg.zones || []).map((z) => [z, [] as Slot[]])),
  };

  if (settings.assignChargeTriage) {
    const chargeCand = roster.find((n) => n.eligibleRoles?.includes('charge'));
    if (chargeCand) board.charge = { nurseId: chargeCand.id };
    const triageCand = roster.find(
      (n) => n.eligibleRoles?.includes('triage') && n.id !== chargeCand?.id
    );
    if (triageCand) board.triage = { nurseId: triageCand.id };
  }

  const unassigned = 'Unassigned';
  for (const n of roster) {
    if (board.charge?.nurseId === n.id || board.triage?.nurseId === n.id) continue;
    if (settings.strategy === 'preassign' && n.defaultZone && cfg.zones.includes(n.defaultZone)) {
      board.zones[n.defaultZone].push({ nurseId: n.id });
    } else {
      board.zones[unassigned].push({ nurseId: n.id });
    }
  }

  return board;
}
