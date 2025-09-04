import { getConfig, saveConfig, Staff } from '@/state';
import { normalizeZones, type ZoneDef } from '@/utils/zones';
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

export function buildEDDefaultZones(): ZoneDef[] {
  const list: Array<string | Partial<ZoneDef>> = [
    { name: 'Charge Nurse', pct: true },
    { name: 'Triage Nurse', pct: true },
    { name: 'Unit Secretary', pct: true },
    'Room 1, 3-7',
    'Rooms 8-12',
    'Rooms 13-16',
    'Rooms 17-20',
    'Rooms 21-24',
    'Faster',
    'Cardiac Obs',
    'Tech 1',
    'Tech 2',
    'Aux 1',
    'Aux 2',
  ];
  return normalizeZones(list);
}

export async function seedZonesIfNeeded(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.zones || cfg.zones.length === 0) {
    const zones = buildEDDefaultZones();
    await saveConfig({ zones });
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
    admin: undefined,
    zones: Object.fromEntries((cfg.zones || []).map((z) => [z.name, [] as Slot[]])),
  };

  if (settings.assignChargeTriage) {
    const chargeCand = roster.find((n) => n.eligibleRoles?.includes('charge'));
    if (chargeCand) board.charge = { nurseId: chargeCand.id };
    const triageCand = roster.find(
      (n) => n.eligibleRoles?.includes('triage') && n.id !== chargeCand?.id
    );
    if (triageCand) board.triage = { nurseId: triageCand.id };
    const adminCand = roster.find(
      (n) => n.eligibleRoles?.includes('admin') && n.id !== chargeCand?.id && n.id !== triageCand?.id
    );
    if (adminCand) board.admin = { nurseId: adminCand.id };
  }

  let defaultZone = cfg.zones.find((z) => !z.pct)?.name;
  if (!defaultZone) {
    defaultZone = 'Unassigned';
    board.zones[defaultZone] = [];
  }
  for (const n of roster) {
    if (board.charge?.nurseId === n.id || board.triage?.nurseId === n.id) continue;
    if (
      settings.strategy === 'preassign' &&
      n.defaultZone &&
      cfg.zones.some((z) => z.name === n.defaultZone)
    ) {
      board.zones[n.defaultZone].push({ nurseId: n.id });
    } else {
      board.zones[defaultZone].push({ nurseId: n.id });
    }
  }

  return board;
}
