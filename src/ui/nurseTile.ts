import type { Slot } from "../slots";
import type { Staff } from "../state";
import { coveringDisplay } from "../slots";

export function nurseTile(slot: Slot, staff: Staff): string {
  const chips: string[] = [];
  if (slot.student) chips.push(`<span class="chip">S</span>`);
  if (slot.comment)
    chips.push(
      `<span class="chip comment" title="${slot.comment}">💬</span>`
    );
  if (slot.break?.active) {
    const cov = coveringDisplay(slot);
    chips.push(
      `<span class="chip break">Break${cov ? ` • Cov: ${cov}` : ""}</span>`
    );
  }
  if (slot.dto) chips.push(`<span class="chip dto">DTO</span>`);
  if (slot.endTimeOverrideHHMM)
    chips.push(
      `<span class="chip off-at">Off at ${slot.endTimeOverrideHHMM}</span>`
    );
  const chipStr = chips.length ? ` ${chips.join(" ")}` : "";
  return `<div class="nurse-tile">${staff.name}${chipStr}</div>`;
}

