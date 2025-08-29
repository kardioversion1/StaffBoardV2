import {
  savePublishedShift,
  indexStaffAssignments,
  saveHuddle,
  getShiftByDate,
  type PublishedShiftSnapshot,
  type HuddleRecord,
} from '@/state/history';

/** Seed a demonstration shift from yesterday if none exists. */
export async function seedDemoHistory(): Promise<void> {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const dateISO = y.toISOString().slice(0, 10);
  if (await getShiftByDate(dateISO, 'day')) return;
  const publishedAt = new Date().toISOString();
  const snapshot: PublishedShiftSnapshot = {
    version: 1,
    dateISO,
    shift: 'day',
    publishedAtISO: publishedAt,
    publishedBy: 'demo',
    zoneAssignments: [
      {
        staffId: 'n1',
        displayName: 'Demo Nurse',
        role: 'nurse',
        zone: 'A-1',
        startISO: `${dateISO}T07:00:00.000Z`,
        endISO: `${dateISO}T19:00:00.000Z`,
      },
    ],
    incoming: [],
    offgoing: [],
    comments: 'demo shift',
    audit: { createdAtISO: publishedAt, createdBy: 'demo' },
  };
  await savePublishedShift(snapshot);
  await indexStaffAssignments(snapshot);
  const huddle: HuddleRecord = {
    dateISO,
    shift: 'day',
    recordedAtISO: publishedAt,
    recordedBy: 'demo',
    checklist: [],
    notes: 'demo huddle',
  };
  await saveHuddle(huddle);
}
