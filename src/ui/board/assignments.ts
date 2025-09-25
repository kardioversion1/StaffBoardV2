import {
  STATE,
  saveStaff,
  saveConfig,
  type ActiveBoard,
  type Config,
  type Slot,
  type Staff,
} from '@/state';
import { labelFromId } from '@/utils/names';
import { nurseTile } from '../nurseTile';
import {
  startBreak,
  endBreak,
  moveSlot,
  upsertSlot,
} from '@/slots';
import { showBanner } from '@/ui/banner';
import { openAssignDialog } from '@/ui/assignDialog';
import type { ParentNode } from 'happy-dom';
import { renderIncoming } from './incoming';

/** Default end time 12h after start. */
export const defaultEnd = (start: string): string => {
  const [h, m] = start.split(':').map(Number);
  const end = (h * 60 + m + 12 * 60) % 1440;
  const hh = String(Math.floor(end / 60)).padStart(2, '0');
  const mm = String(end % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

/** Create the Assignments panel. */
export function createAssignmentsPanel(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `
    <h3>Assignments</h3>
    <div id="zones" class="zones-grid"></div>
  `;
  return section;
}

/** Render all zone assignments. */
export function renderAssignments(
  active: ActiveBoard,
  cfg: Config,
  staff: Staff[],
  save: () => void,
  root: ParentNode
): void {
  const pctCont = root.querySelector('#pct-zones') as HTMLElement | null;
  const cont = root.querySelector('#zones') as HTMLElement | null;
  if (!pctCont || !cont) {
    console.warn('Missing zones container');
    return;
  }
  pctCont.innerHTML = '';
  cont.innerHTML = '';
  pctCont.style.minHeight = '40px';
  cont.style.minHeight = '40px';
  const zones: any[] = cfg.zones || [];

  zones.forEach((z: any, i: number) => {
    const zName = z.name;
    const section = document.createElement('section');
    section.className = 'zone-card';
    section.setAttribute('data-testid', 'zone-card');
    section.draggable = true;
    section.addEventListener('dragstart', (e) => {
      const ev = e as DragEvent;
      ev.dataTransfer?.setData('zone-index', String(i));
    });

    section.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    section.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = (e as DragEvent).dataTransfer;
      const nurseId = dt?.getData('incoming-id');
      if (nurseId) {
        const rawEnd = prompt('Shift end time (HH:MM)?')?.trim();
        const end = rawEnd && /^\d{4}$/.test(rawEnd)
          ? rawEnd.replace(/(\d{2})(\d{2})/, '$1:$2')
          : rawEnd;
        const slot: Slot = {
          nurseId,
          startHHMM: STATE.clockHHMM,
          endTimeOverrideHHMM: end || defaultEnd(STATE.clockHHMM),
        };
        const moved = upsertSlot(active, { zone: z.name }, slot);
        if (moved) showBanner('Previous assignment cleared');
        active.incoming = active.incoming.filter((i) => i.nurseId !== nurseId);
        save();
        renderIncoming(active, staff, save);
        renderAssignments(active, cfg, staff, save, root);
        return;
      }

      const zoneIdxStr = dt?.getData('zone-index');
      if (!zoneIdxStr) return;
      const fromIdx = Number(zoneIdxStr);
      if (isNaN(fromIdx) || fromIdx === i) return;
      const [moved] = cfg.zones.splice(fromIdx, 1);
      moved.pct = z.pct;
      cfg.zones.splice(i, 0, moved);
      await saveConfig({ zones: cfg.zones });
      renderAssignments(active, cfg, staff, save, root);
    });

    const explicit = z.color || cfg.zoneColors?.[zName];
    if (explicit) {
      section.style.setProperty('--zone-color', explicit);
    } else {
      const zi = (i % 8) + 1;
      section.style.setProperty('--zone-color', `var(--zone-bg-${zi})`);
    }

    const title = document.createElement('h2');
    title.className = 'zone-card__title';
    title.textContent = zName;
    section.appendChild(title);

    const editBtn = document.createElement('button');
    editBtn.textContent = '⚙';
    editBtn.className = 'zone-card__edit';
    editBtn.title = 'Edit zone';
    editBtn.addEventListener('click', async () => {
      const val = prompt('Rename zone', z.name)?.trim();
      if (val && val !== z.name) {
        if (cfg.zones.some((zz) => zz.name === val)) {
          alert('A zone with that name already exists.');
          return;
        }
        const idx = cfg.zones.findIndex((zz) => zz.name === z.name);
        cfg.zones[idx].name = val;
        if (cfg.zoneColors && cfg.zoneColors[z.name]) {
          cfg.zoneColors[val] = cfg.zoneColors[z.name];
          delete cfg.zoneColors[z.name];
        }
        active.zones[val] = active.zones[z.name] || [];
        delete active.zones[z.name];
        await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
        document.dispatchEvent(new Event('config-changed'));
        await save();
        renderAssignments(active, cfg, staff, save, root);
      }
    });
    section.appendChild(editBtn);

    const body = document.createElement('div');
    body.className = 'zone-card__body';

    (active.zones[zName] || []).forEach((s: Slot, idx: number) => {
      let st = staff.find((n) => n.id === s.nurseId);
      if (!st) {
        console.warn('Unknown staffId', s.nurseId);
        st = {
          id: s.nurseId,
          name: s.nurseId,
          role: 'nurse',
          type: 'other',
        } as Staff;
      }

      const row = document.createElement('div');
      row.className = 'nurse-row';

      const tileWrapper = document.createElement('div');
      tileWrapper.innerHTML = nurseTile(s, {
        id: st.id,
        name: st.name,
        role: st.role || 'nurse',
        type: st.type || 'other',
      } as Staff);
      const tile = tileWrapper.firstElementChild as HTMLElement;
      row.appendChild(tile);
      if (s.assignedTs && Date.now() - s.assignedTs < 15 * 60 * 1000) {
        tile.classList.add('recent-assignment');
        const remaining = 15 * 60 * 1000 - (Date.now() - s.assignedTs);
        setTimeout(() => tile.classList.remove('recent-assignment'), remaining);
      }

      const btn = document.createElement('button');
      btn.textContent = 'Manage';
      btn.className = 'btn';
      btn.addEventListener('click', () =>
        manageSlot(
          s,
          st!,
          staff,
          save,
          () => renderAssignments(active, cfg, staff, save, root),
          z.name,
          idx,
          active,
          cfg
        )
      );

      row.appendChild(btn);
      body.appendChild(row);
    });

    const hasSlots = (active.zones[zName] || []).length > 0;
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.className = hasSlots
      ? 'zone-card__add zone-card__add--small'
      : 'zone-card__add zone-card__add--large';
    addBtn.title = 'Add staff';
    addBtn.addEventListener('click', () => {
      openAssignDialog(staff, (id) => {
        const slot: Slot = {
          nurseId: id,
          startHHMM: STATE.clockHHMM,
          endTimeOverrideHHMM: defaultEnd(STATE.clockHHMM),
        };
        const moved = upsertSlot(active, { zone: z.name }, slot);
        if (moved) showBanner('Previous assignment cleared');
        save();
        renderAssignments(active, cfg, staff, save, root);
      });
    });
    if (hasSlots) {
      section.appendChild(addBtn);
    } else {
      body.appendChild(addBtn);
    }

    section.appendChild(body);
    (z.pct ? pctCont : cont).appendChild(section);
  });

  const enableDrop = (container: HTMLElement, pct: boolean) => {
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const zoneIdxStr = (e as DragEvent).dataTransfer?.getData('zone-index');
      if (!zoneIdxStr) return;
      const idx = Number(zoneIdxStr);
      if (isNaN(idx)) return;
      cfg.zones[idx].pct = pct;
      await saveConfig({ zones: cfg.zones });
      renderAssignments(active, cfg, staff, save, root);
    });
  };

  enableDrop(pctCont, true);
  enableDrop(cont, false);
}

function manageSlot(
  slot: Slot,
  st: Staff,
  staffList: Staff[],
  save: () => void,
  rerender: () => void,
  zone: string,
  index: number,
  board: ActiveBoard,
  cfg: Config
): void {
  const startValue = slot.startHHMM || STATE.clockHHMM;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const duration = cfg.shiftDurations?.[STATE.shift] ?? 12;
  let endValue = slot.endTimeOverrideHHMM && /^\d{4}$/.test(slot.endTimeOverrideHHMM)
    ? slot.endTimeOverrideHHMM.replace(/(\d{2})(\d{2})/, '$1:$2')
    : slot.endTimeOverrideHHMM || '';
  if (!endValue && startValue) {
    const [sh, sm] = startValue.split(':').map(Number);
    const end = new Date();
    end.setHours(sh + duration, sm);
    endValue = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `
    <div class="manage-dialog">
      <div class="manage-header">
        <div class="role-chip">${st.role === 'nurse' ? 'RN' : 'TECH'}</div>
        <h3>${st.name || labelFromId(st.id)}</h3>
        <div class="staff-type">${st.type}</div>
      </div>
      <div class="manage-grid">
        <div class="manage-col">
          <label>Start <input id="mg-start" type="time" value="${startValue}" disabled></label>
          <label>End <input id="mg-end" type="time" required value="${endValue}"></label>
          <label>RF <input id="mg-rf" type="number" value="${st.rf ?? ''}"></label>
        </div>
        <div class="manage-col">
          <label class="mod"><span class="icon">🎓</span><input id="mg-student" placeholder="Student" value="${typeof slot.student === 'string' ? slot.student : ''}"></label>
          <label class="mod"><span class="icon">☕</span><input type="checkbox" id="mg-break" ${slot.break?.active ? 'checked' : ''}/> Break</label>
          <label class="mod"><span class="icon">🔥</span><input type="checkbox" id="mg-high" ${slot.highAcuityUntil && slot.highAcuityUntil > Date.now() ? 'checked' : ''}/> High acuity</label>
          <label class="mod">Zone <select id="mg-zone">
            ${(cfg.zones || [])
              .map((z: any) => `<option value="${z.name}"${z.name === zone ? ' selected' : ''}>${z.name}</option>`)
              .join('')}
          </select></label>
        </div>
      </div>
      <div class="dialog-actions">
        <button id="mg-save" class="btn">Save</button>
        <button id="mg-cancel" class="btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mg-cancel')!.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#mg-save')!.addEventListener('click', async () => {
    const rfVal = (overlay.querySelector('#mg-rf') as HTMLInputElement).value.trim();
    st.rf = rfVal ? Number(rfVal) : undefined;

    const studVal = (overlay.querySelector('#mg-student') as HTMLInputElement).value.trim();
    slot.student = studVal ? studVal : undefined;

    const breakChecked = (overlay.querySelector('#mg-break') as HTMLInputElement).checked;
    if (breakChecked && !slot.break?.active) startBreak(slot, {});
    if (!breakChecked && slot.break?.active) endBreak(slot);

    const highChecked = (overlay.querySelector('#mg-high') as HTMLInputElement).checked;
    slot.highAcuityUntil = highChecked ? Date.now() + 2 * 60 * 60 * 1000 : undefined;

    const endVal = (overlay.querySelector('#mg-end') as HTMLInputElement).value;
    slot.endTimeOverrideHHMM = endVal;

    const zoneSel = overlay.querySelector('#mg-zone') as HTMLSelectElement;
    if (zoneSel.value !== zone) {
      const moved = moveSlot(board, { zone, index }, { zone: zoneSel.value });
      if (moved) showBanner('Previous assignment cleared');
    }

    await saveStaff(staffList);
    save();
    overlay.remove();
    rerender();
  });
}
