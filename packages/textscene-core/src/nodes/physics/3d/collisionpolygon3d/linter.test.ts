/**
 * CollisionPolygon3D linter: the parent must descend from CollisionObject3D, the polygon should
 * not be empty, and the scale should be uniform. All three mirror collision_polygon_3d.cpp's
 * get_configuration_warnings() (:235-252), so all three warn.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic, expectClean , instanced, override, packedScene} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

const validPolygon = 'PackedVector2Array(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5)';

describe('CollisionPolygon3D Linter', () => {
  it('passes a CollisionPolygon3D under a StaticBody3D with a non-empty polygon', () => {
    expectClean(
      scene(node('StaticBody3D'), node('CollisionPolygon3D', { polygon: validPolygon }, { parent: '.' }))
    );
  });

  it('warns when the parent is not a CollisionObject3D descendant', () => {
    expectDiagnostic(
      scene(
        node('Node3D', {}, { name: 'Root' }),
        node('CollisionPolygon3D', { polygon: validPolygon }, { parent: '.' })
      ),
      { ruleName: 'collisionpolygon3d-invalid-parent', severity: 'warning', contains: ['Node3D', 'CollisionObject3D'] }
    );
  });

  it('warns when CollisionPolygon3D is at the scene root (no parent)', () => {
    expectDiagnostic(scene(node('CollisionPolygon3D', { polygon: validPolygon })), {
      ruleName: 'collisionpolygon3d-no-parent',
      severity: 'warning',
    });
  });

  it('says nothing about a parent whose type is declared in another scene', () => {
    // The 2D twin carries the same case: an `instance=` parent's `type` is the
    // ExtResource ref and an override heading's is the index fallback's "0",
    // and neither can be measured against CollisionObject3D.
    const instancedParent = scene(
      packedScene,
      node('Node3D', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      node('CollisionPolygon3D', { polygon: validPolygon }, { name: 'Poly', parent: 'Body' })
    );
    const overrideParent = scene(
      packedScene,
      node('Node3D', {}, { name: 'Root' }),
      instanced('Body', { parent: '.' }),
      override('Inner', 0, { parent: 'Body' }),
      node('CollisionPolygon3D', { polygon: validPolygon }, { name: 'Poly', parent: 'Body/Inner' })
    );
    expectNoDiagnostic(instancedParent, { ruleName: 'collisionpolygon3d-invalid-parent' });
    expectNoDiagnostic(overrideParent, { ruleName: 'collisionpolygon3d-invalid-parent' });
  });

  it('accepts a parent several levels removed from CollisionObject3D in name only, via the real ancestry (RigidBody3D)', () => {
    expectNoDiagnostic(
      scene(node('RigidBody3D'), node('CollisionPolygon3D', { polygon: validPolygon }, { parent: '.' })),
      { ruleName: 'collisionpolygon3d-invalid-parent' }
    );
  });

  it('warns on an explicit empty polygon', () => {
    expectDiagnostic(
      scene(
        node('StaticBody3D'),
        node('CollisionPolygon3D', { polygon: 'PackedVector2Array()' }, { parent: '.' })
      ),
      { ruleName: 'collisionpolygon3d-empty-polygon', severity: 'warning' }
    );
  });

  it('warns on an absent polygon, since Godot defaults it to empty', () => {
    expectDiagnostic(scene(node('StaticBody3D'), node('CollisionPolygon3D', {}, { parent: '.' })), {
      ruleName: 'collisionpolygon3d-empty-polygon',
      severity: 'warning',
    });
  });

  it('does not warn about emptiness once the polygon has vertices', () => {
    expectNoDiagnostic(
      scene(node('StaticBody3D'), node('CollisionPolygon3D', { polygon: validPolygon }, { parent: '.' })),
      { ruleName: 'collisionpolygon3d-empty-polygon' }
    );
  });

  it('warns on a single stray coordinate, which forms no complete vertex pair (unified with the 2D vertex-pairing count)', () => {
    expectDiagnostic(
      scene(node('StaticBody3D'), node('CollisionPolygon3D', { polygon: 'PackedVector2Array(5)' }, { parent: '.' })),
      { ruleName: 'collisionpolygon3d-empty-polygon', severity: 'warning' }
    );
  });

  it('stays silent on emptiness for a polygon value the format validator itself cannot parse', () => {
    expectNoDiagnostic(
      scene(node('StaticBody3D'), node('CollisionPolygon3D', { polygon: 'NodePath("nonsense")' }, { parent: '.' })),
      { ruleName: 'collisionpolygon3d-empty-polygon' }
    );
  });

  it('warns on a non-uniformly scaled transform', () => {
    const diag = expectDiagnostic(
      scene(
        node('StaticBody3D'),
        node(
          'CollisionPolygon3D',
          { polygon: validPolygon, transform: 'Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon3d-non-uniform-scale', severity: 'warning' }
    );
    expect(diag.message).toContain('non-uniformly scaled');
  });

  it('does not warn on a uniformly scaled transform', () => {
    expectNoDiagnostic(
      scene(
        node('StaticBody3D'),
        node(
          'CollisionPolygon3D',
          { polygon: validPolygon, transform: 'Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 0)' },
          { parent: '.' }
        )
      ),
      { ruleName: 'collisionpolygon3d-non-uniform-scale' }
    );
  });

  it('does not warn on scale when transform is absent, since the identity is uniform', () => {
    expectNoDiagnostic(
      scene(node('StaticBody3D'), node('CollisionPolygon3D', { polygon: validPolygon }, { parent: '.' })),
      { ruleName: 'collisionpolygon3d-non-uniform-scale' }
    );
  });

  it('reports every warning for the fixture-style shape parented directly under Node3D with no polygon', () => {
    const diagnostics = lint(
      scene(node('Node3D', {}, { name: 'Root' }), node('CollisionPolygon3D', {}, { parent: '.' }))
    ).filter((d) => d.nodeType === 'CollisionPolygon3D');
    const ruleNames = diagnostics.map((d) => d.ruleName).sort();
    expect(ruleNames).toEqual(['collisionpolygon3d-empty-polygon', 'collisionpolygon3d-invalid-parent']);
  });
});
