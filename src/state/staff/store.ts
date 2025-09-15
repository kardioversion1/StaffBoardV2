import * as DB from '@/db';
import { KS } from '@/state/keys';
import type { Staff } from './types';
import { fetchRoster, pushRoster } from './service';
import { normalizeStaff } from './normalize';

/**
 * Store for the staff roster with caching and change notifications.
 */
export class RosterStore {
  private list: Staff[] = [];
  private listeners = new Set<() => void>();

  /** Load roster from server or local DB. */
  async load(): Promise<Staff[]> {
    try {
      const remote = await fetchRoster();
      await DB.set(KS.STAFF, remote);
    } catch {}
    const data = (await DB.get<Staff[]>(KS.STAFF)) || [];
    let changed = false;
    this.list = data.map((s) => {
      const n = normalizeStaff(s);
      if (n.id !== s.id) changed = true;
      return n;
    });
    if (changed) await DB.set(KS.STAFF, this.list);
    this.emit();
    return this.list;
  }

  /** Save roster to server and local DB. */
  async save(list: Staff[]): Promise<void> {
    this.list = list.map(normalizeStaff);
    try {
      await pushRoster(this.list);
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
