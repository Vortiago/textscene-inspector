/**
 * One factory, four node types, so the table below is the test. `ShapeCast2D`/`ShapeCast3D`
 * name the missing-shape defect themselves (scene/2d/physics/shape_cast_2d.cpp:407, and
 * its 3D twin at :185). A missing rule is asserted against `meta.emits`, since a name no
 * instantiation emits is absent from every linted scene whatever the factory does.
 */

import { describe, expect, it } from 'vitest';
import {
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  node,
  scene,
  type PropValue,
} from '../testing/testkit.js';
import { makeCastLinterRule } from './castLinterRule.js';
import type { PhysicsDim } from './dim.js';
import type { CastKind } from './castLinterRule.js';
import '../index.js';

/** Every property the shared checks read, at values that trip none of them. */
const LIVE = { collision_mask: 1, collide_with_bodies: true };

const CASTS = ['RayCast2D', 'RayCast3D', 'ShapeCast2D', 'ShapeCast3D'] as const;

const dimOf = (type: string): PhysicsDim => (type.endsWith('3D') ? '3D' : '2D');
const kindOf = (type: string): CastKind => (type.startsWith('Shape') ? 'Shape' : 'Ray');
const emittedBy = (type: string) =>
  makeCastLinterRule(dimOf(type), kindOf(type)).meta.emits?.map((e) => e.ruleName) ?? [];

describe.each(CASTS)('%s semantic rules', (type) => {
  const prefix = type.toLowerCase();
  // A shape cast needs a resolvable shape before any other check is reachable.
  const prelude =
    kindOf(type) === 'Shape' ? [`[sub_resource type="BoxShape${dimOf(type)}" id="Box_1"]`] : [];
  // Annotated, not inferred: the ternary would otherwise widen to a union whose
  // empty branch carries `shape?: undefined`, which `PropValue` excludes.
  const shapeProp: Record<string, PropValue> =
    kindOf(type) === 'Shape' ? { shape: 'SubResource("Box_1")' } : {};
  const cast = (props: Record<string, string | number | boolean> = {}) =>
    scene(...prelude, node(type, { ...LIVE, ...shapeProp, ...props }));

  it('accepts a live configuration', () => {
    expectClean(cast());
  });

  it('reports when neither areas nor bodies can be hit', () => {
    expectDiagnostic(cast({ collide_with_areas: false, collide_with_bodies: false }), {
      ruleName: `${prefix}-no-collide-target`,
      severity: 'info',
      nodeType: type,
    });
  });

  it('takes the Godot defaults into account rather than requiring the keys', () => {
    // collide_with_bodies defaults to true, so an omitted pair is live.
    expectNoDiagnostic(cast(), { ruleName: `${prefix}-no-collide-target` });
  });

  it('reads an unstorable flag as its default, in both directions', () => {
    // `can_convert_strict` refuses a VECTOR2 source for a BOOL target, so the
    // write never lands: `collide_with_bodies` is still true and the cast is live.
    expectNoDiagnostic(cast({ collide_with_bodies: 'Vector2(1, 0)' }), {
      ruleName: `${prefix}-no-collide-target`,
    });
    // The same reading the other way: `collide_with_areas` defaults to false,
    // so an unstorable value there leaves the pair dead and the diagnostic stands.
    expectDiagnostic(cast({ collide_with_areas: '"yes"', collide_with_bodies: false }), {
      ruleName: `${prefix}-no-collide-target`,
      severity: 'info',
    });
  });

  it('reports on a zero collision mask', () => {
    expectDiagnostic(cast({ collision_mask: 0 }), {
      ruleName: `${prefix}-zero-mask`,
      severity: 'info',
    });
  });

  it('stays quiet on an absent collision mask, which means the default, not zero', () => {
    const source = scene(...prelude, node(type, { ...shapeProp, collide_with_bodies: true }));
    expectNoDiagnostic(source, { ruleName: `${prefix}-zero-mask` });
  });
});

describe('the shape-only checks', () => {
  it.each(['ShapeCast2D', 'ShapeCast3D'])('warns when %s has no shape', (type) => {
    expectDiagnostic(scene(node(type, LIVE)), {
      ruleName: `${type.toLowerCase()}-missing-shape`,
      severity: 'warning',
      contains: [`Shape${dimOf(type)}`],
    });
  });

  it.each(['ShapeCast2D', 'ShapeCast3D'])('errors when %s names a shape the scene lacks', (type) => {
    expectDiagnostic(scene(node(type, { ...LIVE, shape: 'SubResource("nope")' })), {
      ruleName: 'dangling-resource-reference',
      severity: 'error',
    });
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

  it('cannot report a name its own instantiation does not declare', () => {
    // `emits` and `check` read the same arm table, so the 2D shape cast has no
    // concave arm. A scene, not only `emits`: widening the check half alone would
    // emit this string while every meta-guard stays green, since the 3D sibling
    // declares `*-concave-shape` for the wildcard to match.
    expect(emittedBy('ShapeCast2D')).not.toContain('shapecast2d-concave-shape');
    expectNoDiagnostic(
      scene(
        '[sub_resource type="ConcavePolygonShape3D" id="Concave_1"]',
        node('ShapeCast2D', { ...LIVE, shape: 'SubResource("Concave_1")' })
      ),
      { ruleName: 'shapecast2d-concave-shape' }
    );
  });

  it('declares exactly the rules each instantiation can produce', () => {
    // The negative half of every claim above. `toEqual`, not `toContain`: an
    // extra declared name would publish a rule into the type's generated sheet
    // that its `check` can never emit.
    expect(emittedBy('RayCast2D')).toEqual(['raycast2d-no-collide-target', 'raycast2d-zero-mask']);
    expect(emittedBy('RayCast3D')).toEqual(['raycast3d-no-collide-target', 'raycast3d-zero-mask']);
    expect(emittedBy('ShapeCast2D')).toEqual([
      'shapecast2d-no-collide-target',
      'shapecast2d-zero-mask',
      'shapecast2d-missing-shape',
    ]);
    expect(emittedBy('ShapeCast3D')).toEqual([
      'shapecast3d-no-collide-target',
      'shapecast3d-zero-mask',
      'shapecast3d-missing-shape',
      'shapecast3d-concave-shape',
    ]);
  });
});
