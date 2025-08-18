import { getConfig, saveConfig, mergeConfigDefaults } from '@/state';

function svgIcon(paths: string) {
  return `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${paths}</svg>`;
}

function iconSun() { return svgIcon('<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'); }
function iconCloud() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/>'); }
function iconRain() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/><path d="M8 20v2M12 20v2M16 20v2"/>'); }
function iconStorm() { return svgIcon('<path d="M13 11h3l-4 7v-4h-3l4-7z"/><path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/>'); }
function iconSnow() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/><path d="M8 19v2M12 19v2M16 19v2"/><path d="M8 21h8"/>'); }
function iconMist() { return svgIcon('<path d="M3 15h18M3 12h18M5 9h14"/>'); }
function iconMegaphone() { return svgIcon('<path d="M3 11v2a1 1 0 0 0 1 1h3l4 4v-14l-4 4H4a1 1 0 0 0-1 1z"/>'); }
function iconCone() { return svgIcon('<path d="M12 2 3 22h18L12 2z"/><path d="M9 16h6"/>'); }

const ICONS: Record<string, () => string> = {
  sun: iconSun,
  cloud: iconCloud,
  rain: iconRain,
  storm: iconStorm,
  snow: iconSnow,
  mist: iconMist,
};

function mapCondition(cond: string | undefined) {
  if (!cond) return 'sun';
  const c = cond.toLowerCase();
  if (c.includes('storm') || c.includes('thunder')) return 'storm';
  if (c.includes('snow')) return 'snow';
  if (c.includes('rain') || c.includes('drizzle')) return 'rain';
  if (c.includes('cloud')) return 'cloud';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return 'mist';
  return 'sun';
}

function card(title: string, bodyHTML: string, iconSVG = '') {
  return `
    <div class="widget">
      <div class="title">${iconSVG}<span>${title}</span></div>
      <div class="sub">${bodyHTML}</div>
    </div>
  `;
}

export async function fetchWeather(): Promise<void> {
  const cfg = getConfig();
  const w = cfg.widgets.weather;
  if (w.mode !== 'openweather' || !w.apiKey) {
    alert('Weather is set to Manual');
    return;
  }
  const params = new URLSearchParams({ appid: w.apiKey, units: w.units === 'F' ? 'imperial' : 'metric' });
  if (w.lat != null && w.lon != null) {
    params.set('lat', String(w.lat));
    params.set('lon', String(w.lon));
  } else if (w.city) params.set('q', w.city);
  else {
    alert('Weather location not configured');
    return;
  }
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`);
    if (!res.ok) throw new Error('bad');
    const data = await res.json();
    w.current = {
      temp: data.main?.temp,
      condition: data.weather?.[0]?.main || '',
      icon: mapCondition(data.weather?.[0]?.main),
      location: data.name,
      updatedISO: new Date().toISOString(),
    };
    await saveConfig({ widgets: cfg.widgets });
  } catch (err) {
    console.error(err);
    alert('Failed to fetch weather');
  }
}

export async function renderWidgets(container: HTMLElement): Promise<void> {
  const cfg = getConfig();
  mergeConfigDefaults();
  const wcfg = cfg.widgets;
  if (wcfg.show === false) {
    container.innerHTML = '';
    return;
  }

  if (
    wcfg.weather.mode === 'openweather' &&
    !wcfg.weather.current &&
    wcfg.weather.apiKey &&
    wcfg.weather.lat != null &&
    wcfg.weather.lon != null
  ) {
    await fetchWeather();
    mergeConfigDefaults();
  }

  let html = '';

  // Weather card
  let weatherBody = '<span class="muted">Weather: set in Settings</span>';
  let icon = '';
  if (wcfg.weather.current) {
    const cur = wcfg.weather.current;
    const ic = ICONS[cur.icon || mapCondition(cur.condition)];
    icon = ic();
    const upd = cur.updatedISO
      ? `<div class="muted">Updated ${new Date(cur.updatedISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`
      : '';
    weatherBody = `<div><span>${Math.round(cur.temp)}° ${wcfg.weather.units} ${cur.condition} • ${cur.location || ''}</span>${upd}</div>`;
  }
  html += card('Weather', weatherBody, icon);

  // Internal headline
  const int = wcfg.headlines.internal || '';
  html += card('Internal', `<div class="single-line" title="${int}">${int}</div>`, iconMegaphone());

  // External headline
  const ext = wcfg.headlines.external || '';
  html += card('External', `<div class="single-line" title="${ext}">${ext}</div>`, iconCone());

  container.innerHTML = html;
}

export { mapCondition };
