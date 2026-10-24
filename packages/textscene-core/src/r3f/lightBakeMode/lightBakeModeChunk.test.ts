/**
 * The static-light skip rides three's light loops. The tests read the installed three, so a release
 * that rewrites a replaced line fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotLightBakeMode } from './lightBakeModeChunk';
import { AREA_LIGHT_STATICS, LIGHT_STATICS } from './lightBakeMode';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const threeChunks = { ...THREE.ShaderChunk };

restoreShaderGlobalsAfterEach();

function patchedLoops(): string {
  installGodotLightBakeMode();
  return THREE.ShaderChunk.lights_fragment_begin;
}

describe('installGodotLightBakeMode', () => {
  it('declares the flags only in a lightmapped program', () => {
    installGodotLightBakeMode();
    const declarations = THREE.ShaderChunk.lights_pars_begin;

    expect(declarations).toMatch(
      new RegExp(`#ifdef GODOT_LIGHTMAP[\\s\\S]*uniform float ${LIGHT_STATICS}\\[[\\s\\S]*#endif`)
    );
    expect(declarations).toContain(`uniform float ${AREA_LIGHT_STATICS}[ NUM_RECT_AREA_LIGHTS ];`);
  });

  it("darkens a Static light in each kind's loop while the surface's lightmap draws", () => {
    const loops = patchedLoops();

    expect(loops).toContain(
      `if ( godotLightmapActive && ${LIGHT_STATICS}[ NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + UNROLLED_LOOP_INDEX ] > 0.5 ) pointLight.color = vec3( 0.0 );`
    );
    expect(loops).toContain(
      `if ( godotLightmapActive && ${AREA_LIGHT_STATICS}[ UNROLLED_LOOP_INDEX ] > 0.5 ) rectAreaLight.color = vec3( 0.0 );`
    );
  });

  it('darkens the light before the loop shades it', () => {
    const spotLoop = patchedLoops().split('spotLight = spotLights[ i ];')[1]!;

    expect(spotLoop.indexOf('spotLight.color = vec3( 0.0 )')).toBeLessThan(spotLoop.indexOf('RE_Direct('));
  });

  it('leaves both chunks alone when the loops lack a replaced line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_begin = 'void main() {}';

    expect(warningsOf(installGodotLightBakeMode)).toHaveLength(1);
    expect(THREE.ShaderChunk.lights_pars_begin).toBe(threeChunks.lights_pars_begin);
  });
});
