import { describe, it, expectTypeOf } from 'vitest';
import { normalizeZones, normalizeActiveZones, type ZoneDef } from '@/utils/zones';
import { set } from '@/db';
import { migrateActiveBoard, type ActiveBoard } from '@/state';

describe('typed signatures', () => {
  it('normalizeZones accepts strings and partial objects', () => {
    const result = normalizeZones(['A', { id: 'b', name: 'B' }]);
    expectTypeOf(result).toEqualTypeOf<ZoneDef[]>();
  });

  it('normalizeActiveZones preserves element types', () => {
    const active = { zones: { A: [{ foo: 'bar' }] } };
    normalizeActiveZones(active, [{ id: 'a', name: 'A' }]);
    expectTypeOf(active.zones.A[0]).toEqualTypeOf<{ foo: string }>();
  });

  it('db.set is generic', () => {
    expectTypeOf(set).parameter(1).not.toBeAny();
  });

  it('migrateActiveBoard returns ActiveBoard', () => {
    const board = migrateActiveBoard({});
    expectTypeOf(board).toEqualTypeOf<ActiveBoard>();
  });
});
