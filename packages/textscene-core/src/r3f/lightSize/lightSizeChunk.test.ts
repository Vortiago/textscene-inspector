/**
 * The light size rides three's light loops. The tests read the installed three, so a release that
 * rewrites a replaced line fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotLightSize } from './lightSizeChunk';
import { LIGHT_SIZES } from './lightSize';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const threeChunks = { ...THREE.ShaderChunk };

restoreShaderGlobalsAfterEach();

function patchedLoops(): string {
  installGodotLightSize();
  return THREE.ShaderChunk.lights_fragment_begin;
}

describe('installGodotLightSize', () => {
  it('declares one size per shaded light, and the offset the light function reads', () => {
    installGodotLightSize();
    const declarations = THREE.ShaderChunk.lights_pars_begin;
    expect(declarations).toContain(
      `uniform float ${LIGHT_SIZES}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS ];`
    );
    expect(declarations).toContain('float godotSizeOffset = 0.0;');
    expect(declarations).toContain('return max( 1.0 - 1.0 / sqrt( 1.0 + t * t ), 0.0 );');
  });

  it("sets each omni and spot loop's offset from its slot and its distance to the light", () => {
    const loops = patchedLoops();
    expect(loops).toContain(
      `godotSizeOffset = godotSizeOffsetAt( ${LIGHT_SIZES}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + UNROLLED_LOOP_INDEX ], length( pointLight.position - geometryPosition ) );`
    );
    expect(loops).toContain(
      `godotSizeOffset = godotSizeOffsetAt( ${LIGHT_SIZES}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + UNROLLED_LOOP_INDEX ], length( spotLight.position - geometryPosition ) );`
    );
  });

  it('sets the offset before the loop shades the light', () => {
    const pointLoop = patchedLoops().split('pointLight = pointLights[ i ];')[1]!;
    expect(pointLoop.indexOf('godotSizeOffset =')).toBeLessThan(pointLoop.indexOf('RE_Direct('));
  });

  it("sets each directional and sun loop's offset from its slot, as Godot passes `size` as is", () => {
    const loops = patchedLoops();
    expect(loops).toContain(`godotSizeOffset = ${LIGHT_SIZES}[ UNROLLED_LOOP_INDEX ];`);
    expect(loops).toContain(`godotSizeOffset = ${LIGHT_SIZES}[ NUM_DIR_LIGHTS + UNROLLED_LOOP_INDEX ];`);
  });

  it('sets a sun loop’s offset before the loop shades the light (edge case)', () => {
    const sunLoop = patchedLoops().split('sunLight = sunLights[ i ];')[1]!;
    expect(sunLoop.indexOf('godotSizeOffset =')).toBeLessThan(sunLoop.indexOf('RE_Direct('));
  });

  it('leaves both chunks alone when the loops lack a replaced line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';
    expect(warningsOf(installGodotLightSize)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_pars_begin).toBe(threeChunks.lights_pars_begin);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedLoops();
    expect(warningsOf(installGodotLightSize)).toEqual([]);
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(once);
  });
});
