import { STATE, getConfig, loadStaff, KS, DB, type DraftShift, type Staff, CURRENT_SCHEMA_VERSION, applyDraftToActive } from '@/state';
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
      el.addEventListener('dragstart', (e: DragEvent) => {
        e.dataTransfer?.setData('text/plain', (el as HTMLElement).getAttribute('data-id')!);
      });
    });
  }

  function renderZones() {
    const cont = document.getElementById('builder-zones')!;
    cont.innerHTML = '';
    cfg.zones.forEach((z) => {
      const section = document.createElement('section');
      section.className = 'zone-card';
      const title = document.createElement('h2');
      title.className = 'zone-card__title';
      title.textContent = z.name;
      section.appendChild(title);

      const body = document.createElement('div');
      body.className = 'zone-card__body';
      body.addEventListener('dragover', (e) => e.preventDefault());
      body.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/plain');
        if (id) {
          upsertSlot(board, { zone: z.name }, { nurseId: id });
          await save();
          renderZones();
        }
      });

      (board.zones[z.name] || []).forEach((slot, idx) => {
        const st = staff.find((n) => n.id === slot.nurseId);
        if (!st) return;
        const row = document.createElement('div');
        row.className = 'nurse-row';

        const tile = document.createElement('div');
        tile.innerHTML = nurseTile(slot, st);
        row.appendChild(tile.firstElementChild!);

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
