import { describe, expect, it } from 'vitest';
import { ATLAS_SAMPLING, OMNI_LOOKUP, SPOT_LOOKUP } from './positionalShadowLookup';
import { SOFT_SHADOW_FILTER } from '../shadowFilter/softShadowFilter';
import { POSITIONAL_SHADOW_ATLAS_UNIFORM } from './shadowAtlasTarget';

describe('the positional shadow lookups', () => {
  it('declare the atlas beside Godot’s soft shadow filter', () => {
    expect(ATLAS_SAMPLING).toContain(`uniform sampler2DShadow ${POSITIONAL_SHADOW_ATLAS_UNIFORM};`);
    expect(ATLAS_SAMPLING).toContain(SOFT_SHADOW_FILTER);
  });

  it('sample the spot shadow through the filter, over soft_shadow_scale atlas texels', () => {
    expect(SPOT_LOOKUP).toContain(
      `godotPcf( ${POSITIONAL_SHADOW_ATLAS_UNIFORM}, softShadowScale * godotAtlasTexel(), coord )`
    );
  });

  it('take every tap of the kernel on the paraboloids', () => {
    expect(OMNI_LOOKUP).toContain('for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ )');
    expect(OMNI_LOOKUP).toContain('rotation * GODOT_SOFT_SHADOW_KERNEL[ i ]');
  });

  it('reach the other paraboloid only for a tap past the unit disc (error case)', () => {
    expect(OMNI_LOOKUP).toContain('bool doFlip = lengthSquared > 1.0;');
  });
});
