/**
 * Camera3D strict validators — format checks for the three Resource-reference
 * members `_bind_methods` declares alongside the numeric ones already covered.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Camera3D', property);
  expect(validator, `no validator registered for Camera3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Camera3D attributes', () => {
  it('accepts a SubResource reference — camera_3d.cpp:675, ADD_PROPERTY(Variant::OBJECT, "attributes", PROPERTY_HINT_RESOURCE_TYPE, "CameraAttributesPractical,CameraAttributesPhysical")', () => {
    // Real corpus value: scenes/demos/3d/physical_light_camera_units/test.tscn:50.
    expect(check('attributes', 'SubResource("CameraAttributesPhysical_drxnu")')).toBeNull();
  });

  it('accepts an ExtResource reference', () => {
    expect(check('attributes', 'ExtResource("1_attrs")')).toBeNull();
  });

  it('accepts the padded form the parser also reads', () => {
    expect(check('attributes', 'SubResource ( "CameraAttributesPractical_1" )')).toBeNull();
  });

  it('rejects the literal null — Godot omits a cleared Resource slot, never writes null', () => {
    expect(check('attributes', 'null')).not.toBeNull();
  });

  it('rejects a bare resource path string', () => {
    expect(check('attributes', '"res://attrs.tres"')).not.toBeNull();
  });
});

/**
 * `compositor` is declared IDENTICALLY on Camera3D (camera_3d.cpp:676) and
 * WorldEnvironment (world_environment.cpp:221): the same
 * `ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "compositor",
 * PROPERTY_HINT_RESOURCE_TYPE, "Compositor"), "set_compositor",
 * "get_compositor")`, and both setters are bare assignments (camera_3d.cpp:572,
 * world_environment.cpp:159). worldenvironment/linterParser.ts registers the
 * identical `v.resourceReference('compositor')`.
 */
describe('Camera3D compositor', () => {
  it('accepts a SubResource reference', () => {
    expect(check('compositor', 'SubResource("Compositor_1")')).toBeNull();
  });

  it('accepts an ExtResource reference', () => {
    expect(check('compositor', 'ExtResource("1_comp")')).toBeNull();
  });

  it('rejects the literal null', () => {
    expect(check('compositor', 'null')).not.toBeNull();
  });
});

describe('Camera3D environment', () => {
  it('accepts a SubResource reference — camera_3d.cpp:674', () => {
    expect(check('environment', 'SubResource("Environment_1")')).toBeNull();
  });

  it('accepts an ExtResource reference', () => {
    expect(check('environment', 'ExtResource("1_env")')).toBeNull();
  });

  it('rejects the literal null', () => {
    expect(check('environment', 'null')).not.toBeNull();
  });
});

/**
 * Every key Camera3D binds via `ADD_PROPERTY` (camera_3d.cpp:672-686), matching
 * doc/classes/Camera3D.xml's members without an `overrides=` attribute.
 */
const KEYS: string[] = [
  'projection',
  'fov',
  'size',
  'frustum_offset',
  'near',
  'far',
  'keep_aspect',
  'cull_mask',
  'doppler_tracking',
  'current',
  'h_offset',
  'v_offset',
  'attributes',
  'compositor',
  'environment',
];

describe('Camera3D strict validators', () => {
  it('registers exactly what Camera3D binds', () => {
    expect(validatorRegistry.getOwnKeys('Camera3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-camera3d.tscn');
  });

  it('rejects a malformed value on every resource-reference property', () => {
    const resourceKeys = ['attributes', 'compositor', 'environment'];
    const accepted = resourceKeys.filter((property) => check(property, 'not-a-reference') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches a Node3D key (transform) through the base-walk', () => {
    expect(validatorRegistry.findValidator('Camera3D', 'transform')).not.toBeNull();
  });
});
