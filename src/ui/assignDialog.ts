import { labelFromId } from '@/utils/names';
import { findShiftsByStaff } from '@/state/history';
import type { Staff } from '@/state/staff';

/**
 * Open overlay to assign a staff member.
 * @param staffList full roster to pick from
 * @param onAssign callback with selected staff id
 */
export function openAssignDialog(
  staffList: Staff[],
  onAssign: (id: string) => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `
    <div class="manage-dialog assign-dialog">
      <input id="assign-search" class="input" placeholder="Search staff">
      <div class="assign-cols">
        <div id="assign-nurses" class="assign-col"></div>
        <div id="assign-techs" class="assign-col"></div>
      </div>
      <div id="assign-details" class="assign-details"></div>
      <div class="dialog-actions">
        <button id="assign-confirm" class="btn" disabled>Assign</button>
        <button id="assign-cancel" class="btn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nurseCol = overlay.querySelector('#assign-nurses') as HTMLElement;
  const techCol = overlay.querySelector('#assign-techs') as HTMLElement;
  const searchInput = overlay.querySelector('#assign-search') as HTMLInputElement;
  const details = overlay.querySelector('#assign-details') as HTMLElement;
  const confirm = overlay.querySelector('#assign-confirm') as HTMLButtonElement;

  let selected: string | null = null;

  const render = (filter = '') => {
    const norm = filter.toLowerCase();
    const nurses = staffList.filter(
      (s) =>
        s.role === 'nurse' &&
        (!filter || (s.name || labelFromId(s.id)).toLowerCase().includes(norm))
    );
    const techs = staffList.filter(
      (s) =>
        s.role === 'tech' &&
        (!filter || (s.name || labelFromId(s.id)).toLowerCase().includes(norm))
    );
    nurseCol.innerHTML = nurses
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    techCol.innerHTML = techs
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    overlay.querySelectorAll('.assign-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.addEventListener('click', () => select(id));
      el.addEventListener('dblclick', () => {
        onAssign(id);
        overlay.remove();
      });
    });
  };

  const select = async (id: string) => {
    selected = id;
    confirm.disabled = false;
    overlay.querySelectorAll('.assign-item').forEach((el) => {
      el.classList.toggle('selected', (el as HTMLElement).dataset.id === id);
    });
    const history = await findShiftsByStaff(id);
    const recent = history.slice(0, 5);
    details.innerHTML = `
      <div class="history-box">
        ${
          recent.length
            ? `<ul>${recent
                .map(
                  (h) =>
                    `<li>${h.dateISO} ${h.shift} - ${h.zone}${h.dto ? ' (DTO)' : ''}</li>`
                )
                .join('')}</ul>`
            : 'No recent shifts'
        }
      </div>`;
  };

  searchInput.addEventListener('input', () => render(searchInput.value));
  overlay
    .querySelector('#assign-cancel')!
    .addEventListener('click', () => overlay.remove());
  confirm.addEventListener('click', () => {
    if (selected) {
      onAssign(selected);
      overlay.remove();
    }
  });

  render();
}

export default openAssignDialog;
