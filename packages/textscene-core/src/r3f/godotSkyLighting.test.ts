/**
 * The sky's light rides three's own IBL lines. A three release that rewrites one
 * fails here, not silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotSkyLighting } from './godotSkyLighting';
import { warningsOf } from './testing/logWarnings';
import { functionBody } from './testing/glslSource';
import { SKY_UNIFORMS, shownSky, skyLayersSlot } from './sky/skyLayerArray';

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

  it("reads Godot's last layer along the world normal, at its derivative mip, scaled as the PMREM is", () => {
    const body = functionBody(patchedChunks().envmap, 'godotIBLIrradiance');
    expect(body).toContain('vec3 ambientDir = envMapRotation * ( vec4( normal, 0.0 ) * viewMatrix ).xyz;');
    expect(body).toContain(
      `PI * godotSkyRead( ambientDir, 7.0, godotSkyLod( ambientDir ) ) * envMapIntensity * ${SKY_UNIFORMS.shown}[ 0 ].x`
    );
  });

  it('gives every lit material the one shared slot of the layer array', () => {
    installGodotSkyLighting();
    expect(THREE.ShaderLib.physical.uniforms[SKY_UNIFORMS.layers]!.value).toBe(skyLayersSlot);
    expect(THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_UNIFORMS.layers]!.value).toBe(
      skyLayersSlot
    );
  });

  it("gives every lit material the one shared sky's share of the ambient and its layout", () => {
    installGodotSkyLighting();
    expect(THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_UNIFORMS.shown]!.value).toBe(
      shownSky
    );
  });

  it('reflects the whole sky, whatever its share of the ambient', () => {
    expect(functionBody(patchedChunks().envmap, 'godotIBLRadiance')).not.toContain(SKY_UNIFORMS.shown);
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

  it("picks Godot's two layers around sqrt( roughness ) times the last layer's index", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      'float blend = modf( sqrt( roughness ) * 7.0, roughnessLod );'
    );
  });

  it("reads both layers at the mip of the reflection's screen derivatives, and blends them", () => {
    const body = functionBody(patchedChunks().envmap, 'godotSkyLayer');
    expect(body).toContain('float lod = godotSkyLod( reflectVec );');
    expect(body).toContain('vec3 sharper = godotSkyRead( reflectVec, roughnessLod, lod );');
    expect(body).toContain('vec3 rougher = godotSkyRead( reflectVec, roughnessLod + 1.0, lod );');
    expect(body).toContain('return mix( sharper, rougher, blend ) * envMapIntensity;');
  });

  it("reads a layer of the array at the direction's octmap texel", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyRead')).toContain(
      `textureLod( ${SKY_UNIFORMS.layers}, vec3( vec3ToOctWithBorder( direction, ${SKY_UNIFORMS.shown}[ 0 ].y ), layer ), lod ).rgb`
    );
  });

  it("picks the mip from the direction's screen derivatives in texels of the radiance size", () => {
    const body = functionBody(patchedChunks().envmap, 'godotSkyLod');
    expect(body).toContain('float ddx = dot( directionDdx, directionDdx ) / pixelSizeSqr;');
    expect(body).toContain('0.25 * log2( max( ddx, ddy ) + 1e-6 )');
  });

  it("clamps the mip to the array's last, as Godot's texture ends there (edge case)", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLod')).toContain(
      `min( lod, ${SKY_UNIFORMS.shown}[ 0 ].w )`
    );
  });

  it('samples no cube of layers and no PMREM for the reflection', () => {
    const envmap = patchedChunks().envmap;
    expect(functionBody(envmap, 'godotSkyLayer')).not.toContain('envMap,');
    expect(envmap).not.toContain('uniform samplerCube');
  });

  it('bends the reflection towards the normal by the roughness squared and dims it below the horizon', () => {
    const body = functionBody(patchedChunks().envmap, 'godotReflection');
    expect(body).toContain('mix( reflect( - viewDir, normal ), normal, pow2( roughness ) )');
    expect(body).toContain('horizon = min( 1.0 + dot( reflectVec, surfaceNormal ), 1.0 );');
  });

  it("turns the reflection into the world unnormalised, as the derivatives of Godot's own are", () => {
    expect(functionBody(patchedChunks().envmap, 'godotReflection')).toContain(
      'return envMapRotation * ( vec4( reflectVec, 0.0 ) * viewMatrix ).xyz;'
    );
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
