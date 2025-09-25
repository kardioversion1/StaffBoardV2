import * as Server from '@/server';
import type { Staff } from './types';

/** Fetch the staff roster from the server. */
export async function fetchRoster(): Promise<Staff[]> {
  return (await Server.load('roster')) as Staff[];
}

/** Push the staff roster to the server. */
export async function pushRoster(list: Staff[]): Promise<void> {
  await Server.save('roster', list);
}
