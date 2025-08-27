export const CANON = {
  nurseTypes: ['home','travel','flex','charge','triage','other'] as const,
  zoneTypes: ['room','hallway','waiting','quick','special'] as const,
  shiftStatuses: ['draft','onbat','live','overlap','archived'] as const,
  flags: ['info','warn','critical'] as const,
  privacyFormat: 'First LastInitial',
  timeZone: 'America/Kentucky/Louisville',
  datePatternUS: 'MM/DD/YYYY',
  timeStyle24h: '24h',
  dtoLabel: 'DTO',
  dtoDefinition: 'Discretionary Time Off',
};

export const SYNONYMS = {
  nurseType: {
    home: ['home','core','staff'],
    travel: ['travel','traveler','contract','agency'],
    flex: ['flex','float'],
    charge: ['charge','cn','charge nurse'],
    triage: ['triage'],
    other: ['other'],
  },
  zoneType: {
    room: ['room','bed'],
    hallway: ['hallway','hw'],
    waiting: ['waiting','wr','waiting room'],
    quick: ['quick','fast track','t1','t2','2'],
    special: ['special','system','meta','offgoing','unassigned','admin'],
  },
  shiftStatus: {
    draft: ['draft','pending'],
    onbat: ['onbat','on bat','prelive','final review'],
    live: ['live','current'],
    overlap: ['overlap'],
    archived: ['archived','past','history'],
  },
};
export type NurseType = typeof CANON.nurseTypes[number];
export type ZoneType = typeof CANON.zoneTypes[number];
export type ShiftStatus = typeof CANON.shiftStatuses[number];

function canonize<T extends Record<string, string[]>, K extends keyof T>(
  map: T,
  value: string | undefined | null
): K | null {
  if (typeof value !== 'string') return null;
  const needle = value.toLowerCase().trim();
  for (const [k, arr] of Object.entries(map)) {
    if (arr.includes(needle)) return k as K;
  }
  return null;
}

/** Normalize nurse type string to canonical form. */
export function canonNurseType(s: string | undefined | null): NurseType | null {
  return canonize(SYNONYMS.nurseType, s);
}

/** Normalize zone type string to canonical form. */
export function canonZoneType(s: string | undefined | null): ZoneType | null {
  return canonize(SYNONYMS.zoneType, s);
}

/** Normalize shift status string to canonical form. */
export function canonShiftStatus(s: string | undefined | null): ShiftStatus | null {
  return canonize(SYNONYMS.shiftStatus, s);
}
