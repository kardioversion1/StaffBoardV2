/** Create the Weather panel wrapper. */
export function createWeatherPanel(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'weather';
  section.className = 'panel';
  section.innerHTML = `
    <h3>Weather</h3>
    <div id="weather-body"></div>
  `;
  return section;
}
