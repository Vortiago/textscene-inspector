/**
 * The sky's light rides three's own IBL lines. A three release that rewrites one
 * fails here, not silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotSkyLighting } from './godotSkyLighting';
import { warningsOf } from './testing/logWarnings';
import { functionBody } from './testing/glslSource';
import {
  SKY_CONTRIBUTION_UNIFORM,
  SKY_LAYER_UNIFORMS,
  skyContribution,
  skyLayerMaps,
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

describe('installGodotSkyLighting', () => {
  it("lights a surface with Godot's last layer in place of the PMREM at roughness 1", () => {
    expect(patchedChunks().maps).toContain('iblIrradiance += godotIBLIrradiance( geometryNormal );');
  });

  it('samples the last layer along the world normal, turned and scaled as the PMREM is', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLIrradiance')).toContain(
      `PI * textureCube( ${SKY_LAYER_UNIFORMS.last}, envMapRotation * worldNormal ).rgb * envMapIntensity * ${SKY_CONTRIBUTION_UNIFORM}[ 0 ]`
    );
  });

  it.each(['sharp', 'rough', 'last'] as const)(
    'gives every lit material the one shared %s layers cube',
    (group) => {
      installGodotSkyLighting();
      const uniform = SKY_LAYER_UNIFORMS[group];
      expect(THREE.ShaderLib.physical.uniforms[uniform]!.value).toBe(skyLayerMaps[group]);
      expect(THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[uniform]!.value).toBe(
        skyLayerMaps[group]
      );
    }
  );

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

  it('reflects about the normal, below its own horizon', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).toContain(
      'godotSkyLayer( reflectVec, roughness ) * horizon * horizon'
    );
  });

  it('reads the radiance itself, the PMREM at roughness 0, as layer 0', () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      'vec3 radiance = textureCubeUV( envMap, reflectVec, 0.0 ).rgb;'
    );
  });

  it("reads layers 1 to 3 from the sharp cube's mips, a trilinear read blending two as Godot's", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      `textureLod( ${SKY_LAYER_UNIFORMS.sharp}, reflectVec, clamp( layer - 1.0, 0.0, 2.0 ) )`
    );
  });

  it("reads layers 4 to 6 from the rough cube's mips", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      `textureLod( ${SKY_LAYER_UNIFORMS.rough}, reflectVec, clamp( layer - 4.0, 0.0, 2.0 ) )`
    );
  });

  it('blends each group into the next across the layer between them', () => {
    const body = functionBody(patchedChunks().envmap, 'godotSkyLayer');
    expect(body).toContain('mix( radiance, sharpLayer, clamp( layer, 0.0, 1.0 ) )');
    expect(body).toContain('mix( skyLayer, roughLayer, clamp( layer - 3.0, 0.0, 1.0 ) )');
    expect(body).toContain('mix( skyLayer, lastLayer, clamp( layer - 6.0, 0.0, 1.0 ) )');
  });

  it('reads the last layer for a roughness of 1', () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      `textureCube( ${SKY_LAYER_UNIFORMS.last}, reflectVec )`
    );
  });

  it('bends the reflection towards the normal by the roughness squared and dims it below the horizon', () => {
    const body = functionBody(patchedChunks().envmap, 'godotReflection');
    expect(body).toContain('mix( reflect( - viewDir, normal ), normal, pow2( roughness ) )');
    expect(body).toContain('horizon = min( 1.0 + dot( reflectVec, surfaceNormal ), 1.0 );');
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
