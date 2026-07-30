/**
 * One factory, four node types — so the table below is the test.
 *
 * The four casts were written by four agents in one wave and disagreed about
 * whether a dead configuration deserves a diagnostic at all: one shipped two
 * rules, three shipped none. Godot settles it. `ShapeCast2D`/`ShapeCast3D`
 * override `get_configuration_warnings` and name the missing-shape defect
 * themselves (scene/2d/physics/shape_cast_2d.cpp:407, and its 3D twin at :185);
 * neither ray cast overrides it, which is why the rays get the two shared
 * dead-config checks and nothing invented on top.
 */

import { describe, expect, it } from 'vitest';
import {
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  node,
  scene,
} from '../testing/testkit.js';
import { makeCastLinterRule } from './castLinterRule.js';
import '../index.js';

/** Every property the shared checks read, at values that trip none of them. */
const LIVE = { collision_mask: 1, collide_with_bodies: true };

const CASTS = [
  { type: 'RayCast2D', prefix: 'raycast2d', shaped: false },
  { type: 'RayCast3D', prefix: 'raycast3d', shaped: false },
  { type: 'ShapeCast2D', prefix: 'shapecast2d', shaped: true },
  { type: 'ShapeCast3D', prefix: 'shapecast3d', shaped: true },
] as const;

/** A resolvable shape sub-resource, so a shape cast can be configured cleanly. */
function shaped(type: string) {
  const dim = type.endsWith('3D') ? '3D' : '2D';
  return {
    block: `[sub_resource type="BoxShape${dim}" id="Box_1"]`,
    props: { shape: 'SubResource("Box_1")' },
  };
}

describe.each(CASTS)('$type semantic rules', ({ type, prefix, shaped: isShaped }) => {
  const extra = isShaped ? shaped(type) : { block: '', props: {} };
  const blocks = (props: Record<string, string | number | boolean>) =>
    scene(...(extra.block ? [extra.block] : []), node(type, { ...LIVE, ...extra.props, ...props }));

  it('accepts a live configuration', () => {
    expectClean(blocks({}));
  });

  it('warns when neither areas nor bodies can be hit', () => {
    expectDiagnostic(blocks({ collide_with_areas: false, collide_with_bodies: false }), {
      ruleName: `${prefix}-no-collide-target`,
      severity: 'warning',
      nodeType: type,
    });
  });

  it('takes the Godot defaults into account rather than requiring the keys', () => {
    // collide_with_bodies defaults to true, so an omitted pair is live.
    expectNoDiagnostic(blocks({}), { ruleName: `${prefix}-no-collide-target` });
  });

  it('warns on a zero collision mask', () => {
    expectDiagnostic(blocks({ collision_mask: 0 }), {
      ruleName: `${prefix}-zero-mask`,
      severity: 'warning',
    });
  });

  it('stays quiet on an absent collision mask, which means the default, not zero', () => {
    const source = scene(
      ...(extra.block ? [extra.block] : []),
      node(type, { ...extra.props, collide_with_bodies: true })
    );
    expectNoDiagnostic(source, { ruleName: `${prefix}-zero-mask` });
  });
});

describe('shape casts only', () => {
  it.each(['ShapeCast2D', 'ShapeCast3D'])('warns when %s has no shape', (type) => {
    expectDiagnostic(scene(node(type, LIVE)), {
      ruleName: `${type.toLowerCase()}-missing-shape`,
      severity: 'warning',
      contains: [`Shape${type.endsWith('3D') ? '3D' : '2D'}`],
    });
  });

  it.each(['RayCast2D', 'RayCast3D'])('does not ask %s for a shape it has no property for', (type) => {
    expectNoDiagnostic(scene(node(type, LIVE)), { ruleName: `${type.toLowerCase()}-missing-shape` });
  });

  it('warns that ShapeCast3D cannot sweep a concave shape', () => {
    expectDiagnostic(
      scene(
        '[sub_resource type="ConcavePolygonShape3D" id="Concave_1"]',
        node('ShapeCast3D', { ...LIVE, shape: 'SubResource("Concave_1")' })
      ),
      { ruleName: 'shapecast3d-concave-shape', severity: 'warning' }
    );
  });

  it('leaves ShapeCast2D alone, whose solver has no such restriction', () => {
    expectNoDiagnostic(
      scene(
        '[sub_resource type="ConcavePolygonShape2D" id="Concave_1"]',
        node('ShapeCast2D', { ...LIVE, shape: 'SubResource("Concave_1")' })
      ),
      { ruleName: 'shapecast2d-concave-shape' }
    );
  });

  it('declares the concave rule on ShapeCast3D alone', () => {
    const emitted = (dim: '2D' | '3D', kind: 'Ray' | 'Shape') =>
      makeCastLinterRule(dim, kind).meta.emits?.map((e) => e.ruleName) ?? [];
    expect(emitted('3D', 'Shape')).toContain('shapecast3d-concave-shape');
    expect(emitted('2D', 'Shape')).not.toContain('shapecast2d-concave-shape');
    expect(emitted('3D', 'Ray')).toEqual(['raycast3d-no-collide-target', 'raycast3d-zero-mask']);
  });
});
