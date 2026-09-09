/**
 * CollisionPolygon2D linter tests — mirrors
 * CollisionPolygon2D::get_configuration_warnings() (collision_polygon_2d.cpp:232-257):
 * parent must descend from CollisionObject2D, the polygon must carry enough
 * vertices for its build mode, and one-way collision has no effect under an
 * Area2D. Every one of these is a WARNING in Godot's own source (a
 * configuration-warning banner, never a load/run failure).
 */
import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  instanced,
  override,
  packedScene,
} from '../../../../linter/testing/testkit';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

/** A CollisionPolygon2D with a valid 4-point square, otherwise-default properties. */
const validPolygon = 'PackedVector2Array(-10, -10, 10, -10, 10, 10, -10, 10)';

describe('CollisionPolygon2D Linter', () => {
  it('passes a well-formed CollisionPolygon2D under a StaticBody2D', () => {
    expectClean(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node('CollisionPolygon2D', { polygon: validPolygon }, { parent: '.' })
      )
    );
  });

  it('warns when CollisionPolygon2D is at the scene root (no parent)', () => {
    expectDiagnostic(scene(node('CollisionPolygon2D', { polygon: validPolygon })), {
      ruleName: 'collisionpolygon2d-no-parent',
      severity: 'warning',
    });
  });

  it('warns when the parent does not descend from CollisionObject2D', () => {
    expectDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('CollisionPolygon2D', { polygon: validPolygon }, { parent: '.' })
      ),
      { ruleName: 'collisionpolygon2d-invalid-parent', severity: 'warning' }
    );
  });

  it('says nothing about a parent whose type is declared in another scene', () => {
    // `instance=` names a PackedScene, not a class, so `type` here is the
    // ExtResource ref; an override heading (neither `type=` nor `instance=`)
    // takes its class from the instance it sits inside and parses with the
    // index fallback's truthy "0". Neither can be measured against
    // CollisionObject2D, and warning anyway fires on scenes built to be
    // instanced.
    const instancedParent = scene(
      packedScene,
      node('Node2D', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      node('CollisionPolygon2D', { polygon: validPolygon }, { name: 'Poly', parent: 'Body' })
    );
    const overrideParent = scene(
      packedScene,
      node('Node2D', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      override('Inner', 0, { parent: 'Body' }),
      node('CollisionPolygon2D', { polygon: validPolygon }, { name: 'Poly', parent: 'Body/Inner' })
    );
    expectNoDiagnostic(instancedParent, { ruleName: 'collisionpolygon2d-invalid-parent' });
    expectNoDiagnostic(overrideParent, { ruleName: 'collisionpolygon2d-invalid-parent' });
  });

  it('does not warn about the parent when it is an Area2D (also a CollisionObject2D)', () => {
    expectNoDiagnostic(
      scene(
        node('Area2D', {}, { name: 'Root' }),
        node('CollisionPolygon2D', { polygon: validPolygon }, { parent: '.' })
      ),
      { ruleName: 'collisionpolygon2d-invalid-parent' }
    );
  });

  it('warns on an empty polygon (property omitted, matching the PackedVector2Array() default)', () => {
    expectDiagnostic(
      scene(node('StaticBody2D', {}, { name: 'Root' }), node('CollisionPolygon2D', {}, { parent: '.' })),
      { ruleName: 'collisionpolygon2d-empty-polygon', severity: 'warning' }
    );
  });

  it('warns on an explicit empty PackedVector2Array()', () => {
    expectDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node('CollisionPolygon2D', { polygon: 'PackedVector2Array()' }, { parent: '.' })
      ),
      { ruleName: 'collisionpolygon2d-empty-polygon', severity: 'warning' }
    );
  });

  it("warns when fewer than 3 points are given in 'Solids' build mode (the default)", () => {
    expectDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { polygon: 'PackedVector2Array(0, 0, 10, 10)' },
          { parent: '.' }
        )
      ),
      {
        ruleName: 'collisionpolygon2d-insufficient-points',
        severity: 'warning',
        contains: ["'Solids'"],
      }
    );
  });

  // The bare and typed spellings load into the same packed slot, one vertex per
  // element, so the count and the warning are the constructor form's.
  it.each([
    ['bare', '[Vector2(0, 0), Vector2(10, 10)]'],
    ['typed', 'Array[Vector2]([Vector2(0, 0), Vector2(10, 10)])'],
  ])('warns on a %s-array polygon with too few points', (_form, polygon) => {
    expectDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node('CollisionPolygon2D', { polygon }, { parent: '.' })
      ),
      {
        ruleName: 'collisionpolygon2d-insufficient-points',
        severity: 'warning',
        contains: ["'Solids'"],
      }
    );
  });

  it("does not warn with exactly 2 points in 'Segments' build mode", () => {
    expectClean(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { build_mode: 1, polygon: 'PackedVector2Array(0, 0, 10, 10)' },
          { parent: '.' }
        )
      )
    );
  });

  it("warns with fewer than 2 points in 'Segments' build mode", () => {
    expectDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { build_mode: 1, polygon: 'PackedVector2Array(0, 0)' },
          { parent: '.' }
        )
      ),
      {
        ruleName: 'collisionpolygon2d-insufficient-points',
        severity: 'warning',
        contains: ["'Segments'"],
      }
    );
  });

  it('says nothing when build_mode is non-finite, which names no mode at all', () => {
    // Both arms compare against BUILD_SOLIDS, and `NaN !== 0` is true, so a
    // non-finite fell into the Segments arm and named a mode the file never
    // states — with the wrong threshold beside it.
    expectNoDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { build_mode: 'nan', polygon: 'PackedVector2Array(0, 0)' },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon2d-insufficient-points' }
    );
  });

  it('does not double-report an empty polygon as also having too few points', () => {
    const diagnostics = lint(
      scene(node('StaticBody2D', {}, { name: 'Root' }), node('CollisionPolygon2D', {}, { parent: '.' }))
    );
    const own = diagnostics.filter((d) => d.nodeType === 'CollisionPolygon2D');
    expect(own).toHaveLength(1);
    expect(own[0]?.ruleName).toBe('collisionpolygon2d-empty-polygon');
  });

  it('warns when one_way_collision is set under an Area2D parent', () => {
    expectDiagnostic(
      scene(
        node('Area2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { polygon: validPolygon, one_way_collision: true },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon2d-one-way-ignored', severity: 'warning', contains: ['Area2D'] }
    );
  });

  it('does not warn about one-way collision under a non-Area2D parent', () => {
    expectNoDiagnostic(
      scene(
        node('StaticBody2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { polygon: validPolygon, one_way_collision: true },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon2d-one-way-ignored' }
    );
  });

  it('does not warn about one-way collision under an Area2D when one_way_collision is false', () => {
    expectNoDiagnostic(
      scene(
        node('Area2D', {}, { name: 'Root' }),
        node(
          'CollisionPolygon2D',
          { polygon: validPolygon, one_way_collision: false },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon2d-one-way-ignored' }
    );
  });

  it('matches the committed unit fixture: zero diagnostics', () => {
    // Independent of expectFixtureClean in linterParser.test.ts: that only runs
    // the strict parser's validators, never RuleRegistry rules. This runs the
    // real Linter (validators + rules together) against the same file.
    expect(lint(readFixture('unit-collision-polygon-2d.tscn'))).toHaveLength(0);
  });
});
