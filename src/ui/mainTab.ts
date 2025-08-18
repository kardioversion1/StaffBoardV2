import { DB, KS, getConfig } from '@/state';
import { renderWidgets } from './widgets';

function buildEmptyActive(dateISO: string, shift: 'day' | 'night') {
  const cfg = getConfig();
  const zones = Object.fromEntries((cfg.zones || []).map((z: string) => [z, []]));
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    zones,
    incoming: [],
    offgoing: [],
    support: { techs: [], vols: [], sitters: [] },
    comments: '',
  };
}

export async function renderMain(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  let active = await DB.get(KS.ACTIVE(ctx.dateISO, ctx.shift));
  if (!active) active = buildEmptyActive(ctx.dateISO, ctx.shift);
  const cfg = getConfig();
  for (const z of cfg.zones || []) if (!active.zones[z]) active.zones[z] = [];
  try {
    root.innerHTML = `<pre>${JSON.stringify(active, null, 2)}</pre>`;
    const widgets = document.createElement('div');
    widgets.id = 'widgets';
    root.appendChild(widgets);
    await renderWidgets(widgets);
  } catch (err) {
    console.error(err);
    root.innerHTML = '<p class="error">Failed to render</p>';
  }
}
