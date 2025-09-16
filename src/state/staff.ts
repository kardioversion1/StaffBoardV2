import { KS } from './keys';
import * as DB from '@/db';
import * as Server from '@/server';

/** Basic staff record. */
export interface Staff {
  id: string;
  name?: string;
  role: string; // e.g., 'nurse' or 'tech'
  type?: string; // e.g., 'home', 'traveler'
  rf?: string;
}

/**
 * Load staff roster from local storage, defaulting nurse type to `home`
 * when not provided.
 */
export async function loadStaff(): Promise<Staff[]> {
  try {
    const stored = (await DB.get<Staff[]>(KS.STAFF)) ?? [];
    return stored.map((s) =>
      s.role === 'nurse' && !s.type ? { ...s, type: 'home' } : s,
    );
  } catch {
    return [];
  }
}

/** Persist staff roster locally and attempt server sync. */
export async function saveStaff(list: Staff[]): Promise<void> {
  await DB.set(KS.STAFF, list);
  try {
    await Server.save('roster', list);
  } catch {
    /* ignore network errors */
  }
}
