/**
 * Legacy wrapper for the former Meteomatics module.
 * Re-exports Open-Meteo helpers to maintain merge compatibility.
 */
export { buildURL as buildProxyURL, type OpenMeteoCfg as MeteomaticsCfg } from './openMeteo';
