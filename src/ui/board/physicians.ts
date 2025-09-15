/** Create the Physicians panel. */
export function createPhysiciansPanel(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `
    <h3>Physicians</h3>
    <div id="phys"></div>
    <button id="phys-next7" class="btn">Next 7 days</button>
  `;
  return section;
}
