import { describe, it, expect, vi } from 'vitest';
/** @vitest-environment happy-dom */

vi.mock('@/state', () => ({
  getConfig: () => ({ showPinned: {} }),
  getActiveBoardCache: () => undefined,
}));

import { renderLeadership } from '@/ui/board';
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
