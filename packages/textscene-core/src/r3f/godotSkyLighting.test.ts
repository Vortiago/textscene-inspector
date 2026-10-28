/**
 * The sky's light rides three's own IBL lines. A three release that rewrites one
 * fails here, not silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotSkyLighting } from './godotSkyLighting';
import { warningsOf } from './testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from './testing/shaderPatches';
import { functionBody } from './testing/glslSource';
import { SKY_RADIANCE_UNIFORMS, shownSky, skyRotation } from './sky/skyRadiance';
import { skyLayersSlot } from './sky/skyRadiance.testkit';

const threeChunks = { ...THREE.ShaderChunk };

restoreShaderGlobalsAfterEach();

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

  it("reads Godot's last layer along the normal in the sky's space, at its derivative mip", () => {
    const body = functionBody(patchedChunks().envmap, 'godotIBLIrradiance');
    expect(body).toContain('vec3 ambientDir = godotSkyRotation * ( vec4( normal, 0.0 ) * viewMatrix ).xyz;');
    expect(body).toContain(
      'PI * godotSkyReadAlong( ambientDir, 7.0, godotSkyLod( ambientDir ) ) * envMapIntensity * GODOT_SKY_CONTRIBUTION'
    );
  });

  it("turns the reflection into the sky's space with the rotation the fogs read", () => {
    installGodotSkyLighting();
    expect(functionBody(THREE.ShaderChunk.envmap_physical_pars_fragment, 'godotReflection')).toContain(
      'return godotSkyRotation * ( vec4( reflectVec, 0.0 ) * viewMatrix ).xyz;'
    );
    expect(
      THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_RADIANCE_UNIFORMS.rotation]!.value
    ).toBe(skyRotation);
  });

  it('gives every lit material the one shared slot of the layer array', () => {
    installGodotSkyLighting();
    expect(THREE.ShaderLib.physical.uniforms[SKY_RADIANCE_UNIFORMS.layers]!.value).toBe(skyLayersSlot);
    expect(
      THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_RADIANCE_UNIFORMS.layers]!.value
    ).toBe(skyLayersSlot);
  });

  it("gives every lit material the one shared sky's share of the ambient and its layout", () => {
    installGodotSkyLighting();
    expect(
      THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)[SKY_RADIANCE_UNIFORMS.shown]!.value
    ).toBe(shownSky);
  });

  it('reflects the whole sky, whatever its share of the ambient', () => {
    const envmap = patchedChunks().envmap;
    expect(functionBody(envmap, 'godotIBLRadiance')).not.toContain('GODOT_SKY_CONTRIBUTION');
    expect(functionBody(envmap, 'godotSkyLayer')).not.toContain('GODOT_SKY_CONTRIBUTION');
  });

  it('names each field of the shown sky in the order SkyRadiance.show writes them', () => {
    const envmap = patchedChunks().envmap;
    ['CONTRIBUTION', 'BORDER_SIZE', 'DERIVATIVE_SCALE', 'LAST_MIP'].forEach((field, index) =>
      expect(envmap).toContain(
        `#define GODOT_SKY_${field} ${SKY_RADIANCE_UNIFORMS.shown}[ 0 ].${'xyzw'[index]}`
      )
    );
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

  it("blends Godot's two layers around sqrt( roughness ) times the last layer's index", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLayer')).toContain(
      'return godotSkyBlend( reflectVec, sqrt( roughness ) * 7.0 ) * envMapIntensity;'
    );
  });

  it("blends the two layers around a layer position by its fraction, at the direction's mip", () => {
    const body = functionBody(patchedChunks().envmap, 'godotSkyBlend');
    expect(body).toContain('float blend = modf( layerPosition, layer );');
    expect(body).toContain('float lod = godotSkyLod( direction );');
    expect(body).toContain(
      'return mix( godotSkyRead( uv, layer, lod ), godotSkyRead( uv, layer + 1.0, lod ), blend );'
    );
  });

  it("reads both layers at the direction's one octmap texel", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyBlend')).toContain(
      'vec2 uv = vec3ToOctWithBorder( direction, GODOT_SKY_BORDER_SIZE );'
    );
  });

  it('reads a layer of the array at an octmap texel and mip', () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyRead')).toContain(
      `textureLod( ${SKY_RADIANCE_UNIFORMS.layers}, vec3( uv, layer ), lod ).rgb`
    );
  });

  it("picks the mip from the direction's screen derivatives in texels of the radiance size", () => {
    const body = functionBody(patchedChunks().envmap, 'godotSkyLod');
    expect(body).toContain(
      'max( dot( directionDdx, directionDdx ), dot( directionDdy, directionDdy ) ) * GODOT_SKY_DERIVATIVE_SCALE'
    );
    expect(body).toContain('0.25 * log2( texelsSqr + 1e-6 )');
  });

  it("clamps the mip to the array's last, as Godot's texture ends there (edge case)", () => {
    expect(functionBody(patchedChunks().envmap, 'godotSkyLod')).toContain(
      'min( 0.25 * log2( texelsSqr + 1e-6 ), GODOT_SKY_LAST_MIP )'
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

  it("keeps the reflection unnormalised, as the derivatives of Godot's own are", () => {
    expect(functionBody(patchedChunks().envmap, 'godotReflection')).not.toContain('normalize');
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
