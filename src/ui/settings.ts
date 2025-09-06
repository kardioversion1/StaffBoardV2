import { getConfig, saveConfig, mergeConfigDefaults } from '@/state/config';
import { loadStaff, saveStaff, Staff } from '@/state/staff';
import { createStaffId, ensureStaffId } from '@/utils/id';
import { renderWeather } from './widgets';
import { getUIConfig, saveUIConfig, applyUI } from '@/state/uiConfig';
import { renderHeader } from '@/ui/header';
import {
  getThemeConfig,
  saveThemeConfig,
  applyTheme,
  THEME_PRESETS,
  type UIMode,
  type ThemePreset,
} from '@/state/theme';
import * as Server from '@/server';
import { openWelcomeModal } from '@/ui/welcome';

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
        <div id="display-settings" data-testid="display-settings"></div>
      </div>
    </div>
    <div id="settings-widgets"></div>
  `;
  await renderRosterPane();
  renderGeneralSettings();
  renderDisplaySettings();
  renderWidgetsPanel();
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
          <button class="roster-del" data-id="${s.id}">🗑</button>
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
    list?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('roster-del')) {
        const id = target.getAttribute('data-id')!;
        if (confirm('Remove from roster?')) {
          await Server.softDeleteStaff(id);
          staff = staff.filter((s) => s.id !== id);
          alert('Removed from roster. Past history is preserved.');
          renderList(search.value.toLowerCase());
        }
        return;
      }
      const row = target.closest('.roster-row') as HTMLElement | null;
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
  const zonesHTML = cfg.zones
    .map(
      (z, i) =>
        `<div class="form-row zone-row">
          <input class="zone-name" data-index="${i}" value="${z.name}">
        </div>`
    )
    .join('');
  el.innerHTML = `
    <section class="panel">
      <h3>General</h3>
      <div class="form-row"><button id="welcome-btn" class="btn">Welcome / How To</button></div>
      ${zonesHTML}
      <div class="form-row"><label>Day hours <input id="gs-day" type="number" value="${cfg.shiftDurations?.day}"></label></div>
      <div class="form-row"><label>Night hours <input id="gs-night" type="number" value="${cfg.shiftDurations?.night}"></label></div>
      <div class="form-row"><label>DTO minutes <input id="gs-dto" type="number" value="${cfg.dtoMinutes}"></label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-charge"${cfg.showPinned?.charge!==false?' checked':''}> Show Charge Nurse slot when empty</label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-triage"${cfg.showPinned?.triage!==false?' checked':''}> Show Triage Nurse slot when empty</label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-privacy"${cfg.privacy!==false?' checked':''}> Privacy mode: First LastInitial</label></div>
      <div class="form-row"><label>RSS URL <input id="gs-rss" value="${cfg.rss?.url || ''}"></label></div>
      <div class="form-row"><label><input type="checkbox" id="gs-rss-en"${cfg.rss?.enabled?' checked':''}> Enable feed</label></div>
      <div class="form-row"><label>Physicians calendar URL <input id="gs-phys-url" value="${cfg.physicians?.calendarUrl || ''}"></label></div>
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

  (document.getElementById('welcome-btn') as HTMLButtonElement).addEventListener('click', openWelcomeModal);

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
  (document.getElementById('gs-phys-url') as HTMLInputElement).addEventListener('input', async (e) => {
    cfg.physicians!.calendarUrl = (e.target as HTMLInputElement).value;
    await saveConfig({ physicians: cfg.physicians });
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

function renderDisplaySettings() {
  const cfg = getThemeConfig();
  const el = document.getElementById('display-settings')!;
  const makeCard = (p: ThemePreset, name: string, sel: string) => `
    <label class="preset-card">
      <input type="radio" name="${name}" value="${p.id}"${sel===p.id?' checked':''}>
      <div class="swatches">
        <span class="swatch" style="background:${p.tokens.bg}"></span>
        <span class="swatch" style="background:${p.tokens.panel}"></span>
        <span class="swatch" style="background:${p.tokens.text}"></span>
        <span class="swatch" style="background:${p.tokens.accent}"></span>
      </div>
      <div class="preset-meta">
        <span>${p.label}</span>
        ${p.note?`<span class="muted">${p.note}</span>`:''}
      </div>
    </label>`;
  const lightCards = THEME_PRESETS.filter(p=>p.mode==='light').map(p=>makeCard(p,'ds-light',cfg.lightPreset)).join('');
  const darkCards = THEME_PRESETS.filter(p=>p.mode==='dark').map(p=>makeCard(p,'ds-dark',cfg.darkPreset)).join('');
  el.innerHTML = `
    <section class="panel">
      <h3>Display</h3>
      <div class="form-row">
        <label>Text size <input id="ds-scale" type="range" min="0.85" max="1.25" step="0.05" value="${cfg.scale}"></label>
      </div>
      <div class="form-row">
        <label>Nurse icon size <input id="ds-icon" type="range" min="0.75" max="1.5" step="0.05" value="${cfg.iconSize ?? 1}"></label>
      </div>
      <div class="form-row">
        <label>Comment text size <input id="ds-comment" type="range" min="0.7" max="1.2" step="0.05" value="${cfg.commentSize ?? 0.85}"></label>
      </div>
      <div class="form-row">
        <label>Theme</label>
        <div>
          <label><input type="radio" name="ds-mode" value="system"${cfg.mode==='system'?' checked':''}> System</label>
          <label><input type="radio" name="ds-mode" value="light"${cfg.mode==='light'?' checked':''}> Light</label>
          <label><input type="radio" name="ds-mode" value="dark"${cfg.mode==='dark'?' checked':''}> Dark</label>
        </div>
      </div>
      <h4>Light presets</h4>
      <div class="preset-grid">${lightCards}</div>
      <div class="form-row"><span id="light-contrast" class="muted"></span></div>
      <h4>Dark presets</h4>
      <div class="preset-grid">${darkCards}</div>
      <div class="form-row"><span id="dark-contrast" class="muted"></span></div>
      <div class="form-row"><label><input type="checkbox" id="ds-contrast"${cfg.highContrast?' checked':''}> High contrast</label></div>
      <div class="form-row"><label><input type="checkbox" id="ds-compact"${cfg.compact?' checked':''}> Compact mode</label></div>
      <div class="btn-row"><button id="ds-reset" class="btn">Reset to defaults</button><button id="ds-save" class="btn">Save Display</button></div>
    </section>
  `;

  const contrast = (fg: string, bg: string) => {
    const hex = (h: string) => {
      const c = h.replace('#', '');
      const bigint = parseInt(c, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      const toLum = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLum(r) + 0.7152 * toLum(g) + 0.0722 * toLum(b);
    };
    const L1 = hex(fg);
    const L2 = hex(bg);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };

  const updateContrast = () => {
    const lightId = (document.querySelector('input[name="ds-light"]:checked') as HTMLInputElement).value;
    const darkId = (document.querySelector('input[name="ds-dark"]:checked') as HTMLInputElement).value;
    const lp = THEME_PRESETS.find(p=>p.id===lightId)!;
    const dp = THEME_PRESETS.find(p=>p.id===darkId)!;
    const lr = contrast(lp.tokens.text, lp.tokens.bg);
    const dr = contrast(dp.tokens.text, dp.tokens.bg);
    (document.getElementById('light-contrast') as HTMLElement).textContent = `Contrast ${lr.toFixed(2)}:1 ${lr>=4.5?'AA pass':'fail'}`;
    (document.getElementById('dark-contrast') as HTMLElement).textContent = `Contrast ${dr.toFixed(2)}:1 ${dr>=4.5?'AA pass':'fail'}`;
    const saveBtn = document.getElementById('ds-save') as HTMLButtonElement;
    saveBtn.disabled = lr < 4.5 || dr < 4.5;
  };
  el
    .querySelectorAll('input[name="ds-light"],input[name="ds-dark"]')
    .forEach((i) =>
      i.addEventListener('change', () => {
        updateContrast();
        const lightId = (
          document.querySelector('input[name="ds-light"]:checked') as HTMLInputElement
        ).value;
        const darkId = (
          document.querySelector('input[name="ds-dark"]:checked') as HTMLInputElement
        ).value;
        applyTheme({ ...cfg, lightPreset: lightId, darkPreset: darkId });
      })
    );
  updateContrast();

  document.getElementById('ds-save')!.addEventListener('click', async () => {
    const scale = parseFloat((document.getElementById('ds-scale') as HTMLInputElement).value);
    const iconSize = parseFloat((document.getElementById('ds-icon') as HTMLInputElement).value);
    const commentSize = parseFloat((document.getElementById('ds-comment') as HTMLInputElement).value);
    const mode = (document.querySelector('input[name="ds-mode"]:checked') as HTMLInputElement).value as UIMode;
    const lightPreset = (document.querySelector('input[name="ds-light"]:checked') as HTMLInputElement).value;
    const darkPreset = (document.querySelector('input[name="ds-dark"]:checked') as HTMLInputElement).value;
    const highContrast = (document.getElementById('ds-contrast') as HTMLInputElement).checked;
    const compact = (document.getElementById('ds-compact') as HTMLInputElement).checked;
    await saveThemeConfig({ scale, iconSize, commentSize, mode, lightPreset, darkPreset, highContrast, compact });
    applyTheme();
    alert('Display settings saved.');
  });

  document.getElementById('ds-reset')!.addEventListener('click', async () => {
    await saveThemeConfig({ custom: undefined });
    applyTheme();
    alert('Theme reset to preset defaults.');
  });
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
      <label>Lat <input id="w-lat" type="number"></label>
      <label>Lon <input id="w-lon" type="number"></label>
      <label>Units
        <select id="w-units">
          <option>F</option><option>C</option>
        </select>
      </label>
    </div>
    <div class="btn-row"><button id="w-save" class="btn">Save Weather</button></div>

    <div id="w-preview"></div>

  </section>
`;

  (document.getElementById('w-show') as HTMLInputElement).checked =
    w.show !== false;
  (document.getElementById('w-lat') as HTMLInputElement).value =
    w.weather.lat?.toString() || '';
  (document.getElementById('w-lon') as HTMLInputElement).value =
    w.weather.lon?.toString() || '';
  (document.getElementById('w-units') as HTMLSelectElement).value =
    w.weather.units;

  document.getElementById('w-save')!.addEventListener('click', async () => {
    const cfg = getConfig();
    const w = cfg.widgets;
    w.show = (document.getElementById('w-show') as HTMLInputElement).checked;
    const lat = parseFloat(
      (document.getElementById('w-lat') as HTMLInputElement).value
    );
    w.weather.lat = isNaN(lat) ? undefined : lat;
    const lon = parseFloat(
      (document.getElementById('w-lon') as HTMLInputElement).value
    );
    w.weather.lon = isNaN(lon) ? undefined : lon;
    w.weather.units = (
      document.getElementById('w-units') as HTMLSelectElement
    ).value as 'F' | 'C';
    await saveConfig({ widgets: w });
    const body = document.getElementById('weather-body');
    if (body) await renderWeather(body);
    renderWidgetsPanel();
  });

  const preview = document.getElementById('w-preview');
  if (preview) {
    const cfg2 = getConfig();
    const prev = cfg2.widgets.show;
    cfg2.widgets.show = true;
    renderWeather(preview).finally(() => {
      cfg2.widgets.show = prev;
    });
  }
}

