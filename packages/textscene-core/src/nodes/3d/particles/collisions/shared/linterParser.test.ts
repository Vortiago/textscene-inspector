/**
 * The GPUParticlesCollision3D set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** Fill from doc/classes/GPUParticlesCollision3D.xml. Red until you do, deliberately. */
const KEYS: string[] = ['cull_mask'];
const LEAVES = ["GPUParticlesCollisionBox3D","GPUParticlesCollisionHeightField3D","GPUParticlesCollisionSDF3D"] as const;

describe('GPUParticlesCollision3D shared validators', () => {
  it('registers exactly what GPUParticlesCollision3D binds', () => {
    // Emptiness check first: an empty KEYS against an empty registerAll would
    // otherwise pass vacuously and ship a tier that validates nothing.
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollision3D')).not.toEqual([]);
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollision3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });
});
