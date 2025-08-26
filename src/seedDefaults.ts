import data from '../staff_and_zones.json';
import { getConfig, saveConfig, loadStaff, saveStaff, Staff } from '@/state';
import { ensureStaffId } from '@/utils/id';

export const CANONICAL_ZONES = data.zones.map((z) => z.name);

/** Seed default staff and zones if none exist. Idempotent. */
export async function seedDefaults(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.zones || cfg.zones.length === 0) {
    await saveConfig({ zones: [...CANONICAL_ZONES] });
  } else {
    const merged = [...cfg.zones];
    for (const name of CANONICAL_ZONES) {
      if (!merged.includes(name)) merged.push(name);
    }
    await saveConfig({ zones: merged });
  }

  let staff = await loadStaff();
  if (staff.length === 0) {
    staff = data.staff.map((s) => ({ ...s, id: ensureStaffId(s.id) })) as Staff[];
    await saveStaff(staff);
  }
}
