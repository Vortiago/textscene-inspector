import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import '../../../base/node3d/linterParser';
import './linterParser';
import './linter';

/** Every wheel in the corpus hangs off a VehicleBody3D; so does every valid one. */
const vehicleBody = node('VehicleBody3D', {}, { name: 'Vehicle' });

describe('VehicleWheel3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('accepts the property set car_base.tscn authors on a front wheel', () => {
      expectClean(
        scene(
          vehicleBody,
          node(
            'VehicleWheel3D',
            {
              transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.573678, 0.115169, 1.10416)',
              use_as_traction: true,
              use_as_steering: true,
              wheel_roll_influence: 0.4,
              wheel_radius: 0.25,
              wheel_friction_slip: 1.0,
              suspension_travel: 0.2,
              suspension_stiffness: 40.0,
              damping_compression: 0.88,
            },
            { name: 'Wheel1', parent: '.' }
          )
        )
      );
    });

    runPropertyValidation(
      { nodeType: 'VehicleWheel3D', prefix: [vehicleBody], nodeOptions: { parent: '.' } },
      [
        // Only the type mismatches are invalid. None of the geometric wheel
        // properties has a range hint, and no setter in vehicle_body_3d.cpp
        // clamps one, so a negative is a value Godot accepts (linterParser.ts
        // cites the binding per property).
        { prop: 'wheel_radius', valid: [0.1, 0.25, 0.5], invalid: [{ value: 'big' }] },
        { prop: 'wheel_rest_length', valid: [0.15, 0.3], invalid: [{ value: 'long' }] },
        { prop: 'wheel_friction_slip', valid: [1.0, 10.5], invalid: [{ value: 'grippy' }] },
        { prop: 'wheel_roll_influence', valid: [0, 0.4, 1], invalid: [{ value: 'some' }] },
        { prop: 'suspension_stiffness', valid: [5.88, 40.0], invalid: [{ value: 'stiff' }] },
        { prop: 'suspension_travel', valid: [0.2, 0.3], invalid: [{ value: 'far' }] },
        { prop: 'suspension_max_force', valid: [6000.0], invalid: [{ value: 'lots' }] },
        { prop: 'damping_compression', valid: [0.83, 0.88], invalid: [{ value: 'soft' }] },
        { prop: 'damping_relaxation', valid: [0.88], invalid: [{ value: 'soft' }] },
        { prop: 'use_as_traction', valid: ['true', 'false'], invalid: [{ value: 'yes' }] },
        { prop: 'use_as_steering', valid: ['true', 'false'], invalid: [{ value: 'yes' }] },
        { prop: 'engine_force', valid: [0, 40.0, -25.0], invalid: [{ value: 'fast' }] },
        { prop: 'brake', valid: [0, 25.0], invalid: [{ value: 'hard' }] },
        { prop: 'steering', valid: [0, -0.4], invalid: [{ value: 'left' }] },
      ]
    );
  });

  describe('Semantic Validation (Parent)', () => {
    it('warns when the wheel is not a child of a VehicleBody3D', () => {
      expectDiagnostic(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('VehicleWheel3D', { wheel_radius: 0.25 }, { name: 'Wheel1', parent: '.' })
        ),
        { ruleName: 'vehiclewheel3d-not-under-vehicle-body', severity: 'warning' }
      );
    });

    it('warns when the wheel is the scene root, with no parent at all', () => {
      expectDiagnostic(scene(node('VehicleWheel3D', {}, { name: 'Wheel1' })), {
        ruleName: 'vehiclewheel3d-not-under-vehicle-body',
        severity: 'warning',
      });
    });

    it('accepts a wheel parented directly to a VehicleBody3D', () => {
      const content = scene(
        vehicleBody,
        node('VehicleWheel3D', {}, { name: 'Wheel1', parent: '.' })
      );
      expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-not-under-vehicle-body' });
    });

    it('warns for a wheel nested under a container inside the body — Godot requires a direct child', () => {
      const content = scene(
        vehicleBody,
        node('Node3D', {}, { name: 'Axle', parent: '.' }),
        node('VehicleWheel3D', {}, { name: 'Wheel1', parent: 'Axle' })
      );
      expectDiagnostic(content, { ruleName: 'vehiclewheel3d-not-under-vehicle-body', severity: 'warning' });
    });
  });

  describe('Semantic Validation (Suspension)', () => {
    it('warns when suspension_travel is outside the documented 0.1–0.3 range', () => {
      expectDiagnostic(
        scene(
          vehicleBody,
          node('VehicleWheel3D', { suspension_travel: 2.0 }, { name: 'Wheel1', parent: '.' })
        ),
        { ruleName: 'vehiclewheel3d-suspension-travel-out-of-range', severity: 'warning' }
      );
    });

    it('accepts suspension_travel at both ends of the documented range', () => {
      for (const travel of [0.1, 0.3]) {
        const content = scene(
          vehicleBody,
          node('VehicleWheel3D', { suspension_travel: travel }, { name: 'Wheel1', parent: '.' })
        );
        expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-suspension-travel-out-of-range' });
      }
    });

    it('warns when damping_relaxation is below damping_compression', () => {
      expectDiagnostic(
        scene(
          vehicleBody,
          node(
            'VehicleWheel3D',
            { damping_compression: 0.5, damping_relaxation: 0.3 },
            { name: 'Wheel1', parent: '.' }
          )
        ),
        {
          ruleName: 'vehiclewheel3d-damping-relaxation-below-compression',
          severity: 'warning',
        }
      );
    });

    it('stays quiet when only damping_compression is authored at or below the relaxation default (edge)', () => {
      // Every corpus wheel sets damping_compression = 0.88 and leaves
      // damping_relaxation at its 0.88 default, so the substituted pair is
      // equal and the recommendation still holds.
      const content = scene(
        vehicleBody,
        node('VehicleWheel3D', { damping_compression: 0.88 }, { name: 'Wheel1', parent: '.' })
      );
      expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-damping-relaxation-below-compression' });
    });

    it('warns when only damping_compression is authored, above the relaxation default', () => {
      // The unauthored side is Godot's 0.88; a compression of 0.95 puts the
      // wheel the wrong way round just as surely as authoring both would.
      expectDiagnostic(
        scene(
          vehicleBody,
          node('VehicleWheel3D', { damping_compression: 0.95 }, { name: 'Wheel1', parent: '.' })
        ),
        { ruleName: 'vehiclewheel3d-damping-relaxation-below-compression', severity: 'warning' }
      );
    });

    it('warns when only damping_relaxation is authored, below the compression default', () => {
      // Compression defaults to 0.83; a relaxation of 0.1 rebounds far faster
      // than the spring compresses. Requiring BOTH sides missed this entirely.
      expectDiagnostic(
        scene(
          vehicleBody,
          node('VehicleWheel3D', { damping_relaxation: 0.1 }, { name: 'Wheel1', parent: '.' })
        ),
        { ruleName: 'vehiclewheel3d-damping-relaxation-below-compression', severity: 'warning' }
      );
    });

    it('stays quiet when neither damping side is authored (edge)', () => {
      // Godot's own pair — 0.83 compression, 0.88 relaxation — satisfies the
      // recommendation, so a bare wheel must never carry this warning.
      const content = scene(
        vehicleBody,
        node('VehicleWheel3D', { wheel_radius: 0.25 }, { name: 'Wheel1', parent: '.' })
      );
      expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-damping-relaxation-below-compression' });
    });

    it('stays quiet when relaxation equals compression', () => {
      const content = scene(
        vehicleBody,
        node(
          'VehicleWheel3D',
          { damping_compression: 0.5, damping_relaxation: 0.5 },
          { name: 'Wheel1', parent: '.' }
        )
      );
      expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-damping-relaxation-below-compression' });
    });
  });

  describe('Edge Cases', () => {
    it('leaves every corpus-shaped wheel free of ERRORS', () => {
      // trailer_truck.tscn's TWheel1: no traction, no steering, tiny radius,
      // scientific notation in the basis.
      const diagnostics = lint(
        scene(
          vehicleBody,
          node(
            'VehicleWheel3D',
            {
              transform:
                'Transform3D(1, 0, 0, 0, 1, -1.49012e-08, 0, 0, 1, 0.573678, -0.402732, -1.53277)',
              wheel_roll_influence: 0.4,
              wheel_radius: 0.1,
              wheel_friction_slip: 1.0,
              suspension_stiffness: 28.0,
              damping_compression: 0.88,
            },
            { name: 'TWheel1', parent: '.' }
          )
        )
      );
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('reports several problems at once', () => {
      const diagnostics = lint(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node(
            'VehicleWheel3D',
            { suspension_travel: 5.0, damping_compression: 0.9, damping_relaxation: 0.1 },
            { name: 'Wheel1', parent: '.' }
          )
        )
      );
      const names = diagnostics.map((d) => d.ruleName);
      expect(names).toContain('vehiclewheel3d-not-under-vehicle-body');
      expect(names).toContain('vehiclewheel3d-suspension-travel-out-of-range');
      expect(names).toContain('vehiclewheel3d-damping-relaxation-below-compression');
    });
  });
});
