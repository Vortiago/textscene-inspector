/**
 * The fog chunks blend Godot's way ahead of the tone curve, and every fog program reads one shared
 * set of volume uniforms. The tests read the installed three, so a release that rewrites a
 * replaced line fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  installVolumetricFogComposite,
  VOLUMETRIC_FOG_PARS_CHUNK,
  VOLUMETRIC_FOG_SKY_CHUNK,
  volumetricFogUniforms,
} from './fogComposite';
import { warningsOf } from '../testing/logWarnings';

const threeChunks = {
  fog_pars_fragment: THREE.ShaderChunk.fog_pars_fragment,
  fog_fragment: THREE.ShaderChunk.fog_fragment,
  tonemapping_fragment: THREE.ShaderChunk.tonemapping_fragment,
  backgroundCube_frag: THREE.ShaderChunk.backgroundCube_frag,
};
const backgroundCube = THREE.ShaderLib.backgroundCube!;
const threeBackgroundShader = backgroundCube.fragmentShader;

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
  backgroundCube.fragmentShader = threeBackgroundShader;
});

describe('installVolumetricFogComposite', () => {
  it('moves three’s fog ahead of the tone curve', () => {
    installVolumetricFogComposite();

    const toneCurve = THREE.ShaderChunk.tonemapping_fragment;
    expect(THREE.ShaderChunk.fog_fragment).toBe('');
    expect(toneCurve.indexOf('godotFog( gl_FragColor.rgb, fogFactor )')).toBeLessThan(
      toneCurve.indexOf('toneMapping( gl_FragColor.rgb )')
    );
    expect(toneCurve).toContain('exp( - fogDensity * fogDensity * vFogDepth * vFogDepth )');
    expect(toneCurve).not.toContain('mix( gl_FragColor.rgb, fogColor, fogFactor )');
  });

  it('declares the volume lookup with the fog uniforms', () => {
    installVolumetricFogComposite();

    expect(THREE.ShaderChunk.fog_pars_fragment).toContain(`#include <${VOLUMETRIC_FOG_PARS_CHUNK}>`);
    expect(THREE.ShaderChunk[VOLUMETRIC_FOG_PARS_CHUNK as keyof typeof THREE.ShaderChunk]).toContain(
      'vec4 volumetricFogAtDepth( float viewDepth )'
    );
  });

  it('fogs the cube background before its tone curve', () => {
    installVolumetricFogComposite();

    const shader = backgroundCube.fragmentShader;
    expect(shader.startsWith(`#include <${VOLUMETRIC_FOG_PARS_CHUNK}>`)).toBe(true);
    expect(shader.indexOf(VOLUMETRIC_FOG_SKY_CHUNK)).toBeLessThan(shader.indexOf('<tonemapping_fragment>'));
  });

  it('gives every fog material and the background the same uniform values', () => {
    installVolumetricFogComposite();

    const fogShaders = [THREE.ShaderLib.standard!, THREE.ShaderLib.basic, backgroundCube];
    for (const shader of fogShaders) {
      const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
      expect(uniforms.volumetricFogVolume!.value).toBe(volumetricFogUniforms.volume);
      expect(uniforms.volumetricFogLookup!.value).toBe(volumetricFogUniforms.lookup);
      expect(uniforms.volumetricFogViewport!.value).toBe(volumetricFogUniforms.viewport);
    }
  });

  it('gives no uniform to a shader without fog (edge case)', () => {
    installVolumetricFogComposite();

    expect(THREE.ShaderLib.depth.uniforms).not.toHaveProperty('volumetricFogLookup');
  });

  it('changes nothing on a second call (edge case)', () => {
    installVolumetricFogComposite();
    const chunks = { ...THREE.ShaderChunk };
    installVolumetricFogComposite();

    expect({ ...THREE.ShaderChunk }).toEqual(chunks);
  });

  it('keeps three’s fog and warns when three lacks its fog blend (error case)', () => {
    THREE.ShaderChunk.fog_fragment = 'gl_FragColor.rgb = fogColor;';

    const warnings = warningsOf(installVolumetricFogComposite);

    expect(warnings).toEqual([
      "[Shading] three's fog_fragment has no gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );",
    ]);
    expect(THREE.ShaderChunk.tonemapping_fragment).toBe(threeChunks.tonemapping_fragment);
  });
});
