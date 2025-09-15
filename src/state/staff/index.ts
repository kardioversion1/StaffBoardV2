/**
 * Roster management utilities.
 * Use the singleton {@link rosterStore} to load and observe staff records.
 */
export type { Staff } from './types';
export { normalizeStaff } from './normalize';
export { rosterStore, RosterStore } from './store';
