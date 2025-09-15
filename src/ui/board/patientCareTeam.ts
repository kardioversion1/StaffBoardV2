import { getConfig, type ActiveBoard, type Staff } from '@/state';
import { labelFromId } from '@/utils/names';
import { upsertSlot, removeSlot } from '@/slots';
import { showBanner } from '@/ui/banner';

/** Create the Patient Care Team panel. */
export function createPatientCareTeamPanel(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `
    <h3>Patient Care Team</h3>
    <div class="slots lead">
      <div id="slot-charge"></div>
      <div id="slot-triage"></div>
      <div id="slot-secretary"></div>
    </div>
    <div id="pct-zones" class="zones-grid"></div>
  `;
  return section;
}

/** Render leadership slots within the Patient Care Team panel. */
export function renderLeadership(
  active: ActiveBoard,
  staff: Staff[],
  save: () => void,
  root: ParentNode,
  rerender: () => void
): void {
  const cfg = getConfig();
  const chargeEl = root.querySelector('#slot-charge') as HTMLElement | null;
  const triageEl = root.querySelector('#slot-triage') as HTMLElement | null;
  const secEl = root.querySelector('#slot-secretary') as HTMLElement | null;
  if (!chargeEl || !triageEl || !secEl) {
    console.warn('Missing leadership slot element');
    return;
  }

  chargeEl.textContent = labelFromId(active.charge?.nurseId);
  triageEl.textContent = labelFromId(active.triage?.nurseId);
  secEl.textContent = labelFromId(active.admin?.nurseId);

  chargeEl.style.display =
    active.charge?.nurseId || cfg.showPinned?.charge ? '' : 'none';
  triageEl.style.display =
    active.triage?.nurseId || cfg.showPinned?.triage ? '' : 'none';
  secEl.style.display = active.admin?.nurseId ? '' : 'none';

  chargeEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'charge', rerender);
  triageEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'triage', rerender);
  secEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'admin', rerender);
}

function assignLeadDialog(
  board: ActiveBoard,
  staffList: Staff[],
  save: () => void,
  role: 'charge' | 'triage' | 'admin',
  rerender: () => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  const roleLabel =
    role === 'charge' ? 'Charge Nurse' : role === 'triage' ? 'Triage Nurse' : 'Unit Secretary';
  overlay.innerHTML = `
    <div class="manage-dialog">
      <h3>Assign ${roleLabel}</h3>
      <select id="lead-select">
        <option value="">Unassigned</option>
        ${staffList
          .map((s) => `<option value="${s.id}">${s.name || s.id}</option>`)
          .join('')}
      </select>
      <div class="dialog-actions">
        <button id="lead-save" class="btn">Save</button>
        <button id="lead-cancel" class="btn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const sel = overlay.querySelector('#lead-select') as HTMLSelectElement;
  const currentId =
    role === 'charge'
      ? board.charge?.nurseId
      : role === 'triage'
      ? board.triage?.nurseId
      : board.admin?.nurseId;
  if (currentId) sel.value = currentId;

  overlay.querySelector('#lead-cancel')!.addEventListener('click', () =>
    overlay.remove()
  );
  overlay.querySelector('#lead-save')!.addEventListener('click', () => {
    const id = sel.value;
    if (id) {
      const moved = upsertSlot(board, role, { nurseId: id });
      if (moved) showBanner('Previous assignment cleared');
    } else {
      if (removeSlot(board, role)) showBanner('Assignment cleared');
    }
    save();
    overlay.remove();
    rerender();
  });
}
