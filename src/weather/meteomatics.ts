export type MeteomaticsCfg = {
  units: 'F' | 'C';
  lat: number; lon: number;
  params: string;
  step: string;           // e.g., 'PT1H'
  hoursBack: number;      // e.g., 0
  hoursFwd: number;       // e.g., 24
  model: string;          // 'mix'
};

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toLocalISO(dt: Date) {
  // Use offset form like 2025-09-04T21:00:00-04:00 (Meteomatics accepts offsets)
  const tzOffMin = -dt.getTimezoneOffset();
  const sign = tzOffMin >= 0 ? '+' : '-';
  const hh = pad2(Math.floor(Math.abs(tzOffMin) / 60));
  const mm = pad2(Math.abs(tzOffMin) % 60);
  return dt.toISOString().slice(0,19) + `${sign}${hh}:${mm}`;
}

export function buildTimeWindow(hoursBack: number, hoursFwd: number) {
  const now = new Date();
  now.setMinutes(0,0,0);
  const start = new Date(now.getTime() - hoursBack * 3600_000);
  const end   = new Date(now.getTime() + hoursFwd  * 3600_000);
  return { startISO: toLocalISO(start), endISO: toLocalISO(end) };
}

export function buildProxyURL(cfg: MeteomaticsCfg) {
  const { startISO, endISO } = buildTimeWindow(cfg.hoursBack, cfg.hoursFwd);
  const q = new URLSearchParams({
    start: startISO, end: endISO, step: cfg.step,
    params: cfg.params, lat: String(cfg.lat), lon: String(cfg.lon),
    format: 'html', model: cfg.model
  });
  return `/meteomatics_proxy.php?${q.toString()}`;
}
