/**
 * The fold of an ancestor chain into the CanvasItem state of an item drawn away from its tree
 * parent. The y-sort lift starts its chain under the sort root, whose material a deferring chain
 * takes. The Control walker starts under a Control, or under a broken chain that defers to nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  INHERIT_PARENT_MATERIAL,
  NO_PARENT_MATERIAL,
  foldCanvasAncestors,
  type CanvasAncestorMaterial,
  type CanvasAncestors,
} from './canvasAncestors';
import { parseNode2D } from '../nodes/base/node2d/parser';
import { parseControl } from '../nodes/2d/ui/control/parser';
import type { SceneScope, TscnNode } from '../parser/types';

const SCOPE: SceneScope = {
  internalResources: [
    { id: 'add', type: 'CanvasItemMaterial', data: { blend_mode: '1' } },
    { id: 'mul', type: 'CanvasItemMaterial', data: { blend_mode: '3' } },
  ],
  externalResources: [],
};

function node2d(name: string, raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Node2D', name } };
  return { rawProperties: {}, name, type: 'Node2D', children: [], properties: parseNode2D(heading, raw) };
}

function control(name: string, raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Control', name } };
  return { rawProperties: {}, name, type: 'Control', children: [], properties: parseControl(heading, raw) };
}

function fold(chain: readonly TscnNode[], start: CanvasAncestorMaterial): CanvasAncestors {
  return foldCanvasAncestors(chain, SCOPE, start);
}

const LIFT = INHERIT_PARENT_MATERIAL;
const WALKER_AFTER_BREAK = NO_PARENT_MATERIAL;

describe('foldCanvasAncestors', () => {
  it.each([
    ['the y-sort lift', LIFT],
    ['the Control walker', WALKER_AFTER_BREAK],
  ])('composes the transforms outermost first, for %s', (_, start) => {
    const chain = [
      node2d('Outer', { position: 'Vector2(100, 0)', rotation: String(Math.PI / 2) }),
      node2d('Inner', { position: 'Vector2(10, 0)' }),
    ];
    const { transform } = fold(chain, start);
    // Inner's origin (10, 0) turns a quarter to (0, 10), then moves by (100, 0).
    expect(transform.tx).toBeCloseTo(100, 5);
    expect(transform.ty).toBeCloseTo(10, 5);
    expect(transform.c).toBeCloseTo(-1, 5);
  });

  it.each([
    ['the y-sort lift', LIFT],
    ['the Control walker', WALKER_AFTER_BREAK],
  ])('multiplies each modulate and never a self_modulate, for %s', (_, start) => {
    const chain = [
      node2d('Outer', { modulate: 'Color(0.5, 1, 1, 1)', self_modulate: 'Color(0, 0, 0, 0)' }),
      node2d('Inner', { modulate: 'Color(1, 0.5, 1, 0.5)' }),
    ];
    expect(fold(chain, start).modulate).toEqual({ r: 0.5, g: 0.5, b: 1, a: 0.5 });
  });

  it('lists each z step outermost first, so an absolute step can restart the sum', () => {
    const chain = [
      node2d('Outer', { z_index: '3' }),
      node2d('Inner', { z_index: '-2', z_as_relative: 'false' }),
    ];
    expect(fold(chain, LIFT).z).toEqual([
      { zIndex: 3, zAsRelative: true },
      { zIndex: -2, zAsRelative: false },
    ]);
  });

  it('lets the innermost ancestor that names a filter or repeat win', () => {
    const chain = [
      node2d('Outer', { texture_filter: '1', texture_repeat: '3' }),
      node2d('Inner', { texture_filter: '2' }),
    ];
    expect(fold(chain, LIFT).sampler).toEqual({ filter: 2, repeat: 3 });
  });

  it("reads a Control link's z and sampler, which its parse holds in camelCase", () => {
    const chain = [
      control('Link', { z_index: '2', z_as_relative: 'false', texture_filter: '1', texture_repeat: '2' }),
    ];
    const folded = fold(chain, LIFT);
    expect(folded.z).toEqual([{ zIndex: 2, zAsRelative: false }]);
    expect(folded.sampler).toEqual({ filter: 1, repeat: 2 });
  });

  it('takes the material above a Control link with `use_parent_material`', () => {
    const chain = [
      node2d('Outer', { material: 'SubResource("add")' }),
      control('Link', { use_parent_material: 'true' }),
    ];
    expect(fold(chain, LIFT).material).toEqual(own('add'));
  });

  it.each<[string, Record<string, string>[], CanvasAncestorMaterial, CanvasAncestorMaterial]>([
    [
      'the innermost own material',
      [{ material: 'SubResource("mul")' }, { material: 'SubResource("add")' }],
      LIFT,
      own('add'),
    ],
    [
      'the material above a `use_parent_material` link',
      [{ material: 'SubResource("add")' }, { use_parent_material: 'true' }],
      LIFT,
      own('add'),
    ],
    [
      'no material when the innermost link names none',
      [{ material: 'SubResource("add")' }, {}],
      LIFT,
      NO_PARENT_MATERIAL,
    ],
    ["the sort root's material when every lifted link defers", [{ use_parent_material: 'true' }], LIFT, LIFT],
    [
      'nothing when every link after a broken chain defers',
      [{ use_parent_material: 'true' }],
      WALKER_AFTER_BREAK,
      NO_PARENT_MATERIAL,
    ],
  ])('hands a `use_parent_material` item %s', (_, raws, start, material) => {
    const chain = raws.map((raw, i) => node2d(`N${i}`, raw));
    expect(fold(chain, start).material).toEqual(material);
  });
});

function own(id: string): CanvasAncestorMaterial {
  return { kind: 'own', ref: `SubResource("${id}")`, resources: SCOPE };
}
