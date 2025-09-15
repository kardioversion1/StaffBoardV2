import * as DB from '@/db';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import { KS } from './keys';
import * as Server from '@/server';

export type Staff = {
  id: string;
  name?: string | undefined;
  first?: string | undefined;
  last?: string | undefined;
  rf?: number | undefined;
  role: 'nurse' | 'tech';
  type: NurseType;
  active?: boolean | undefined;
  notes?: string | undefined;
  prefDay?: boolean | undefined;
  prefNight?: boolean | undefined;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[] | undefined;
  defaultZone?: string | undefined;
  dtoEligible?: boolean | undefined;
};

/** Load staff roster from server or local DB */
export async function loadStaff(): Promise<Staff[]> {
  try {
    const remote = (await Server.load('roster')) as Staff[];
    await DB.set(KS.STAFF, remote);
  } catch {}
  const list = (await DB.get<Staff[]>(KS.STAFF)) || [];
  let changed = false;
  const normalized = list.map((s) => {
    ensureRole(s);
    const id = ensureStaffId(s.id);
    const rawType = (s as any).type;
    const type = (canonNurseType(rawType) || rawType || 'home') as NurseType;
    if (id !== s.id) changed = true;
    return { ...s, id, type } as Staff;
  });
  if (changed) await DB.set(KS.STAFF, normalized);
  return normalized;
}

/** Save staff roster to server and local DB */
export async function saveStaff(list: Staff[]): Promise<void> {
  try {
    await Server.save('roster', list);
  } catch {}
  await DB.set(KS.STAFF, list);
}
