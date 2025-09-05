export const en = {
  nav: { nextShift: 'Next Shift', history: 'History' },
  actions: {
    addNurse: 'Add nurse', editNurse: 'Edit nurse',
    createZone: 'Create zone', resetDefaults: 'Reset to ED defaults',
    saveDraft: 'Save draft', saveOnBat: 'Save to On Bat', goLive: 'Go live',
    endOverlapNow: 'End overlap now',
  },
  labels: {
    charge: 'Charge Nurse', triage: 'Triage Nurse', adminOn: 'Unit Secretary',
    unassigned: 'Unassigned', offgoing: 'Offgoing',
    roster: 'Roster', zones: 'Zones', flags: 'Duplication flags',
    dto: 'DTO', dtoLong: 'Discretionary Time Off',
    flex: 'Flex', travel: 'Travel', home: 'Home',
    other: 'Other',
  },
  signout: {
    title: 'Shift sign-out',
    checklistConfirm: 'I confirm the handoff has been completed',
    overlapEndsIn: 'Overlap ends in',
  },
  errors: {
    capacityExceeded: 'Zone capacity exceeded.',
    duplicateAssignment: 'Nurse is assigned to multiple zones.',
    chargeTriageInvalid: 'Charge/Triage must have at most one nurse.',
    checklistIncomplete: 'Checklist must be confirmed to go live.',
  },
} as const;
export type Messages = typeof en;
/** Retrieve a localized string by key path. */
export function t(k: string): string {
  const parts = k.split('.');
  let result: unknown = en;
  for (const p of parts) {
    if (typeof result === 'object' && result && p in (result as Record<string, unknown>)) {
      result = (result as Record<string, unknown>)[p];
    } else {
      return k;
    }
  }
  return result as string;
}
