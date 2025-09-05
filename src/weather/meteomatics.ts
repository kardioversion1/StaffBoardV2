// meteomatics.ts
/**
 * DEPRECATED: Legacy wrapper for the former Meteomatics module.
 * This file exists only to keep merge/compile compatibility after the switch to Open-Meteo.
 * - `MeteomaticsCfg` → aliased to `OpenMeteoCfg`
 * - `buildProxyURL`  → re-export of `buildURL`
 *
 * TODO: Rip this file out once all call sites import from './openMeteo' directly.
 */
export { buildURL as buildProxyURL, type OpenMeteoCfg as MeteomaticsCfg } from './openMeteo';

/**
 * Legacy helper retained for backward compatibility.
 * Returns ISO8601 timestamps in the local timezone rounded to the hour.
 */
export function buildTimeWindow(
  startOffsetHours: number,
  endOffsetHours: number
): { startISO: string; endISO: string } {
  const now = new Date();
  now.setMinutes(0, 0, 0);

  const toLocalIso = (d: Date): string => {
    const tz = -d.getTimezoneOffset();
    const sign = tz >= 0 ? '+' : '-';
    const pad = (n: number) => Math.abs(n).toString().padStart(2, '0');
    const local = new Date(d.getTime() + tz * 60 * 1000);
    const hours = Math.trunc(tz / 60);
    const mins = tz % 60;
    return `${local.toISOString().slice(0, 19)}${sign}${pad(hours)}:${pad(mins)}`;
  };

  const start = new Date(now.getTime() + startOffsetHours * 60 * 60 * 1000);
  const end = new Date(now.getTime() + endOffsetHours * 60 * 60 * 1000);
  return { startISO: toLocalIso(start), endISO: toLocalIso(end) };
}
