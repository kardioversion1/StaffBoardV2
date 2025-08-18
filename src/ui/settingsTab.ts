import { getConfig, saveConfig, mergeConfigDefaults } from '@/state';
import { fetchWeather, renderWidgets } from './widgets';

function mapIcon(cond: string) {
  const c = cond.toLowerCase();
  if (c.includes('storm') || c.includes('thunder')) return 'storm';
  if (c.includes('snow')) return 'snow';
  if (c.includes('rain') || c.includes('drizzle')) return 'rain';
  if (c.includes('cloud')) return 'cloud';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'mist';
  return 'sun';
}

export function renderSettingsTab(root: HTMLElement) {
  mergeConfigDefaults();
  root.innerHTML = `<div id="settings-widgets"></div><div id="type-legend"></div>`;
  renderWidgetsPanel();
  renderTypeLegend();
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
  (document.getElementById('w-mode') as HTMLSelectElement).value = w.weather.mode === 'openweather' ? 'OpenWeather' : 'Manual';
  (document.getElementById('w-units') as HTMLSelectElement).value = w.weather.units;
  (document.getElementById('w-city') as HTMLInputElement).value = w.weather.city || '';
  (document.getElementById('w-lat') as HTMLInputElement).value = w.weather.lat?.toString() || '';
  (document.getElementById('w-lon') as HTMLInputElement).value = w.weather.lon?.toString() || '';
  (document.getElementById('w-key') as HTMLInputElement).value = w.weather.apiKey || '';
  (document.getElementById('w-temp') as HTMLInputElement).value = w.weather.current?.temp?.toString() || '';
  (document.getElementById('w-cond') as HTMLInputElement).value = w.weather.current?.condition || '';
  (document.getElementById('w-loc') as HTMLInputElement).value = w.weather.current?.location || '';
  (document.getElementById('h-int') as HTMLInputElement).value = w.headlines.internal;
  (document.getElementById('h-ext') as HTMLInputElement).value = w.headlines.external;

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
          : w.weather.current.temp * 9 / 5 + 32;
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
