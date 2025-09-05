import { describe, it, expect } from 'vitest';
import {
  mergeBoards,
  CURRENT_SCHEMA_VERSION,
  type ActiveBoard,
} from '@/state';

const base = (): ActiveBoard => ({
  dateISO: '2024-01-01',
  shift: 'day',
  zones: {},
  incoming: [],
  offgoing: [],
  comments: '',
  huddle: '',
  handoff: '',
  version: CURRENT_SCHEMA_VERSION,
});

describe('mergeBoards', () => {
  it('preserves remote comments when local empty', () => {
    const remote = { ...base(), comments: 'server' };
    const local = base();
    const merged = mergeBoards(remote, local);
    expect(merged.comments).toBe('server');
  });

  it('keeps remote slots and adds local ones', () => {
    const remote = { ...base(), zones: { A: [{ nurseId: 'n1' }] } };
    const local = {
      ...base(),
      zones: { A: [{ nurseId: 'n1' }, { nurseId: 'n2' }] },
    };
    const merged = mergeBoards(remote, local);
    expect(merged.zones.A.map((s) => s.nurseId)).toEqual(['n1', 'n2']);
  });

  it('does not drop remote slots when local zone empty', () => {
    const remote = { ...base(), zones: { A: [{ nurseId: 'n1' }] } };
    const local = { ...base(), zones: { A: [] } };
    const merged = mergeBoards(remote, local);
    expect(merged.zones.A).toHaveLength(1);
    expect(merged.zones.A[0].nurseId).toBe('n1');
  });

  it('merges incoming arrays by nurse and eta', () => {
    const remote = { ...base(), incoming: [{ nurseId: 'n1', eta: '1' }] };
    const local = { ...base(), incoming: [{ nurseId: 'n2', eta: '2' }] };
    const merged = mergeBoards(remote, local);
    expect(merged.incoming).toHaveLength(2);
  });
});
