export interface OpenMeteoCfg {
  lat: number;
  lon: number;
  units: 'F' | 'C';
}

export function buildURL(cfg: OpenMeteoCfg): string {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(cfg.lat));
  url.searchParams.set('longitude', String(cfg.lon));
  url.searchParams.set(
    'hourly',
    'temperature_2m,relative_humidity_2m,wet_bulb_temperature_2m'
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set(
    'temperature_unit',
    cfg.units === 'C' ? 'celsius' : 'fahrenheit'
  );
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('current_weather', 'true');
  return url.toString();
}
