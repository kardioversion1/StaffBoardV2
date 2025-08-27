import data from '../staff_and_zones.json';
import { getConfig, saveConfig, loadStaff, saveStaff, Staff } from '@/state';
import { ensureStaffId } from '@/utils/id';
import type { ZoneDef } from '@/utils/zones';

export const CANONICAL_ZONES: ZoneDef[] = data.zones as ZoneDef[];

/** Seed default staff and zones if none exist. Idempotent. */
export async function seedDefaults(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.zones || cfg.zones.length === 0) {
    await saveConfig({ zones: [...CANONICAL_ZONES] });
  } else {
    const merged = [...cfg.zones];
    for (const z of CANONICAL_ZONES) {
      if (!merged.some((m) => m.id === z.id || m.name === z.name)) merged.push(z);
    }
    await saveConfig({ zones: merged });
  }

  let staff = await loadStaff();
  if (staff.length === 0) {
    staff = data.staff.map((s) => ({ ...s, id: ensureStaffId(s.id) })) as Staff[];
    await saveStaff(staff);
  }
}
