// mainBoard.ts — merged & de-conflicted

import * as Server from '@/server';
import {
  DB,
  KS,
  STATE,
  loadStaff,
  saveStaff,
  CURRENT_SCHEMA_VERSION,
  migrateActiveBoard,
  setActiveBoardCache,
  getActiveBoardCache,
  mergeBoards,
  type Staff,
  type ActiveBoard,
  type DraftShift,
  getConfig,
  saveConfig,
  type Config,
} from '@/state';
import { notifyUpdate, onUpdate } from '@/state/sync';

import { setNurseCache, labelFromId } from '@/utils/names';
import { renderWeather } from './widgets';
import { renderPhysicians, renderPhysicianPopup } from './physicians';
import { nurseTile } from './nurseTile';
import { createDebouncer } from '@/utils/debouncedSave';
import './mainBoard/boardLayout.css';
import {
  startBreak,
  endBreak,
  moveSlot,
  upsertSlot,
  removeSlot,
  type Slot,
} from '@/slots';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { normalizeActiveZones, type ZoneDef } from '@/utils/zones';
import { showBanner, showToast } from '@/ui/banner';
import { openAssignDialog } from '@/ui/assignDialog';

const RECENT_MS = 15 * 60 * 1000;
const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
let clockHandler: (() => void) | null = null;

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

    // Prefer in-memory cache to preserve unsaved edits when switching tabs
    let active: ActiveBoard | undefined = getActiveBoardCache(
      ctx.dateISO,
      ctx.shift
    );
    let usedLocal = !!active;

    try {
      const remote = await Server.load<ActiveBoard>('active', {
        date: ctx.dateISO,
        shift: ctx.shift,
      });
      if (remote) {
        active = active ? mergeBoards(remote, active) : remote;
        usedLocal = false;
      }
    } catch {
      /* ignore network errors */
    }

    if (!active) {
      active = await DB.get<ActiveBoard>(saveKey);
      usedLocal = !!active;
    }
    if (!active) {
      active = buildEmptyActive(ctx.dateISO, ctx.shift, cfg.zones);
    } else {
      active = migrateActiveBoard(active);
    }

    normalizeActiveZones(active, cfg.zones);
    setActiveBoardCache(active);

    if (!usedLocal) {
      await DB.set(saveKey, active);
      notifyUpdate(saveKey);
    } else {
      showToast('Using local data; changes may not persist');
    }

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

          <section id="incoming-panel" class="panel">
            <h3>Incoming (click to toggle arrived)</h3>
            <button id="add-incoming" class="btn">+ Add</button>
            <div id="incoming" class="min-h-40"></div>
          </section>

          <section id="offgoing-panel" class="panel">
            <h3>Offgoing (kept 40 min)</h3>
            <div id="offgoing"></div>
          </section>

          <section class="panel">
            <h3>Physicians</h3>
            <div id="phys"></div>
            <button id="phys-next7" class="btn">Next 7 days</button>
          </section>
        </div>
      </div>
    `;

    // Debounced save (server-first, then local always)
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const flushSave = async () => {
      if (saveTimer) clearTimeout(saveTimer);
      try {
        await Server.save('active', active!);
      } catch (err) {
        console.error('failed to save active board', err);
        showToast('Saving locally; server unreachable');
      } finally {
        await DB.set(saveKey, active!);
        notifyUpdate(saveKey);
      }
    };

    const queueSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 300);
    };

    const refresh = () => {
      renderLeadership(active!, staff, queueSave, root, refresh);
      renderZones(active!, cfg, staff, queueSave, root);
    };

    refresh();
    wireComments(active!, queueSave);
      await renderIncoming(active!, staff, queueSave);
  renderOffgoing(active!, queueSave);

      const checkArrivals = () => {
        if (autoAssignArrivals(active!, cfg)) {
          queueSave();
          void renderIncoming(active!, staff, queueSave);
          renderZones(active!, cfg, staff, queueSave, root);
        }
      };
      if (clockHandler) document.removeEventListener('clock-tick', clockHandler);
      clockHandler = checkArrivals;
      document.addEventListener('clock-tick', checkArrivals);
      checkArrivals();

      const weatherBody = document.getElementById('weather-body');
      if (weatherBody) await renderWeather(weatherBody);

    await renderPhysicians(
      document.getElementById('phys') as HTMLElement,
      ctx.dateISO
    );

    const btn = document.getElementById('phys-next7');
    btn?.addEventListener('click', () => {
      renderPhysicianPopup(ctx.dateISO, 7);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void flushSave();
    });

    window.addEventListener('pagehide', () => {
      void flushSave();
    });

    onUpdate(saveKey, async () => {
      const updated = await DB.get<ActiveBoard>(saveKey);
      if (!updated) return;
      active = migrateActiveBoard(updated);
      normalizeActiveZones(active, cfg.zones);
      setActiveBoardCache(active);
      refresh();
    });

    // Re-render on config changes (e.g., zone list or colors)
    document.addEventListener('config-changed', () => {
      const c = getConfig();
      normalizeActiveZones(active!, c.zones);
      queueSave();
      renderLeadership(active!, staff, queueSave, root, refresh);
      renderZones(active!, c, staff, queueSave, root);
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

// --- zones & tiles ---------------------------------------------------------

function renderZones(
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
        const slot: Slot = { nurseId, startHHMM: STATE.clockHHMM };
        if (end) slot.endTimeOverrideHHMM = end;
        const moved = upsertSlot(active, { zone: z.name }, slot);
        if (moved) showBanner('Previous assignment cleared');
        active.incoming = active.incoming.filter((i) => i.nurseId !== nurseId);
        save();
        renderIncoming(active, staff, save);
        renderZones(active, cfg, staff, save, root);
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
      renderZones(active, cfg, staff, save, root);
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

    const editBtn = document.createElement('button');
    editBtn.textContent = '⚙';
    editBtn.className = 'zone-card__edit';
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
        renderZones(active, cfg, staff, save, root);
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
      if (s.assignedTs && Date.now() - s.assignedTs < RECENT_MS) {
        tile.classList.add('recent-assignment');
        const remaining = RECENT_MS - (Date.now() - s.assignedTs);
        setTimeout(() => tile.classList.remove('recent-assignment'), remaining);
      }

      const btn = document.createElement('button');
      btn.textContent = 'Manage';
      btn.className = 'btn';
      btn.addEventListener('click', () =>
        manageSlot(
          s,
          st,
          staff,
          save,
          () => renderZones(active, cfg, staff, save, root),
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
    addBtn.addEventListener('click', () => {
      openAssignDialog(staff, (id) => {
        const moved = upsertSlot(active, { zone: z.name }, { nurseId: id });
        if (moved) showBanner('Previous assignment cleared');
        save();
        renderZones(active, cfg, staff, save, root);
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
      renderZones(active, cfg, staff, save, root);
    });
  };

  enableDrop(pctCont, true);
  enableDrop(cont, false);
}

// --- comments --------------------------------------------------------------

function wireComments(active: ActiveBoard, save: () => void) {
  const el = document.getElementById('comments') as HTMLTextAreaElement | null;
  if (!el) return;

  el.value = active.comments || '';
  el.disabled = STATE.locked;
  const commit = () => {
    active.comments = el.value;
    save();
  };

  const debounced = createDebouncer(
    () => {
      active.comments = el.value;
    },
    () => save()
  );

  el.addEventListener('input', debounced);
  el.addEventListener('blur', commit);
}

// --- incoming & offgoing ---------------------------------------------------

async function renderIncoming(
  active: ActiveBoard,
  staffList: Staff[],
  save: () => void
) {
  const cont = document.getElementById('incoming')!;
  cont.innerHTML = '';

  // auto-populate from draft schedule 40 min before start time
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
        inc.arrived = !inc.arrived;
        const cfg = getConfig();
        const moved = autoAssignArrivals(active, cfg);
        save();
        void renderIncoming(active, staffList, save);
        if (moved) {
          renderZones(
            active,
            cfg,
            staffList,
            save,
            document.getElementById('panel')!
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
          active.incoming.push({ nurseId: id, eta: (etaEl?.value || '').trim() });
          save();
          void renderIncoming(active, staffList, save);
          overlay.remove();
        });
        cancelBtn?.addEventListener('click', () => overlay.remove());
      });
    };
  }
}

function renderOffgoing(active: ActiveBoard, save: () => void) {
  const cont = document.getElementById('offgoing')!;
  const cutoff = Date.now() - 60 * 60 * 1000; // 60 min
  active.offgoing = (active.offgoing || []).filter((o) => o.ts > cutoff);

  cont.innerHTML = '';
  for (const o of active.offgoing) {
    const div = document.createElement('div');
    div.textContent = labelFromId(o.nurseId);
    cont.appendChild(div);
  }
  save();
}

function autoAssignArrivals(active: ActiveBoard, cfg: Config): boolean {
  const auxName = 'Aux 1';
  if (!cfg.zones?.some((z) => z.name === auxName) || !active.zones[auxName]) {
    return false;
  }
  const now = toMin(STATE.clockHHMM);
  let moved = false;
  active.incoming = active.incoming.filter((inc) => {
    if (inc.arrived && inc.eta && toMin(inc.eta) <= now) {
      upsertSlot(active, { zone: auxName }, { nurseId: inc.nurseId, startHHMM: inc.eta });
      moved = true;
      return false;
    }
    return true;
  });
  return moved;
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
  board: ActiveBoard,
  cfg: Config
): void {
  if (!st) return;

  const currentRole = st.role;
  const endValue = slot.endTimeOverrideHHMM && /^\d{4}$/.test(slot.endTimeOverrideHHMM)
    ? slot.endTimeOverrideHHMM.replace(/(\d{2})(\d{2})/, '$1:$2')
    : (slot.endTimeOverrideHHMM || '');

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
      <label>End time <input id="mg-end" type="time" value="${endValue}"></label>
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
    if (removeSlot(board, { zone, index })) showBanner('Assignment cleared');
    board.offgoing.push({ nurseId: st.id, ts: Date.now() });

    // Append to history
    interface HistoryEntry {
      nurseId: string;
      dateISO: string;
      shift: 'day' | 'night';
      endedISO: string;
    }
    const hist = (await DB.get<HistoryEntry[]>(KS.HISTORY)) || [];
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

  overlay.querySelector('#mg-save')!.addEventListener('click', async () => {
    // Basic fields
    st.name = (overlay.querySelector('#mg-name') as HTMLInputElement).value.trim() || undefined;

    const rfVal = (overlay.querySelector('#mg-rf') as HTMLInputElement).value.trim();
    st.rf = rfVal ? Number(rfVal) : undefined;

    const selectedRole = roleSel.value as Staff['role'];
    st.role = selectedRole;

    // Only nurses have a nurse type
    if (st.role === 'nurse') {
      const tval = (overlay.querySelector('#mg-type') as HTMLSelectElement).value;
      const canon = (canonNurseType(tval) || st.type) as NurseType;
      st.type = canon;
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
      const moved = moveSlot(board, { zone, index }, { zone: zoneSel.value });
      if (moved) showBanner('Previous assignment cleared');
    }

    // Persist
    await saveStaff(staffList); // best-effort staff write
    save();
    overlay.remove();
    rerender();
  });
}

