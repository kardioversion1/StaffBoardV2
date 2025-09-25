import * as DB from '@/db';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import { KS } from './keys';
import * as Server from '@/server';

export type Staff = {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  rf?: number;
  role: 'nurse' | 'tech';
  type: NurseType;
  active?: boolean;
  notes?: string;
  prefDay?: boolean;
  prefNight?: boolean;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[];
  defaultZone?: string;
  dtoEligible?: boolean;
};

type RawStaff = Omit<Staff, 'type'> & { type?: Staff['type'] | string | null };

/**
 * Normalize a staff record by enforcing id prefix and nurse type defaults.
 */
export function normalizeStaff(s: RawStaff): Staff {
  ensureRole(s);
  const id = ensureStaffId(s.id);
  const rawType = (s as { type?: string | null }).type;
  const type = (canonNurseType(rawType) || rawType || 'home') as NurseType;
  return { ...s, id, type } as Staff;
}

/**
 * Store for the staff roster with caching and change notifications.
 */
export class RosterStore {
  private list: Staff[] = [];
  private listeners = new Set<() => void>();

  /** Load roster from server or local DB. */
  async load(): Promise<Staff[]> {
    try {
      const remote = (await Server.load('roster')) as RawStaff[] | undefined;
      if (remote) {
        await DB.set(KS.STAFF, remote);
      }
    } catch {}

    const data = (await DB.get<RawStaff[]>(KS.STAFF)) || [];
    let changed = false;
    this.list = data.map((s) => {
      const normalized = normalizeStaff(s);
      if (normalized.id !== s.id) changed = true;
      return normalized;
    });
    if (changed) await DB.set(KS.STAFF, this.list);
    this.emit();
    return this.list;
  }

  /** Save roster to server and local DB. */
  async save(list: Staff[]): Promise<void> {
    this.list = list.map(normalizeStaff);
    try {
      await Server.save('roster', this.list);
    } catch {}
    await DB.set(KS.STAFF, this.list);
    this.emit();
  }

  /** Get all staff records. */
  all(): Staff[] {
    return this.list;
  }

  /** Get only active staff. */
  active(): Staff[] {
    return this.list.filter((s) => s.active !== false);
  }

  /** Get only inactive staff. */
  inactive(): Staff[] {
    return this.list.filter((s) => s.active === false);
  }

  /** Subscribe to roster changes. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const rosterStore = new RosterStore();

/** Load staff roster using the shared roster store. */
export async function loadStaff(): Promise<Staff[]> {
  return rosterStore.load();
}

/** Persist staff roster using the shared roster store. */
export async function saveStaff(list: Staff[]): Promise<void> {
  await rosterStore.save(list);
}
