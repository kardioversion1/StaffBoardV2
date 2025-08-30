import { STATE, KS, DB, type DraftShift, CURRENT_SCHEMA_VERSION, applyDraftToActive } from '@/state/board';
import { getConfig, saveConfig } from '@/state/config';
import { loadStaff, type Staff } from '@/state/staff';
import { upsertSlot, removeSlot, type Slot } from '@/slots';
import { nurseTile } from './nurseTile';
import { setNurseCache, labelFromId } from '@/utils/names';
import { normalizeActiveZones, type ZoneDef } from '@/utils/zones';
import './mainBoard/boardLayout.css';

function buildEmptyDraft(dateISO: string, shift: 'day' | 'night', zones: ZoneDef[]): DraftShift {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(zones.map((z) => [z.name, [] as Slot[]])),
    incoming: [],
    offgoing: [],
    huddle: '',
    handoff: '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

/** Render the pending shift builder allowing drag-and-drop assignments. */
export async function renderBuilder(root: HTMLElement): Promise<void> {
  const cfg = getConfig();
  const staff = await loadStaff();
  setNurseCache(staff);
  const key = KS.DRAFT(STATE.dateISO, STATE.shift);
  const board: DraftShift =
    (await DB.get<DraftShift>(key)) ??
    buildEmptyDraft(STATE.dateISO, STATE.shift, cfg.zones);
  normalizeActiveZones(board, cfg.zones);

  async function save() {
    await DB.set(key, board);
  }

  root.innerHTML = `
    <div class="layout builder-layout" data-testid="builder">
      <div class="col col-left">
        <section class="panel">
          <h3>Roster</h3>
          <input id="builder-roster-search" class="input" placeholder="Search nurses">
          <div id="builder-roster"></div>
        </section>
      </div>
      <div class="col col-right">
        <section class="panel">
          <h3>Patient Care Team</h3>
          <div class="slots lead">
            <div id="builder-charge"></div>
            <div id="builder-triage"></div>
            <div id="builder-secretary"></div>
          </div>
          <div id="builder-pct-zones" class="zones-grid" style="min-height:40px"></div>
        </section>
        <section class="panel">
          <h3>Pending Zones</h3>
          <div id="builder-zones" class="zones-grid" style="min-height:40px"></div>
        </section>
        <div class="btn-row">
          <button id="builder-save" class="btn">Save</button>
          <button id="builder-submit" class="btn">Submit</button>
        </div>
      </div>
    </div>
  `;

  renderRoster();
  renderZones();
  renderLeads();

  // Resolved version: keep return type + remove listener if element is gone.
  function adjustRosterHeight(): void {
    const cont = document.getElementById('builder-roster');
    if (!cont) {
      window.removeEventListener('resize', adjustRosterHeight);
      return;
    }
    const top = cont.getBoundingClientRect().top;
    cont.style.maxHeight = `${window.innerHeight - top}px`;
    cont.style.overflow = 'hidden';
  }

  adjustRosterHeight();
  window.addEventListener('resize', adjustRosterHeight);

  const searchInput = document.getElementById('builder-roster-search') as HTMLInputElement;
  searchInput.addEventListener('input', () => renderRoster(searchInput.value));

  function renderRoster(query = '') {
    const cont = document.getElementById('builder-roster')!;
    const q = query.toLowerCase();
    cont.innerHTML = staff
      .filter((s) => !q || (s.name || s.id).toLowerCase().includes(q))
      .map(
        (s) =>
          `<div class="nurse-card" draggable="true" data-id="${s.id}"><div class="nurse-name">${s.name || s.id}</div></div>`
      )
      .join('');
    cont.querySelectorAll('.nurse-card').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const event = e as DragEvent;
        event.dataTransfer?.setData('text/plain', (el as HTMLElement).getAttribute('data-id')!);
      });
      el.addEventListener('click', () => toggleDetails(el as HTMLElement));
    });
  }

  async function toggleDetails(card: HTMLElement) {
    const existing = card.querySelector('.nurse-details');
    if (existing) {
      existing.remove();
      return;
    }
    const info = await nurseHistory(card.dataset.id!);
    const detail = document.createElement('div');
    detail.className = 'nurse-details';
    detail.innerHTML = `
      <div><strong>Past 5 shifts</strong></div>
      <ul>${info.shifts.map((s) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul>
      <div><strong>DTO</strong></div>
      <ul>${info.dto.map((d) => `<li>${d}</li>`).join('') || '<li>None</li>'}</ul>
    `;
    card.appendChild(detail);
  }

  async function nurseHistory(id: string): Promise<{ shifts: string[]; dto: string[] }> {
    const hist = (await DB.get<any[]>(KS.HISTORY)) || [];
    const shifts: string[] = [];
    const dto: string[] = [];
    for (let i = hist.length - 1; i >= 0; i--) {
      const entry = hist[i];
      if (entry?.nurseId === id) {
        dto.push(`${entry.dateISO} ${entry.shift}`);
      } else if (entry?.zones) {
        const zones: Slot[][] = Object.values(entry.zones);
        if (zones.some((arr) => arr.some((s: Slot) => s.nurseId === id))) {
          shifts.push(`${entry.dateISO} ${entry.shift}`);
          if (shifts.length >= 5) break;
        }
      }
    }
    return { shifts, dto };
  }

  function renderLeads() {
    const chargeEl = document.getElementById('builder-charge') as HTMLElement;
    const triageEl = document.getElementById('builder-triage') as HTMLElement;
    const secEl = document.getElementById('builder-secretary') as HTMLElement;

    chargeEl.textContent = labelFromId(board.charge?.nurseId);
    triageEl.textContent = labelFromId(board.triage?.nurseId);
    secEl.textContent = labelFromId(board.admin?.nurseId);

    chargeEl.onclick = () =>
      assignLeadDialog(board, staff, save, 'charge', renderLeads);
    triageEl.onclick = () =>
      assignLeadDialog(board, staff, save, 'triage', renderLeads);
    secEl.onclick = () =>
      assignLeadDialog(board, staff, save, 'admin', renderLeads);
  }

  function assignLeadDialog(
    board: DraftShift,
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

    overlay
      .querySelector('#lead-cancel')!
      .addEventListener('click', () => overlay.remove());
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

  function renderZones() {
    const pctCont = document.getElementById('builder-pct-zones')!;
    const cont = document.getElementById('builder-zones')!;
    pctCont.innerHTML = '';
    cont.innerHTML = '';
    pctCont.style.minHeight = '40px';
    cont.style.minHeight = '40px';
    cfg.zones.forEach((z, i) => {
      const section = document.createElement('section');
      section.className = 'zone-card';
      section.draggable = true;
      section.dataset.index = String(i);
      section.addEventListener('dragstart', (e) => {
        if ((e.target as HTMLElement).closest('.nurse-row')) return;
        const ev = e as DragEvent;
        ev.dataTransfer?.setData('zone-index', String(i));
      });
      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      const title = document.createElement('h2');
      title.className = 'zone-card__title';
      title.textContent = z.name;
      section.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'zone-card__actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn';
      editBtn.addEventListener('click', async () => {
        const val = prompt('Rename zone', z.name)?.trim();
        if (val && val !== z.name) {
          const idx = cfg.zones.findIndex((zz) => zz.name === z.name);
          cfg.zones[idx].name = val;
          if (cfg.zoneColors && cfg.zoneColors[z.name]) {
            cfg.zoneColors[val] = cfg.zoneColors[z.name];
            delete cfg.zoneColors[z.name];
          }
          board.zones[val] = board.zones[z.name] || [];
          delete board.zones[z.name];
          await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
          await save();
          renderZones();
        }
      });
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'btn';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete zone ${z.name}?`)) return;
        const idx = cfg.zones.findIndex((zz) => zz.name === z.name);
        const removed = cfg.zones.splice(idx, 1)[0];
        if (removed) {
          delete board.zones[removed.name];
          if (cfg.zoneColors) delete cfg.zoneColors[removed.name];
        }
        await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
        await save();
        renderZones();
      });
      actions.appendChild(delBtn);

      section.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'zone-card__body';
      body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      const onDrop = async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const zoneIdxStr = e.dataTransfer?.getData('zone-index');
        if (zoneIdxStr) {
          const fromIdx = Number(zoneIdxStr);
          if (!isNaN(fromIdx) && fromIdx !== i) {
            const [moved] = cfg.zones.splice(fromIdx, 1);
            moved.pct = z.pct;
            cfg.zones.splice(i, 0, moved);
            board.zones = Object.fromEntries(
              cfg.zones.map((zz) => [zz.name, board.zones[zz.name] || []])
            );
            await saveConfig({ zones: cfg.zones });
            await save();
            renderZones();
            return;
          }
        }

        const slotData = e.dataTransfer?.getData('slot');
        if (slotData) {
          const { zone: fromZone, index } = JSON.parse(slotData);
          const [slot] = board.zones[fromZone].splice(index, 1);
          const arr = board.zones[z.name] || (board.zones[z.name] = []);
          arr.push(slot);
          await save();
          renderZones();
          return;
        }
        const id = e.dataTransfer?.getData('text/plain');
        if (id) {
          const start = cfg.anchors[STATE.shift];
          upsertSlot(board, { zone: z.name }, { nurseId: id, startHHMM: start });
          await save();
          renderZones();
        }
      };

      section.addEventListener('drop', onDrop);
      body.addEventListener('drop', onDrop);

      (board.zones[z.name] || []).forEach((slot, idx) => {
        const st = staff.find((n) => n.id === slot.nurseId);
        if (!st) return;
        const row = document.createElement('div');
        row.className = 'nurse-row';
        row.draggable = true;
        row.addEventListener('dragstart', (e) => {
          const ev = e as DragEvent;
          ev.dataTransfer?.setData('slot', JSON.stringify({ zone: z.name, index: idx }));
        });

        const tile = document.createElement('div');
        tile.innerHTML = nurseTile(slot, st);
        row.appendChild(tile.firstElementChild!);

        const time = document.createElement('input');
        time.type = 'time';
        time.value = slot.startHHMM || cfg.anchors[STATE.shift];
        time.addEventListener('change', async () => {
          slot.startHHMM = time.value;
          await save();
        });
        row.appendChild(time);

        const rm = document.createElement('button');
        rm.textContent = 'Remove';
        rm.className = 'btn';
        rm.addEventListener('click', async () => {
          board.zones[z.name].splice(idx, 1);
          await save();
          renderZones();
        });
        row.appendChild(rm);
        body.appendChild(row);
      });

      section.appendChild(body);
      (z.pct ? pctCont : cont).appendChild(section);
    });

    const enableDrop = (container: HTMLElement, pct: boolean) => {
      container.addEventListener('dragover', (e) => e.preventDefault());
      container.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const zoneIdxStr = e.dataTransfer?.getData('zone-index');
        if (!zoneIdxStr) return;
        const fromIdx = Number(zoneIdxStr);
        if (!isNaN(fromIdx)) {
          cfg.zones[fromIdx].pct = pct;
          await saveConfig({ zones: cfg.zones });
          await save();
          renderZones();
        }
      });
    };

    enableDrop(pctCont, true);
    enableDrop(cont, false);
  }

  document.getElementById('builder-save')!.addEventListener('click', save);
  document.getElementById('builder-submit')!.addEventListener('click', async () => {
    await save();
    await applyDraftToActive(board.dateISO, board.shift);
    alert('Draft submitted to main board');
  });
}
