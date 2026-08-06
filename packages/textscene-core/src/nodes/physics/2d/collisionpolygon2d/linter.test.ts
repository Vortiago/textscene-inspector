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
