/**
 * The CSGShape3D set must reach every CSG node, the combiner included: it is
 * the one CSG type that is not a primitive. Asserted through `findValidator` on
 * the leaves, and through a whole-scene lint, because a tier that registers
 * but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from '../../../../linter/Linter.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** Every key csg_shape.cpp:1040-1051 binds on CSGShape3D. */
const KEYS = [
  'operation',
  'calculate_tangents',
  'use_collision',
  'collision_layer',
  'collision_mask',
  'collision_priority',
] as const;

const LEAVES = [
  'CSGBox3D',
  'CSGCombiner3D',
  'CSGCylinder3D',
  'CSGMesh3D',
  'CSGPolygon3D',
  'CSGSphere3D',
  'CSGTorus3D',
] as const;

function check(key: string, value: string) {
  const validator = validatorRegistry.findValidator('CSGBox3D', key);
  expect(validator, `CSGBox3D.${key} resolves no validator`).not.toBeNull();
  return validator!(key, value, 1);
}

const scene = (body: string) => `[gd_scene format=3]

[node name="Box" type="CSGBox3D"]
${body}
`;

describe('CSGShape3D shared validators', () => {
  it('registers exactly what CSGShape3D binds', () => {
    expect(validatorRegistry.getOwnKeys('CSGShape3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('warns, never errors, on an operation outside the enum', () => {
    // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
    // set_operation:933-937 assigns straight through.
    for (const legal of ['0', '1', '2']) expect(check('operation', legal)).toBeNull();
    expect(check('operation', '5')?.severity).toBe('warning');
  });

  it.each(['use_collision', 'calculate_tangents'])('%s takes only a bool literal', (key) => {
    expect(check(key, 'true')).toBeNull();
    expect(check(key, 'false')).toBeNull();
    expect(check(key, '"banana"')?.severity).toBe('error');
  });

  it.each(['collision_layer', 'collision_mask'])('%s is a 32-bit layer mask', (key) => {
    // set_collision_layer:120-125 / set_collision_mask:131-136 store the
    // uint32_t (csg_shape.h:72-73) unguarded, so 0 and all-on are both legal.
    expect(check(key, '0')).toBeNull();
    expect(check(key, '4294967295')).toBeNull();
    expect(check(key, '"banana"')?.severity).toBe('error');
    // Bit 33 does not exist in the slot.
    expect(check(key, '4294967296')?.severity).toBe('error');
  });

  it('collision_priority is an unbounded float', () => {
    // csg_shape.cpp:1051 declares it with no hint; set_collision_priority:188-193
    // is a bare assignment.
    expect(check('collision_priority', '-3.5')).toBeNull();
    expect(check('collision_priority', '"banana"')?.severity).toBe('error');
  });

  it('a whole-scene lint reports the malformed values', () => {
    const diagnostics = new Linter().lint(
      scene('use_collision = "banana"\ncollision_layer = "banana"')
    );
    const errors = diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
    expect(errors.some((m) => m.includes('use_collision'))).toBe(true);
    expect(errors.some((m) => m.includes('collision_layer'))).toBe(true);
  });

  it('leaves the leaves nothing of CSGShape3D to re-declare', () => {
    for (const nodeType of LEAVES) {
      for (const key of KEYS) expect(validatorRegistry.getOwnKeys(nodeType)).not.toContain(key);
    }
  });
});
