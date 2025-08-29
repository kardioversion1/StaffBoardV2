import type { Shift } from '@/utils/time';

/** LocalStorage keys for persisted state */
export const KS = {
  CONFIG: 'CONFIG',
  STAFF: 'STAFF',
  HISTORY: 'HISTORY',
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  ONBAT: (dateISO: string, shift: Shift) => `ONBAT:${dateISO}:${shift}`,
  DRAFT: (dateISO: string, shift: Shift) => `DRAFT:${dateISO}:${shift}`,
} as const;
