import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  const realFetch = globalThis.fetch;

  const mockResponse = () =>
    Promise.resolve(
      new Response('null', {
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
    try {
      targetHost = new URL(urlString || 'http://localhost:3000', 'http://localhost:3000').host;
    } catch {
      targetHost = '';
    }

    if (targetHost.includes('localhost:3000') || targetHost.includes('127.0.0.1:3000')) {
      return mockResponse();
    }

    return realFetch ? realFetch(input as any, init) : mockResponse();
  });

  vi.stubGlobal('fetch', fetchStub);
  (window as typeof globalThis & { fetch: typeof fetchStub }).fetch = fetchStub;
}
