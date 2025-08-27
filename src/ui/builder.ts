import {
  STATE,
  getConfig,
  loadStaff,
  KS,
  DB,
  type DraftShift,
  type Staff,
  CURRENT_SCHEMA_VERSION,
  applyDraftToActive,
  saveConfig,
} from '@/state';
import { upsertSlot, type Slot } from '@/slots';
import { nurseTile } from './nurseTile';
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
          <div id="builder-roster"></div>
        </section>
      </div>
      <div class="col col-right">
        <section class="panel">
          <h3>Pending Zones</h3>
          <div id="builder-zones" class="zones-grid"></div>
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

  function renderRoster() {
    const cont = document.getElementById('builder-roster')!;
    cont.innerHTML = staff
      .map((s) => `<div class="nurse-card" draggable="true" data-id="${s.id}">${s.name || s.id}</div>`)
      .join('');
    cont.querySelectorAll('[draggable=true]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const event = e as DragEvent;
        event.dataTransfer?.setData('text/plain', (el as HTMLElement).getAttribute('data-id')!);
      });
    });
  }

  function renderZones() {
    const cont = document.getElementById('builder-zones')!;
    cont.innerHTML = '';
    cfg.zones.forEach((z, i) => {
      const section = document.createElement('section');
      section.className = 'zone-card';
      section.draggable = true;
      section.dataset.index = String(i);
      section.addEventListener('dragstart', (e) => {
        const ev = e as DragEvent;
        ev.dataTransfer?.setData('zone-index', String(i));
      });
      section.addEventListener('dragover', (e) => e.preventDefault());
      section.addEventListener('drop', async (e) => {
        e.preventDefault();
        const ev = e as DragEvent;
        const fromIdx = Number(ev.dataTransfer?.getData('zone-index'));
        if (!isNaN(fromIdx) && fromIdx !== i) {
          const [moved] = cfg.zones.splice(fromIdx, 1);
          cfg.zones.splice(i, 0, moved);
          board.zones = Object.fromEntries(
            cfg.zones.map((zz) => [zz.name, board.zones[zz.name] || []])
          );
          await saveConfig({ zones: cfg.zones });
          await save();
          renderZones();
          return;
        }
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
      body.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
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
      });

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
      cont.appendChild(section);
    });
  }

  document.getElementById('builder-save')!.addEventListener('click', save);
  document.getElementById('builder-submit')!.addEventListener('click', async () => {
    await save();
    await applyDraftToActive(board.dateISO, board.shift);
    alert('Draft submitted to main board');
  });
}
