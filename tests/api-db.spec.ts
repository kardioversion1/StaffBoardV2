import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

let server: ChildProcess;
const dbPath = resolve('server/test.sqlite');

beforeAll(async () => {
  try { rmSync(dbPath); } catch {}
  server = spawn('php', ['-S', '127.0.0.1:8021', '-t', 'server'], {
    env: { ...process.env, HEYBRE_API_KEY: 'test-key', HEYBRE_DB_PATH: dbPath },
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(() => {
  server.kill();
  try { rmSync(dbPath); } catch {}
});

describe('DB-backed API', () => {
  it('saves and loads config using SQLite', async () => {
    await fetch('http://127.0.0.1:8021/api.php?action=save&key=config', {
      method: 'POST',
      headers: { 'X-API-Key': 'test-key' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    const res = await fetch('http://127.0.0.1:8021/api.php?action=load&key=config', {
      headers: { 'X-API-Key': 'test-key' },
    });
    const json = await res.json();
    expect(json).toEqual({ foo: 'bar' });
  });

  it('stores history entries when saving active', async () => {
    const payload = { dateISO: '2024-01-02', shift: 'day', assignments: [] };
    await fetch('http://127.0.0.1:8021/api.php?action=save&key=active&appendHistory=true', {
      method: 'POST',
      headers: { 'X-API-Key': 'test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res = await fetch('http://127.0.0.1:8021/api.php?action=history&mode=list&date=2024-01-02', {
      headers: { 'X-API-Key': 'test-key' },
    });
    const list = await res.json();
    expect(list.length).toBe(1);
    expect(list[0].dateISO).toBe('2024-01-02');
  });
});
