import { describe, expect, it } from 'vitest';
import { headingOrder } from './headingOrder.js';

function misplacedIn(...types: string[]) {
  const order = headingOrder();
  types.forEach((type, index) => order.read(type, index + 1));
  return order.misplaced();
}

describe('headingOrder', () => {
  it('answers the type of the heading before each heading', () => {
    const order = headingOrder();

    expect(['gd_scene', 'node', 'editable'].map((type, index) => order.read(type, index + 1))).toEqual([
      null,
      'gd_scene',
      'node',
    ]);
  });

  it.each([
    [['gd_scene', 'ext_resource', 'sub_resource', 'node', 'node', 'connection', 'editable']],
    [['gd_resource', 'ext_resource', 'sub_resource', 'resource']],
  ])('takes each heading in its place: %j', (types) => {
    expect(misplacedIn(...types)).toBeNull();
  });

  it.each([
    [['gd_scene', 'sub_resource', 'ext_resource', 'node'], 'ext_resource', 3, 'unknown tag'],
    [['gd_scene', 'node', 'ext_resource'], 'ext_resource', 3, 'unknown tag'],
    [['gd_scene', 'node', 'connection', 'sub_resource'], 'sub_resource', 4, 'unknown tag'],
    [['gd_scene', 'connection', 'node'], 'connection', 2, 'unknown tag'],
    [['gd_scene', 'resource', 'node'], 'resource', 2, 'resource in scene'],
    [['gd_resource', 'node'], 'node', 2, 'node in resource'],
    [['gd_resource', 'resource', 'sub_resource'], 'sub_resource', 3, 'extra tag'],
  ])('refuses the first misplaced heading of %j', (types, type, line, reason) => {
    expect(misplacedIn(...types)).toEqual({ type, line, reason });
  });

  it('keeps the first refusal, as the loader stops there', () => {
    expect(misplacedIn('gd_scene', 'node', 'sub_resource', 'ext_resource')).toMatchObject({ line: 3 });
  });

  it('judges no heading of a file with no header line', () => {
    expect(misplacedIn('node', 'sub_resource')).toBeNull();
  });
});
