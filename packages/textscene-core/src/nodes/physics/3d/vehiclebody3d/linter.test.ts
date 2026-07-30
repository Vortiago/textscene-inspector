import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  collisionShape3d,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
// VehicleBody3D inherits RigidBody3D's validators through nodeBaseTypes, so the
// sibling slice's registrations must be live for mass / center_of_mass_mode /
// physics_material_override to be checked at all. Its RULE is imported too, so
// the "no rigidbody3d-* diagnostics on a vehicle" case below is not vacuous.
// The full linter barrel is deliberately NOT imported: it would also register
// the CollisionShape3D rule, whose shapeless-shape error the testkit's canonical
// accept-child would then trip on every case.
import '../../../base/node3d/linterParser';
import '../rigidbody3d/linterParser';
import '../rigidbody3d/linter';
import './linterParser';
import './linter';

/** A VehicleWheel3D child, so the body is a complete vehicle by default. */
const wheel = node('VehicleWheel3D', { wheel_radius: 0.25 }, { name: 'Wheel1', parent: '.' });

describe('VehicleBody3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('accepts a fully-configured vehicle body', () => {
      expectClean(
        scene(
          node(
            'VehicleBody3D',
            {
              transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
              mass: 40.0,
              center_of_mass_mode: 1,
              engine_force: 0.0,
              brake: 0.0,
              steering: 0.0,
              collision_layer: 1,
              collision_mask: 1,
            },
            { name: 'Vehicle' }
          ),
          wheel,
          collisionShape3d
        )
      );
    });

    // VehicleBody3D declares only engine_force/brake/steering of its own; mass,
    // center_of_mass_mode and physics_material_override must reach it through
    // the RigidBody3D link in nodeBaseTypes, and transform/visible through Node3D.
    runPropertyValidation(
      // 'no-error': a wheel-less body always carries the advisory
      // vehiclebody3d-needs-wheels warning, which these format cases are not about.
      { nodeType: 'VehicleBody3D', acceptChild: collisionShape3d, acceptMode: 'no-error' },
      [
        { prop: 'engine_force', valid: [0, 40.0, -25.5], invalid: [{ value: 'fast' }] },
        { prop: 'brake', valid: [0, 25.0], invalid: [{ value: 'hard' }] },
        { prop: 'steering', valid: [0, -0.4, 0.4], invalid: [{ value: 'left' }] },
        { prop: 'mass', valid: [40.0, 0.5], invalid: [{ value: '0' }, { value: '-1' }] },
        { prop: 'center_of_mass_mode', valid: [0, 1], invalid: [{ value: '5' }] },
        { prop: 'visible', valid: ['true', 'false'], invalid: [{ value: 'maybe' }] },
      ]
    );
  });

  describe('Semantic Validation (Resource References)', () => {
    it('errors when physics_material_override points at a missing resource', () => {
      expectDiagnostic(
        scene(
          node(
            'VehicleBody3D',
            { physics_material_override: 'SubResource("PhysicsMaterial_gone")' },
            { name: 'Vehicle' }
          ),
          wheel,
          collisionShape3d
        ),
        { ruleName: 'valid-vehiclebody3d-resources', severity: 'error' }
      );
    });

    it('accepts a physics_material_override that resolves', () => {
      const content = [
        '[gd_scene load_steps=2 format=3]',
        '',
        '[sub_resource type="PhysicsMaterial" id="PhysicsMaterial_ok"]',
        'friction = 0.5',
        '',
        '[node name="Vehicle" type="VehicleBody3D"]',
        'physics_material_override = SubResource("PhysicsMaterial_ok")',
        '',
        '[node name="Wheel1" type="VehicleWheel3D" parent="."]',
        '',
        '[node name="CollisionShape3D" type="CollisionShape3D" parent="."]',
      ].join('\n');
      expectNoDiagnostic(content, { ruleName: 'valid-vehiclebody3d-resources' });
    });
  });

  describe('Semantic Validation (Vehicle Structure)', () => {
    it('warns when the body has no VehicleWheel3D children — it cannot drive', () => {
      expectDiagnostic(
        scene(node('VehicleBody3D', {}, { name: 'Vehicle' }), collisionShape3d),
        { ruleName: 'vehiclebody3d-needs-wheels', severity: 'warning' }
      );
    });

    it('accepts a body whose wheels are nested under a container', () => {
      const content = scene(
        node('VehicleBody3D', {}, { name: 'Vehicle' }),
        node('Node3D', {}, { name: 'Axle', parent: '.' }),
        node('VehicleWheel3D', {}, { name: 'Wheel1', parent: 'Axle' }),
        collisionShape3d
      );
      expectNoDiagnostic(content, { ruleName: 'vehiclebody3d-needs-wheels' });
    });

    it('warns when the body has no CollisionShape3D children', () => {
      expectDiagnostic(scene(node('VehicleBody3D', {}, { name: 'Vehicle' }), wheel), {
        ruleName: 'vehiclebody3d-needs-collision-shape',
        severity: 'warning',
      });
    });
  });

  describe('Semantic Validation (Collision Layers)', () => {
    it('warns on a zero collision_layer', () => {
      expectDiagnostic(
        scene(
          node('VehicleBody3D', { collision_layer: 0 }, { name: 'Vehicle' }),
          wheel,
          collisionShape3d
        ),
        { ruleName: 'vehiclebody3d-zero-collision-layer', severity: 'warning' }
      );
    });

    it('warns on a zero collision_mask', () => {
      expectDiagnostic(
        scene(
          node('VehicleBody3D', { collision_mask: 0 }, { name: 'Vehicle' }),
          wheel,
          collisionShape3d
        ),
        { ruleName: 'vehiclebody3d-zero-collision-mask', severity: 'warning' }
      );
    });
  });

  describe('Edge Cases', () => {
    it('leaves a bare VehicleBody3D free of ERRORS (warnings are advisory)', () => {
      const diagnostics = lint(scene(node('VehicleBody3D', {}, { name: 'Vehicle' })));
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
      expect(diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    });

    it('does not apply RigidBody3D rules to a VehicleBody3D', () => {
      // Both rules exist and both are 3D physics bodies; the vehicle must not
      // collect rigidbody3d-* diagnostics as well as its own.
      const diagnostics = lint(scene(node('VehicleBody3D', {}, { name: 'Vehicle' })));
      expect(diagnostics.filter((d) => d.ruleName?.startsWith('rigidbody3d'))).toHaveLength(0);
    });

    it('tolerates scientific notation in the transform (edge)', () => {
      expectClean(
        scene(
          node(
            'VehicleBody3D',
            { transform: 'Transform3D(1, 0, 0, 0, 1, -1.49012e-08, 0, 0, 1, 0, 1, 0)' },
            { name: 'Vehicle' }
          ),
          wheel,
          collisionShape3d
        )
      );
    });
  });
});
