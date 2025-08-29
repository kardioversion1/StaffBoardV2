import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;

beforeAll(async () => {
  server = spawn('php', ['-S', '127.0.0.1:8020', '-t', 'server'], {
    env: { ...process.env, HEYBRE_API_KEY: 'test-key' },
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(() => {
  server.kill();
});

describe('API auth', () => {
  it('rejects missing key', async () => {
    const res = await fetch('http://127.0.0.1:8020/api.php?action=ping');
    expect(res.status).toBe(401);
  });

  it('rejects wrong key', async () => {
    const res = await fetch('http://127.0.0.1:8020/api.php?action=ping', {
      headers: { 'X-API-Key': 'wrong' },
    });
    expect(res.status).toBe(401);
  });
});

