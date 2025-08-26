import {
  getConfig,
  saveConfig,
  mergeConfigDefaults,
  applyThemeAndScale,
  loadStaff,
  saveStaff,
  Staff,
} from '@/state';
import { createStaffId, ensureStaffId } from '@/utils/id';
import { fetchWeather, renderWidgets } from './widgets';

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
export async function renderSettingsTab(root: HTMLElement): Promise<void> {
  mergeConfigDefaults();
  root.innerHTML = `<div id="roster-settings"></div><div id="display-settings"></div><div id="settings-widgets"></div><div id="type-legend"></div>`;
  await renderRosterSettings();
  renderDisplaySettings();
  renderWidgetsPanel();
  renderTypeLegend();
}

async function renderRosterSettings(): Promise<void> {
  const el = document.getElementById('roster-settings')!;
  let staff = await loadStaff();

  const renderTable = () => {
    el.innerHTML = `
    <section class="panel">
      <h3>Staff Roster</h3>
      <div class="btn-row">
        <button id="staff-add" class="btn">Add</button>
        <button id="staff-export" class="btn">Export JSON</button>
        <input id="staff-file" type="file" accept="application/json" style="display:none">
        <button id="staff-import" class="btn">Import JSON</button>
      </div>
      <table id="staff-table">
        <thead><tr><th>Name</th><th>RF</th><th>Role</th><th>Type</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </section>`;
    const tbody = el.querySelector('#staff-table tbody')!;
    staff.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input data-id="${s.id}" data-field="name" value="${s.name || ''}"></td>
        <td><input data-id="${s.id}" data-field="rf" type="number" value="${s.rf ?? ''}"></td>
        <td><select data-id="${s.id}" data-field="role">
          <option value="nurse"${s.role === 'nurse' ? ' selected' : ''}>Nurse</option>
          <option value="tech"${s.role === 'tech' ? ' selected' : ''}>Tech</option>
        </select></td>
        <td><select data-id="${s.id}" data-field="type">
          <option value="home"${s.type === 'home' ? ' selected' : ''}>home</option>
          <option value="travel"${s.type === 'travel' ? ' selected' : ''}>travel</option>
          <option value="flex"${s.type === 'flex' ? ' selected' : ''}>flex</option>
          <option value="charge"${s.type === 'charge' ? ' selected' : ''}>charge</option>
          <option value="triage"${s.type === 'triage' ? ' selected' : ''}>triage</option>
          <option value="other"${s.type === 'other' ? ' selected' : ''}>other</option>
        </select></td>
        <td><button class="btn" data-del="${s.id}">×</button></td>
      `;
      const roleSel = tr.querySelector('select[data-field="role"]') as HTMLSelectElement;
      const typeSel = tr.querySelector('select[data-field="type"]') as HTMLSelectElement;
      typeSel.disabled = roleSel.value !== 'nurse';
      roleSel.addEventListener('change', () => {
        typeSel.disabled = roleSel.value !== 'nurse';
      });
      tbody.appendChild(tr);
    });

    tbody.addEventListener('input', async (e) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      const id = target.getAttribute('data-id');
      const field = target.getAttribute('data-field') as keyof Staff | null;
      if (!id || !field) return;
      const entry = staff.find((s) => s.id === id);
      if (!entry) return;

      if (field === 'rf') entry.rf = target.value ? Number(target.value) : undefined;
      else if (field === 'name') entry.name = target.value;
      else if (field === 'role') {
        const v = (target as HTMLSelectElement).value as Staff['role'];
        entry.role = v;
      } else if (field === 'type') entry.type = target.value as any;

      await saveStaff(staff);
    });

    tbody.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-del');
      if (!id) return;
      staff = staff.filter((s) => s.id !== id);
      await saveStaff(staff);
      renderTable();
    });

    (el.querySelector('#staff-add') as HTMLButtonElement).onclick = async () => {
      staff.push({ id: createStaffId(), role: 'nurse', type: 'other' } as Staff);
      await saveStaff(staff);
      renderTable();
    };

    (el.querySelector('#staff-export') as HTMLButtonElement).onclick = () => {
      const blob = new Blob([JSON.stringify(staff, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'staff-roster.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const fileInput = el.querySelector('#staff-file') as HTMLInputElement;
    (el.querySelector('#staff-import') as HTMLButtonElement).onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const arr = JSON.parse(text) as Partial<Staff>[];
        staff = arr.map((s) => ({
          id: s.id ? ensureStaffId(s.id) : createStaffId(),
          name: s.name || '',
          rf: s.rf,
          role: s.role === 'tech' ? 'tech' : 'nurse',
          type: (s.type as any) ?? 'other',
        }));
        await saveStaff(staff);
        renderTable();
      } catch {
        alert('Invalid JSON');
      }
    };
  };

  renderTable();
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

    <h4>Headlines</h4>
    <div class="form-grid">
      <label>Internal <input id="h-int"></label>
      <label>External <input id="h-ext"></label>
    </div>
    <div class="btn-row"><button id="h-save" class="btn">Save Headlines</button></div>
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
  (document.getElementById('h-int') as HTMLInputElement).value = w.headlines.internal || '';
  (document.getElementById('h-ext') as HTMLInputElement).value = w.headlines.external || '';

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
    const body = document.getElementById('widgets-body');
    if (body) await renderWidgets(body);
  });

  document.getElementById('w-fetch')!.addEventListener('click', async () => {
    await fetchWeather();
    const body = document.getElementById('widgets-body');
    if (body) await renderWidgets(body);
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
    const body = document.getElementById('widgets-body');
    if (body) await renderWidgets(body);
    renderWidgetsPanel();
  });

  document.getElementById('h-save')!.addEventListener('click', async () => {
    const cfg = getConfig();
    cfg.widgets.headlines.internal = (document.getElementById('h-int') as HTMLInputElement).value;
    cfg.widgets.headlines.external = (document.getElementById('h-ext') as HTMLInputElement).value;
    await saveConfig({ widgets: cfg.widgets });
    const body = document.getElementById('widgets-body');
    if (body) await renderWidgets(body);
  });
}

function renderDisplaySettings() {
  const cfg = getConfig();
  const el = document.getElementById('display-settings')!;
  el.innerHTML = `
  <section class="panel">
    <h3>Display</h3>
    <div class="form-row">
      <label>Font size
        <select id="font-scale">
          <option value="1">Normal</option>
          <option value="1.2">Large</option>
          <option value="1.4">Extra Large</option>
        </select>
      </label>
    </div>
    <div class="form-row">
      <label>Theme
        <select id="theme-select">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
    </div>
    <div class="form-row">
      <label><input type="checkbox" id="high-contrast"> High contrast</label>
    </div>
  </section>`;
  (document.getElementById('font-scale') as HTMLSelectElement).value = (cfg.fontScale || 1).toString();
  document.getElementById('font-scale')!.addEventListener('change', async (e) => {
    const scale = parseFloat((e.target as HTMLSelectElement).value);
    await saveConfig({ fontScale: scale });
    applyThemeAndScale({ ...cfg, fontScale: scale });
  });

  (document.getElementById('theme-select') as HTMLSelectElement).value = cfg.theme || 'dark';
  document.getElementById('theme-select')!.addEventListener('change', async (e) => {
    const theme = (e.target as HTMLSelectElement).value as 'light' | 'dark';
    await saveConfig({ theme });
    applyThemeAndScale({ ...cfg, theme });
  });

  (document.getElementById('high-contrast') as HTMLInputElement).checked = !!cfg.highContrast;
  document.getElementById('high-contrast')!.addEventListener('change', async (e) => {
    const hc = (e.target as HTMLInputElement).checked;
    await saveConfig({ highContrast: hc });
    applyThemeAndScale({ ...cfg, highContrast: hc });
  });
}
