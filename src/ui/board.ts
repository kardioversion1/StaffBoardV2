// mainBoard.ts — merged & de-conflicted

import {
  DB,
  KS,
  getConfig,
  saveConfig,
  STATE,
  loadStaff,
  saveStaff,
  Staff,
  ActiveBoard,
  CURRENT_SCHEMA_VERSION,
  migrateActiveBoard,
  setActiveBoardCache,
} from '@/state';
import { setNurseCache, labelFromId } from '@/utils/names';
import { renderWeather } from './widgets';
import { renderPhysicians } from './physicians';
import { nurseTile } from './nurseTile';
import { debouncedSave } from '@/utils/debouncedSave';
import './mainBoard/boardLayout.css';
import { startBreak, endBreak, moveSlot, upsertSlot, removeSlot, type Slot } from '@/slots';
import { canonNurseType } from '@/domain/lexicon';
import { normalizeActiveZones, type ZoneDef } from '@/utils/zones';
import type { DraftShift } from '@/state';

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
    zones: Object.fromEntries(zones.map((z) => [z.name, [] as Slot[]])),
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
      setActiveBoardCache(active);

    // Layout
    root.innerHTML = `
      <div class="layout" data-testid="main-board">
        <div class="col col-left">
          <section class="panel">
            <h3>Patient Care Team</h3>
            <div class="slots lead">
              <div id="slot-charge"></div>
              <div id="slot-triage"></div>
              <div id="slot-secretary"></div>
            </div>
            <div id="pct-zones" class="zones-grid"></div>
          </section>

          <section class="panel">
            <h3>Assignments</h3>
            <div id="zones" class="zones-grid"></div>
          </section>

          <section class="panel">
            <h3>Comments</h3>
            <textarea id="comments" class="input" placeholder="Current Status..."></textarea>
          </section>
        </div>

        <div class="col col-right">
          <section id="weather" class="panel">
            <h3>Weather</h3>
            <div id="weather-body"></div>
          </section>

          <section class="panel">
            <h3>Incoming (click to toggle arrived)</h3>
            <button id="add-incoming" class="btn">+ Add</button>
            <div id="incoming" style="min-height:40px"></div>
          </section>

          <section class="panel">
            <h3>Offgoing (kept 40 min)</h3>
            <div id="offgoing"></div>
          </section>

          <section class="panel">
            <h3>Physicians (read-only)</h3>
            <div id="phys"></div>
          </section>
        </div>
      </div>
    `;

    // Debounced save
    let saveTimer: any;
    const queueSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        DB.set(saveKey, active);
        Server.save('active', active).catch(() => {});
      }, 300);
    };

    renderLeadership(active, staff, queueSave);
    renderZones(active, cfg, staff, queueSave);
    wireComments(active, queueSave);
    await renderIncoming(active, queueSave);
    renderOffgoing(active, queueSave);
    await renderWeather(document.getElementById('weather-body')!);
    await renderPhysicians(
      document.getElementById('phys') as HTMLElement,
      ctx.dateISO
    );

    // Removed testBoardFit call; allow natural scroll for overflow

    // Re-render on config changes (e.g., zone list or colors)
    document.addEventListener('config-changed', () => {
      const c = getConfig();
      renderLeadership(active, staff, queueSave);
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

function renderLeadership(
  active: ActiveBoard,
  staff: Staff[],
  save: () => void
) {
  const cfg = getConfig();
  const chargeEl = document.getElementById('slot-charge') as HTMLElement;
  const triageEl = document.getElementById('slot-triage') as HTMLElement;
  const secEl = document.getElementById('slot-secretary') as HTMLElement;

  chargeEl.textContent = labelFromId(active.charge?.nurseId);
  triageEl.textContent = labelFromId(active.triage?.nurseId);
  secEl.textContent = labelFromId(active.admin?.nurseId);

  chargeEl.style.display =
    active.charge?.nurseId || cfg.showPinned?.charge ? '' : 'none';
  triageEl.style.display =
    active.triage?.nurseId || cfg.showPinned?.triage ? '' : 'none';
  secEl.style.display = active.admin?.nurseId ? '' : 'none';

  chargeEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'charge', () =>
      renderLeadership(active, staff, save)
    );
  triageEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'triage', () =>
      renderLeadership(active, staff, save)
    );
  secEl.onclick = () =>
    assignLeadDialog(active, staff, save, 'admin', () =>
      renderLeadership(active, staff, save)
    );
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
      upsertSlot(board, role, { nurseId: id });
    } else {
      removeSlot(board, role);
    }
    save();
    overlay.remove();
    rerender();
  });
}

// --- zones & tiles ---------------------------------------------------------

function renderZones(active: ActiveBoard, cfg: any, staff: Staff[], save: () => void) {
  const pctCont = document.getElementById('pct-zones')!;
  const cont = document.getElementById('zones')!;
  pctCont.innerHTML = '';
  cont.innerHTML = '';
  const zones: ZoneDef[] = cfg.zones || [];

  zones.forEach((z: ZoneDef, i: number) => {
    const zName = z.name;
    const section = document.createElement('section');
    section.className = 'zone-card';
    section.setAttribute('data-testid', 'zone-card');
    section.draggable = true;
    section.addEventListener('dragstart', (e) => {
      const ev = e as DragEvent;
      ev.dataTransfer?.setData('zone-index', String(i));
    });

    // Highlight color: explicit or from palette
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

    const addRow = document.createElement('div');
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add';
    addBtn.className = 'btn';
    addBtn.addEventListener('click', () =>
      addSlotDialog(active, staff, save, z.name, () =>
        renderZones(active, cfg, staff, save)
      )
    );
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    section.appendChild(body);
    (z.pct ? pctCont : cont).appendChild(section);
  });

  const enableDrop = (container: HTMLElement, pct: boolean) => {
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const zoneIdxStr = e.dataTransfer?.getData('zone-index');
      if (!zoneIdxStr) return;
      const idx = Number(zoneIdxStr);
      if (isNaN(idx)) return;
      cfg.zones[idx].pct = pct;
      await saveConfig({ zones: cfg.zones });
      renderZones(active, cfg, staff, save);
    });
  };

  enableDrop(pctCont, true);
  enableDrop(cont, false);
}

// --- comments --------------------------------------------------------------

function wireComments(active: ActiveBoard, save: () => void) {
  const el = document.getElementById('comments') as HTMLTextAreaElement;
  if (!el) return;

  el.value = active.comments || '';
  el.disabled = STATE.locked;
  const commit = () => {
    active.comments = el.value;
    save();
  };

  el.addEventListener('input', () =>
    debouncedSave(
      () => {
        active.comments = el.value;
      },
      () => save()
    )
  );

  el.addEventListener('blur', commit);
}

// --- incoming & offgoing ---------------------------------------------------

async function renderIncoming(active: ActiveBoard, save: () => void) {
  const cont = document.getElementById('incoming')!;
  cont.innerHTML = '';

  // auto-populate from draft schedule 40 min before start time
  const draft = await DB.get<DraftShift>(KS.DRAFT(STATE.dateISO, STATE.shift));
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
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
  }

  const btn = document.getElementById('add-incoming') as HTMLButtonElement;
  if (btn) {
    btn.disabled = STATE.locked;
    btn.onclick = () => {
      if (STATE.locked) return;
      const overlay = document.createElement('div');
      overlay.className = 'manage-overlay';
      overlay.innerHTML = `
        <div class="manage-dialog">
          <h3>Add Incoming</h3>
          <label>Nurse ID <input id="inc-id"></label>
          <label>ETA <input id="inc-eta" placeholder="HH:MM"></label>
          <div class="dialog-actions">
            <button id="inc-save" class="btn">Save</button>
            <button id="inc-cancel" class="btn">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const idEl = overlay.querySelector('#inc-id') as HTMLInputElement;
      const etaEl = overlay.querySelector('#inc-eta') as HTMLInputElement;
      overlay.querySelector('#inc-save')?.addEventListener('click', () => {
        const nurse = idEl.value.trim();
        if (!nurse) return;
        active.incoming.push({ nurseId: nurse, eta: etaEl.value.trim() });
        save();
        renderIncoming(active, save);
        overlay.remove();
      });
      overlay.querySelector('#inc-cancel')?.addEventListener('click', () => overlay.remove());
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

function addSlotDialog(
  board: ActiveBoard,
  staffList: Staff[],
  save: () => void,
  zone: string,
  rerender: () => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `
    <div class="manage-dialog">
      <h3>Add to ${zone}</h3>
      <select id="add-nurse">
        ${staffList
          .map((s) => `<option value="${s.id}">${s.name || s.id}</option>`)
          .join('')}
      </select>
      <div class="dialog-actions">
        <button id="add-confirm" class="btn">Add</button>
        <button id="add-cancel" class="btn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#add-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#add-confirm')!.addEventListener('click', () => {
    const sel = overlay.querySelector('#add-nurse') as HTMLSelectElement;
    const id = sel.value;
    upsertSlot(board, { zone }, { nurseId: id });
    save();
    overlay.remove();
    rerender();
  });
}
