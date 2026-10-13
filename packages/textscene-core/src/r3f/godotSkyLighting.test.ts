/**
 * The sky's light rides three's own IBL lines. A three release that rewrites one
 * fails here, not silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotSkyLighting } from './godotSkyLighting';
import { warningsOf } from './testing/logWarnings';
import {
  SKY_CONTRIBUTION_UNIFORM,
  SKY_LAST_LAYER_UNIFORM,
  SKY_ROUGH_LAYERS_UNIFORM,
  skyContribution,
  skyLastLayerMap,
  skyRoughLayersMap,
} from './sky/skyLayersMap';

const CHUNKS = ['lights_fragment_maps', 'envmap_physical_pars_fragment'] as const;
const threeChunks = Object.fromEntries(CHUNKS.map((name) => [name, THREE.ShaderChunk[name]]));

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

function patchedChunks() {
  installGodotSkyLighting();
  return {
    maps: THREE.ShaderChunk.lights_fragment_maps,
    envmap: THREE.ShaderChunk.envmap_physical_pars_fragment,
  };
}

/** The body of the GLSL function `name` in `chunk`. */
function functionBody(chunk: string, name: string): string {
  return chunk.split(`vec3 ${name}(`)[1]!.split('\n\t}')[0]!;
}

describe('installGodotSkyLighting', () => {
  it("lights a surface with Godot's last layer in place of the PMREM at roughness 1", () => {
    expect(patchedChunks().maps).toContain('iblIrradiance += godotIBLIrradiance( geometryNormal );');
  });

  it('samples the last layer along the world normal, turned and scaled as the PMREM is', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLIrradiance')).toContain(
      `PI * textureCube( ${SKY_LAST_LAYER_UNIFORM}, envMapRotation * worldNormal ).rgb * envMapIntensity * ${SKY_CONTRIBUTION_UNIFORM}.x`
    );
  });

  it('gives every lit material the one shared rough layers cube', () => {
    installGodotSkyLighting();
    expect(THREE.ShaderLib.physical.uniforms[SKY_ROUGH_LAYERS_UNIFORM]!.value).toBe(skyRoughLayersMap);
    expect(
      THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_ROUGH_LAYERS_UNIFORM]!.value
    ).toBe(skyRoughLayersMap);
  });

  it('gives every lit material the one shared last layer cube', () => {
    installGodotSkyLighting();
    expect(THREE.ShaderLib.physical.uniforms[SKY_LAST_LAYER_UNIFORM]!.value).toBe(skyLastLayerMap);
    expect(THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_LAST_LAYER_UNIFORM]!.value).toBe(
      skyLastLayerMap
    );
  });

  it("gives every lit material the one shared sky's share of the ambient", () => {
    installGodotSkyLighting();
    expect(
      THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_CONTRIBUTION_UNIFORM]!.value
    ).toBe(skyContribution);
  });

  it('reflects the whole sky, whatever its share of the ambient', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).not.toContain(SKY_CONTRIBUTION_UNIFORM);
  });

  it("reflects the sky with Godot's radiance lookup on Godot's roughness", () => {
    expect(patchedChunks().maps).toContain(
      'vec3 iblRadiance = godotIBLRadiance( geometryViewDir, geometryNormal, material.godotRoughness );'
    );
  });

  it("reads the PMREM at the power of the roughness whose blur matches Godot's layer, up to layer 3", () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).toContain(
      'textureCubeUV( envMap, reflectVec, pow( min( roughness, 0.18367346938775508 ), 0.8 ) )'
    );
  });

  it("reads layers 4 to 6 from the rough cube's mips, a trilinear read blending two as Godot's", () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).toContain(
      `textureLod( ${SKY_ROUGH_LAYERS_UNIFORM}, reflectVec, clamp( layer - 4.0, 0.0, 2.0 ) )`
    );
  });

  it('blends the PMREM into the baked layers between layer 3 and layer 4', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).toContain(
      'float bakedShare = clamp( layer - 3.0, 0.0, 1.0 );'
    );
  });

  it('blends layer 6 into the last layer between layer 6 and layer 7', () => {
    const body = functionBody(patchedChunks().envmap, 'godotIBLRadiance');
    expect(body).toContain(`textureCube( ${SKY_LAST_LAYER_UNIFORM}, reflectVec )`);
    expect(body).toContain('mix( roughLayer, lastLayer, clamp( layer - 6.0, 0.0, 1.0 ) )');
  });

  it('bends the reflection towards the normal by the roughness squared and dims it below the horizon', () => {
    const body = functionBody(patchedChunks().envmap, 'godotIBLRadiance');
    expect(body).toContain('mix( reflect( - viewDir, normal ), normal, pow2( roughness ) )');
    expect(body).toContain('* horizon * horizon');
  });

  it("reflects an anisotropic surface's bent normal through the same lookup", () => {
    expect(functionBody(patchedChunks().envmap, 'getIBLAnisotropyRadiance')).toContain(
      'return godotIBLRadiance( viewDir, bentNormal, roughness );'
    );
  });

  it("leaves the clearcoat on three's lookup, as Godot picks its layer another way (edge case)", () => {
    expect(patchedChunks().maps).toContain(
      'getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness )'
    );
  });

  it('leaves every chunk alone when one lacks its line, and warns (error case)', () => {
    THREE.ShaderChunk.lights_fragment_maps = 'void main() {}';

    expect(warningsOf(installGodotSkyLighting)).toHaveLength(1);

    expect(THREE.ShaderChunk.envmap_physical_pars_fragment).toBe(threeChunks.envmap_physical_pars_fragment);
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const once = patchedChunks();
    const warnings = warningsOf(installGodotSkyLighting);

    expect(warnings).toEqual([]);
    expect(patchedChunks()).toEqual(once);
  });
});
