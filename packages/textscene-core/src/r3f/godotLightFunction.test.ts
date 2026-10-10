/**
 * The Fresnel weight comes off three's diffuse term, a light's diffuse and specular follow the modes
 * a program defines, and the default specular is Godot's GGX on Godot's roughness. The first test reads the
 * installed three, so a release that rewrites the lines fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_LIGHT_FUNCTION_EDITS,
  threeAnisotropy,
  drawsLightModesOf,
  installGodotLightFunction,
  lightModesInjection,
  lightModesOf,
  lightModesUserData,
  type LightModes,
} from './godotLightFunction';
import { DiffuseMode } from '../godot/diffuseMode';
import { SpecularMode } from '../godot/specularMode';
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
      /if \( material\.godotRoughness <= 0\.0 \) \{\s*specularBRDF = vec3\( 0\.0 \);[\s\S]*\}\s*reflectedLight\.directSpecular \+=/
    );
  });

  it("writes a toon specular into the light's diffuse, as Godot does", () => {
    // `scene_forward_lights_inc.glsl:228-234`.
    const toon = godotChunks()[CHUNK].split('#if defined( GODOT_SPECULAR_TOON )')[1]!.split('#elif')[0]!;
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

const BURLEY_GGX: LightModes = {
  diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
  specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
};

/** The fragment shader a lit material in `modes` compiles. */
function fragmentIn(modes: Partial<LightModes>): string {
  const injection = lightModesInjection({ ...BURLEY_GGX, ...modes })!;
  return patchedShader(injection.onBeforeCompile, THREE.ShaderLib.standard.fragmentShader);
}

describe('lightModesInjection', () => {
  it.each([
    // `scene_forward_lights_inc.glsl:194-202,210-213`.
    [DiffuseMode.DIFFUSE_LAMBERT, 'GODOT_DIFFUSE_LAMBERT'],
    [DiffuseMode.DIFFUSE_LAMBERT_WRAP, 'GODOT_DIFFUSE_LAMBERT_WRAP'],
    [DiffuseMode.DIFFUSE_TOON, 'GODOT_DIFFUSE_TOON'],
  ])('defines the diffuse branch of mode %i, %s', (diffuseMode, define) => {
    expect(fragmentIn({ diffuseMode })).toMatch(new RegExp(`^#define ${define}\\n`));
  });

  it.each([
    // `scene_forward_lights_inc.glsl:228-237`.
    [SpecularMode.SPECULAR_TOON, 'GODOT_SPECULAR_TOON'],
    [SpecularMode.SPECULAR_DISABLED, 'GODOT_SPECULAR_DISABLED'],
  ])('defines the specular branch of mode %i, %s', (specularMode, define) => {
    expect(fragmentIn({ specularMode })).toMatch(new RegExp(`^#define ${define}\\n`));
  });

  it('defines both modes of a surface that sets both', () => {
    const fragment = fragmentIn({
      diffuseMode: DiffuseMode.DIFFUSE_TOON,
      specularMode: SpecularMode.SPECULAR_TOON,
    });
    expect([
      fragment.includes('#define GODOT_DIFFUSE_TOON\n'),
      fragment.includes('#define GODOT_SPECULAR_TOON\n'),
    ]).toEqual([true, true]);
  });

  it("patches nothing for Burley and GGX, BaseMaterial3D's defaults", () => {
    // `material.h:608-609`.
    expect(lightModesInjection(BURLEY_GGX)).toBeUndefined();
  });

  it('writes Burley in the branch the chunk takes with no define', () => {
    const lightFunction = godotChunks()[CHUNK].split('#elif defined( GODOT_DIFFUSE_TOON )')[1]!;
    expect(lightFunction.split('#endif')[0]).toMatch(/#else[\s\S]*fd90Minus1/);
  });

  it('draws a diffuse mode past the enum as Lambert, as a shader with no diffuse render mode (edge case)', () => {
    // `material.cpp:828-841` writes no `diffuse_*` render mode for it, and `shader_types.cpp:241`
    // makes Lambert the default.
    expect(lightModesInjection({ ...BURLEY_GGX, diffuseMode: 7 })).toBe(
      lightModesInjection({ ...BURLEY_GGX, diffuseMode: DiffuseMode.DIFFUSE_LAMBERT })
    );
  });

  it('draws a specular mode past the enum as GGX, as a shader with no specular render mode (edge case)', () => {
    // `material.cpp:843-855` writes no `specular_*` render mode for it, and
    // `scene_forward_clustered.glsl:1078-1080` makes GGX the default.
    expect(lightModesInjection({ ...BURLEY_GGX, specularMode: 7 })).toBeUndefined();
  });

  it('gives one injection per pair of modes, so composed programs share it', () => {
    const modes = { diffuseMode: DiffuseMode.DIFFUSE_TOON, specularMode: SpecularMode.SPECULAR_TOON };
    expect(lightModesInjection(modes)).toBe(lightModesInjection({ ...modes }));
  });
});

describe('lightModesOf', () => {
  it('reads the modes a material records', () => {
    const modes = { diffuseMode: DiffuseMode.DIFFUSE_TOON, specularMode: SpecularMode.SPECULAR_DISABLED };
    const material = new THREE.MeshStandardMaterial({ userData: lightModesUserData(modes) });
    expect(lightModesOf(material)).toEqual(modes);
  });

  it('reads Burley and GGX off a material that records none, as a glTF import is (edge case)', () => {
    expect(lightModesOf(new THREE.MeshStandardMaterial())).toEqual(BURLEY_GGX);
  });

  it('reads Burley and GGX for no material (error case)', () => {
    expect(lightModesOf(undefined)).toEqual(BURLEY_GGX);
  });
});

describe('drawsLightModesOf', () => {
  const recording = (modes: LightModes) =>
    new THREE.MeshStandardMaterial({ userData: lightModesUserData(modes) });
  const toonSpecular = { ...BURLEY_GGX, specularMode: SpecularMode.SPECULAR_TOON };

  it('matches two materials that record the same modes', () => {
    expect(drawsLightModesOf(recording(toonSpecular), recording(toonSpecular))).toBe(true);
  });

  it('tells apart materials whose specular modes differ', () => {
    expect(drawsLightModesOf(recording(toonSpecular), recording(BURLEY_GGX))).toBe(false);
  });

  it('matches no material to the default modes (edge case)', () => {
    expect(drawsLightModesOf(recording(BURLEY_GGX), undefined)).toBe(true);
  });
});
