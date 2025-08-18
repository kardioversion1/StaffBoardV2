import { getConfig, saveConfig, mergeConfigDefaults } from '@/state';

function svgIcon(paths: string) {
  return `<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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
  container.className = 'widgets';
  container.innerHTML = '';

  const cards: HTMLElement[] = [];

  // Weather card
  const weatherCard = document.createElement('div');
  weatherCard.className = 'widget-card weather-card';
  const menu = buildMenu(container);
  if (wcfg.weather.current) {
    const cur = wcfg.weather.current;
    const iconFn = ICONS[cur.icon || mapCondition(cur.condition)];
    const icon = document.createElement('span');
    icon.innerHTML = iconFn();
    const temp = document.createElement('span');
    temp.className = 'temp';
    temp.textContent = `${Math.round(cur.temp)}° ${wcfg.weather.units}`;
    const line1 = document.createElement('div');
    line1.className = 'line1';
    line1.append(icon, temp);
    const cond = document.createElement('div');
    cond.textContent = `${cur.condition} • ${cur.location || wcfg.weather.city || ''}`;
    const upd = document.createElement('div');
    if (cur.updatedISO) {
      const d = new Date(cur.updatedISO);
      upd.className = 'updated';
      upd.textContent = `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    weatherCard.append(line1, cond, upd);
  } else {
    weatherCard.textContent = 'Weather: set in Settings';
  }
  weatherCard.appendChild(menu);
  cards.push(weatherCard);

  // Internal headline
  const intCard = document.createElement('div');
  intCard.className = 'widget-card';
  const intIcon = document.createElement('span');
  intIcon.innerHTML = iconMegaphone();
  const intText = document.createElement('span');
  intText.textContent = wcfg.headlines.internal;
  intText.title = wcfg.headlines.internal;
  intCard.append(intIcon, intText);
  cards.push(intCard);

  // External headline
  const extCard = document.createElement('div');
  extCard.className = 'widget-card';
  const extIcon = document.createElement('span');
  extIcon.innerHTML = iconCone();
  const extText = document.createElement('span');
  extText.textContent = wcfg.headlines.external;
  extText.title = wcfg.headlines.external;
  extCard.append(extIcon, extText);
  cards.push(extCard);

  for (const c of cards) container.appendChild(c);
}

function buildMenu(container: HTMLElement) {
  const details = document.createElement('details');
  details.className = 'widget-menu';
  const summary = document.createElement('summary');
  summary.textContent = '⋮';
  details.appendChild(summary);
  const menu = document.createElement('div');
  const btnRef = document.createElement('button');
  btnRef.textContent = 'Refresh now';
  btnRef.addEventListener('click', async (e) => {
    e.preventDefault();
    details.removeAttribute('open');
    await fetchWeather();
    await renderWidgets(container);
  });
  const btnHide = document.createElement('button');
  btnHide.textContent = 'Hide widgets';
  btnHide.addEventListener('click', async (e) => {
    e.preventDefault();
    details.removeAttribute('open');
    const cfg = getConfig();
    cfg.widgets.show = false;
    await saveConfig({ widgets: cfg.widgets });
    await renderWidgets(container);
  });
  menu.append(btnRef, btnHide);
  details.appendChild(menu);
  return details;
}

