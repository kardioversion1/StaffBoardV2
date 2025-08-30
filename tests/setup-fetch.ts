import { vi } from 'vitest';

vi.stubGlobal(
  'fetch',
  vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
);
