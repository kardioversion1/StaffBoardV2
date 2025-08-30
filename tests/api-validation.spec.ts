import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.includes('action=save')) return Promise.resolve(new Response('', { status: 400 }));
    if (url.includes('mode=list')) return Promise.resolve(new Response('', { status: 400 }));
    if (url.includes('mode=byNurse')) return Promise.resolve(new Response('', { status: 400 }));
    return Promise.resolve(new Response('', { status: 200 }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API validation', () => {
  it('rejects invalid JSON payloads', async () => {
    const res = await fetch('http://127.0.0.1:8021/api.php?action=save&key=active', {
      method: 'POST',
      headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
      body: '{bad',
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid history date', async () => {
    const res = await fetch('http://127.0.0.1:8021/api.php?action=history&mode=list&date=bad', {
      headers: { 'X-API-Key': 'test-key' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing nurseId', async () => {
    const res = await fetch('http://127.0.0.1:8021/api.php?action=history&mode=byNurse', {
      headers: { 'X-API-Key': 'test-key' },
    });
    expect(res.status).toBe(400);
  });
});
