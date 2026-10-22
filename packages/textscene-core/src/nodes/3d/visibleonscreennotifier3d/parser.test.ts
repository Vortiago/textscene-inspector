import { describe, expect, it } from 'vitest';
import { VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB } from '../../../godot/scene/visibleOnScreen';
import { heading } from '../../../parser/testing/parserKit';
import { parseNode3D } from '../../base/node3d/parser';
import { parseVisibleOnScreenNotifier3D } from './parser';

const parse = (properties: Record<string, string>) =>
  parseVisibleOnScreenNotifier3D(heading('VisibleOnScreenNotifier3D', { name: 'Notifier' }), properties);

describe('parseVisibleOnScreenNotifier3D', () => {
  it('reads aabb as the box', () => {
    expect(parse({ aabb: 'AABB(0, 0, 0, 4, 1, 2)' }).aabb).toEqual({
      position: { x: 0, y: 0, z: 0 },
      size: { x: 4, y: 1, z: 2 },
    });
  });

  it("keeps the constructor's box from -1 to 1 for a notifier that authors none", () => {
    expect(parse({}).aabb).toEqual({
      position: { x: -1, y: -1, z: -1 },
      size: { x: 2, y: 2, z: 2 },
    });
    expect(parse({}).aabb).toBe(VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB);
  });

  it("keeps the constructor's box for a malformed aabb (error case)", () => {
    expect(parse({ aabb: 'AABB(bad)' }).aabb).toBe(VISIBLE_ON_SCREEN_NOTIFIER_3D_DEFAULT_AABB);
  });

  it('keeps an authored AABB() empty: the setter stores it bare (edge case)', () => {
    expect(parse({ aabb: 'AABB(0, 0, 0, 0, 0, 0)' }).aabb.size).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('keeps a negative size as written: the setter stores it bare (edge case)', () => {
    expect(parse({ aabb: 'AABB(0, 0, 0, -2, 1, 1)' }).aabb.size.x).toBe(-2);
  });

  it('keeps the Node3D transform', () => {
    const properties = { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)' };
    expect(parse(properties).transform?.origin).toEqual({ x: 1, y: 2, z: 3 });
    const { aabb: _aabb, ...base } = parse(properties);
    expect(base).toEqual(parseNode3D(heading('VisibleOnScreenNotifier3D', { name: 'Notifier' }), properties));
  });
});
