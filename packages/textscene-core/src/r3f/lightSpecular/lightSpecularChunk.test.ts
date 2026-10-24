/**
 * The light specular rides three's light loops. The tests read the installed three, so a release
 * that rewrites a replaced line fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotLightSpecular } from './lightSpecularChunk';
import { LIGHT_SPECULARS } from './lightSpecular';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const threeChunks = { ...THREE.ShaderChunk };

restoreShaderGlobalsAfterEach();

function patchedLoops(): string {
  installGodotLightSpecular();
  return THREE.ShaderChunk.lights_fragment_begin;
}

describe('installGodotLightSpecular', () => {
  it('declares one amount per shaded light, and the amount the light function reads', () => {
    installGodotLightSpecular();
    const declarations = THREE.ShaderChunk.lights_pars_begin;

    expect(declarations).toContain(
      `uniform float ${LIGHT_SPECULARS}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS ];`
    );
    expect(declarations).toContain('float godotSpecularAmount = 1.0;');
  });

  it("sets each loop's amount from its kind's slots, past the kinds before it", () => {
    const loops = patchedLoops();

    expect(loops).toContain(`godotSpecularAmount = ${LIGHT_SPECULARS}[ UNROLLED_LOOP_INDEX ];`);
    expect(loops).toContain(
      `godotSpecularAmount = ${LIGHT_SPECULARS}[ NUM_DIR_LIGHTS + UNROLLED_LOOP_INDEX ];`
    );
    expect(loops).toContain(
      `godotSpecularAmount = ${LIGHT_SPECULARS}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + UNROLLED_LOOP_INDEX ];`
    );
    expect(loops).toContain(
      `godotSpecularAmount = ${LIGHT_SPECULARS}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + UNROLLED_LOOP_INDEX ];`
    );
  });

  it('sets the amount before the loop shades the light', () => {
    const pointLoop = patchedLoops().split('pointLight = pointLights[ i ];')[1]!;

    expect(pointLoop.indexOf('godotSpecularAmount =')).toBeLessThan(pointLoop.indexOf('RE_Direct('));
  });

  it('leaves both chunks alone when the loops lack a replaced line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';

    expect(warningsOf(installGodotLightSpecular)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_pars_begin).toBe(threeChunks.lights_pars_begin);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedLoops();

    expect(warningsOf(installGodotLightSpecular)).toEqual([]);
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(once);
  });
});
