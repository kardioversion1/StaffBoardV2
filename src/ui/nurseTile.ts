import type { Slot } from "../slots";
import type { Staff } from "../state";
import { formatShortName } from "@/utils/format";

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

  const name = formatShortName(staff.name);
  const statuses: string[] = [];
  if (slot.break?.active) statuses.push('on break');
  if (slot.student) statuses.push('has student');
  if (slot.comment) statuses.push('has comment');
  const aria = `${name}, ${staff.type} nurse${
    statuses.length ? ', ' + statuses.join(', ') : ''
  }`;
  const chipStr = chips.length ? `<span class="chips">${chips.join('')}</span>` : '';
  return `<div class="nurse-pill" data-type="${staff.type}" tabindex="0" aria-label="${aria}"><span class="nurse-name">${name}</span>${chipStr}</div>`;
}

