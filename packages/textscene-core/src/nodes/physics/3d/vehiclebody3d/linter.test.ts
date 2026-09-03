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
// physics_material_override to be checked at all. Its RULE is imported for the
// same reason: `rigidBodyLinterRule` matches on descendsFrom, so it is what
// supplies the shared body checks here, and without it they would be missing
// rather than merely renamed.
// The full linter barrel is deliberately NOT imported: it would also register
// the CollisionShape3D rule, whose shapeless-shape error the testkit's canonical
// accept-child would then trip on every case.
import '../../../base/node3d/linterParser';
import '../rigidbody3d/linterParser';
import '../rigidbody3d/linter';
import './linterParser';
import './linter';
import '../shared/linter';

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
        // `ruleName` on these two rejections is load-bearing: the wheel-less
        // scene's needs-wheels warning names engine_force and steering in its
        // own message, so a rejection matched by property alone is satisfied by
        // that advisory whether or not the validator fires.
        {
          prop: 'engine_force',
          valid: [0, 40.0, -25.5],
          invalid: [{ value: 'fast', ruleName: 'strict-parser' }],
        },
        { prop: 'brake', valid: [0, 25.0], invalid: [{ value: 'hard' }] },
        {
          prop: 'steering',
          valid: [0, -0.4, 0.4],
          invalid: [{ value: 'left', ruleName: 'strict-parser' }],
        },
        { prop: 'mass', valid: [40.0, 0.5], invalid: [{ value: '0' }, { value: '-1' }] },
        { prop: 'center_of_mass_mode', valid: [0, 1], invalid: [{ value: '5' }] },
        { prop: 'visible', valid: ['true', 'false'], invalid: [{ value: 'maybe' }] },
      ]
    );
  });

  // The shared body checks below are RigidBody3D's, reaching VehicleBody3D
  // through `rigidBodyLinterRule`'s descendsFrom matcher. They are asserted here
  // because a vehicle is where they most need to still fire; the rule name being
  // `rigidbody3d-*` is the point, not an accident.
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
        { ruleName: 'dangling-resource-reference', severity: 'error' }
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
      expectNoDiagnostic(content, { ruleName: 'dangling-resource-reference' });
    });
  });

  describe('Semantic Validation (Vehicle Structure)', () => {
    it('reports when the body has no VehicleWheel3D children — it cannot drive', () => {
      expectDiagnostic(
        scene(node('VehicleBody3D', {}, { name: 'Vehicle' }), collisionShape3d),
        { ruleName: 'vehiclebody3d-needs-wheels', severity: 'info' }
      );
    });

    it('still reports when every wheel is nested under a container — Godot attaches only direct children', () => {
      // VehicleWheel3D registers itself via cast_to<VehicleBody3D>(get_parent()),
      // so a wheel under an intermediate node is never attached and the vehicle
      // has no working wheels at all.
      expectDiagnostic(
        scene(
          node('VehicleBody3D', {}, { name: 'Vehicle' }),
          node('Node3D', {}, { name: 'Axle', parent: '.' }),
          node('VehicleWheel3D', {}, { name: 'Wheel1', parent: 'Axle' }),
          collisionShape3d
        ),
        { ruleName: 'vehiclebody3d-needs-wheels', severity: 'info' }
      );
    });

    it('accepts a body with a direct wheel child', () => {
      const content = scene(node('VehicleBody3D', {}, { name: 'Vehicle' }), wheel, collisionShape3d);
      expectNoDiagnostic(content, { ruleName: 'vehiclebody3d-needs-wheels' });
    });

    it('warns when the body has no CollisionShape3D or CollisionPolygon3D children', () => {
      expectDiagnostic(scene(node('VehicleBody3D', {}, { name: 'Vehicle' }), wheel), {
        ruleName: 'collisionobject3d-needs-collision-shape',
        severity: 'warning',
      });
    });
  });

  describe('Semantic Validation (Scaled Transform, inherited from RigidBody3D)', () => {
    // rigid_body_3d.cpp:667 is RigidBodyLinterRule's (rigidbody3d-scale-overridden-at-runtime),
    // which reaches VehicleBody3D through the same `descendsFrom` matcher as
    // the rest of the shared body set. No copy here (`vehiclebody3d-scaled-transform`),
    // so a scaled VehicleBody3D is not warned about twice under two rule names.
    it('warns on a scaled transform — the physics engine overrides it at runtime', () => {
      expectDiagnostic(
        scene(
          node(
            'VehicleBody3D',
            { transform: 'Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)' },
            { name: 'Vehicle' }
          ),
          wheel,
          collisionShape3d
        ),
        { ruleName: 'rigidbody3d-scale-overridden-at-runtime', severity: 'warning' }
      );
    });

    it('stays quiet on a rotated but unscaled transform (edge)', () => {
      // A pure rotation keeps every basis column at unit length; comparing the
      // raw matrix entries instead of the column lengths would false-positive here.
      const content = scene(
        node(
          'VehicleBody3D',
          { transform: 'Transform3D(0.866025, 0, -0.5, 0, 1, 0, 0.5, 0, 0.866025, 0, 1, 0)' },
          { name: 'Vehicle' }
        ),
        wheel,
        collisionShape3d
      );
      expectNoDiagnostic(content, { ruleName: 'rigidbody3d-scale-overridden-at-runtime' });
    });

    // rigid_body_3d.cpp:665-667 measures `get_basis().get_scale()` and warns when
    // any axis is further than 0.05 from 1. An infinite basis entry makes that
    // column's length infinite, so Godot warns; a `nan` one makes every
    // comparison false, so it does not.
    it('warns on an infinite basis component, which Godot measures as scaled', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node(
            'VehicleBody3D',
            { transform: 'Transform3D(inf, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
            { name: 'Vehicle' }
          ),
          wheel,
          collisionShape3d
        ),
        { ruleName: 'rigidbody3d-scale-overridden-at-runtime', severity: 'warning' }
      );
      // The measured column lengths, never NaN — the message is the only place
      // the read shows, and `parseFloat` would make it unreachable entirely.
      expect(diagnostic.message).toContain('(Infinity, 1, 1)');
    });

    // A `nan` component poisons the DETERMINANT, not just its own column, and
    // `get_scale` multiplies every axis by that one shared sign
    // (basis.cpp:321-322). `SIGN(nan)` is 0 — both of its comparisons are false
    // (typedefs.h:124-126) — so the clean columns come back as exactly 0, and
    // `abs(0 - 1) > 0.05` (rigid_body_3d.cpp:666) is true for them. Only the nan
    // axis itself stays silent. An unsigned reading makes the whole node look
    // quiet instead.
    it('warns on a nan basis component, since the poisoned determinant zeroes the rest', () => {
      const content = scene(
        node(
          'VehicleBody3D',
          { transform: 'Transform3D(nan, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
          { name: 'Vehicle' }
        ),
        wheel,
        collisionShape3d
      );
      expectDiagnostic(content, {
        ruleName: 'rigidbody3d-scale-overridden-at-runtime',
        severity: 'warning',
      });
    });

    it('stays quiet on an unscaled translated transform', () => {
      const content = scene(
        node(
          'VehicleBody3D',
          { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)' },
          { name: 'Vehicle' }
        ),
        wheel,
        collisionShape3d
      );
      expectNoDiagnostic(content, { ruleName: 'rigidbody3d-scale-overridden-at-runtime' });
    });
  });

  describe('Edge Cases', () => {
    it('leaves a bare VehicleBody3D free of ERRORS (warnings are advisory)', () => {
      const diagnostics = lint(scene(node('VehicleBody3D', {}, { name: 'Vehicle' })));
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
      expect(diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    });

    it('collects the inherited RigidBody3D checks, each reported exactly once', () => {
      // VehicleBody3D IS a RigidBody3D, so the base rule must reach it. The
      // vehicle rule therefore declares only what the base one does not, and
      // this pins that split: no condition may arrive under both prefixes.
      const diagnostics = lint(scene(node('VehicleBody3D', {}, { name: 'Vehicle' })));
      const names = diagnostics.map((d) => d.ruleName);

      expect(names).toContain('collisionobject3d-needs-collision-shape');
      expect(names).toContain('vehiclebody3d-needs-wheels');
      expect(new Set(names).size).toBe(names.length);

      const suffix = (n: string | undefined): string =>
        (n ?? '').replace(/^(valid-)?(rigidbody3d|vehiclebody3d)-?/, '');
      const suffixes = names.map(suffix);
      expect(new Set(suffixes).size).toBe(suffixes.length);
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
