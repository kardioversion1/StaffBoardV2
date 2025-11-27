import * as Server from '@/server';
import {
  DB,
  KS,
  STATE,
  CURRENT_SCHEMA_VERSION,
  migrateActiveBoard,
  setActiveBoardCache,
  getActiveBoardCache,
  mergeBoards,
  type ActiveBoard,
  getConfig,
  type Config,
} from '@/state';
import { rosterStore, type Staff } from '@/state/staff';
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

/** Attempt to flush queued board saves in order. */
const offlineQueue: ActiveBoard[] = [];
async function flushQueuedSaves(): Promise<Error | null> {
  while (offlineQueue.length) {
    const board = offlineQueue[0];
    try {
      await Server.save('active', board);
      offlineQueue.shift();
    } catch (err) {
      return err as Error;
    }
  }
  return null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushQueuedSaves();
  });
}

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

/** Render the main board view. */
export async function renderBoard(
  root: HTMLElement,
  ctx: { dateISO: string; shift: 'day' | 'night' }
): Promise<void> {
  try {
    const cfg = getConfig();
    if (!cfg.zones) cfg.zones = [];

    const staff: Staff[] = await rosterStore.load();
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

    const undoStack: ActiveBoard[] = [];
    let undoBtn: HTMLButtonElement | null = null;
    const updateUndoBtn = () => {
      if (!undoBtn) return;
      undoBtn.disabled = undoStack.length === 0;
      undoBtn.title = undoStack.length
        ? 'Undo your most recent change to this board'
        : 'No changes to undo yet';
    };
    const beforeChange = () => {
      undoStack.push(structuredClone(active!));
      updateUndoBtn();
    };

    // Layout assembly
    root.innerHTML = '';
    const toolbar = document.createElement('div');
    toolbar.className = 'board-toolbar';
    toolbar.innerHTML = `
      <div>
        <p class="muted small">Assign staff to rooms for this shift. You can undo the last change.</p>
      </div>
      <div class="board-toolbar__actions"></div>
    `;
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

    root.appendChild(toolbar);
    root.appendChild(layout);

    // Save logic
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const saveLocal = () => {
      void DB.set(saveKey, active!);
      notifyUpdate(saveKey);
    };

    const flushServer = async () => {
      if (saveTimer) clearTimeout(saveTimer);
      offlineQueue.push(structuredClone(active!));
      const err = await flushQueuedSaves();
      if (err) {
        console.error('failed to save active board', err);
        showToast('Saving locally; server unreachable');
      }
    };

    const queueSave = () => {
      saveLocal();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushServer, 300);
    };

    const refresh = () => {
      renderLeadership(active!, staff, queueSave, root, refresh, beforeChange);
      renderAssignments(active!, cfg, staff, queueSave, root, beforeChange);
    };

    undoBtn = document.createElement('button');
    undoBtn.id = 'board-undo';
    undoBtn.className = 'btn';
    undoBtn.textContent = 'Undo last change';
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', async () => {
      const previous = undoStack.pop();
      updateUndoBtn();
      if (!previous) return;
      active = migrateActiveBoard(previous);
      normalizeActiveZones(active, cfg.zones);
      setActiveBoardCache(active);
      await DB.set(saveKey, active);
      notifyUpdate(saveKey);
      refresh();
      wireComments(active, queueSave, beforeChange);
      await renderIncoming(active, staff, queueSave, beforeChange);
      renderOffgoing(active, beforeChange, queueSave);
      showToast('Last change undone');
    });
    toolbar.querySelector('.board-toolbar__actions')?.appendChild(undoBtn);
    updateUndoBtn();

    refresh();
    wireComments(active!, queueSave, beforeChange);
    await renderIncoming(active!, staff, queueSave, beforeChange);
    renderOffgoing(active!, beforeChange, queueSave);

    const checkArrivals = () => {
      const snapshot = structuredClone(active!);
      if (autoAssignArrivals(active!, cfg)) {
        undoStack.push(snapshot);
        updateUndoBtn();
        queueSave();
        void renderIncoming(active!, staff, queueSave, beforeChange);
        renderAssignments(active!, cfg, staff, queueSave, root, beforeChange);
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
      renderLeadership(active!, staff, queueSave, root, refresh, beforeChange);
      renderAssignments(active!, c, staff, queueSave, root, beforeChange);
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
