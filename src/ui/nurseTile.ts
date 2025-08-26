import type { Slot } from "../slots";
import type { Staff } from "../state";
import { formatDisplayName } from "@/utils/names";

export function nurseTile(slot: Slot, staff: Staff): string {
  const chips: string[] = [];
  if (slot.break?.active)
    chips.push(
      `<span class="chip" aria-label="On break"><span class="icon">⏸️</span></span>`
    );
  if (slot.student)
    chips.push(
      `<span class="chip" aria-label="Has student"><span class="icon">🎓</span></span>`
    );
  if (slot.comment)
    chips.push(
      `<span class="chip" aria-label="Has comment"><span class="icon">💬</span></span>`
    );
  if (slot.bad)
    chips.push(
      `<span class="chip" aria-label="Marked bad"><span class="icon">⚠️</span></span>`
    );

  const name = formatDisplayName(staff.name || '');
  const statuses: string[] = [];
  if (slot.break?.active) statuses.push('on break');
  if (slot.student) statuses.push('has student');
  if (slot.comment) statuses.push('has comment');
  if (slot.bad) statuses.push('marked bad');
  const aria = `${name}, ${staff.type} ${staff.role}${
    statuses.length ? ', ' + statuses.join(', ') : ''
  }`;
  const chipStr = chips.length ? `<span class="chips">${chips.join('')}</span>` : '';
  return `<div class="nurse-pill" data-type="${staff.type}" data-role="${staff.role}" tabindex="0" aria-label="${aria}"><span class="nurse-name">${name}</span>${chipStr}</div>`;
}

