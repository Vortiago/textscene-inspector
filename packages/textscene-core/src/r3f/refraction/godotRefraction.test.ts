/**
 * Godot's refraction blur rides three's transmission chunks. The tests read the installed three, so a
 * release that rewrites a replaced line fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotRefraction } from './godotRefraction';
import { installShaderPatches } from '../shaderPatch/installShaderPatches';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';
import { functionBody } from '../testing/glslSource';

restoreShaderGlobalsAfterEach();

describe('installGodotRefraction', () => {
  it("reads the screen at Godot's lod, the roughness times 8, with no bicubic filter", () => {
    installGodotRefraction();
    const sample = functionBody(THREE.ShaderChunk.transmission_pars_fragment, 'vec4 getTransmissionSample');

    expect(sample).toContain('return textureLod( transmissionSamplerMap, fragCoord.xy, roughness * 8.0 );');
    expect(sample).not.toContain('textureBicubic');
  });

  it("blurs by the material's roughness as the fragment writes it, before the decals mix theirs in", () => {
    installGodotRefraction();

    expect(THREE.ShaderChunk.roughnessmap_fragment).toContain(
      'float godotRefractionRoughness = roughnessFactor;'
    );
    expect(THREE.ShaderChunk.transmission_fragment).toContain(
      'n, v, material.roughness, godotRefractionRoughness,'
    );
  });

  it("keeps three's floored roughness for the Fresnel on the refraction", () => {
    installGodotRefraction();
    const refraction = functionBody(
      THREE.ShaderChunk.transmission_pars_fragment,
      'vec4 getIBLVolumeRefraction'
    );

    expect(refraction).toContain('EnvironmentBRDF( n, v, specularColor, specularF90, roughness )');
    expect(refraction).toContain('getTransmissionSample( refractionCoords, godotRefractionRoughness, ior )');
  });

  it('installs with every other patch a canvas draws with', () => {
    installShaderPatches();

    expect(THREE.ShaderChunk.transmission_fragment).toContain('godotRefractionRoughness');
  });
});
