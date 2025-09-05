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
