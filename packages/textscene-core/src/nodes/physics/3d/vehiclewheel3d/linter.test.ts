import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  runPropertyValidation,
  instanced,
  override,
  packedScene,
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

    it('says nothing when the parent is an override of a node inside an instance', () => {
      // An override heading carries neither `type=` nor `instance=`, so its class
      // lives in the instanced scene this linter never opens. Its type is empty,
      // and only `overridesExistingNode` shows what it is.
      const content = scene(
        packedScene,
        node('Node3D', {}, { name: 'Root' }),
        instanced('Car', { parent: '.' }),
        override('Body', 0, { parent: 'Car' }),
        node('VehicleWheel3D', {}, { name: 'Wheel5', parent: 'Car/Body' })
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
    it('says nothing about the magnitude of suspension_travel', () => {
      // vehicle_body_3d.cpp:335 binds it PROPERTY_HINT_NONE and
      // set_suspension_travel (:198) assigns without a clamp, so the engine
      // states no range. The class reference suggests 0.1-0.3, but that is
      // prose advice, and Godot's own truck_town demo ships 2.0 on all eight
      // wheels. A warning here fired on the canonical example of the node.
      for (const travel of [0.05, 0.2, 2.0, 50]) {
        const content = scene(
          vehicleBody,
          node('VehicleWheel3D', { suspension_travel: travel }, { name: 'Wheel1', parent: '.' })
        );
        expectNoDiagnostic(content, { ruleName: 'vehiclewheel3d-suspension-travel-out-of-range' });
      }
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
  });
});
