import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  const realFetch = globalThis.fetch;

  const mockResponse = () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

  const fetchStub = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const urlString =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : '';

    let targetHost = '';
    let action: string | null = null;
    let mode: string | null = null;

    try {
      const parsed = new URL(
        urlString || 'http://localhost:3000',
        'http://localhost:3000'
      );
      targetHost = parsed.host;
      action = parsed.searchParams.get('action');
      mode = parsed.searchParams.get('mode');
    } catch {
      targetHost = '';
    }

    const isLocal =
      targetHost.includes('localhost:3000') ||
      targetHost.includes('127.0.0.1:3000');

    if (isLocal) {
      // For historyKv get calls, tests expect a literal `null` JSON body
      if (action === 'historyKv' && mode === 'get') {
        return Promise.resolve(
          new Response('null', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      // For everything else to localhost:3000, just pretend it succeeded
      return mockResponse();
    }

    return realFetch ? realFetch(input as any, init) : mockResponse();
  });

  vi.stubGlobal('fetch', fetchStub);
  (window as typeof globalThis & { fetch: typeof fetchStub }).fetch = fetchStub;
}
