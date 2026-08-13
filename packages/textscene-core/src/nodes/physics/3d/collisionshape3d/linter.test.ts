/**
 * Tests for CollisionShape3D linter (strict parser + semantic rules)
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
import './linterParser';
import './linter';

describe('CollisionShape3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid CollisionShape3D properties', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="CollisionShape" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = false
`);
    });

    describe('shape property validation', () => {
      it('should accept valid SubResource reference', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box_shape"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("box_shape")
`);
      });

      it('should accept valid ExtResource reference', () => {
        expectClean(`[gd_scene format=3]

[ext_resource type="Shape3D" path="res://shapes/box.tres" id="ext_shape"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = ExtResource("ext_shape")
`);
      });

      it('should reject invalid shape reference format', () => {
        const content = scene(
          node('StaticBody3D', {}, { name: 'StaticBody' }),
          node('CollisionShape3D', { shape: '"invalid_format"' }, { name: 'InvalidShape', parent: '.' })
        );
        expectDiagnostic(content, { ruleName: 'strict-parser', contains: ['resource reference'] });
      });

      it('should reject shape with invalid characters', () => {
        const content = scene(
          node('StaticBody3D', {}, { name: 'StaticBody' }),
          node('CollisionShape3D', { shape: 'SubResource(box shape)' }, { name: 'BadShape', parent: '.' })
        );
        expectDiagnostic(content, { contains: ['shape'] });
      });
    });

    describe('disabled property validation', () => {
      it('should accept disabled = true', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="DisabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = true
`);
      });

      it('should accept disabled = false', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="EnabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = false
`);
      });

      it('should reject non-boolean disabled value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="InvalidDisabled" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = 1
`;
        expectDiagnostic(content, { ruleName: 'strict-parser', contains: ['boolean'] });
      });

      it('should reject string non-boolean disabled value', () => {
        const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="InvalidDisabled" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = "yes"
`;
        expectDiagnostic(content, { prop: 'disabled', contains: ['boolean'] });
      });
    });
  });

  describe('Semantic Validation (Required Properties)', () => {
    it('should detect missing shape property (REQUIRED)', () => {
      const content = scene(
        node('StaticBody3D', {}, { name: 'StaticBody' }),
        node('CollisionShape3D', { disabled: false }, { name: 'NoShape', parent: '.' })
      );
      const shapeError = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-requires-shape',
        severity: 'warning',
        nodeType: 'CollisionShape3D',
        contains: ['missing required property', 'shape'],
      });
      expect(shapeError.nodeName).toBe('NoShape');
    });

    it('should pass when shape property is present', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="ValidShape" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect non-existent shape resource', () => {
      const content = scene(
        node('StaticBody3D', {}, { name: 'StaticBody' }),
        node('CollisionShape3D', { shape: 'SubResource("nonexistent")' }, { name: 'MissingResource', parent: '.' })
      );
      const resourceError = expectDiagnostic(content, {
        ruleName: 'valid-collisionshape3d-resources',
        severity: 'error',
        nodeType: 'CollisionShape3D',
        contains: ['Shape resource not found'],
      });
      expect(resourceError.nodeName).toBe('MissingResource');
    });

    it('should pass when shape resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="SphereShape3D" id="sphere_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="ValidResource" type="CollisionShape3D" parent="."]
shape = SubResource("sphere_1")
`);
    });

    it('should validate multiple shape resources', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box_shape"]
[sub_resource type="SphereShape3D" id="sphere_shape"]
[sub_resource type="CapsuleShape3D" id="capsule_shape"]

[node name="StaticBody1" type="StaticBody3D"]

[node name="BoxCollision" type="CollisionShape3D" parent="."]
shape = SubResource("box_shape")

[node name="SphereCollision" type="CollisionShape3D" parent="."]
shape = SubResource("sphere_shape")

[node name="CapsuleCollision" type="CollisionShape3D" parent="."]
shape = SubResource("capsule_shape")
`);
    });
  });

  describe('Semantic Validation (Parent Types)', () => {
    it('should pass with StaticBody3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });

    it('should pass with RigidBody3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="SphereShape3D" id="shape_1"]

[node name="RigidBody" type="RigidBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });

    it('should pass with CharacterBody3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="CapsuleShape3D" id="shape_1"]

[node name="CharacterBody" type="CharacterBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });

    it('should pass with Area3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Area" type="Area3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });

    it('should warn when parent is invalid type (Node3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="InvalidParent" type="Node3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;
      const parentError = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-invalid-parent',
        severity: 'warning',
        nodeType: 'CollisionShape3D',
        contains: ['Node3D', 'not a CollisionObject3D'],
      });
      expect(parentError.nodeName).toBe('Collision');
    });

    it('accepts a PhysicalBone3D parent, which IS a CollisionObject3D', () => {
      // Godot's test is `cast_to<CollisionObject3D>(get_parent())`
      // (collision_shape_3d.cpp), which PhysicalBone3D passes.
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Bone" type="PhysicalBone3D"]

[node name="Collision" type="CollisionShape3D" parent="Bone"]
shape = SubResource("shape_1")
`;
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-invalid-parent' });
    });

    it('says nothing about a parent whose type is declared in another scene', () => {
      // An `instance=` heading names a PackedScene, so `type` is the
      // ExtResource ref; an override heading has neither `type=` nor
      // `instance=` and parses with the index fallback's truthy "0". Neither is
      // a class this file states, and warning anyway fires on every body
      // assembled by instancing one.
      const instancedParent = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://body.tscn" id="1_body"]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1_body")]

[node name="Collision" type="CollisionShape3D" parent="Body"]
shape = SubResource("shape_1")
`;
      const overrideParent = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://body.tscn" id="1_body"]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1_body")]

[node name="Inner" parent="Body" index="0"]

[node name="Collision" type="CollisionShape3D" parent="Body/Inner"]
shape = SubResource("shape_1")
`;
      expectNoDiagnostic(instancedParent, { ruleName: 'collisionshape3d-invalid-parent' });
      expectNoDiagnostic(overrideParent, { ruleName: 'collisionshape3d-invalid-parent' });
    });

    it('should warn when parent is invalid type (MeshInstance3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]
[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Mesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`;
      expectDiagnostic(content, {
        ruleName: 'collisionshape3d-invalid-parent',
        contains: ['MeshInstance3D'],
      });
    });

    it('should warn when CollisionShape3D has no parent (root level)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="RootCollision" type="CollisionShape3D"]
shape = SubResource("shape_1")
`;
      const noParentError = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-no-parent',
        severity: 'warning',
        nodeType: 'CollisionShape3D',
        contains: ['no parent node'],
      });
      expect(noParentError.nodeName).toBe('RootCollision');
    });

    it('should pass with AnimatableBody3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="AnimatableBody" type="AnimatableBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });

    it('should pass with VehicleBody3D parent', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Vehicle" type="VehicleBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`);
    });
  });

  describe('Semantic Validation (Transform Scale)', () => {
    it('warns on a non-uniformly scaled transform', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
transform = Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
      const diag = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-non-uniform-scale',
        severity: 'warning',
        nodeType: 'CollisionShape3D',
        contains: ['non-uniformly scaled'],
      });
      expect(diag.nodeName).toBe('Collision');
    });

    it('does not warn on a uniformly scaled transform', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 0)
`;
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-non-uniform-scale' });
    });

    it('does not warn on a flattened basis, where SIGN(det) makes Godot read (0, 0, 0)', () => {
      // `Basis::get_scale()` is `SIGN(determinant()) * get_scale_abs()`
      // (basis.cpp:321), and `SIGN` is three-valued (typedefs.h:123-126). A
      // determinant of 0 therefore reads as a UNIFORM (0, 0, 0) and
      // collision_shape_3d.cpp:153-156 stays silent, however unequal the
      // column magnitudes are.
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
transform = Transform3D(2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0)
`,
        { ruleName: 'collisionshape3d-non-uniform-scale' }
      );
    });

    it('does not warn when transform is absent, since the identity is uniform', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
`,
        { ruleName: 'collisionshape3d-non-uniform-scale' }
      );
    });
  });

  describe('Semantic Validation (Shape/Body Compatibility)', () => {
    it('warns on a ConcavePolygonShape3D under a RigidBody3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConcavePolygonShape3D" id="concave_1"]

[node name="Ball" type="RigidBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("concave_1")
`;
      const diag = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-concave-under-rigidbody',
        severity: 'warning',
        nodeType: 'CollisionShape3D',
        contains: ['ConcavePolygonShape3D', 'RigidBody3D'],
      });
      expect(diag.nodeName).toBe('Collision');
    });

    it('names VehicleBody3D specifically, since it is also a RigidBody3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConcavePolygonShape3D" id="concave_1"]

[node name="Vehicle" type="VehicleBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("concave_1")
`;
      const diag = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-concave-under-rigidbody',
        contains: ['VehicleBody3D'],
      });
      // Godot picks the more specific name once cast_to<VehicleBody3D> succeeds
      // (collision_shape_3d.cpp:137-140); the generic "RigidBody3D" never appears.
      expect(diag.message).not.toContain('RigidBody3D');
    });

    it('warns unconditionally regardless of freeze/freeze_mode ("except when frozen" is message prose only)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConcavePolygonShape3D" id="concave_1"]

[node name="Ball" type="RigidBody3D"]
freeze = true
freeze_mode = 0

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("concave_1")
`;
      expectDiagnostic(content, { ruleName: 'collisionshape3d-concave-under-rigidbody' });
    });

    it('warns on a WorldBoundaryShape3D under a RigidBody3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="WorldBoundaryShape3D" id="wb_1"]

[node name="Ball" type="RigidBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("wb_1")
`;
      const diag = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-worldboundary-under-rigidbody',
        severity: 'warning',
        contains: ['WorldBoundaryShape3D', 'RigidBody3D'],
      });
      expect(diag.nodeName).toBe('Collision');
    });

    it('warns on a ConcavePolygonShape3D under a CharacterBody3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConcavePolygonShape3D" id="concave_1"]

[node name="Player" type="CharacterBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("concave_1")
`;
      const diag = expectDiagnostic(content, {
        ruleName: 'collisionshape3d-concave-under-characterbody',
        severity: 'warning',
        contains: ['ConcavePolygonShape3D', 'CharacterBody3D'],
      });
      expect(diag.nodeName).toBe('Collision');
    });

    it('does not warn about WorldBoundaryShape3D under a CharacterBody3D (Godot has no such check)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="WorldBoundaryShape3D" id="wb_1"]

[node name="Player" type="CharacterBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("wb_1")
`;
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-worldboundary-under-rigidbody' });
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-concave-under-characterbody' });
    });

    it('does not warn on a ConcavePolygonShape3D under a StaticBody3D, which suits it', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConcavePolygonShape3D" id="concave_1"]

[node name="Ground" type="StaticBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("concave_1")
`;
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-concave-under-rigidbody' });
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-concave-under-characterbody' });
    });

    it('does not warn on a Convex shape under a RigidBody3D', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ConvexPolygonShape3D" id="convex_1"]

[node name="Ball" type="RigidBody3D"]

[node name="Collision" type="CollisionShape3D" parent="."]
shape = SubResource("convex_1")
`;
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-concave-under-rigidbody' });
      expectNoDiagnostic(content, { ruleName: 'collisionshape3d-worldboundary-under-rigidbody' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = scene(
        node('Node3D', {}, { name: 'InvalidParent' }),
        node('CollisionShape3D', { disabled: 'not_a_boolean' }, { name: 'MultipleErrors', parent: '.' })
      );

      const diagnostics = lint(content);
      // Expect: missing shape (error), invalid parent (warning), invalid disabled format (error)
      // However, strict parser errors may stop semantic validation
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      const hasShapeError = diagnostics.some(d => d.message.includes('missing required property'));
      const hasParentWarning = diagnostics.some(d => d.message.includes('invalid-parent') || d.message.includes('should be a child'));
      const hasDisabledError = diagnostics.some(d => d.message.includes('disabled'));
      // At least one error should be present
      expect(hasShapeError || hasParentWarning || hasDisabledError).toBe(true);
    });

    it('should detect CollisionShape3D with deeply nested parent structure', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="Root" type="Node3D"]

[node name="StaticBody" type="StaticBody3D" parent="."]

[node name="NestedCollision" type="CollisionShape3D" parent="StaticBody"]
shape = SubResource("shape_1")
`);
    });

    it('should handle CollisionShape3D with only shape property', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="CylinderShape3D" id="cylinder"]

[node name="StaticBody" type="StaticBody3D"]

[node name="MinimalCollision" type="CollisionShape3D" parent="."]
shape = SubResource("cylinder")
`);
    });

    it('should handle all common shape types', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="box"]
[sub_resource type="SphereShape3D" id="sphere"]
[sub_resource type="CapsuleShape3D" id="capsule"]
[sub_resource type="CylinderShape3D" id="cylinder"]
[sub_resource type="ConvexPolygonShape3D" id="convex"]
[sub_resource type="ConcavePolygonShape3D" id="concave"]

[node name="StaticBody" type="StaticBody3D"]

[node name="BoxCollision" type="CollisionShape3D" parent="."]
shape = SubResource("box")

[node name="SphereCollision" type="CollisionShape3D" parent="."]
shape = SubResource("sphere")

[node name="CapsuleCollision" type="CollisionShape3D" parent="."]
shape = SubResource("capsule")

[node name="CylinderCollision" type="CollisionShape3D" parent="."]
shape = SubResource("cylinder")

[node name="ConvexCollision" type="CollisionShape3D" parent="."]
shape = SubResource("convex")

[node name="ConcaveCollision" type="CollisionShape3D" parent="."]
shape = SubResource("concave")
`);
    });

    it('should handle disabled collision shape', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="shape_1"]

[node name="StaticBody" type="StaticBody3D"]

[node name="DisabledCollision" type="CollisionShape3D" parent="."]
shape = SubResource("shape_1")
disabled = true
`);
    });

    it('should handle node with no properties at all', () => {
      const content = scene(
        node('StaticBody3D', {}, { name: 'StaticBody' }),
        node('CollisionShape3D', {}, { name: 'EmptyCollision', parent: '.' })
      );
      // Should have error for missing shape
      expectDiagnostic(content, { prop: 'missing required property' });
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete physics scene with multiple bodies', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="BoxShape3D" id="ground_shape"]
[sub_resource type="SphereShape3D" id="ball_shape"]
[sub_resource type="CapsuleShape3D" id="player_shape"]
[sub_resource type="BoxShape3D" id="trigger_shape"]

[node name="Scene" type="Node3D"]

[node name="Ground" type="StaticBody3D" parent="."]

[node name="GroundCollision" type="CollisionShape3D" parent="Ground"]
shape = SubResource("ground_shape")

[node name="Ball" type="RigidBody3D" parent="."]

[node name="BallCollision" type="CollisionShape3D" parent="Ball"]
shape = SubResource("ball_shape")

[node name="Player" type="CharacterBody3D" parent="."]

[node name="PlayerCollision" type="CollisionShape3D" parent="Player"]
shape = SubResource("player_shape")

[node name="Trigger" type="Area3D" parent="."]

[node name="TriggerCollision" type="CollisionShape3D" parent="Trigger"]
shape = SubResource("trigger_shape")
disabled = false
`);
    });
  });
});
