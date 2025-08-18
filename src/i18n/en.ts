export const en = {
  nav: { draft: 'Draft', history: 'History' },
  actions: {
    addNurse: 'Add nurse', editNurse: 'Edit nurse',
    createZone: 'Create zone', resetDefaults: 'Reset to ED defaults',
    saveDraft: 'Save draft', saveOnBat: 'Save to On Bat', goLive: 'Go live',
    endOverlapNow: 'End overlap now',
  },
  labels: {
    charge: 'Charge', triage: 'Triage', adminOn: 'Admin on',
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
export const t = <K extends string>(k: K): any => k.split('.').reduce((o,p)=>o?.[p], en);
