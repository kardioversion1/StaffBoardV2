import * as Server from '@/server';
import {
  DB,
  KS,
  STATE,
  loadStaff,
  CURRENT_SCHEMA_VERSION,
  migrateActiveBoard,
  setActiveBoardCache,
  getActiveBoardCache,
  mergeBoards,
  type Staff,
  type ActiveBoard,
  getConfig,
  type Config,
} from '@/state';
import { notifyUpdate, onUpdate } from '@/state/sync';
import { setNurseCache } from '@/utils/names';
import { renderWeather } from '@/ui/widgets';
import { renderPhysicians, renderPhysicianPopup } from '@/ui/physicians';
import '@/ui/mainBoard/boardLayout.css';
import { normalizeActiveZones, type ZoneDef } from '@/utils/zones';
import { showToast } from '@/ui/banner';

import { createPatientCareTeamPanel, renderLeadership } from '@/ui/board/patientCareTeam';
import { createAssignmentsPanel, renderAssignments, defaultEnd } from '@/ui/board/assignments';
import { createCommentsPanel, wireComments } from '@/ui/board/comments';
import { createWeatherPanel } from '@/ui/board/weather';
import {
  createIncomingPanel,
  renderIncoming,
  autoAssignArrivals,
} from '@/ui/board/incoming';
import { createOffgoingPanel, renderOffgoing } from '@/ui/board/offgoing';
import { createPhysiciansPanel } from '@/ui/board/physicians';
import type { Slot } from '@/slots';

export { defaultEnd };
export { renderLeadership } from '@/ui/board/patientCareTeam';

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function buildEmptyActive(
  dateISO: string,
  shift: 'day' | 'night',
  zones: ZoneDef[]
): ActiveBoard {
  return {
    dateISO,
    shift,
    charge: undefined,
    triage: undefined,
    admin: undefined,
    zones: Object.fromEntries(zones.map((z) => [z.name, [] as Slot[]])),
    incoming: [],
    offgoing: [],
    comments: '',
    huddle: '',
    handoff: '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

let clockHandler: (() => void) | null = null;
const offlineQueue: ActiveBoard[] = [];
async function flushQueuedSaves(): Promise<void> {
  while (offlineQueue.length) {
    const board = offlineQueue[0];
    try {
      await Server.save('active', board);
      offlineQueue.shift();
    } catch {
      break;
    }
  }
}

/** Render the main board view. */
export async function renderBoard(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  try {
    const cfg = getConfig();
    if (!cfg.zones) cfg.zones = [];

    const staff: Staff[] = await loadStaff();
    setNurseCache(staff);

    const saveKey = KS.ACTIVE(ctx.dateISO, ctx.shift);

    let active: ActiveBoard | undefined = await DB.get<ActiveBoard>(saveKey);
    let usedLocal = true;

    const cached = getActiveBoardCache(ctx.dateISO, ctx.shift);
    if (cached) {
      active = active ? mergeBoards(active, cached) : cached;
    }

    try {
      const remote = await Server.load<ActiveBoard>('active', {
        date: ctx.dateISO,
        shift: ctx.shift,
      });
      if (remote) {
        active = active ? mergeBoards(remote, active) : remote;
        usedLocal = false;
      }
    } catch {
      /* ignore network errors */
    }

    if (!active) {
      active = buildEmptyActive(ctx.dateISO, ctx.shift, cfg.zones);
    } else {
      active = migrateActiveBoard(active);
    }

    normalizeActiveZones(active, cfg.zones);
    setActiveBoardCache(active);
    await DB.set(saveKey, active);
    notifyUpdate(saveKey);
    if (usedLocal) {
      showToast('Using local data; changes may not persist');
    }

    // Layout assembly
    root.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'layout';
    layout.setAttribute('data-testid', 'main-board');

    const left = document.createElement('div');
    left.className = 'col col-left';
    left.appendChild(createPatientCareTeamPanel());
    left.appendChild(createAssignmentsPanel());
    left.appendChild(createCommentsPanel());
    layout.appendChild(left);

    const right = document.createElement('div');
    right.className = 'col col-right';
    right.appendChild(createWeatherPanel());
    right.appendChild(createIncomingPanel());
    right.appendChild(createOffgoingPanel());
    right.appendChild(createPhysiciansPanel());
    layout.appendChild(right);

    root.appendChild(layout);

    // Save logic
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const saveLocal = () => {
      void DB.set(saveKey, active!);
      notifyUpdate(saveKey);
    };

    const flushServer = async () => {
      if (saveTimer) clearTimeout(saveTimer);
      try {
        await Server.save('active', active!);
        void flushQueuedSaves();
      } catch (err) {
        console.error('failed to save active board', err);
        showToast('Saving locally; server unreachable');
        offlineQueue.push(structuredClone(active!));
      }
    };

    const queueSave = () => {
      saveLocal();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushServer, 300);
    };

    const refresh = () => {
      renderLeadership(active!, staff, queueSave, root, refresh);
      renderAssignments(active!, cfg, staff, queueSave, root);
    };

    refresh();
    wireComments(active!, queueSave);
    await renderIncoming(active!, staff, queueSave);
    renderOffgoing(active!, queueSave);

    const checkArrivals = () => {
      if (autoAssignArrivals(active!, cfg)) {
        queueSave();
        void renderIncoming(active!, staff, queueSave);
        renderAssignments(active!, cfg, staff, queueSave, root);
      }
    };
    if (clockHandler) document.removeEventListener('clock-tick', clockHandler);
    clockHandler = checkArrivals;
    document.addEventListener('clock-tick', checkArrivals);
    checkArrivals();

    const weatherBody = document.getElementById('weather-body');
    if (weatherBody) await renderWeather(weatherBody);

    await renderPhysicians(
      document.getElementById('phys') as HTMLElement,
      ctx.dateISO
    );
    const btn = document.getElementById('phys-next7');
    btn?.addEventListener('click', () => {
      renderPhysicianPopup(ctx.dateISO, 7);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveLocal();
        void flushServer();
      }
    });

    window.addEventListener('pagehide', () => {
      saveLocal();
      void flushServer();
    });

    onUpdate(saveKey, async () => {
      const updated = await DB.get<ActiveBoard>(saveKey);
      if (!updated) return;
      active = migrateActiveBoard(updated);
      normalizeActiveZones(active, cfg.zones);
      setActiveBoardCache(active);
      refresh();
    });

    document.addEventListener('config-changed', () => {
      const c = getConfig();
      normalizeActiveZones(active!, c.zones);
      queueSave();
      renderLeadership(active!, staff, queueSave, root, refresh);
      renderAssignments(active!, c, staff, queueSave, root);
    });
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <section class="panel">
        <p>Couldn't render board. See console.</p>
        <button id="reset-tuple" class="btn">Reset tuple</button>
      </section>
    `;
    document.getElementById('reset-tuple')?.addEventListener('click', async () => {
      await DB.del(KS.ACTIVE(ctx.dateISO, ctx.shift));
      renderBoard(root, ctx);
    });
  }
}
