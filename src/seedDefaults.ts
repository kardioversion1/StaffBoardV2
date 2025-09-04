import data from '../staff_and_zones.json';
import { loadStaff, saveStaff, Staff } from '@/state';
import { seedZonesIfNeeded } from '@/seed';
import { ensureStaffId } from '@/utils/id';

/** Seed default staff and zones if missing. Idempotent. */
export async function seedDefaults(): Promise<void> {
  let staff = await loadStaff();
  if (staff.length === 0 && Array.isArray(data.staff)) {
    staff = data.staff.map((s) => ({ ...s, id: ensureStaffId(s.id) })) as Staff[];
    await saveStaff(staff);
  }
  await seedZonesIfNeeded();
}
