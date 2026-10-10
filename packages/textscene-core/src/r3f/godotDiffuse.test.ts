/**
 * The Fresnel weight comes off three's diffuse term, and a light's diffuse follows the mode a
 * program defines. The first test reads the installed three, so a release that rewrites the
 * lines fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_DIFFUSE_EDITS,
  diffuseModeInjection,
  diffuseModeOf,
  diffuseModeUserData,
  installGodotDiffuse,
} from './godotDiffuse';
import { DiffuseMode } from '../godot/diffuseMode';
import { applyChunkEdits } from './shaderPatch/chunkPatch';
import { warningsOf } from './testing/logWarnings';
import { patchedShader } from './testing/patchedFragment';

const CHUNK = 'lights_physical_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

const occurrences = (text: string, part: string) => text.split(part).length - 1;

/** three's chunk with every edit applied. */
function godotDiffuseChunk(): string {
  return applyChunkEdits({ [CHUNK]: threeChunk }, GODOT_DIFFUSE_EDITS)![CHUNK];
}

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
});

describe('GODOT_DIFFUSE_EDITS', () => {
  it('finds each replaced line exactly once in the installed three', () => {
    for (const { three } of GODOT_DIFFUSE_EDITS) {
      expect(occurrences(threeChunk, three)).toBe(1);
    }
  });

  it('writes each edit into the chunk', () => {
    const patched = godotDiffuseChunk();

    for (const { godot } of GODOT_DIFFUSE_EDITS) {
      expect(patched).toContain(godot);
    }
  });

  it('drops the Fresnel weight from both diffuse lines', () => {
    const patched = godotDiffuseChunk();
    expect(patched).not.toContain('* ( 1.0 - F )');
    expect(patched).not.toContain('* ( 1.0 - singleScattering - multiScattering )');
  });

  it("defines Godot's light function before the direct light function calls it", () => {
    const patched = godotDiffuseChunk();
    expect(patched.indexOf('float godotDiffuseNL(')).toBeLessThan(
      patched.indexOf('void RE_Direct_Physical(')
    );
  });

  it('keeps the specular term', () => {
    expect(godotDiffuseChunk()).toContain('irradiance * specularBRDF * material.multiScatteringCompensation');
  });
});

describe('installGodotDiffuse', () => {
  it('replaces three’s chunk with the unweighted one', () => {
    installGodotDiffuse();

    expect(THREE.ShaderChunk[CHUNK]).toBe(godotDiffuseChunk());
  });

  it('leaves a chunk it cannot patch alone, and warns (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';

    expect(warningsOf(installGodotDiffuse)).toHaveLength(1);

    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    const warnings = warningsOf(() => {
      installGodotDiffuse();
      installGodotDiffuse();
    });

    expect(warnings).toEqual([]);
    expect(THREE.ShaderChunk[CHUNK]).toBe(godotDiffuseChunk());
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
    const lightFunction = godotDiffuseChunk().split('#elif defined( GODOT_DIFFUSE_TOON )')[1]!;
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
