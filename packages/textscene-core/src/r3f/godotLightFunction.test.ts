/**
 * The Fresnel weight comes off three's diffuse term, a light's diffuse follows the mode a program
 * defines, and a light's specular is Godot's GGX on Godot's roughness. The first test reads the
 * installed three, so a release that rewrites the lines fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_LIGHT_FUNCTION_EDITS,
  threeAnisotropy,
  diffuseModeInjection,
  diffuseModeOf,
  diffuseModeUserData,
  installGodotLightFunction,
} from './godotLightFunction';
import { DiffuseMode } from '../godot/diffuseMode';
import { applyChunkEdits } from './shaderPatch/chunkPatch';
import { warningsOf } from './testing/logWarnings';
import { patchedShader } from './testing/patchedFragment';

const CHUNK = 'lights_physical_pars_fragment';
const SETUP_CHUNK = 'lights_physical_fragment';
const MAPS_CHUNK = 'lights_fragment_maps';
type LightChunk = typeof CHUNK | typeof SETUP_CHUNK | typeof MAPS_CHUNK;

/** The three chunks as `THREE.ShaderChunk` holds them now. */
function installedChunks(): Record<LightChunk, string> {
  return {
    [CHUNK]: THREE.ShaderChunk[CHUNK],
    [SETUP_CHUNK]: THREE.ShaderChunk[SETUP_CHUNK],
    [MAPS_CHUNK]: THREE.ShaderChunk[MAPS_CHUNK],
  };
}

const threeChunks = installedChunks();

const occurrences = (text: string, part: string) => text.split(part).length - 1;

/** three's chunks with every edit applied. */
function godotChunks(): Record<LightChunk, string> {
  return applyChunkEdits(threeChunks, GODOT_LIGHT_FUNCTION_EDITS)!;
}

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

describe('GODOT_LIGHT_FUNCTION_EDITS', () => {
  it('finds each replaced line exactly once in the installed three', () => {
    for (const { chunk, three } of GODOT_LIGHT_FUNCTION_EDITS) {
      expect(occurrences(threeChunks[chunk], three)).toBe(1);
    }
  });

  it('writes each edit into its chunk', () => {
    const patched = godotChunks();

    for (const { chunk, godot } of GODOT_LIGHT_FUNCTION_EDITS) {
      expect(patched[chunk]).toContain(godot);
    }
  });

  it('drops the Fresnel weight from both diffuse lines', () => {
    const patched = godotChunks()[CHUNK];
    expect(patched).not.toContain('* ( 1.0 - F )');
    expect(patched).not.toContain('* ( 1.0 - singleScattering - multiScattering )');
  });

  it("defines Godot's light function before the direct light function calls it", () => {
    const patched = godotChunks()[CHUNK];
    expect(patched.indexOf('float godotDiffuseNL(')).toBeLessThan(
      patched.indexOf('void RE_Direct_Physical(')
    );
  });

  it("draws a light's specular with Godot's GGX", () => {
    // `scene_forward_lights_inc.glsl:239-262`.
    expect(godotChunks()[CHUNK].split('void RE_Direct_Physical(')[1]).toContain(
      'vec3 specularBRDF = godotSpecularBRDF( directLight.direction, geometryViewDir, geometryNormal, material );'
    );
  });

  it('draws no specular at roughness 0, as Godot does (edge case)', () => {
    // `scene_forward_lights_inc.glsl:222`.
    const direct = godotChunks()[CHUNK].split('void RE_Direct_Physical(')[1]!;
    expect(direct).toMatch(
      /if \( material\.godotRoughness <= 0\.0 \) specularBRDF = vec3\( 0\.0 \);\s*reflectedLight\.directSpecular \+=/
    );
  });

  it("stretches the anisotropic lobe by Godot's aspect ratio of its roughness", () => {
    // `scene_forward_lights_inc.glsl:241-245`.
    const setup = godotChunks()[SETUP_CHUNK];
    expect(setup).toContain('float godotAspect = sqrt( 1.0 - godotAnisotropy * 0.9 );');
    expect(setup).toContain('material.alphaT = pow2( material.godotRoughness ) / godotAspect;');
    expect(setup).toContain('material.godotAlphaB = pow2( material.godotRoughness ) * godotAspect;');
  });

  it('turns the frame by the flowmap only above 0.01, as Godot does (edge case)', () => {
    // `scene_forward_clustered.glsl:1456-1461`.
    expect(godotChunks()[SETUP_CHUNK]).toContain(
      'if ( godotAnisotropy <= 0.01 ) anisotropyV = vec2( 1.0, 0.0 );'
    );
  });

  it("bends a negative anisotropy's reflection about the tangent, as Godot does (edge case)", () => {
    // `scene_forward_clustered.glsl:1698`.
    expect(godotChunks()[CHUNK]).toContain(
      '#define GODOT_IBL_ANISOTROPIC_DIRECTION ( GODOT_ANISOTROPY_IS_NEGATIVE ? material.anisotropyT : material.anisotropyB )'
    );
    expect(godotChunks()[MAPS_CHUNK]).not.toContain('material.anisotropyB');
  });

  it('reads the sign off the frame that threeAnisotropy turns (edge case)', () => {
    expect(godotChunks()[CHUNK]).toContain(
      '#define GODOT_ANISOTROPY_IS_NEGATIVE ( anisotropyVector.x < 0.0 )'
    );
    expect(godotChunks()[SETUP_CHUNK]).toContain(
      'float godotAnisotropy = GODOT_ANISOTROPY_IS_NEGATIVE ? - material.anisotropy : material.anisotropy;'
    );
  });
});

describe('installGodotLightFunction', () => {
  it('replaces three’s chunks with the patched ones', () => {
    installGodotLightFunction();

    expect(installedChunks()).toEqual(godotChunks());
  });

  it('leaves a chunk it cannot patch alone, and warns (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);

    expect(installedChunks()).toEqual({ ...threeChunks, [CHUNK]: 'void main() {}' });
  });

  it('leaves every chunk alone when the setup chunk lacks its roughness clamp (error case)', () => {
    THREE.ShaderChunk[SETUP_CHUNK] = 'void main() {}';

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);

    expect(installedChunks()).toEqual({ ...threeChunks, [SETUP_CHUNK]: 'void main() {}' });
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const warnings = warningsOf(() => {
      installGodotLightFunction();
      installGodotLightFunction();
    });

    expect(warnings).toEqual([]);
    expect(installedChunks()).toEqual(godotChunks());
  });
});

describe('threeAnisotropy', () => {
  it('passes a positive anisotropy through, unturned', () => {
    expect(threeAnisotropy(0.5)).toEqual({ anisotropy: 0.5, anisotropyRotation: 0 });
  });

  it('turns a negative anisotropy by π, so anisotropyVector.x carries the sign', () => {
    const { anisotropy, anisotropyRotation } = threeAnisotropy(-0.5);
    expect(anisotropy).toBe(0.5);
    expect(anisotropy * Math.cos(anisotropyRotation)).toBeLessThan(0);
  });

  it('leaves 0 unturned, which three draws isotropic (edge case)', () => {
    expect(threeAnisotropy(0)).toEqual({ anisotropy: 0, anisotropyRotation: 0 });
  });
});

describe('diffuseModeInjection', () => {
  it.each([
    // `scene_forward_lights_inc.glsl:194-202,210-213`.
    [DiffuseMode.DIFFUSE_LAMBERT, 'GODOT_DIFFUSE_LAMBERT'],
    [DiffuseMode.DIFFUSE_LAMBERT_WRAP, 'GODOT_DIFFUSE_LAMBERT_WRAP'],
    [DiffuseMode.DIFFUSE_TOON, 'GODOT_DIFFUSE_TOON'],
  ])('defines the light function branch of mode %i, %s', (mode, define) => {
    const fragment = patchedShader(
      diffuseModeInjection(mode)!.onBeforeCompile,
      THREE.ShaderLib.standard.fragmentShader
    );
    expect(fragment).toMatch(new RegExp(`^#define ${define}\\n`));
  });

  it('patches nothing for Burley, the branch the chunk takes with no define', () => {
    // `material.h:608`: BaseMaterial3D's default.
    expect(diffuseModeInjection(DiffuseMode.DIFFUSE_BURLEY)).toBeUndefined();
  });

  it('writes Burley in the branch the chunk takes with no define', () => {
    const lightFunction = godotChunks()[CHUNK].split('#elif defined( GODOT_DIFFUSE_TOON )')[1]!;
    expect(lightFunction.split('#endif')[0]).toMatch(/#else[\s\S]*fd90Minus1/);
  });

  it('draws a mode past the enum as Lambert, as a shader with no diffuse render mode (edge case)', () => {
    // `material.cpp:828-841` writes no `diffuse_*` render mode for it, and `shader_types.cpp:241`
    // makes Lambert the default.
    expect(diffuseModeInjection(7)).toBe(diffuseModeInjection(DiffuseMode.DIFFUSE_LAMBERT));
  });

  it('gives one injection per mode, so composed programs share it', () => {
    expect(diffuseModeInjection(DiffuseMode.DIFFUSE_TOON)).toBe(
      diffuseModeInjection(DiffuseMode.DIFFUSE_TOON)
    );
  });
});

describe('diffuseModeOf', () => {
  it('reads the mode a material records', () => {
    const material = new THREE.MeshStandardMaterial({
      userData: diffuseModeUserData(DiffuseMode.DIFFUSE_TOON),
    });
    expect(diffuseModeOf(material)).toBe(DiffuseMode.DIFFUSE_TOON);
  });

  it('reads Burley off a material that records none, as a glTF import is (edge case)', () => {
    expect(diffuseModeOf(new THREE.MeshStandardMaterial())).toBe(DiffuseMode.DIFFUSE_BURLEY);
  });
});
