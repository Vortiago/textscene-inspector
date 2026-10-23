/**
 * The fog chunks draw Godot's fog ahead of the tone curve, the cube background fogs the sky, and
 * every fog program reads one shared set of fog uniforms. The tests read the installed three, so a
 * release that rewrites a replaced line fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installFogComposite } from './fogComposite';
import { GODOT_FOG_PARS_CHUNK } from './fogChunks';
import { fogUniforms } from './fogUniforms';
import { GODOT_SKY_VIEW_RAY } from '../sky/skyProjection';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const threeChunks = { ...THREE.ShaderChunk };
const backgroundCube = THREE.ShaderLib.backgroundCube!;
const backgroundPlane = THREE.ShaderLib.background!;

restoreShaderGlobalsAfterEach();

describe('installFogComposite', () => {
  it('draws the fog ahead of the tone curve, in place of three’s', () => {
    installFogComposite();

    const toneCurve = THREE.ShaderChunk.tonemapping_fragment;
    expect(THREE.ShaderChunk.fog_fragment).toBe('');
    expect(toneCurve.indexOf('godotFogAt( vGodotFogView )')).toBeLessThan(
      toneCurve.indexOf('toneMapping( gl_FragColor.rgb )')
    );
  });

  it('hands the view-space position from the vertex to the fragment', () => {
    installFogComposite();

    expect(THREE.ShaderChunk.fog_pars_vertex).toContain('varying vec3 vGodotFogView;');
    expect(THREE.ShaderChunk.fog_vertex).toContain('vGodotFogView = mvPosition.xyz;');
    expect(THREE.ShaderChunk.fog_pars_fragment).toContain('varying vec3 vGodotFogView;');
  });

  it('declares the fog functions with the fog uniforms', () => {
    installFogComposite();

    expect(THREE.ShaderChunk.fog_pars_fragment).toContain(`#include <${GODOT_FOG_PARS_CHUNK}>`);
    const pars = THREE.ShaderChunk[GODOT_FOG_PARS_CHUNK as keyof typeof THREE.ShaderChunk];
    expect(pars).toContain('vec4 depthFogAt( vec3 view )');
    expect(pars).toContain('vec4 volumetricFogAtDepth( float viewDepth )');
  });

  it('fogs the cube background before its tone curve', () => {
    installFogComposite();

    const shader = backgroundCube.fragmentShader;
    expect(shader.startsWith(`#include <${GODOT_FOG_PARS_CHUNK}>`)).toBe(true);
    expect(shader.indexOf('godotSkyFog( gl_FragColor.rgb, vWorldDirection )')).toBeLessThan(
      shader.indexOf('<tonemapping_fragment>')
    );
  });

  it('fogs the flat background, a colour background, before its tone curve', () => {
    installFogComposite();

    const shader = backgroundPlane.fragmentShader;
    expect(shader.startsWith(`#include <${GODOT_FOG_PARS_CHUNK}>`)).toBe(true);
    expect(shader.indexOf('godotSkyFog( gl_FragColor.rgb, vWorldDirection )')).toBeLessThan(
      shader.indexOf('<tonemapping_fragment>')
    );
  });

  it('gives the flat background the view direction of each pixel, as Godot’s sky pass casts it', () => {
    installFogComposite();

    const shader = backgroundPlane.vertexShader;
    expect(shader).toContain('varying vec3 vWorldDirection;');
    expect(shader).toContain(GODOT_SKY_VIEW_RAY);
  });

  it('gives every fog material and the background the same uniform values', () => {
    installFogComposite();

    const fogShaders = [THREE.ShaderLib.standard!, THREE.ShaderLib.basic, backgroundCube, backgroundPlane];
    for (const shader of fogShaders) {
      const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
      expect(uniforms.volumetricFogVolume!.value).toBe(fogUniforms.volume);
      expect(uniforms.fogRadiance!.value).toBe(fogUniforms.radiance);
      expect(uniforms.depthFogShape!.value).toBe(fogUniforms.depthShape);
      expect(uniforms.fogSkyRotation!.value).toBe(fogUniforms.skyRotation);
    }
  });

  it('gives no uniform to a shader without fog (edge case)', () => {
    installFogComposite();

    expect(THREE.ShaderLib.depth.uniforms).not.toHaveProperty('depthFogShape');
  });

  it('changes nothing on a second call (edge case)', () => {
    installFogComposite();
    const chunks = { ...THREE.ShaderChunk };
    installFogComposite();

    expect({ ...THREE.ShaderChunk }).toEqual(chunks);
  });

  it('keeps three’s fog and warns when three lacks its fog depth (error case)', () => {
    THREE.ShaderChunk.fog_vertex = 'vFogDepth = 0.0;';

    const warnings = warningsOf(installFogComposite);

    expect(warnings).toContain(
      "[Shading] three's fog_vertex or fog_fragment lacks a line the fog patch replaces"
    );
    expect(THREE.ShaderChunk.tonemapping_fragment).toBe(threeChunks.tonemapping_fragment);
  });
});
