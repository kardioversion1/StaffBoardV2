/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/state', () => ({
  CURRENT_SCHEMA_VERSION: 2,
  KS: { DRAFT: (d: string, s: string) => `DRAFT:${d}:${s}` },
  DB: { set: vi.fn() },
  applyDraftToActive: vi.fn(),
}));

import { buildEmptyDraft, loadNextDraft, saveNextDraft, publishNextDraft } from '../nextShift';
import * as Server from '@/server';
import * as State from '@/state';

const mockLoad = Server.load as unknown as ReturnType<typeof vi.fn>;
const mockSave = Server.save as unknown as ReturnType<typeof vi.fn>;
const mockSet = State.DB.set as unknown as ReturnType<typeof vi.fn>;
const mockApply = State.applyDraftToActive as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
  mockSet.mockReset();
  mockApply.mockReset();
});

describe('nextShift state', () => {
  it('loads empty draft when file missing', async () => {
    mockLoad.mockResolvedValueOnce({});
    const draft = await loadNextDraft();
    expect(draft).toBeNull();
  });

  it('saves and reloads draft', async () => {
    const draft = buildEmptyDraft('2024-01-01', 'day', []);
    await saveNextDraft(draft);
    expect(mockSave).toHaveBeenCalledWith('next', draft);
    mockLoad.mockResolvedValueOnce(draft);
    const loaded = await loadNextDraft();
    expect(loaded).toEqual(draft);
  });

  it('prevents duplicate nurse assignment across zones', async () => {
    const draft = buildEmptyDraft('2024-01-01', 'day', [
      { id: 'z1', name: 'A', color: '' },
      { id: 'z2', name: 'B', color: '' },
    ]);
    draft.zones['A'].push({ nurseId: 'n1' } as any);
    draft.zones['B'].push({ nurseId: 'n1' } as any);
    mockLoad.mockResolvedValueOnce(draft);
    await expect(publishNextDraft()).rejects.toThrow(/duplicate/);
  });

  it('publishes draft to active, clears draft, and updates history', async () => {
    const draft = buildEmptyDraft('2024-01-01', 'day', []);
    const prev = { dateISO: '2023-12-31', shift: 'night' } as any;
    mockLoad.mockResolvedValueOnce(draft);
    mockLoad.mockResolvedValueOnce(prev);
    await publishNextDraft();
    expect(mockSave).toHaveBeenNthCalledWith(1, 'active', prev, { appendHistory: 'true' });
    expect(mockSave).toHaveBeenNthCalledWith(2, 'active', draft, { appendHistory: 'false' });
    expect(mockSave).toHaveBeenNthCalledWith(3, 'next', {});
    expect(mockSet).toHaveBeenCalledWith(State.KS.DRAFT(draft.dateISO, draft.shift), draft);
    expect(mockApply).toHaveBeenCalledWith(draft.dateISO, draft.shift);
  });
});
