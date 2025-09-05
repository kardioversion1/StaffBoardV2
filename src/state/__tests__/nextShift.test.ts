/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEmptyDraft, loadNextDraft, saveNextDraft, publishNextDraft } from '../nextShift';

vi.mock('@/server', () => ({
  load: vi.fn(),
  save: vi.fn(),
}));

import * as Server from '@/server';

const mockLoad = Server.load as unknown as ReturnType<typeof vi.fn>;
const mockSave = Server.save as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
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

  it('publishes draft to active and clears draft', async () => {
    const draft = buildEmptyDraft('2024-01-01', 'day', []);
    mockLoad.mockResolvedValueOnce(draft);
    await publishNextDraft();
    expect(mockSave).toHaveBeenNthCalledWith(1, 'active', draft, { appendHistory: 'false' });
    expect(mockSave).toHaveBeenNthCalledWith(2, 'next', {});
  });
});
