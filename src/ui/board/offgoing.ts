import type { ActiveBoard } from '@/state';
import { labelFromId } from '@/utils/names';

/** Create the Offgoing panel. */
export function createOffgoingPanel(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'offgoing-panel';
  section.className = 'panel';
  section.innerHTML = `
    <h3>Offgoing (kept 40 min)</h3>
    <div id="offgoing"></div>
  `;
  return section;
}

/** Render recently offgoing staff. */
export function renderOffgoing(
  active: ActiveBoard,
  beforeChange: () => void = () => {},
  save: () => void
): void {
  const cont = document.getElementById('offgoing')!;
  const cutoff = Date.now() - 60 * 60 * 1000;
  const original = active.offgoing?.slice();
  active.offgoing = (active.offgoing || []).filter((o) => o.ts > cutoff);

  cont.innerHTML = '';
  for (const o of active.offgoing) {
    const div = document.createElement('div');
    div.textContent = labelFromId(o.nurseId);
    cont.appendChild(div);
  }
  if (JSON.stringify(original) !== JSON.stringify(active.offgoing)) {
    beforeChange();
  }
  save();
}
