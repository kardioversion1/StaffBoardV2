// mainBoard.ts — merged & de-conflicted

import {
  DB,
  KS,
  getConfig,
  STATE,
  loadStaff,
  saveStaff,
  Staff,
  ActiveBoard,
  CURRENT_SCHEMA_VERSION,
  migrateActiveBoard,
} from '@/state';
import { setNurseCache, labelFromId } from '@/utils/names';
import { renderWidgets } from './widgets';
import { nurseTile } from './nurseTile';
import { debouncedSave } from '@/utils/debouncedSave';
import './mainBoard/boardLayout.css';
import { startBreak, endBreak, moveSlot, type Slot } from '@/slots';
import { canonNurseType } from '@/domain/lexicon';
import { normalizeZones, normalizeActiveZones, type ZoneDef } from '@/utils/zones';

// Palette used to pair zone background with a readable nurse tile bg in dark mode
const PALETTE: [string, string][] = [
  ['#3b82f6', '#60a5fa'],
  ['#2563eb', '#3b82f6'],
  ['#1d4ed8', '#2563eb'],
  ['#ef4444', '#f87171'],
  ['#b91c1c', '#ef4444'],
  ['#10b981', '#34d399'],
  ['#047857', '#10b981'],
  ['#8b5cf6', '#a78bfa'],
];

// --- helpers ---------------------------------------------------------------

function buildEmptyActive(
  dateISO: string,
  shift: 'day' | 'night',
  zones: ZoneDef[]
): ActiveBoard {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(
      [...zones.map((z) => z.name), 'Bullpen'].map((z) => [z, [] as Slot[]])
    ),
    incoming: [],
    offgoing: [],
    comments: '',
    huddle: '',
    handoff: '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

// --- top-level render ------------------------------------------------------

/** Render the main board view. */
export async function renderBoard(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  try {
    const cfg = getConfig();
      if (!cfg.zones) cfg.zones = [];
      if (!cfg.zones.some((z: ZoneDef) => z.name === 'Bullpen')) {
        cfg.zones.push(normalizeZones(['Bullpen'])[0]);
      }

    const staff: Staff[] = await loadStaff();
    setNurseCache(staff);

    // Load or initialize active shift tuple
    const saveKey = KS.ACTIVE(ctx.dateISO, ctx.shift);
      let active = await DB.get<ActiveBoard>(saveKey);
      if (!active) {
        active = buildEmptyActive(ctx.dateISO, ctx.shift, cfg.zones);
      } else {
        active = migrateActiveBoard(active);
      }
      normalizeActiveZones(active, cfg.zones);

    // Layout
    root.innerHTML = `
      <div class="layout" data-testid="main-board">
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

          <section id="widgets" class="panel">
            <h3>Ops Widgets</h3>
            <div id="widgets-body"></div>
          </section>
        </div>
      </div>
    `;

    // Debounced save
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
    await renderWidgets(document.getElementById('widgets-body')!);

    // Re-render on config changes (e.g., zone list or colors)
    document.addEventListener('config-changed', () => {
      const c = getConfig();
      renderLeadership(active);
      renderZones(active, c, staff, queueSave);
    });
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
      renderBoard(root, ctx);
    });
  }
}

// --- leadership ------------------------------------------------------------

function renderLeadership(active: ActiveBoard) {
  const cfg = getConfig();
  const chargeEl = document.getElementById('slot-charge') as HTMLElement;
  const triageEl = document.getElementById('slot-triage') as HTMLElement;

  chargeEl.textContent = labelFromId(active.charge?.nurseId);
  triageEl.textContent = labelFromId(active.triage?.nurseId);

  chargeEl.style.display =
    active.charge?.nurseId || cfg.showPinned?.charge ? '' : 'none';
  triageEl.style.display =
    active.triage?.nurseId || cfg.showPinned?.triage ? '' : 'none';

  const adminEl = document.getElementById('slot-admin') as HTMLElement;
  if (active.admin?.nurseId) {
    adminEl.style.display = '';
    adminEl.textContent = labelFromId(active.admin.nurseId);
  } else {
    adminEl.style.display = 'none';
    adminEl.textContent = '';
  }
}

// --- zones & tiles ---------------------------------------------------------

function renderZones(active: ActiveBoard, cfg: any, staff: Staff[], save: () => void) {
  const cont = document.getElementById('zones')!;
  cont.innerHTML = '';
  const zones: ZoneDef[] = cfg.zones || [];

  zones.forEach((z: ZoneDef, i: number) => {
    const zName = z.name;
    const section = document.createElement('section');
    section.className = 'zone-card';
    section.setAttribute('data-testid', 'zone-card');

    // Color: explicit or palette variables
    const explicit = z.color || cfg.zoneColors?.[zName];
    if (explicit) {
      section.style.background = explicit;
      // If explicit color matches our palette's first color, use its paired nurse tile color
      const match = PALETTE.find(([zone]) => zone.toLowerCase() === String(explicit).toLowerCase());
      if (match) section.style.setProperty('--nurse-bg', match[1]);
    } else {
      // Fall back to CSS var palette; using 8 to match PALETTE length
      const zi = (i % 8) + 1;
      const ni = ((i + 1) % 8) + 1;
      section.style.setProperty('--zone-bg', `var(--zone-bg-${zi})`);
      section.style.setProperty('--nurse-bg', `var(--nurse-bg-${ni})`);
    }

    const title = document.createElement('h2');
    title.className = 'zone-card__title';
    title.textContent = zName;
    section.appendChild(title);

    const body = document.createElement('div');
    body.className = 'zone-card__body';

    (active.zones[zName] || []).forEach((s: Slot, idx: number) => {
      const st = staff.find((n) => n.id === s.nurseId);
      if (!st) {
        console.warn('Unknown staffId', s.nurseId);
        return;
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
      row.appendChild(tileWrapper.firstElementChild!);

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
          z.name,
          idx,
          active,
          cfg
        )
      );

      row.appendChild(btn);
      body.appendChild(row);
    });

    section.appendChild(body);
    cont.appendChild(section);
  });
}

// --- comments --------------------------------------------------------------

function wireComments(active: ActiveBoard, save: () => void) {
  const el = document.getElementById('comments') as HTMLTextAreaElement;
  if (!el) return;

  el.value = active.comments || '';
  el.disabled = STATE.locked;

  el.addEventListener('input', () =>
    debouncedSave(
      () => {
        active.comments = el.value;
      },
      () => save()
    )
  );
}

// --- incoming & offgoing ---------------------------------------------------

function renderIncoming(active: ActiveBoard, save: () => void) {
  const cont = document.getElementById('incoming')!;
  cont.innerHTML = '';

  active.incoming.forEach((inc: any) => {
    const div = document.createElement('div');
    const name = labelFromId(inc.nurseId);
    div.textContent = `${name} ${inc.eta}${inc.arrived ? ' ✓' : ''}`;
    div.addEventListener('click', () => {
      if (STATE.locked) return;
      inc.arrived = !inc.arrived;
      save();
      renderIncoming(active, save);
    });
    cont.appendChild(div);
  });

  const btn = document.getElementById('add-incoming') as HTMLButtonElement;
  if (btn) {
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
}

function renderOffgoing(active: ActiveBoard, save: () => void) {
  const cont = document.getElementById('offgoing')!;
  const cutoff = Date.now() - 60 * 60 * 1000; // 60 min
  active.offgoing = (active.offgoing || []).filter((o: any) => o.ts > cutoff);

  cont.innerHTML = '';
  for (const o of active.offgoing) {
    const div = document.createElement('div');
    div.textContent = labelFromId(o.nurseId);
    cont.appendChild(div);
  }
  save();
}

// --- manage overlay --------------------------------------------------------

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

  const currentRole = st.role;

  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `
    <div class="manage-dialog">
      <h3>Manage ${st.name || labelFromId(st.id)}</h3>
      <label>Name <input id="mg-name" value="${st.name || ''}"></label>
      <label>RF <input id="mg-rf" type="number" value="${st.rf ?? ''}"></label>
      <label>Role <select id="mg-role">
        <option value="nurse"${currentRole === 'nurse' ? ' selected' : ''}>Nurse</option>
        <option value="tech"${currentRole === 'tech' ? ' selected' : ''}>Tech</option>
      </select></label>
      <div id="mg-type-wrap" style="display:${currentRole === 'nurse' ? '' : 'none'}">
        <label>Type <select id="mg-type">
          <option value="home"${st.type === 'home' ? ' selected' : ''}>home</option>
          <option value="travel"${st.type === 'travel' ? ' selected' : ''}>travel</option>
          <option value="flex"${st.type === 'flex' ? ' selected' : ''}>flex</option>
          <option value="charge"${st.type === 'charge' ? ' selected' : ''}>charge</option>
          <option value="triage"${st.type === 'triage' ? ' selected' : ''}>triage</option>
          <option value="other"${st.type === 'other' ? ' selected' : ''}>other</option>
        </select></label>
      </div>
      <label>Student <input id="mg-student" value="${typeof slot.student === 'string' ? slot.student : ''}"></label>
      <label>Comment <input id="mg-comment" value="${slot.comment || ''}"></label>
      <label><input type="checkbox" id="mg-break" ${slot.break?.active ? 'checked' : ''}/> On break</label>
      <label><input type="checkbox" id="mg-bad" ${slot.bad ? 'checked' : ''}/> Bad</label>
      <label>End time <input id="mg-end" type="time" value="${slot.endTimeOverrideHHMM || ''}"></label>
      <label>Zone <select id="mg-zone">
        ${(cfg.zones || [])
          .map((z: ZoneDef) => `<option value="${z.name}"${z.name === zone ? ' selected' : ''}>${z.name}</option>`)
          .join('')}
      </select></label>
      <div class="dialog-actions">
        <button id="mg-save" class="btn">Save</button>
        <button id="mg-dto" class="btn">DTO</button>
        <button id="mg-cancel" class="btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const roleSel = overlay.querySelector('#mg-role') as HTMLSelectElement;
  const typeWrap = overlay.querySelector('#mg-type-wrap') as HTMLElement;
  roleSel.addEventListener('change', () => {
    typeWrap.style.display = roleSel.value === 'nurse' ? '' : 'none';
  });

  overlay.querySelector('#mg-cancel')!.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#mg-dto')!.addEventListener('click', async () => {
    // End shift early: move to offgoing (kept for 60 min by renderOffgoing)
    board.zones[zone].splice(index, 1);
    board.offgoing.push({ nurseId: st.id, ts: Date.now() });

    // Append to history
    const hist = (await DB.get<any[]>(KS.HISTORY)) || [];
    hist.push({
      nurseId: st.id,
      dateISO: board.dateISO,
      shift: board.shift,
      endedISO: new Date().toISOString(),
    });
    await DB.set(KS.HISTORY, hist);

    save();
    overlay.remove();
    rerender();
  });

  overlay.querySelector('#mg-save')!.addEventListener('click', () => {
    // Basic fields
    st.name = (overlay.querySelector('#mg-name') as HTMLInputElement).value.trim() || undefined;

    const rfVal = (overlay.querySelector('#mg-rf') as HTMLInputElement).value.trim();
    st.rf = rfVal ? Number(rfVal) : undefined;

    const selectedRole = roleSel.value as Staff['role'];
    st.role = selectedRole;

    // Only nurses have a nurse type
    if (st.role === 'nurse') {
      const tval = (overlay.querySelector('#mg-type') as HTMLSelectElement).value;
      const canon = canonNurseType(tval) || st.type;
      st.type = canon as any;
    }

    // Slot-level fields
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

    // Zone move
    const zoneSel = overlay.querySelector('#mg-zone') as HTMLSelectElement;
    if (zoneSel.value !== zone) {
      moveSlot(board, { zone, index }, { zone: zoneSel.value });
    }

    // Persist
    saveStaff(staffList); // best-effort staff write
    save();               // board tuple
    overlay.remove();
    rerender();
  });
}
