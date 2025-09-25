import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import type { Staff } from './types';

/**
 * Normalize a staff record by fixing id prefix and nurse type.
 * @param s raw staff object
 * @returns normalized staff object
 */
export function normalizeStaff(s: Staff): Staff {
  ensureRole(s);
  const id = ensureStaffId(s.id);
  const rawType = (s as any).type;
  const type = (canonNurseType(rawType) || rawType || 'home') as NurseType;
  return { ...s, id, type };
}
