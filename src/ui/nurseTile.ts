import type { Slot } from '@/slots';
import type { Staff } from '@/state/staff';
import { getConfig } from '@/state/config';
import { getActiveBoardCache, STATE } from '@/state';
import { formatName } from '@/utils/names';

/** Render a nurse tile with status icons. */
export function nurseTile(slot: Slot, staff: Staff): string {
  const chips: string[] = [];
  if (slot.break?.active) {
    chips.push(
      `<span class="chip" aria-label="On break" title="On break"><span class="icon">☕</span></span>`
    );
  }
  if (slot.student) {
    chips.push(
      `<span class="chip" aria-label="Has student" title="Has student"><span class="icon">🎓</span></span>`
    );
  }
  if (slot.highAcuityUntil && slot.highAcuityUntil > Date.now()) {
    chips.push(
      `<span class="chip" aria-label="Recovering from high acuity" title="Recovering from high acuity"><span class="icon">🔥</span></span>`
    );
  }

  const board =
    typeof getActiveBoardCache === 'function'
      ? getActiveBoardCache(STATE.dateISO, STATE.shift)
      : undefined;
  const cfg = (typeof getConfig === 'function' ? getConfig() : {}) as any;
  let endISO = board?.endAtISO;
  if (!endISO && board) {
    const anchors = cfg?.anchors || { day: '07:00', night: '19:00' };
    const startHH = board.shift === 'day' ? anchors.day : anchors.night;
    const start = new Date(`${board.dateISO}T${startHH}`);
    start.setHours(start.getHours() + 12);
    endISO = start.toISOString();
  }
  if (endISO) {
    const msLeft = new Date(endISO).getTime() - Date.now();
    if (msLeft > 0 && msLeft <= 60 * 60 * 1000) {
      chips.push(
        `<span class="chip" aria-label="Shift ending soon" title="Shift ending soon"><span class="icon">🚪</span></span>`
      );
    }
  }
  // Resolve privacy setting from config (with conservative defaults)
  const privacy =
    (cfg?.ui && typeof cfg.ui?.namePrivacy === 'boolean' ? cfg.ui.namePrivacy : undefined) ??
    (typeof cfg?.privacy === 'boolean' ? cfg.privacy : undefined) ??
    (typeof cfg?.privacyMode === 'boolean' ? cfg.privacyMode : undefined) ??
    true;

  const name = formatName(staff.name || '', privacy);
  const metaBase = `${staff.type ?? 'other'} ${staff.role ?? 'nurse'}`.trim();
  const typeIcons: Record<string, string> = {
    home: '🏠',
    travel: '✈️',
    flex: '🔁',
    charge: '⭐',
    triage: '🚨',
  };
  const typeIcon = typeIcons[staff.type ?? ''] || '';
  const meta = typeIcon ? `${typeIcon} ${metaBase}` : metaBase;

  const statuses: string[] = [];
  if (slot.break?.active) statuses.push('on break');
  if (slot.student) statuses.push('has student');
  if (slot.highAcuityUntil && slot.highAcuityUntil > Date.now()) statuses.push('recovering from high acuity');

  const aria =
    `${name}` +
    (metaBase ? `, ${metaBase}` : '') +
    (slot.comment ? `, comment ${slot.comment}` : '') +
    (statuses.length ? `, ${statuses.join(', ')}` : '');

  const chipStr = chips.length ? `<span class="chips">${chips.join('')}</span>` : '';
  const commentHtml = slot.comment
    ? `<div class="nurse-card__comment"><span class="icon">💬</span> ${slot.comment}</div>`
    : '';

  const metaHtml = staff.rf
    ? `<div class="nurse-card__meta"><span>${meta}</span><span class="nurse-card__rf">${staff.rf}</span></div>`
    : `<div class="nurse-card__meta">${meta}</div>`;

  return `<div class="nurse-card" data-type="${staff.type ?? 'other'}" data-role="${staff.role ?? 'nurse'}" tabindex="0" aria-label="${aria}"><div class="nurse-card__text"><div class="nurse-card__name">${name}</div>${metaHtml}${commentHtml}</div>${chipStr}</div>`;
}
