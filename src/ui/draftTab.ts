import {
  STATE,
  DB,
  KS,
  getConfig,
  saveConfig,
  loadStaff,
  saveStaff,
  Staff,
  DraftShift,
} from '@/state';
import { setNurseCache, labelFromId, formatShortName } from '@/utils/names';
import { upsertSlot, moveSlot, removeSlot } from '@/slots';
import {
  seedZonesIfNeeded,
  getDefaultRosterForLabel,
  buildSeedBoard,
  DEFAULT_SEED_SETTINGS,
} from '@/seed';
import { t } from '@/i18n/en';

export async function renderDraftTab(root: HTMLElement) {
  await seedZonesIfNeeded();
  let staff: Staff[] = await loadStaff();
  setNurseCache(staff);
  let board = await DB.get<DraftShift>(KS.DRAFT(STATE.dateISO, STATE.shift));
  if (!board) {
    const roster = getDefaultRosterForLabel(staff, STATE.shift);
    const seed = buildSeedBoard(roster, DEFAULT_SEED_SETTINGS);
    board = {
      dateISO: STATE.dateISO,
      shift: STATE.shift,
      charge: seed.charge,
      triage: seed.triage,
      admin: seed.admin,
      zones: seed.zones,
      incoming: [],
      offgoing: [],
      support: { techs: [], vols: [], sitters: [] },
    };
    await DB.set(KS.DRAFT(STATE.dateISO, STATE.shift), board);
  } else {
    board.incoming ||= [];
    board.offgoing ||= [];
    board.support ||= { techs: [], vols: [], sitters: [] };
    board.dateISO ||= STATE.dateISO;
    board.shift ||= STATE.shift;
    board.admin ||= undefined;
  }
  let selected: string | undefined;

  root.innerHTML = `
    <div class="draft-layout">
      <aside class="panel roster-panel">
        <div class="roster-controls">
          <input id="roster-search" type="search" placeholder="Search nurses" />
          <select id="roster-filter">
            <option value="">All Types</option>
            <option value="home">${t('labels.home')}</option>
            <option value="travel">${t('labels.travel')}</option>
            <option value="flex">${t('labels.flex')}</option>
            <option value="charge">${t('labels.charge')}</option>
            <option value="triage">${t('labels.triage')}</option>
            <option value="other">${t('labels.other') ?? 'Other'}</option>
          </select>
        </div>
        <ul id="roster-list"></ul>
        <button id="nurse-edit" class="btn">+ ${t('actions.addNurse')}</button>
      </aside>
      <section class="panel board-panel">
        <div class="zone" data-zone="charge">
          <h4>${t('labels.charge')}</h4>
          <div class="slots" id="zone-charge"></div>
        </div>
        <div class="zone" data-zone="triage">
          <h4>${t('labels.triage')}</h4>
          <div class="slots" id="zone-triage"></div>
        </div>
        <div class="zone" data-zone="admin" id="zone-admin-wrap" style="display:none">
          <h4>${t('labels.adminOn')}</h4>
          <div class="slots" id="zone-admin"></div>
        </div>
        <div id="zones"></div>
        <button id="add-zone" class="btn">+ ${t('actions.createZone')}</button>
      </section>
      <aside class="panel flags-panel">
        <h3>${t('labels.flags')}</h3>
        <ul id="flags-list"></ul>
      </aside>
    </div>
  `;

  const saveBoard = async () => {
    await DB.set(KS.DRAFT(STATE.dateISO, STATE.shift), board);
    renderFlags();
  };

  function renderRoster() {
    const search = (document.getElementById('roster-search') as HTMLInputElement).value.toLowerCase();
    const filter = (document.getElementById('roster-filter') as HTMLSelectElement).value as Staff['type'] | '';
    const list = document.getElementById('roster-list')!;
    list.innerHTML = '';
    staff
      .filter(
        (s) => (!filter || s.type === filter) && (!search || s.name.toLowerCase().includes(search))
      )
      .forEach((s) => {
        const li = document.createElement('li');
        li.className = 'nurse-pill';
        li.dataset.type = s.type;
        li.draggable = true;
        li.dataset.id = s.id;
        const name = formatShortName(s.name || '');
        const rf = s.rf != null ? `RF ${s.rf}` : '';
        li.innerHTML = `<span class="nurse-name">${name}</span><span class="chip">${s.type[0].toUpperCase()}</span><span class="nurse-meta">${rf}</span>`;
        if (selected === s.id) li.classList.add('selected');
        li.addEventListener('click', () => {
          selected = selected === s.id ? undefined : s.id;
          renderRoster();
        });
        li.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('nurse', s.id);
        });
        list.appendChild(li);
      });
    const btn = document.getElementById('nurse-edit') as HTMLButtonElement;
    btn.textContent = selected ? t('actions.editNurse') : `+ ${t('actions.addNurse')}`;
  }

  function placeholder(): HTMLElement {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Drop nurse here';
    return p;
  }


  function renderSlot(slot: any, target: any): HTMLElement {
    const div = document.createElement('div');
    div.className = 'slot';
    div.textContent = labelFromId(slot.nurseId);
    div.draggable = true;
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('slot', JSON.stringify(target));
    });
    div.addEventListener('dblclick', () => {
      removeSlot(board, target);
      saveBoard();
      renderBoard();
    });
    return div;
  }

  function makeDroppable(el: HTMLElement, target: any) {
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const nurse = e.dataTransfer?.getData('nurse');
      const from = e.dataTransfer?.getData('slot');
      if (nurse) {
        if (
          target === 'admin' &&
          !staff.find((s) => s.id === nurse)?.eligibleRoles?.includes('admin')
        ) {
          return;
        }
        upsertSlot(board, target, { nurseId: nurse });
      } else if (from) {
        moveSlot(board, JSON.parse(from), target);
      }
      saveBoard();
      renderBoard();
    });
  }

  function renderBoard() {
    const chargeEl = document.getElementById('zone-charge')!;
    chargeEl.innerHTML = '';
    makeDroppable(chargeEl, 'charge');
    if (board.charge) chargeEl.appendChild(renderSlot(board.charge, 'charge'));
    else chargeEl.appendChild(placeholder());

    const triageEl = document.getElementById('zone-triage')!;
    triageEl.innerHTML = '';
    makeDroppable(triageEl, 'triage');
    if (board.triage) triageEl.appendChild(renderSlot(board.triage, 'triage'));
    else triageEl.appendChild(placeholder());

    const adminWrap = document.getElementById('zone-admin-wrap')!;
    const adminEl = document.getElementById('zone-admin')!;
    adminWrap.style.display = '';
    adminEl.innerHTML = '';
    makeDroppable(adminEl, 'admin');
    if (board.admin) {
      adminEl.appendChild(renderSlot(board.admin, 'admin'));
    } else {
      adminEl.appendChild(placeholder());
    }

    const zonesCont = document.getElementById('zones')!;
    zonesCont.innerHTML = '';
    for (const z of Object.keys(board.zones)) {
      const wrap = document.createElement('div');
      wrap.className = 'zone';
      wrap.dataset.zone = z;
      const h = document.createElement('h4');
      h.innerHTML = `${z} <button class="remove-zone" data-zone="${z}">×</button>`;
      wrap.appendChild(h);
      const slots = document.createElement('div');
      slots.className = 'slots';
      slots.id = `zone-${z}`;
      makeDroppable(slots, { zone: z });
      if (board.zones[z].length === 0) slots.appendChild(placeholder());
      board.zones[z].forEach((s, i) => slots.appendChild(renderSlot(s, { zone: z, index: i })));
      wrap.appendChild(slots);
      zonesCont.appendChild(wrap);
    }
  }

  function renderFlags() {
    const list = document.getElementById('flags-list')!;
    const counts = new Map<string, string[]>();
    if (board.charge) counts.set(board.charge.nurseId, ['Charge']);
    if (board.triage) {
      const arr = counts.get(board.triage.nurseId) || [];
      arr.push('Triage');
      counts.set(board.triage.nurseId, arr);
    }
    if (board.admin) {
      const arr = counts.get(board.admin.nurseId) || [];
      arr.push('Admin on');
      counts.set(board.admin.nurseId, arr);
    }
    for (const [zone, slots] of Object.entries(board.zones)) {
      slots.forEach((s) => {
        const arr = counts.get(s.nurseId) || [];
        arr.push(zone);
        counts.set(s.nurseId, arr);
      });
    }
    const flags = Array.from(counts.entries())
      .filter(([_, arr]) => arr.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
    list.innerHTML = '';
    if (flags.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No flags';
      list.appendChild(li);
    } else {
      flags.forEach(([id, arr]) => {
        const li = document.createElement('li');
        li.textContent = `${labelFromId(id)} assigned to ${arr.join(', ')}`;
        list.appendChild(li);
      });
    }
  }

  function wireUI() {
    (document.getElementById('roster-search') as HTMLInputElement).addEventListener('input', renderRoster);
    (document.getElementById('roster-filter') as HTMLSelectElement).addEventListener('change', renderRoster);
    document.getElementById('nurse-edit')!.addEventListener('click', async () => {
      if (selected) {
        const nurse = staff.find((s) => s.id === selected)!;
        const name = prompt('Name', nurse.name);
        if (!name) return;
        const type = (prompt('Type', nurse.type) as Staff['type']) || nurse.type;
        nurse.name = name;
        nurse.type = type;
      } else {
        const name = prompt('Name?');
        if (!name) return;
        const type =
          (prompt('Type? (home, travel, flex, charge, triage, other)', 'home') as Staff['type']) ||
          'home';
        staff.push({ id: crypto.randomUUID(), name, type });
      }
      await saveStaff(staff);
      setNurseCache(staff);
      selected = undefined;
      renderRoster();
      renderBoard();
      renderFlags();
    });

    document.getElementById('add-zone')!.addEventListener('click', async () => {
      const name = prompt('Zone name?');
      if (!name || board.zones[name]) return;
      board.zones[name] = [];
      const cfg = getConfig();
      cfg.zones.push(name);
      await saveConfig({ zones: cfg.zones });
      await saveBoard();
      renderBoard();
    });

    document.getElementById('zones')!.addEventListener('click', async (ev) => {
      const btn = (ev.target as HTMLElement).closest('.remove-zone') as HTMLElement | null;
      if (btn) {
        const z = btn.dataset.zone!;
        if (confirm(`Remove zone ${z}?`)) {
          delete board.zones[z];
          const cfg = getConfig();
          cfg.zones = cfg.zones.filter((s) => s !== z);
          await saveConfig({ zones: cfg.zones });
          await saveBoard();
          renderBoard();
        }
      }
    });
  }

  renderRoster();
  renderBoard();
  renderFlags();
  wireUI();
}
