/**
 * The CSGPrimitive3D set must reach every primitive and stop short of the
 * combiner, which is a CSGShape3D but not a primitive.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** The one key csg_shape.cpp:1102 binds on CSGPrimitive3D. */
const KEYS = ['flip_faces'] as const;
const LEAVES = [
  'CSGBox3D',
  'CSGCylinder3D',
  'CSGMesh3D',
  'CSGPolygon3D',
  'CSGSphere3D',
  'CSGTorus3D',
] as const;

describe('CSGPrimitive3D shared validators', () => {
  it('registers exactly what CSGPrimitive3D binds', () => {
    expect(validatorRegistry.getOwnKeys('CSGPrimitive3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('reaches CSGShape3D from here, so a primitive loaded alone sees both tiers', () => {
    expect(validatorRegistry.findValidator('CSGSphere3D', 'use_collision')).not.toBeNull();
  });

  it('flip_faces takes only a bool literal', () => {
    // set_flip_faces:1105-1112 assigns straight through.
    const validator = validatorRegistry.findValidator('CSGTorus3D', 'flip_faces')!;
    expect(validator('flip_faces', 'true', 1)).toBeNull();
    expect(validator('flip_faces', '"banana"', 1)?.severity).toBe('error');
  });

  it('does not reach the combiner', () => {
    expect(validatorRegistry.findValidator('CSGCombiner3D', 'flip_faces')).toBeNull();
  });

  it('leaves the primitives nothing to re-declare', () => {
    for (const nodeType of LEAVES) {
      expect(validatorRegistry.getOwnKeys(nodeType)).not.toContain('flip_faces');
    }
  });
});
