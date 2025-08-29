import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;

beforeAll(async () => {
  server = spawn('php', ['-S', '127.0.0.1:8021', '-t', 'server'], {
    env: { ...process.env, HEYBRE_API_KEY: 'test-key' },
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(() => {
  server.kill();
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
