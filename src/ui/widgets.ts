import { getConfig, mergeConfigDefaults } from '@/state/config';
import { formatDateUS, formatTime24h } from '@/utils/format';
import { buildProxyURL } from '@/weather/meteomatics';

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

export async function renderWeather(container: HTMLElement): Promise<void> {
  const cfg = getConfig();
  mergeConfigDefaults();
  const wcfg = cfg.widgets;
  if (wcfg.show === false) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  let mmUrl: string | null = null;
  if (wcfg.weather.mode === 'meteomatics') {
    if (wcfg.weather.lat != null && wcfg.weather.lon != null && wcfg.weather.params) {
      const url = buildProxyURL({
        units: wcfg.weather.units,
        lat: wcfg.weather.lat,
        lon: wcfg.weather.lon,
        params: wcfg.weather.params,
        step: wcfg.weather.step || 'PT1H',
        hoursBack: wcfg.weather.hoursBack ?? 0,
        hoursFwd: wcfg.weather.hoursFwd ?? 24,
        model: wcfg.weather.model || 'mix',
      });
      mmUrl = url;
      const header = `<div>${wcfg.weather.lat}, ${wcfg.weather.lon} • ${wcfg.weather.units} <a href="${url}" target="_blank" rel="noreferrer">Open</a></div>`;
      const iframe = `<iframe src="${url}" style="width:100%;aspect-ratio:16/10;min-height:340px;border:0;border-radius:12px"></iframe>`;
      html += card('Weather', header + iframe);
    } else {
      html += card('Weather', '<span class="muted">Weather: set in Settings</span>');
    }
  } else {
    let weatherBody = '<span class="muted">Weather: set in Settings</span>';
    let icon = '';
    if (wcfg.weather.current) {
      const cur = wcfg.weather.current;
      const ic = ICONS[cur.icon || mapCondition(cur.condition)];
      icon = ic();
      const ok = typeof cur.temp === 'number' && Number.isFinite(cur.temp);
      const upd = cur.updatedISO
        ? `<div class="muted">Updated ${formatDateUS(cur.updatedISO)} ${formatTime24h(cur.updatedISO)}</div>`
        : '';
      const temp = ok ? Math.round(cur.temp) : '—';
      weatherBody = `<div><span>${temp}° ${wcfg.weather.units} ${cur.condition} • ${cur.location || ''}</span>${upd}</div>`;
    }
    html += card('Weather', weatherBody, icon);
  }

  container.innerHTML = html;
  if (mmUrl) {
    const frame = container.querySelector('iframe');
    frame?.addEventListener('error', () => {
      container.innerHTML = card(
        'Weather unavailable',
        `<div>Meteomatics request failed.</div><div class="btn-row"><button id="mm-retry" class="btn">Retry</button><a class="btn" href="${mmUrl}" target="_blank" rel="noreferrer">Open in new tab</a></div>`
      );
      const btn = container.querySelector('#mm-retry');
      btn?.addEventListener('click', () => renderWeather(container));
    });
  }
}

export { mapCondition };
