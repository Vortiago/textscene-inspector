import { describe, expect, it } from 'vitest';
import { AREA_LOOKUP, ATLAS_SAMPLING, OMNI_LOOKUP, SPOT_LOOKUP } from './positionalShadowLookup';
import { POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM, POSITIONAL_SHADOW_ATLAS_UNIFORM } from './shadowAtlasTarget';
import {
  AREA_LIGHT_SHADOW_MATRICES,
  AREA_LIGHT_SHADOW_RECTS,
  AREA_LIGHT_SHADOWS,
  AREA_LIGHT_SOFT_SHADOW_RADII,
} from '../areaLight/areaLightShadowUniforms';
import { LIGHT_SOFT_SHADOWS } from '../shadowFilter/softShadowSearch';
import { withoutBlock } from '../testing/glslSource';

describe('the positional shadow lookups', () => {
  it('declare the atlas, and leave Godot’s soft shadow filter to its own install', () => {
    expect(ATLAS_SAMPLING).toContain(`uniform sampler2DShadow ${POSITIONAL_SHADOW_ATLAS_UNIFORM};`);
    expect(ATLAS_SAMPLING).not.toContain('float godotPcf(');
  });

  it('sample the spot shadow through the filter, over soft_shadow_scale atlas texels', () => {
    expect(SPOT_LOOKUP).toContain(
      `godotPcf( ${POSITIONAL_SHADOW_ATLAS_UNIFORM}, shadow.shadowRadius * godotAtlasTexel(), coord )`
    );
  });

  it('take every tap of the kernel on the paraboloids, for an omni and an area light alike', () => {
    expect(ATLAS_SAMPLING).toContain('for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ )');
    expect(ATLAS_SAMPLING).toContain('rotation * GODOT_SOFT_SHADOW_KERNEL[ i ]');
    expect(OMNI_LOOKUP).toContain('godotOmniPcf(');
    expect(AREA_LOOKUP).toContain('godotOmniPcf(');
  });

  it('reach the other paraboloid only for a tap past the unit disc (error case)', () => {
    expect(ATLAS_SAMPLING).toContain('bool doFlip = lengthSquared > 1.0;');
  });

  it('search for blockers in the raw depth the atlas colour holds, under a linear filter', () => {
    expect(ATLAS_SAMPLING).toContain(`uniform sampler2D ${POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM};`);
    expect(ATLAS_SAMPLING).toContain(`godotRawDepth( ${POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM},`);
    expect(ATLAS_SAMPLING).toContain('if ( blocker < depth ) {');
  });

  it('compile no blocker search without Godot’s light soft shadows, so bind no atlas colour (edge case)', () => {
    const sources = [ATLAS_SAMPLING, SPOT_LOOKUP, OMNI_LOOKUP, AREA_LOOKUP];
    const compiled = sources.map((source) => withoutBlock(source, `#ifdef ${LIGHT_SOFT_SHADOWS}`)).join('\n');
    expect(compiled).not.toContain(POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM);
    expect(compiled).not.toContain('SoftShadow(');
    expect(compiled).toContain('godotPcf(');
    expect(compiled.match(/godotOmniPcf\(/g)).toHaveLength(3);
  });

  it('take the penumbra taps of Soft Low, through the compare', () => {
    expect(ATLAS_SAMPLING).toContain('i < GODOT_PENUMBRA_SHADOW_SAMPLES;');
    expect(ATLAS_SAMPLING).toContain(`texture( ${POSITIONAL_SHADOW_ATLAS_UNIFORM}, vec3(`);
  });
});

describe('the omni shadow lookup', () => {
  it('searches for blockers on both paraboloids for a light with a negative radius', () => {
    expect(OMNI_LOOKUP).toContain('if ( pointShadow.shadowRadius < 0.0 )');
    expect(OMNI_LOOKUP).toContain('godotParaboloidSoftShadow( localVert, normalBias, uvRect, flipOffset,');
  });

  it('filters a light with a radius of zero or more (edge case)', () => {
    expect(OMNI_LOOKUP).toContain('godotOmniPcf( pointShadow.shadowRadius / shadowSample.z,');
  });
});

describe('the spot shadow lookup', () => {
  it('searches for blockers in the slot for a light with a negative radius', () => {
    expect(SPOT_LOOKUP).toContain('if ( shadow.shadowRadius < 0.0 )');
    expect(SPOT_LOOKUP).toContain('if ( blocker < coord.z ) {');
  });

  it('keeps every tap inside the light’s slot (edge case)', () => {
    expect(SPOT_LOOKUP).toContain('clamp( coord.xy + offset, slotRect.xy, slotRect.xy + slotRect.zw )');
  });

  it('reads a light without a range as lit, as it lights nothing (error case)', () => {
    expect(SPOT_LOOKUP).toContain('if ( light.distance <= 0.0 ) return 1.0;');
  });
});

describe('the area shadow lookup', () => {
  it('reads each light’s terms by its index', () => {
    for (const name of [
      AREA_LIGHT_SHADOW_MATRICES,
      AREA_LIGHT_SHADOW_RECTS,
      AREA_LIGHT_SHADOWS,
      AREA_LIGHT_SOFT_SHADOW_RADII,
    ]) {
      expect(AREA_LOOKUP).toContain(`${name}[ NUM_RECT_AREA_LIGHTS ];`);
    }
  });

  it('searches for blockers on its one paraboloid for a light with a negative radius', () => {
    expect(AREA_LOOKUP).toContain('godotParaboloidSoftShadow( localVert, normalBias, uvRect, vec2( 0.0 ),');
  });

  it('reads one paraboloid, which a tap past its disc never leaves (edge case)', () => {
    expect(AREA_LOOKUP).toContain('uvRect, vec2( 0.0 ), depth )');
  });

  it('reads a light without opacity as lit (edge case)', () => {
    expect(AREA_LOOKUP).toContain('if ( terms.x <= 0.001 ) return 1.0;');
  });
});
