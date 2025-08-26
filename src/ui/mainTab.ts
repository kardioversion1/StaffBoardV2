import { DB, KS, getConfig, STATE, loadStaff, saveStaff, Staff } from '@/state';
import { setNurseCache, labelFromId } from '@/utils/names';
import { renderWidgets } from './widgets';
import { nurseTile } from './nurseTile';
import { startBreak, endBreak, type Slot } from '@/slots';
import { canonNurseType } from '@/domain/lexicon';

function buildEmptyActive(dateISO: string, shift: 'day' | 'night', zones: string[]) {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries((zones || []).map((z) => [z, [] as any[]])),
    incoming: [],
    offgoing: [],
    support: { techs: [], vols: [], sitters: [] },
    comments: '',
  };
}

export async function renderMain(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  try {
    const cfg = getConfig();
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
          <h3>Support Staff</h3>
          <div class="support">
            <label>Techs <input id="techs" placeholder="Comma-separated..."></label>
            <label>Volunteers <input id="vols" placeholder="Comma-separated..."></label>
            <label>Sitters <input id="sitters" placeholder="Comma-separated..."></label>
          </div>
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
    renderSupport(active, queueSave);
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
    for (const s of active.zones[z] || []) {
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
        manageSlot(s, st, staff, save, () => renderZones(active, cfg, staff, save))
      );
      item.appendChild(btn);
      list.appendChild(item);
    }
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

function renderSupport(active: any, save: () => void) {
  const map: Record<string, string> = { techs: 'techs', vols: 'vols', sitters: 'sitters' };
  for (const [id, key] of Object.entries(map)) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.value = active.support[key].join(', ');
    input.disabled = STATE.locked;
    input.addEventListener('input', () => {
      active.support[key] = input.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      save();
    });
  }
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
  rerender: () => void
): void {
  if (!st) return;
  const name = prompt('Name', st.name || '');
  if (name !== null) st.name = name.trim() || undefined;

  const rfStr = prompt('RF number', st.rf ? String(st.rf) : '');
  if (rfStr !== null) st.rf = rfStr.trim() ? Number(rfStr) : undefined;

  const roleIn = prompt('Role (rn/tech/admin)', st.role || 'rn');
  if (roleIn !== null) {
    const r = (roleIn || '').toLowerCase();
    st.role = r === 'tech' ? 'tech' : r === 'admin' ? 'admin' : 'rn';
  }

  if (st.role === 'rn') {
    const typeIn = prompt('Nurse type (home/travel/flex/charge/triage/other)', st.type);
    if (typeIn !== null) {
      const canon = canonNurseType(typeIn) || st.type;
      st.type = canon as any;
    }
  }

  const stud = prompt(
    'Student (blank for none)',
    typeof slot.student === 'string' ? slot.student : ''
  );
  if (stud !== null) slot.student = stud.trim() ? stud.trim() : undefined;

  if (slot.break?.active) {
    if (confirm('End break?')) endBreak(slot);
  } else {
    if (confirm('Start break?')) startBreak(slot, {});
  }

  if (confirm(slot.bad ? 'Clear BAD?' : 'Mark BAD?')) slot.bad = !slot.bad;

  const comment = prompt('Comment', slot.comment || '');
  if (comment !== null) slot.comment = comment.trim() || undefined;

  saveStaff(staffList);
  save();
  rerender();
}
