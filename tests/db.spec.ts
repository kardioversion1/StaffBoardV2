import { describe, it, expect, afterEach } from 'vitest';
import { get, set } from '@/db';

type IndexedDBLike = {
  open: (name: string, version: number) => any;
};

function createFakeIndexedDB(): IndexedDBLike {
  const data = new Map<string, string>();
  return {
    open() {
      const req: any = {};
      setTimeout(() => {
        req.result = {
          createObjectStore() {},
          transaction() {
            return {
              objectStore() {
                return {
                  get(key: string) {
                    const r: any = {};
                    setTimeout(() => {
                      r.result = data.get(key);
                      r.onsuccess?.();
                    }, 0);
                    return r;
                  },
                  put(val: string, key: string) {
                    const r: any = {};
                    setTimeout(() => {
                      data.set(key, val);
                      r.onsuccess?.();
                    }, 0);
                    return r;
                  },
                };
              },
            };
          },
        };
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

const originalIndexedDB = globalThis.indexedDB;

afterEach(() => {
  if (originalIndexedDB === undefined) {
    delete (globalThis as any).indexedDB;
  } else {
    globalThis.indexedDB = originalIndexedDB;
  }
});

describe('db module', () => {
  it('writes and reads values', async () => {
    globalThis.indexedDB = createFakeIndexedDB() as any;
    await set('foo', { bar: 1 });
    const val = await get<{ bar: number }>('foo');
    expect(val).toEqual({ bar: 1 });
  });

  it('propagates open errors', async () => {
    const error = new Error('open failed');
    globalThis.indexedDB = { open: () => { throw error; } } as any;
    await expect(get('x')).rejects.toBe(error);
  });
});
