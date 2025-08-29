import {
  getConfig,
  saveConfig,
  mergeConfigDefaults,
  loadStaff,
  saveStaff,
  Staff,
} from '@/state';
import { createStaffId, ensureStaffId } from '@/utils/id';
import { fetchWeather, renderWeather } from './widgets';
import { getUIConfig, saveUIConfig, applyUI } from '@/state/uiConfig';
import { renderHeader } from '@/ui/header';

declare global {
  interface Window {
    STAFF_API: {
      deleteStaffById: (id: string) => Promise<void>;
      // add other STAFF_API methods here as needed
    };
  }
}

function mapIcon(cond: string) {
  const c = (cond || '').toLowerCase();
  if (c.includes('storm') || c.includes('thunder')) return 'storm';
  if (c.includes('snow')) return 'snow';
  if (c.includes('rain') || c.includes('drizzle')) return 'rain';
  if (c.includes('cloud')) return 'cloud';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'mist';
  return 'sun';
}

/** Render the Settings tab including roster and display options. */
/** Render the settings tab including roster and display options. */
export async function renderSettings(root: HTMLElement): Promise<void> {
  mergeConfigDefaults();
  root.innerHTML = `
    <div class="settings-grid">
      <div id="roster-pane" class="panel roster-box" data-testid="roster-pane"></div>
      <div class="settings-pane">
        <div id="nurse-editor" data-testid="nurse-editor"></div>
        <div id="general-settings" data-testid="general-settings"></div>
      </div>
    </div>
    <div id="settings-widgets"></div>
    <div id="type-legend"></div>
  `;
  await renderRosterPane();
  renderGeneralSettings();
  renderWidgetsPanel();
  renderTypeLegend();
}

async function renderRosterPane() {
  const el = document.getElementById('roster-pane')!;
  let staff = await loadStaff();
  let selected: string | null = null;

  const renderList = (filter = '') => {
    const rows = staff
      .filter((s) => (s.name || '').toLowerCase().includes(filter))
      .map(
        (s) => `
        <div class="roster-row${s.id === selected ? ' selected' : ''}" data-id="${s.id}">
          <span>${s.name || ''}</span>
          <span class="muted">${s.role}</span>
          <span class="muted">${s.type}</span>
        </div>`
      )
      .join('');
    el.innerHTML = `
      <h3>Nurse Roster</h3>
      <input id="roster-search" class="input" placeholder="Search">
      <div id="roster-list" class="roster-box">${rows}</div>
      <div class="btn-row">
        <button id="staff-add" class="btn">Add</button>
        <button id="staff-export" class="btn">Export</button>
        <input id="staff-file" type="file" accept="application/json" style="display:none">
        <button id="staff-import" class="btn">Import</button>
      </div>
    `;

    const search = document.getElementById('roster-search') as HTMLInputElement;
    let t: any;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => renderList(search.value.toLowerCase()), 200);
    });

    const list = document.getElementById('roster-list');
    list?.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.roster-row') as HTMLElement | null;
      if (!row) return;
      selected = row.getAttribute('data-id');
      renderList(search.value.toLowerCase());
      renderEditor();
    });

    (document.getElementById('staff-add') as HTMLButtonElement).onclick = async () => {
      const n = { id: createStaffId(), role: 'nurse', type: 'other' } as Staff;
      staff.push(n);
      await saveStaff(staff);
      renderList(search.value.toLowerCase());
    };

    (document.getElementById('staff-export') as HTMLButtonElement).onclick = () => {
      const blob = new Blob([JSON.stringify(staff, null, 2)], {
        type: 'application/json',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'staff-roster.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const fileInput = document.getElementById('staff-file') as HTMLInputElement;
    (document.getElementById('staff-import') as HTMLButtonElement).onclick = () =>
      fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const arr = JSON.parse(text) as Staff[];
        staff = arr.map((s) => ({ ...s, id: ensureStaffId(s.id) }));
        await saveStaff(staff);
        renderList(search.value.toLowerCase());
      } catch {
        alert('Invalid JSON');
      }
    };
  };

  const renderEditor = () => {
    const wrap = document.getElementById('nurse-editor')!;
    const st = staff.find((s) => s.id === selected);
    if (!st) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <section class="panel">
        <h3>Edit Nurse</h3>
        <div class="form-grid">
          <label>First <input id="ne-first" value="${st.first || ''}"></label>
          <label>Last <input id="ne-last" value="${st.last || ''}"></label>
          <label>Role
            <select id="ne-role">
              <option value="nurse"${st.role === 'nurse' ? ' selected' : ''}>nurse</option>
              <option value="tech"${st.role === 'tech' ? ' selected' : ''}>tech</option>
            </select>
          </label>
          <label>Type
            <select id="ne-type">
              <option>home</option><option>travel</option><option>flex</option><option>charge</option><option>triage</option><option>other</option>
            </select>
          </label>
        </div>
        <label>Notes <textarea id="ne-notes">${st.notes || ''}</textarea></label>
        <div class="btn-row"><button id="ne-save" class="btn">Save</button><button id="ne-cancel" class="btn">Cancel</button></div>
        <div id="ne-err" class="muted"></div>
      </section>
    `;
    (document.getElementById('ne-type') as HTMLSelectElement).value = st.type;
    (document.getElementById('ne-save') as HTMLButtonElement).onclick = async () => {
      const first = (document.getElementById('ne-first') as HTMLInputElement).value.trim();
      if (!first) {
        (document.getElementById('ne-err') as HTMLElement).textContent = 'First required';
        return;
      }
      st.first = first;
      st.last = (document.getElementById('ne-last') as HTMLInputElement).value.trim();
      st.name = `${st.first} ${st.last}`.trim();
      st.role = (document.getElementById('ne-role') as HTMLSelectElement).value as Staff['role'];
      st.type = (document.getElementById('ne-type') as HTMLSelectElement).value as any;
      st.notes = (document.getElementById('ne-notes') as HTMLTextAreaElement).value || undefined;
      await saveStaff(staff);
      renderList((document.getElementById('roster-search') as HTMLInputElement).value.toLowerCase());
      document.dispatchEvent(new Event('config-changed'));
    };
    (document.getElementById('ne-cancel') as HTMLButtonElement).onclick = () => {
      renderList((document.getElementById('roster-search') as HTMLInputElement).value.toLowerCase());
      renderEditor();
    };
  };

  renderList();
}

function renderGeneralSettings() {
  const cfg = getConfig();
  const ui = getUIConfig();
  const el = document.getElementById('general-settings')!;
  const palette = [
    '#3b82f6', '#2563eb', '#1d4ed8', // blues
    '#ef4444', '#b91c1c',             // reds
    '#10b981', '#047857',             // greens
    '#8b5cf6',                        // purple
  ];
  const zoneOptions = (z: string, sel: string | undefined) =>
    `<select data-zone="${z}" class="zone-sel">` +
    '<option value="">Default</option>' +
    palette
      .map((c) => `<option value="${c}"${sel===c?' selected':''} style="background:${c}">${c}</option>`)
      .join('') +
    '</select>';
  const zonesHTML = cfg.zones
    .map(
      (z, i) =>
        `<div class="form-row zone-row">
          <input class="zone-name" data-index="${i}" value="${z.name}">
          ${zoneOptions(z.name, z.color)}
          <button class="zone-del btn" data-index="${i}">Remove</button>
        </div>`
    )
    .join('');
  el.innerHTML = `
    <section class="panel">
      <h3>General</h3>
      ${zonesHTML}
      <div class="form-row"><button id="zone-add" class="btn">Add Zone</button></div>
      <div class="form-row"><label>Day hours <input id="gs-day" type="number" value="${cfg.shiftDurations?.day}"></label></div>
      <div class="form-row"><label>Night hours <input id="gs-night" type="number" value="${cfg.shiftDurations?.night}"></label></div>
      <div class="form-row"><label>DTO minutes <input id="gs-dto" type="number" value="${cfg.dtoMinutes}"></label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-charge"${cfg.showPinned?.charge!==false?' checked':''}> Show Charge Nurse slot when empty</label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-triage"${cfg.showPinned?.triage!==false?' checked':''}> Show Triage Nurse slot when empty</label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-privacy"${cfg.privacy!==false?' checked':''}> Privacy mode: First LastInitial</label></div>
      <div class="form-row"><label>RSS URL <input id="gs-rss" value="${cfg.rss?.url || ''}"></label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-rss-en"${cfg.rss?.enabled?' checked':''}> Enable feed</label></div>
      <div class="form-row">
        <label>Signout Button Mode</label>
        <div>
          <label><input type="radio" name="signout-mode" value="shiftHuddle"${ui.signoutMode==='shiftHuddle'?' checked':''}> Shift Huddle</label>
          <label><input type="radio" name="signout-mode" value="disabled"${ui.signoutMode==='disabled'?' checked':''}> Disabled</label>
          <label><input type="radio" name="signout-mode" value="legacySignout"${ui.signoutMode==='legacySignout'?' checked':''}> Legacy Signout</label>
        </div>
        <div class="muted">Controls Signout button behavior.</div>
      </div>
      <div class="form-row">
        <label for="gs-sidebar-width">Right Sidebar Width</label>
        <input id="gs-sidebar-width" type="range" min="${ui.rightSidebarMinPx}" max="${ui.rightSidebarMaxPx}" value="${ui.rightSidebarWidthPx}">
        <input id="gs-sidebar-width-num" type="number" min="${ui.rightSidebarMinPx}" max="${ui.rightSidebarMaxPx}" value="${ui.rightSidebarWidthPx}">
      </div>
    </section>
  `;

  el.querySelectorAll('.zone-sel').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const zone = (sel as HTMLSelectElement).getAttribute('data-zone')!;
      const val = (sel as HTMLSelectElement).value;
      cfg.zoneColors![zone] = val;
      const zObj = cfg.zones.find((z) => z.name === zone);
      if (zObj) zObj.color = val;
      await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
      document.dispatchEvent(new Event('config-changed'));
    });
  });
  el.querySelectorAll('.zone-name').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const idx = Number((inp as HTMLElement).getAttribute('data-index'));
      const old = cfg.zones[idx].name;
      const val = (inp as HTMLInputElement).value.trim() || old;
      if (val !== old) {
        cfg.zones[idx].name = val;
        if (cfg.zoneColors && cfg.zoneColors[old]) {
          cfg.zoneColors[val] = cfg.zoneColors[old];
          delete cfg.zoneColors[old];
        }
        await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
        document.dispatchEvent(new Event('config-changed'));
        renderGeneralSettings();
      }
    });
  });
  el.querySelectorAll('.zone-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = Number((btn as HTMLElement).getAttribute('data-index'));
      const removed = cfg.zones.splice(idx, 1)[0];
      if (removed && cfg.zoneColors) delete cfg.zoneColors[removed.name];
      await saveConfig({ zones: cfg.zones, zoneColors: cfg.zoneColors });
      document.dispatchEvent(new Event('config-changed'));
      renderGeneralSettings();
    });
  });
  (document.getElementById('zone-add') as HTMLButtonElement).addEventListener('click', async () => {
    cfg.zones.push({ id: `zone_${Date.now()}`, name: `Zone ${cfg.zones.length + 1}`, color: '#ffffff' });
    await saveConfig({ zones: cfg.zones });
    document.dispatchEvent(new Event('config-changed'));
    renderGeneralSettings();
  });
  (document.getElementById('gs-day') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.shiftDurations!.day = parseInt((e.target as HTMLInputElement).value) || 12;
    await saveConfig({ shiftDurations: cfg.shiftDurations });
  });
  (document.getElementById('gs-night') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.shiftDurations!.night = parseInt((e.target as HTMLInputElement).value) || 12;
    await saveConfig({ shiftDurations: cfg.shiftDurations });
  });
  (document.getElementById('gs-dto') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.dtoMinutes = parseInt((e.target as HTMLInputElement).value) || 60;
    await saveConfig({ dtoMinutes: cfg.dtoMinutes });
  });
  (document.getElementById('gs-charge') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.showPinned!.charge = (e.target as HTMLInputElement).checked;
    await saveConfig({ showPinned: cfg.showPinned });
    document.dispatchEvent(new Event('config-changed'));
  });
  (document.getElementById('gs-triage') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.showPinned!.triage = (e.target as HTMLInputElement).checked;
    await saveConfig({ showPinned: cfg.showPinned });
    document.dispatchEvent(new Event('config-changed'));
  });
  (document.getElementById('gs-privacy') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.privacy = (e.target as HTMLInputElement).checked;
    await saveConfig({ privacy: cfg.privacy });
    document.dispatchEvent(new Event('config-changed'));
  });
  (document.getElementById('gs-rss') as HTMLInputElement).addEventListener('input', async (e) => {
    cfg.rss!.url = (e.target as HTMLInputElement).value;
    await saveConfig({ rss: cfg.rss });
  });
  (document.getElementById('gs-rss-en') as HTMLInputElement).addEventListener('change', async (e) => {
    cfg.rss!.enabled = (e.target as HTMLInputElement).checked;
    await saveConfig({ rss: cfg.rss });
  });

  el.querySelectorAll('input[name="signout-mode"]').forEach((r) => {
    r.addEventListener('change', async (e) => {
      const mode = (e.target as HTMLInputElement).value as any;
      await saveUIConfig({ signoutMode: mode });
      renderHeader();
    });
  });
  const range = document.getElementById('gs-sidebar-width') as HTMLInputElement;
  const num = document.getElementById('gs-sidebar-width-num') as HTMLInputElement;
  const sync = (val: number) => {
    range.value = num.value = String(val);
    applyUI({ ...ui, rightSidebarWidthPx: val });
  };
  range.addEventListener('input', () => sync(parseInt(range.value)));
  range.addEventListener('change', async () => {
    ui.rightSidebarWidthPx = parseInt(range.value);
    await saveUIConfig({ rightSidebarWidthPx: ui.rightSidebarWidthPx });
  });
  num.addEventListener('input', () => sync(parseInt(num.value)));
  num.addEventListener('change', async () => {
    ui.rightSidebarWidthPx = parseInt(num.value);
    await saveUIConfig({ rightSidebarWidthPx: ui.rightSidebarWidthPx });
  });
}

function renderTypeLegend() {
  const el = document.getElementById('type-legend')!;
  el.innerHTML = `
  <section class="panel">
    <h3>Nurse Type Legend</h3>
    <div class="assignments">
      <div class="nurse-pill" data-type="home"><span class="nurse-name">Home</span></div>
      <div class="nurse-pill" data-type="travel"><span class="nurse-name">Travel</span></div>
      <div class="nurse-pill" data-type="flex"><span class="nurse-name">Flex</span></div>
      <div class="nurse-pill" data-type="charge"><span class="nurse-name">Charge</span></div>
      <div class="nurse-pill" data-type="triage"><span class="nurse-name">Triage</span></div>
      <div class="nurse-pill" data-type="other"><span class="nurse-name">Other</span></div>
    </div>
  </section>`;
}

function renderWidgetsPanel() {
  const cfg = getConfig();
  const w = cfg.widgets;
  const el = document.getElementById('settings-widgets')!;
  el.innerHTML = `
  <section class="panel">
    <h3>Widgets</h3>

    <div class="form-row">
      <label><input type="checkbox" id="w-show"> Show widgets</label>
    </div>

    <h4>Weather</h4>
    <div class="form-grid">
      <label>Mode
        <select id="w-mode">
          <option>Manual</option>
          <option>OpenWeather</option>
        </select>
      </label>
      <label>Units
        <select id="w-units">
          <option>F</option><option>C</option>
        </select>
      </label>
      <label>City <input id="w-city" placeholder="Louisville, KY"></label>
      <label>Lat <input id="w-lat" type="number"></label>
      <label>Lon <input id="w-lon" type="number"></label>
      <label>API Key <input id="w-key" type="password"></label>
    </div>
    <div class="btn-row"><button id="w-save" class="btn">Save Weather</button><button id="w-fetch" class="btn">Fetch Now</button></div>

    <div id="w-manual" class="form-grid">
      <label>Temperature <input id="w-temp" type="number"></label>
      <label>Condition <input id="w-cond"></label>
      <label>Location <input id="w-loc"></label>
      <button id="w-apply" class="btn">Apply Manual</button>
    </div>

  </section>
`;

  (document.getElementById('w-show') as HTMLInputElement).checked = w.show !== false;
  (document.getElementById('w-mode') as HTMLSelectElement).value =
    w.weather.mode === 'openweather' ? 'OpenWeather' : 'Manual';
  (document.getElementById('w-units') as HTMLSelectElement).value = w.weather.units;
  (document.getElementById('w-city') as HTMLInputElement).value = w.weather.city || '';
  (document.getElementById('w-lat') as HTMLInputElement).value = w.weather.lat?.toString() || '';
  (document.getElementById('w-lon') as HTMLInputElement).value = w.weather.lon?.toString() || '';
  (document.getElementById('w-key') as HTMLInputElement).value = w.weather.apiKey || '';
  (document.getElementById('w-temp') as HTMLInputElement).value = w.weather.current?.temp?.toString() || '';
  (document.getElementById('w-cond') as HTMLInputElement).value = w.weather.current?.condition || '';
  (document.getElementById('w-loc') as HTMLInputElement).value = w.weather.current?.location || '';
  const manual = document.getElementById('w-manual')!;
  manual.style.display = w.weather.mode === 'manual' ? 'grid' : 'none';
  document.getElementById('w-mode')!.addEventListener('change', (e) => {
    const mode = (e.target as HTMLSelectElement).value.toLowerCase();
    manual.style.display = mode === 'manual' ? 'grid' : 'none';
  });

  document.getElementById('w-save')!.addEventListener('click', async () => {
    const cfg = getConfig();
    const w = cfg.widgets;
    w.show = (document.getElementById('w-show') as HTMLInputElement).checked;
    w.weather.mode = (document.getElementById('w-mode') as HTMLSelectElement).value.toLowerCase() as 'manual' | 'openweather';
    const prevUnits = w.weather.units;
    w.weather.units = (document.getElementById('w-units') as HTMLSelectElement).value as 'F' | 'C';
    w.weather.city = (document.getElementById('w-city') as HTMLInputElement).value || undefined;
    const lat = parseFloat((document.getElementById('w-lat') as HTMLInputElement).value);
    w.weather.lat = isNaN(lat) ? undefined : lat;
    const lon = parseFloat((document.getElementById('w-lon') as HTMLInputElement).value);
    w.weather.lon = isNaN(lon) ? undefined : lon;
    w.weather.apiKey = (document.getElementById('w-key') as HTMLInputElement).value || undefined;
    if (w.weather.current && prevUnits !== w.weather.units) {
      w.weather.current.temp =
        w.weather.units === 'C'
          ? ((w.weather.current.temp - 32) * 5) / 9
          : (w.weather.current.temp * 9) / 5 + 32;
    }
    await saveConfig({ widgets: w });
    if (
      w.weather.mode === 'openweather' &&
      w.weather.apiKey &&
      w.weather.lat != null &&
      w.weather.lon != null
    ) {
      await fetchWeather();
    }
    const body = document.getElementById('weather-body');
    if (body) await renderWeather(body);
  });

  document.getElementById('w-fetch')!.addEventListener('click', async () => {
    await fetchWeather();
    const body = document.getElementById('weather-body');
    if (body) await renderWeather(body);
    renderWidgetsPanel();
  });

  document.getElementById('w-apply')!.addEventListener('click', async () => {
    const cfg = getConfig();
    const w = cfg.widgets;
    const temp = parseFloat((document.getElementById('w-temp') as HTMLInputElement).value);
    const cond = (document.getElementById('w-cond') as HTMLInputElement).value;
    const loc = (document.getElementById('w-loc') as HTMLInputElement).value;
    w.weather.current = {
      temp: temp,
      condition: cond,
      location: loc,
      icon: mapIcon(cond),
      updatedISO: new Date().toISOString(),
    };
    await saveConfig({ widgets: w });
    const body = document.getElementById('weather-body');
    if (body) await renderWeather(body);
    renderWidgetsPanel();
  });
}

