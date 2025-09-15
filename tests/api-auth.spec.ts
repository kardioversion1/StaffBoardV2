import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;
let logs = '';

beforeAll(async () => {
  server = spawn('php', ['-S', '127.0.0.1:8020', '-t', 'server'], {
    env: { ...process.env, HEYBRE_API_KEY: 'test-key' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  server.stderr?.on('data', (d) => {
    logs += d.toString();
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(() => {
  server.kill();
});

describe('API auth', () => {
  it('rejects missing key', async () => {
    logs = '';
    const res = await fetch('http://127.0.0.1:8020/api.php?action=ping');
    expect(res.status).toBe(401);
    await new Promise((r) => setTimeout(r, 50));
    expect(logs).toContain('unauthorized');
  });

  it('rejects wrong key', async () => {
    logs = '';
    const res = await fetch('http://127.0.0.1:8020/api.php?action=ping', {
      headers: { 'X-API-Key': 'wrong' },
    });
    expect(res.status).toBe(401);
    await new Promise((r) => setTimeout(r, 50));
    expect(logs).toContain('unauthorized');
  });

  it('accepts correct key', async () => {
    const res = await fetch('http://127.0.0.1:8020/api.php?action=ping', {
      headers: { 'X-API-Key': 'test-key' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

