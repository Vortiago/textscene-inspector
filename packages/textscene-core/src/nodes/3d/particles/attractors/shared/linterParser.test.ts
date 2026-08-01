/**
 * The GPUParticlesAttractor3D set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** Fill from doc/classes/GPUParticlesAttractor3D.xml. Red until you do, deliberately. */
const KEYS: string[] = ['strength', 'attenuation', 'directionality', 'cull_mask'];
const LEAVES = ["GPUParticlesAttractorBox3D","GPUParticlesAttractorSphere3D","GPUParticlesAttractorVectorField3D"] as const;

describe('GPUParticlesAttractor3D shared validators', () => {
  it('registers exactly what GPUParticlesAttractor3D binds', () => {
    // Emptiness check first: an empty KEYS against an empty registerAll would
    // otherwise pass vacuously and ship a tier that validates nothing.
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractor3D')).not.toEqual([]);
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractor3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });
});
