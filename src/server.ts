/**
 * Wrapper around the globally provided `Server` adapter.
 * Exports helper functions so modules can `import * as Server from '@/server'`.
 */

// `Server` is declared globally in src/types/server.d.ts
const api: ServerAPI | undefined = (globalThis as any).Server;

function ensure(): ServerAPI {
  if (!api) throw new Error('Server adapter not available');
  return api;
}

export const load: ServerAPI['load'] = (...args) => ensure().load(...(args as any));
export const save: ServerAPI['save'] = (...args) => ensure().save(...(args as any));
export const softDeleteStaff: ServerAPI['softDeleteStaff'] = (...args) =>
  ensure().softDeleteStaff(...(args as any));
export const exportHistoryCSV: ServerAPI['exportHistoryCSV'] = (...args) =>
  ensure().exportHistoryCSV(...(args as any));

export default { load, save, softDeleteStaff, exportHistoryCSV };
