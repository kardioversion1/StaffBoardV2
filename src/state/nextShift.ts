import {
  CURRENT_SCHEMA_VERSION,
  applyDraftToActive,
  KS,
  DB,
  type DraftShift,
} from '@/state';
import * as Server from '@/server';
import { type ZoneDef } from '@/utils/zones';

/** Build an empty draft with zones populated but no assignments. */
export function buildEmptyDraft(
  dateISO: string,
  shift: 'day' | 'night',
  zones: ZoneDef[],
): DraftShift {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(zones.map((z) => [z.name, []])),
    incoming: [],
    offgoing: [],
    huddle: '',
    handoff: '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

/** Load the current next-shift draft from the server. */
export async function loadNextDraft(): Promise<DraftShift | null> {
  try {
    const raw = await Server.load('next');
    return raw && Object.keys(raw).length ? (raw as DraftShift) : null;
  } catch (err) {
    console.warn('loadNextDraft failed', err);
    return null;
  }
}

/** Persist a next-shift draft to the server. */
export async function saveNextDraft(draft: DraftShift): Promise<void> {
  await Server.save('next', draft);
}

function hasDuplicateAssignments(draft: DraftShift): boolean {
  const seen = new Set<string>();
  const leadIds = [draft.charge?.nurseId, draft.triage?.nurseId, draft.admin?.nurseId];
  for (const id of leadIds) {
    if (id) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  for (const zone of Object.values(draft.zones)) {
    for (const slot of zone) {
      const id = slot.nurseId;
      if (id) {
        if (seen.has(id)) return true;
        seen.add(id);
      }
    }
  }
  return false;
}

/**
 * Publish the draft to the active board and clear it from storage.
 * The previous active board is stored in history before publishing the new draft.
 */
export async function publishNextDraft(opts?: { appendHistory?: boolean }): Promise<void> {
  const draft = await loadNextDraft();
  if (!draft) throw new Error('No draft to publish');
  if (!draft.dateISO || !draft.shift || !draft.zones) throw new Error('Draft incomplete');
  if (hasDuplicateAssignments(draft)) throw new Error('duplicate nurse assignment');

  if (opts?.appendHistory !== false) {
    try {
      const current = await Server.load('active');
      if (current && Object.keys(current).length) {
        await Server.save('active', current, { appendHistory: 'true' });
      }
    } catch (err) {
      console.warn('append history failed', err);
    }
  }

  await Server.save('active', draft, { appendHistory: 'false' });
  await Server.save('next', {});
  await DB.set(KS.DRAFT(draft.dateISO, draft.shift), draft);
  await applyDraftToActive(draft.dateISO, draft.shift);
}

export type { DraftShift };
