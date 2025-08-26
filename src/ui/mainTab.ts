import { DB, KS, getConfig, STATE, loadStaff, saveStaff, Staff } from '@/state';
import { setNurseCache, labelFromId } from '@/utils/names';
import { renderWidgets } from './widgets';
import { nurseTile } from './nurseTile';
import { startBreak, endBreak, moveSlot, type Slot } from '@/slots';
import { canonNurseType } from '@/domain/lexicon';

function buildEmptyActive(dateISO: string, shift: 'day' | 'night', zones: string[]) {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(
      [...zones, 'Bullpen'].map((z) => [z, [] as any[]])
    ),
    incoming: [],
    offgoing: [],
    comments: '',
  };
}

export async function renderMain(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  try {
    const cfg = getConfig();
    if (!cfg.zones.includes('Bullpen')) cfg.zones.push('Bullpen');
    const staff: Staff[] = await loadStaff();
    setNurseCache(staff);
    let active: any = await DB.get(KS.ACTIVE(ctx.dateISO, ctx.shift));
    if (!active) active = buildEmptyActive(ctx.dateISO, ctx.shift, cfg.zones || []);

    root.innerHTML = `
    <div class="layout">
      <div class="col col-left">
        <section class="panel">
          <h3>Leadership</h3>
          <div class="slots lead">
            <div id="slot-charge"></div>
            <div id="slot-triage"></div>
            <div id="slot-admin" style="display:none"></div>
          </div>
        </section>

        <section class="panel">
          <h3>Assignments (TV Landscape)</h3>
          <div id="zones" class="zones-grid"></div>
        </section>

        <section class="panel">
          <h3>Comments</h3>
          <textarea id="comments" class="input" placeholder="Current Status..."></textarea>
        </section>
      </div>

      <div class="col col-right">
        <section class="panel">
          <h3>Physicians (read-only)</h3>
          <div id="phys"></div>
        </section>

        <section class="panel">
          <h3>Incoming (click to toggle arrived)</h3>
          <button id="add-incoming" class="btn">+ Add</button>
          <div id="incoming"></div>
        </section>

        <section class="panel">
          <h3>Offgoing (kept 40 min)</h3>
          <div id="offgoing"></div>
        </section>

        <section class="panel">
          <h3>Clock</h3>
          <div id="clock" class="clock"></div>
        </section>

        <section id="widgets" class="panel">
          <h3>Ops Widgets</h3>
          <div id="widgets-body"></div>
        </section>
      </div>
    </div>
  `;

    const saveKey = KS.ACTIVE(ctx.dateISO, ctx.shift);
    let saveTimer: any;
    const queueSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => DB.set(saveKey, active), 300);
    };

    renderLeadership(active);
    renderZones(active, cfg, staff, queueSave);
    wireComments(active, queueSave);
    renderIncoming(active, queueSave);
    renderOffgoing(active, queueSave);
    renderClock();
    await renderWidgets(document.getElementById('widgets-body')!);
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <section class="panel">
        <p>Couldn't render board. See console.</p>
        <button id="reset-tuple" class="btn">Reset tuple</button>
      </section>
    `;
    document.getElementById('reset-tuple')?.addEventListener('click', async () => {
      await DB.del(KS.ACTIVE(ctx.dateISO, ctx.shift));
      renderMain(root, ctx);
    });
  }
}

function renderLeadership(active: any) {
  (document.getElementById('slot-charge') as HTMLElement).textContent =
    labelFromId(active.charge?.nurseId);
  (document.getElementById('slot-triage') as HTMLElement).textContent =
    labelFromId(active.triage?.nurseId);
  const adminEl = document.getElementById('slot-admin') as HTMLElement;
  if (active.admin?.nurseId) {
    adminEl.style.display = '';
    adminEl.textContent = labelFromId(active.admin.nurseId);
  } else {
    adminEl.style.display = 'none';
    adminEl.textContent = '';
  }
}

function renderZones(active: any, cfg: any, staff: Staff[], save: () => void) {
  const cont = document.getElementById('zones')!;
  cont.innerHTML = '';
  for (const z of cfg.zones || []) {
    const div = document.createElement('div');
    const h = document.createElement('h4');
    h.textContent = z;
    div.appendChild(h);
    const list = document.createElement('div');
    (active.zones[z] || []).forEach((s: Slot, idx: number) => {
      const item = document.createElement('div');
      const st = staff.find((n) => n.id === s.nurseId);
      const tileWrapper = document.createElement('div');
      tileWrapper.innerHTML = nurseTile(s, {
        id: st?.id || s.nurseId,
        name: st?.name,
        type: st?.type || 'other',
      } as Staff);
      item.appendChild(tileWrapper.firstElementChild!);
      const btn = document.createElement('button');
      btn.textContent = 'Manage';
      btn.className = 'btn';
      btn.addEventListener('click', () =>
        manageSlot(
          s,
          st,
          staff,
          save,
          () => renderZones(active, cfg, staff, save),
          z,
          idx,
          active,
          cfg
        )
      );
      item.appendChild(btn);
      list.appendChild(item);
    });
    div.appendChild(list);
    cont.appendChild(div);
  }
}

function wireComments(active: any, save: () => void) {
  const el = document.getElementById('comments') as HTMLTextAreaElement;
  el.value = active.comments || '';
  el.disabled = STATE.locked;
  el.addEventListener('input', () => {
    active.comments = el.value;
    save();
  });
}

function renderIncoming(active: any, save: () => void) {
  const cont = document.getElementById('incoming')!;
  cont.innerHTML = '';
  active.incoming.forEach((inc: any) => {
    const div = document.createElement('div');
    div.textContent = `${labelFromId(inc.nurseId)} ${inc.eta}${inc.arrived ? ' ✓' : ''}`;
    div.addEventListener('click', () => {
      if (STATE.locked) return;
      inc.arrived = !inc.arrived;
      save();
      renderIncoming(active, save);
    });
    cont.appendChild(div);
  });
  const btn = document.getElementById('add-incoming') as HTMLButtonElement;
  btn.disabled = STATE.locked;
  btn.onclick = () => {
    if (STATE.locked) return;
    const nurse = prompt('Nurse ID?');
    if (!nurse) return;
    const eta = prompt('ETA?') || '';
    active.incoming.push({ nurseId: nurse, eta });
    save();
    renderIncoming(active, save);
  };
}

function renderOffgoing(active: any, save: () => void) {
  const cont = document.getElementById('offgoing')!;
  const cutoff = Date.now() - 40 * 60 * 1000;
  active.offgoing = active.offgoing.filter((o: any) => o.ts > cutoff);
  cont.innerHTML = '';
  for (const o of active.offgoing) {
    const div = document.createElement('div');
    div.textContent = labelFromId(o.nurseId);
    cont.appendChild(div);
  }
  save();
}

function renderClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = STATE.clockHHMM;
}

function manageSlot(
  slot: Slot,
  st: Staff | undefined,
  staffList: Staff[],
  save: () => void,
  rerender: () => void,
  zone: string,
  index: number,
  board: any,
  cfg: any
): void {
  if (!st) return;
  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `<div class="manage-dialog">
    <h3>Manage ${st.name || labelFromId(st.id)}</h3>
    <label>Name <input id="mg-name" value="${st.name || ''}"></label>
    <label>RF <input id="mg-rf" type="number" value="${st.rf ?? ''}"></label>
    <label>Role <select id="mg-role">
      <option value="rn"${st.role === 'rn' ? ' selected' : ''}>RN</option>
      <option value="tech"${st.role === 'tech' ? ' selected' : ''}>Tech</option>
      <option value="sitter"${st.role === 'sitter' ? ' selected' : ''}>Sitter</option>
      <option value="ancillary"${st.role === 'ancillary' ? ' selected' : ''}>Ancillary</option>
      <option value="admin"${st.role === 'admin' ? ' selected' : ''}>Admin</option>
    </select></label>
    <div id="mg-type-wrap" style="display:${st.role === 'rn' ? '' : 'none'}">
      <label>Type <select id="mg-type">
        <option value="home"${st.type === 'home' ? ' selected' : ''}>home</option>
        <option value="travel"${st.type === 'travel' ? ' selected' : ''}>travel</option>
        <option value="flex"${st.type === 'flex' ? ' selected' : ''}>flex</option>
        <option value="charge"${st.type === 'charge' ? ' selected' : ''}>charge</option>
        <option value="triage"${st.type === 'triage' ? ' selected' : ''}>triage</option>
        <option value="other"${st.type === 'other' ? ' selected' : ''}>other</option>
      </select></label>
    </div>
    <label>Student <input id="mg-student" value="${
      typeof slot.student === 'string' ? slot.student : ''
    }"></label>
    <label>Comment <input id="mg-comment" value="${slot.comment || ''}"></label>
    <label><input type="checkbox" id="mg-break" ${
      slot.break?.active ? 'checked' : ''
    } /> On break</label>
    <label><input type="checkbox" id="mg-bad" ${slot.bad ? 'checked' : ''}/> Bad</label>
    <label>End time <input id="mg-end" type="time" value="${
      slot.endTimeOverrideHHMM || ''
    }"></label>
    <label>Zone <select id="mg-zone">${cfg.zones
      .map((z: string) => `<option value="${z}"${z === zone ? ' selected' : ''}>${z}</option>`)
      .join('')}</select></label>
    <div class="dialog-actions">
      <button id="mg-save" class="btn">Save</button>
      <button id="mg-cancel" class="btn">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const roleSel = overlay.querySelector('#mg-role') as HTMLSelectElement;
  const typeWrap = overlay.querySelector('#mg-type-wrap') as HTMLElement;
  roleSel.addEventListener('change', () => {
    typeWrap.style.display = roleSel.value === 'rn' ? '' : 'none';
  });

  overlay.querySelector('#mg-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#mg-save')!.addEventListener('click', () => {
    st.name = (overlay.querySelector('#mg-name') as HTMLInputElement).value.trim() || undefined;
    const rfVal = (overlay.querySelector('#mg-rf') as HTMLInputElement).value.trim();
    st.rf = rfVal ? Number(rfVal) : undefined;
    st.role = roleSel.value as Staff['role'];
    if (st.role === 'rn') {
      const tval = (overlay.querySelector('#mg-type') as HTMLSelectElement).value;
      const canon = canonNurseType(tval) || st.type;
      st.type = canon as any;
    }
    const studVal = (overlay.querySelector('#mg-student') as HTMLInputElement).value.trim();
    slot.student = studVal ? studVal : undefined;
    const commentVal = (overlay.querySelector('#mg-comment') as HTMLInputElement).value.trim();
    slot.comment = commentVal ? commentVal : undefined;
    const breakChecked = (overlay.querySelector('#mg-break') as HTMLInputElement).checked;
    if (breakChecked && !slot.break?.active) startBreak(slot, {});
    if (!breakChecked && slot.break?.active) endBreak(slot);
    slot.bad = (overlay.querySelector('#mg-bad') as HTMLInputElement).checked;
    const endVal = (overlay.querySelector('#mg-end') as HTMLInputElement).value;
    slot.endTimeOverrideHHMM = endVal ? endVal : undefined;
    const zoneSel = overlay.querySelector('#mg-zone') as HTMLSelectElement;
    if (zoneSel.value !== zone) {
      moveSlot(board, { zone, index }, { zone: zoneSel.value });
    }
    saveStaff(staffList);
    save();
    overlay.remove();
    rerender();
  });
}
