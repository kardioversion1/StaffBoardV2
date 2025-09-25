import data from '../staff_and_zones.json';
import { rosterStore, type Staff } from '@/state/staff';
import { seedZonesIfNeeded } from '@/seed';
import { ensureStaffId } from '@/utils/id';

/** Seed default staff and zones if missing. Idempotent. */
export async function seedDefaults(): Promise<void> {
  await rosterStore.load();
  let staff = rosterStore.all();

  if (staff.length === 0 && Array.isArray((data as any).staff)) {
    staff = (data as any).staff.map((s: Partial<Staff>) => ({
      ...s,
      id: ensureStaffId(s.id as string | undefined),
    })) as Staff[];
    await rosterStore.save(staff);
  }

  await seedZonesIfNeeded();
}
