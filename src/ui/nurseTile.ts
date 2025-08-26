import type { Slot } from '../slots';
import type { Staff } from '../state';
import { getConfig } from '@/state';
import { formatName } from '@/utils/names';

export function nurseTile(slot: Slot, staff: Staff): string {
  const chips: string[] = [];
  if (slot.break?.active) {
    chips.push(
      `<span class="chip" aria-label="On break"><span class="icon">⏸️</span></span>`
    );
  }
  if (slot.student) {
    chips.push(
      `<span class="chip" aria-label="Has student"><span class="icon">🎓</span></span>`
    );
  }
  if (slot.comment) {
    chips.push(
      `<span class="chip" aria-label="Has comment"><span class="icon">💬</span></span>`
    );
  }
  if (slot.bad) {
    chips.push(
      `<span class="chip" aria-label="Marked bad"><span class="icon">⚠️</span></span>`
    );
  }

  // Resolve privacy setting from config (with conservative defaults)
  const cfg = (typeof getConfig === 'function' ? getConfig() : {}) as any;
  const privacy =
    (cfg?.ui && typeof cfg.ui?.namePrivacy === 'boolean' ? cfg.ui.namePrivacy : undefined) ??
    (typeof cfg?.privacy === 'boolean' ? cfg.privacy : undefined) ??
    (typeof cfg?.privacyMode === 'boolean' ? cfg.privacyMode : undefined) ??
    true;

  const name = formatName(staff.name || '', privacy);
  const meta = `${staff.type ?? 'other'} ${staff.role ?? 'nurse'}`.trim();

  const statuses: string[] = [];
  if (slot.break?.active) statuses.push('on break');
  if (slot.student) statuses.push('has student');
  if (slot.comment) statuses.push('has comment');
  if (slot.bad) statuses.push('marked bad');

  const aria =
    `${name}` +
    (meta ? `, ${meta}` : '') +
    (statuses.length ? `, ${statuses.join(', ')}` : '');

  const chipStr = chips.length ? `<span class="chips">${chips.join('')}</span>` : '';

  return `<div class="nurse-card" data-type="${staff.type ?? 'other'}" data-role="${staff.role ?? 'nurse'}" tabindex="0" aria-label="${aria}">
    <div class="nurse-card__text">
      <div class="nurse-card__name">${name}</div>
      <div class="nurse-card__meta">${meta}</div>
    </div>
    ${chipStr}
  </div>`;
}
