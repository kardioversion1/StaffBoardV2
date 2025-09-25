import { describe, it, expect, vi } from 'vitest';
/** @vitest-environment happy-dom */

vi.mock('@/state', () => ({
  getConfig: () => ({ showPinned: {}, zones: [] }),
  STATE: { dateISO: '2024-01-01', shift: 'day', locked: false, clockHHMM: '00:00' },
}));

import { createPatientCareTeamPanel, renderLeadership } from '@/ui/board/patientCareTeam';
import { createAssignmentsPanel } from '@/ui/board/assignments';
import { createCommentsPanel, wireComments } from '@/ui/board/comments';
import { createWeatherPanel } from '@/ui/board/weather';
import { createIncomingPanel } from '@/ui/board/incoming';
import { createOffgoingPanel } from '@/ui/board/offgoing';
import { createPhysiciansPanel } from '@/ui/board/physicians';
import { setNurseCache } from '@/utils/names';
import type { ActiveBoard, Staff } from '@/state';

const baseBoard: ActiveBoard = {
  dateISO: '2024-01-01',
  shift: 'day',
  charge: undefined,
  triage: undefined,
  admin: undefined,
  zones: {},
  incoming: [],
  offgoing: [],
  comments: '',
  huddle: '',
  handoff: '',
  version: 1,
};

const noStaff: Staff[] = [] as any;

describe('panel factories', () => {
  it('creates patient care team panel with heading', () => {
    const el = createPatientCareTeamPanel();
    expect(el.querySelector('h3')?.textContent).toContain('Patient Care Team');
  });

  it('creates assignments panel with zones container', () => {
    const el = createAssignmentsPanel();
    expect(el.querySelector('#zones')).toBeTruthy();
  });

  it('wires comments panel', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    root.appendChild(createCommentsPanel());
    wireComments(baseBoard, () => {});
    const ta = root.querySelector('textarea')!;
    ta.value = 'hi';
    ta.dispatchEvent(new Event('change'));
    expect(baseBoard.comments).toBe('hi');
  });

  it('creates weather panel', () => {
    const el = createWeatherPanel();
    expect(el.querySelector('#weather-body')).toBeTruthy();
  });

  it('creates incoming panel', () => {
    const el = createIncomingPanel();
    expect(el.querySelector('#incoming')).toBeTruthy();
  });

  it('creates offgoing panel', () => {
    const el = createOffgoingPanel();
    expect(el.querySelector('#offgoing')).toBeTruthy();
  });

  it('creates physicians panel', () => {
    const el = createPhysiciansPanel();
    expect(el.querySelector('#phys')).toBeTruthy();
  });
});

describe('renderLeadership', () => {
  it('handles missing elements gracefully', () => {
    const root = document.createElement('div');
    expect(() => renderLeadership(baseBoard, noStaff, () => {}, root, () => {})).not.toThrow();
  });

  it('renders names when elements exist', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div id="slot-charge"></div><div id="slot-triage"></div><div id="slot-secretary"></div>';
    const board: ActiveBoard = {
      ...baseBoard,
      charge: { nurseId: 'c1' },
      triage: { nurseId: 't1' },
      admin: { nurseId: 'a1' },
    };
    setNurseCache([
      { id: 'c1', name: 'c1', role: 'nurse', type: 'other' } as any,
      { id: 't1', name: 't1', role: 'nurse', type: 'other' } as any,
      { id: 'a1', name: 'a1', role: 'nurse', type: 'other' } as any,
    ]);
    renderLeadership(board, noStaff, () => {}, root, () => {});
    expect(root.querySelector('#slot-charge')!.textContent).toBe('c1');
    expect(root.querySelector('#slot-triage')!.textContent).toBe('t1');
    expect(root.querySelector('#slot-secretary')!.textContent).toBe('a1');
  });
});
