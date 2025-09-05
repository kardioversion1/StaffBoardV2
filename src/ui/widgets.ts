import { getConfig, mergeConfigDefaults } from '@/state/config';
import { formatDateUS, formatTime24h } from '@/utils/format';
import { buildURL } from '@/weather/openMeteo';

function svgIcon(paths: string) {
  return `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">${paths}</svg>`;
}

function iconSun() { return svgIcon('<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'); }
function iconCloud() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/>'); }
function iconRain() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/><path d="M8 20v2M12 20v2M16 20v2"/>'); }
function iconStorm() { return svgIcon('<path d="M13 11h3l-4 7v-4h-3l4-7z"/><path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/>'); }
function iconSnow() { return svgIcon('<path d="M4 15a4 4 0 0 1 2-7 5 5 0 0 1 9 3h1a3 3 0 0 1 0 6H6a4 4 0 0 1-2-2"/><path d="M8 19v2M12 19v2M16 19v2"/><path d="M8 21h8"/>'); }
function iconMist() { return svgIcon('<path d="M3 15h18M3 12h18M5 9h14"/>'); }

const ICONS: Record<string, () => string> = {
  sun: iconSun,
  cloud: iconCloud,
  rain: iconRain,
  storm: iconStorm,
  snow: iconSnow,
  mist: iconMist,
};

function mapWeatherCode(code: number | undefined): keyof typeof ICONS {
  if (code == null) return 'sun';
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  )
    return 'rain';
  if ([45, 48].includes(code)) return 'mist';
  if ([1, 2, 3].includes(code)) return 'cloud';
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

export async function renderWeather(container: HTMLElement): Promise<void> {
  const cfg = getConfig();
  mergeConfigDefaults();
  const wcfg = cfg.widgets;
  if (wcfg.show === false) {
    container.innerHTML = '';
    return;
  }

  if (wcfg.weather.lat == null || wcfg.weather.lon == null) {
    container.innerHTML = card(
      'Weather',
      '<span class="muted">Weather: set in Settings</span>'
    );
    return;
  }

  const url = buildURL({
    lat: wcfg.weather.lat,
    lon: wcfg.weather.lon,
    units: wcfg.weather.units,
  });

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const cw = data.current_weather;
    const time: string | undefined = cw?.time;
    const idx = time
      ? data.hourly?.time?.indexOf(time)
      : -1;
    const rh =
      idx != null && idx >= 0
        ? data.hourly.relative_humidity_2m[idx]
        : undefined;
    const wb =
      idx != null && idx >= 0
        ? data.hourly.wet_bulb_temperature_2m[idx]
        : undefined;
    const icon = ICONS[mapWeatherCode(cw?.weathercode)]?.() || '';
    const upd = time
      ? `<div class="muted">Updated ${formatDateUS(time)} ${formatTime24h(time)}</div>`
      : '';
    const temp =
      typeof cw?.temperature === 'number' && Number.isFinite(cw.temperature)
        ? Math.round(cw.temperature)
        : '—';
    const rhTxt = rh != null ? ` RH ${rh}%` : '';
    const wbTxt =
      typeof wb === 'number' && Number.isFinite(wb)
        ? ` WB ${Math.round(wb)}°`
        : '';
    const body = `<div><span>${temp}° ${wcfg.weather.units}${rhTxt}${wbTxt}</span>${upd}</div>`;
    container.innerHTML = card('Weather', body, icon);
  } catch {
    container.innerHTML = card(
      'Weather unavailable',
      '<div>Open-Meteo request failed.</div><div class="btn-row"><button id="om-retry" class="btn">Retry</button></div>'
    );
    const btn = container.querySelector('#om-retry');
    btn?.addEventListener('click', () => renderWeather(container));
  }
}

