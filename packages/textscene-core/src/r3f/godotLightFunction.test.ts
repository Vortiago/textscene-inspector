/**
 * The Fresnel weight comes off three's diffuse term, a light's diffuse and specular follow the modes
 * a program defines, and the default specular is Godot's GGX on Godot's roughness. The first test reads the
 * installed three, so a release that rewrites the lines fails here, not in a golden.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GODOT_LIGHT_FUNCTION_EDITS, threeAnisotropy, installGodotLightFunction } from './godotLightFunction';
import { applyChunkEdits } from './shaderPatch/chunkPatch';
import { installGodotLightSpecular } from './lightSpecular/lightSpecularChunk';
import { warningsOf } from './testing/logWarnings';
import { preprocessorBranch } from './testing/glslSource';

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
const threeLightChunks = {
  lights_pars_begin: THREE.ShaderChunk.lights_pars_begin,
  lights_fragment_begin: THREE.ShaderChunk.lights_fragment_begin,
};

const occurrences = (text: string, part: string) => text.split(part).length - 1;

/** three's chunks with every edit applied. */
function godotChunks(): Record<LightChunk, string> {
  return applyChunkEdits(threeChunks, GODOT_LIGHT_FUNCTION_EDITS)!;
}

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks, threeLightChunks);
});

describe('GODOT_LIGHT_FUNCTION_EDITS', () => {
  it("scales each specular mode by the light's specular amount", () => {
    const sum = godotChunks()[CHUNK].split('if ( material.godotRoughness <= 0.0 ) {')[1]!;
    expect(sum).toContain('* directLight.color * godotSpecularAmount * material.diffuseContribution;');
    expect(sum).toContain('specularBRDF *= godotSpecularAmount;');
  });

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

  it('drops the Fresnel weight from every diffuse line', () => {
    const patched = godotChunks()[CHUNK];
    expect(patched).not.toContain('* ( 1.0 - F )');
    expect(patched).not.toContain('* ( 1.0 - singleScattering - multiScattering )');
    expect(patched).not.toContain('* ( 1.0 - totalScatteringDielectric )');
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
      /if \( material\.godotRoughness <= 0\.0 \) \{\s*specularBRDF = vec3\( 0\.0 \);[\s\S]*\}\s*specularBRDF \*= godotSpecularAmount;\s*reflectedLight\.directSpecular \+=/
    );
  });

  it("writes a toon specular into the light's diffuse, as Godot does", () => {
    // `scene_forward_lights_inc.glsl:228-234`.
    const toon = preprocessorBranch(godotChunks()[CHUNK], '#if defined( GODOT_SPECULAR_TOON )');
    expect(toon).toContain('specularBRDF = vec3( 0.0 );');
    expect(toon).toContain('reflectedLight.directDiffuse += godotToonSpecular(');
  });

  it('draws no specular when the specular mode is disabled', () => {
    // `scene_forward_lights_inc.glsl:236-237`.
    const disabled = godotChunks()[CHUNK].split('#elif defined( GODOT_SPECULAR_DISABLED )')[1]!;
    expect(disabled.split('#endif')[0]).toContain('specularBRDF = vec3( 0.0 );');
  });

  it("draws a retroreflective lobe with Godot's GGX, not three's", () => {
    expect(godotChunks()[CHUNK]).toContain(
      'vec3 retroSpecularBRDF = godotSpecularBRDF( directLight.direction, retroViewDir, geometryNormal, material );'
    );
  });

  it('snaps a roughness below 1e-8 to 0, as Godot does (edge case)', () => {
    // `scene_forward_clustered.glsl:1667-1671`.
    expect(godotChunks()[SETUP_CHUNK]).toMatch(
      /material\.godotRoughness = sqrt\([^\n]*\);\nif \( material\.godotRoughness < 1e-8 \) material\.godotRoughness = 0\.0;/
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

  it("reflects an anisotropic surface on Godot's roughness, as its isotropic reflection does", () => {
    expect(godotChunks()[MAPS_CHUNK]).toContain(
      'getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.godotRoughness, '
    );
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
  beforeEach(installGodotLightSpecular);

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

  it("leaves three's chunks alone before the light specular it reads, and warns (error case)", () => {
    Object.assign(THREE.ShaderChunk, threeLightChunks);

    expect(warningsOf(installGodotLightFunction)).toHaveLength(1);
    expect(installedChunks()).toEqual(threeChunks);
  });

  it('finds itself installed after another patch adds a field to the material struct (edge case)', () => {
    installGodotLightFunction();
    THREE.ShaderChunk[CHUNK] = THREE.ShaderChunk[CHUNK].replace(
      'struct PhysicalMaterial {',
      'struct PhysicalMaterial {\n\tvec3 otherField;'
    );

    expect(warningsOf(installGodotLightFunction)).toEqual([]);
  });
});

describe('the light function chunk', () => {
  it('writes Burley in the branch the chunk takes with no define', () => {
    const lightFunction = godotChunks()[CHUNK].split('#elif defined( GODOT_DIFFUSE_TOON )')[1]!;
    expect(lightFunction.split('#endif')[0]).toMatch(/#else[\s\S]*fd90Minus1/);
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
