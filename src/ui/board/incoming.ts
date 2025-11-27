import { DB, KS, STATE, type ActiveBoard, type DraftShift, type Slot, type Staff, getConfig } from '@/state';
import { nurseTile } from '../nurseTile';
import { labelFromId } from '@/utils/names';
import { openAssignDialog } from '@/ui/assignDialog';
import { upsertSlot } from '@/slots';
import { defaultEnd, renderAssignments } from './assignments';
import { showBanner } from '@/ui/banner';

/** Panel for incoming staff. */
export function createIncomingPanel(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'incoming-panel';
  section.className = 'panel';
  section.innerHTML = `
    <h3>Incoming (click to toggle arrived)</h3>
    <button id="add-incoming" class="btn">+ Add</button>
    <div id="incoming" class="min-h-40"></div>
  `;
  return section;
}

/** Render incoming staff list. */
export async function renderIncoming(
  active: ActiveBoard,
  staffList: Staff[],
  save: () => void,
  beforeChange: () => void = () => {}
) {
  const cont = document.getElementById('incoming')!;
  cont.innerHTML = '';

  const draft = await DB.get<DraftShift>(KS.DRAFT(STATE.dateISO, STATE.shift));
  let changed = false;
  if (draft) {
    const slots: Slot[] = [];
    if (draft.charge) slots.push(draft.charge);
    if (draft.triage) slots.push(draft.triage);
    if (draft.admin) slots.push(draft.admin);
    for (const arr of Object.values(draft.zones)) slots.push(...arr);
    const now = toMin(STATE.clockHHMM);
    for (const s of slots) {
      if (!s.startHHMM) continue;
      const diff = toMin(s.startHHMM) - now;
      if (diff <= 40 && diff >= 0) {
        if (!active.incoming.some((i) => i.nurseId === s.nurseId)) {
          beforeChange();
          active.incoming.push({ nurseId: s.nurseId, eta: s.startHHMM });
          changed = true;
        }
      }
    }
  }
  if (changed) save();

  if (active.incoming.length === 0) {
    cont.innerHTML = '<div class="incoming-placeholder"></div>';
  } else {
    active.incoming.forEach((inc) => {
      const st =
        staffList.find((s) => s.id === inc.nurseId) ||
        ({ id: inc.nurseId, name: inc.nurseId, role: 'nurse', type: 'other' } as Staff);

      const row = document.createElement('div');
      row.className = 'nurse-row';

      const tileWrapper = document.createElement('div');
      tileWrapper.innerHTML = nurseTile({ nurseId: inc.nurseId }, st);
      const card = tileWrapper.firstElementChild as HTMLElement;
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('incoming-id', inc.nurseId);
      });
      const toggleArrived = () => {
        if (STATE.locked) return;
        beforeChange();
        inc.arrived = !inc.arrived;
        const cfg = getConfig();
        const moved = autoAssignArrivals(active, cfg);
        save();
        void renderIncoming(active, staffList, save, beforeChange);
        if (moved) {
          renderAssignments(
            active,
            cfg,
            staffList,
            save,
            document.getElementById('panel')!,
            beforeChange
          );
        }
      };
      card.addEventListener('click', toggleArrived);
      row.appendChild(card);

      const eta = document.createElement('div');
      eta.textContent = `${inc.eta}${inc.arrived ? ' ✓' : ''}`;
      eta.addEventListener('click', toggleArrived);
      row.appendChild(eta);

      cont.appendChild(row);
    });
  }

  const btn = document.getElementById('add-incoming') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = STATE.locked;
    btn.onclick = () => {
      if (STATE.locked) return;
      openAssignDialog(staffList, (id) => {
        const overlay = document.createElement('div');
        overlay.className = 'manage-overlay';
        overlay.innerHTML = `
          <div class="manage-dialog">
            <h3>Add Incoming</h3>
            <p>${labelFromId(id)}</p>
            <label>ETA <input id="inc-eta" placeholder="HH:MM"></label>
            <div class="dialog-actions">
              <button id="inc-save" class="btn">Save</button>
              <button id="inc-cancel" class="btn">Cancel</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        const etaEl = overlay.querySelector('#inc-eta') as HTMLInputElement | null;
        const saveBtn = overlay.querySelector('#inc-save') as HTMLButtonElement | null;
        const cancelBtn = overlay.querySelector('#inc-cancel') as HTMLButtonElement | null;
        saveBtn?.addEventListener('click', () => {
          beforeChange();
          active.incoming.push({ nurseId: id, eta: (etaEl?.value || '').trim() });
          save();
          void renderIncoming(active, staffList, save, beforeChange);
          overlay.remove();
        });
        cancelBtn?.addEventListener('click', () => overlay.remove());
      });
    };
  }
}

/** Auto-assign arrivals that are due. */
export function autoAssignArrivals(active: ActiveBoard, cfg: any): boolean {
  const auxName = 'Aux 1';
  if (!cfg.zones?.some((z: any) => z.name === auxName) || !active.zones[auxName]) {
    return false;
  }
  const now = toMin(STATE.clockHHMM);
  let moved = false;
  active.incoming = active.incoming.filter((inc) => {
    if (inc.arrived && inc.eta && toMin(inc.eta) <= now) {
      upsertSlot(active, {
        zone: auxName,
      }, {
        nurseId: inc.nurseId,
        startHHMM: inc.eta,
        endTimeOverrideHHMM: defaultEnd(inc.eta),
      });
      moved = true;
      return false;
    }
    return true;
  });
  if (moved) showBanner('Previous assignment cleared');
  return moved;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
