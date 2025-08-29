import type { ServerAPI } from '@/types/server';

let api: ServerAPI | undefined;

/** Ensure the global Server adapter is available. */
function ensure(): ServerAPI {
  if (!api) {
    api = (window as any).Server as ServerAPI;
  }
  return api;
}

/** Proxy to {@link ServerAPI.load}. */
export const load: ServerAPI['load'] = (key, params?) => ensure().load(key, params);

/** Proxy to {@link ServerAPI.save}. */
export const save: ServerAPI['save'] = (key, payload, params?) =>
  ensure().save(key, payload, params);

/** Proxy to {@link ServerAPI.softDeleteStaff}. */
export const softDeleteStaff: ServerAPI['softDeleteStaff'] = (id) =>
  ensure().softDeleteStaff(id);

/** Proxy to {@link ServerAPI.exportHistoryCSV}. */
export const exportHistoryCSV: ServerAPI['exportHistoryCSV'] = (filters?) =>
  ensure().exportHistoryCSV(filters);

export default { load, save, softDeleteStaff, exportHistoryCSV };

