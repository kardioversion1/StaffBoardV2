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
  const cfg = getConfig();
  mergeConfigDefaults();
  const w = cfg.widgets;
  root.innerHTML = `
    <section>
      <h2>Widgets</h2>
      <label><input type="checkbox" id="widgets-show" ${w.show !== false ? 'checked' : ''}/> Show widgets</label>
      <h3>Weather</h3>
      <label>Mode <select id="weather-mode"><option value="manual">Manual</option><option value="openweather">OpenWeather</option></select></label>
      <label>Units <select id="weather-units"><option value="F">F</option><option value="C">C</option></select></label>
      <label>City <input type="text" id="weather-city" value="${w.weather.city || ''}"></label>
      <label>Lat <input type="number" id="weather-lat" value="${w.weather.lat ?? ''}"></label>
      <label>Lon <input type="number" id="weather-lon" value="${w.weather.lon ?? ''}"></label>
      <label>API Key <input type="password" id="weather-api" value="${w.weather.apiKey || ''}"></label>
      <div id="weather-current" class="muted"></div>
      <button id="save-weather">Save Weather</button>
      <button id="fetch-weather">Fetch Now</button>
      <div id="manual-fields" style="margin-top:8px;display:${w.weather.mode === 'manual' ? 'block' : 'none'}">
        <label>Temperature <input type="number" id="manual-temp" value="${w.weather.current?.temp ?? ''}"></label>
        <label>Condition <input type="text" id="manual-cond" value="${w.weather.current?.condition ?? ''}"></label>
        <label>Location <input type="text" id="manual-loc" value="${w.weather.current?.location ?? ''}"></label>
      </div>
      <h3>Headlines</h3>
      <label>Internal <input type="text" id="headline-int" value="${w.headlines.internal}"></label>
      <label>External <input type="text" id="headline-ext" value="${w.headlines.external}"></label>
      <button id="save-headlines">Save Headlines</button>
    </section>`;

  (document.getElementById('weather-mode') as HTMLSelectElement).value = w.weather.mode;
  (document.getElementById('weather-units') as HTMLSelectElement).value = w.weather.units;
  const currentEl = document.getElementById('weather-current')!;
  if (w.weather.current) {
    const cur = w.weather.current;
    currentEl.textContent = `${Math.round(cur.temp)}° ${w.weather.units} ${cur.condition} ${cur.location || ''}`;
  } else currentEl.textContent = '';

  (document.getElementById('weather-mode') as HTMLSelectElement).addEventListener('change', (e) => {
    const mode = (e.target as HTMLSelectElement).value;
    document.getElementById('manual-fields')!.style.display = mode === 'manual' ? 'block' : 'none';
  });

  document.getElementById('save-weather')!.addEventListener('click', async () => {
    const cfg = getConfig();
    const w = cfg.widgets;
    w.show = (document.getElementById('widgets-show') as HTMLInputElement).checked;
    const mode = (document.getElementById('weather-mode') as HTMLSelectElement).value as 'manual' | 'openweather';
    const newUnits = (document.getElementById('weather-units') as HTMLSelectElement).value as 'F' | 'C';
    const prevUnits = w.weather.units;
    w.weather.mode = mode;
    w.weather.units = newUnits;
    w.weather.city = (document.getElementById('weather-city') as HTMLInputElement).value || undefined;
    const lat = parseFloat((document.getElementById('weather-lat') as HTMLInputElement).value);
    w.weather.lat = isNaN(lat) ? undefined : lat;
    const lon = parseFloat((document.getElementById('weather-lon') as HTMLInputElement).value);
    w.weather.lon = isNaN(lon) ? undefined : lon;
    w.weather.apiKey = (document.getElementById('weather-api') as HTMLInputElement).value || undefined;
    if (mode === 'manual') {
      const temp = parseFloat((document.getElementById('manual-temp') as HTMLInputElement).value);
      const cond = (document.getElementById('manual-cond') as HTMLInputElement).value;
      const loc = (document.getElementById('manual-loc') as HTMLInputElement).value;
      w.weather.current = {
        temp: temp,
        condition: cond,
        location: loc,
        icon: mapIcon(cond),
        updatedISO: new Date().toISOString(),
      };
    } else if (w.weather.current && prevUnits !== newUnits) {
      // convert temp on unit change
      w.weather.current.temp =
        newUnits === 'C'
          ? ((w.weather.current.temp - 32) * 5) / 9
          : w.weather.current.temp * 9 / 5 + 32;
    }
    await saveConfig({ widgets: w });
    const container = document.getElementById('widgets');
    if (container) await renderWidgets(container);
    renderSettingsTab(root);
  });

  document.getElementById('fetch-weather')!.addEventListener('click', async () => {
    await fetchWeather();
    const container = document.getElementById('widgets');
    if (container) await renderWidgets(container);
    renderSettingsTab(root);
  });

  document.getElementById('save-headlines')!.addEventListener('click', async () => {
    const cfg = getConfig();
    cfg.widgets.headlines.internal = (document.getElementById('headline-int') as HTMLInputElement).value;
    cfg.widgets.headlines.external = (document.getElementById('headline-ext') as HTMLInputElement).value;
    await saveConfig({ widgets: cfg.widgets });
    const container = document.getElementById('widgets');
    if (container) await renderWidgets(container);
    renderSettingsTab(root);
  });
}
