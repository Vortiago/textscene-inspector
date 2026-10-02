import { describe, expect, it } from 'vitest';
import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel';
import { ATLAS_SAMPLING, OMNI_LOOKUP, SPOT_LOOKUP } from './positionalShadowLookup';

/** The float literals of the kernel the GLSL declares. */
function kernelLiterals(): number[] {
  const kernel = /GODOT_SOFT_SHADOW_KERNEL\[ \d+ \] = vec2\[\]\((.*)\);/.exec(ATLAS_SAMPLING)![1]!;
  return [...kernel.matchAll(/vec2\( (\S+), (\S+) \)/g)].flatMap((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

describe('the positional shadow lookups', () => {
  it('declare Godot’s Soft Low kernel, each tap the float Godot stores', () => {
    expect(kernelLiterals()).toEqual(vogelDisk(SOFT_LOW_SHADOW_SAMPLES).flat());
  });

  it('take every tap of the kernel, in both lookups', () => {
    for (const lookup of [SPOT_LOOKUP, OMNI_LOOKUP]) {
      expect(lookup).toContain(`for ( int i = 0; i < ${SOFT_LOW_SHADOW_SAMPLES}; i ++ )`);
    }
  });

  it('write every kernel value as a float GLSL accepts (edge case)', () => {
    const kernel = /vec2\[\]\((.*)\);/.exec(ATLAS_SAMPLING)![1]!;
    expect(kernel).not.toMatch(/[(, ]-?\d+ [,)]/);
  });

  it('reach the other paraboloid only for a tap past the unit disc (error case)', () => {
    expect(OMNI_LOOKUP).toContain('bool doFlip = lengthSquared > 1.0;');
  });
});
