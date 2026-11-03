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

  it("blurs by the material's raw roughness, with no floor and no geometry roughness", () => {
    installGodotRefraction();

    expect(THREE.ShaderChunk.transmission_fragment).toContain('n, v, roughnessFactor,');
    expect(THREE.ShaderChunk.transmission_fragment).not.toContain('material.roughness');
  });

  it('installs with every other patch a canvas draws with', () => {
    installShaderPatches();

    expect(THREE.ShaderChunk.transmission_fragment).toContain('n, v, roughnessFactor,');
  });
});
