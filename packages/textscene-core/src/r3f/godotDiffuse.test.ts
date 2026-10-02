/**
 * The Fresnel weight comes off three's diffuse term and nothing else changes. The first test
 * reads the installed three, so a release that rewrites the lines fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FRESNEL_WEIGHTED_DIFFUSE, installGodotDiffuse } from './godotDiffuse';
import { applyChunkEdits } from './shaderPatch/chunkPatch';
import { warningsOf } from './testing/logWarnings';

const CHUNK = 'lights_physical_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

const occurrences = (text: string, part: string) => text.split(part).length - 1;

/** three's chunk with every edit applied. */
function godotDiffuseChunk(): string {
  return applyChunkEdits({ [CHUNK]: threeChunk }, FRESNEL_WEIGHTED_DIFFUSE)![CHUNK];
}

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
});

describe('FRESNEL_WEIGHTED_DIFFUSE', () => {
  it('finds each weighted line exactly once in the installed three', () => {
    for (const { three } of FRESNEL_WEIGHTED_DIFFUSE) {
      expect(occurrences(threeChunk, three)).toBe(1);
    }
  });

  it('writes each line in Godot’s unweighted form', () => {
    const patched = godotDiffuseChunk();

    for (const { three, godot } of FRESNEL_WEIGHTED_DIFFUSE) {
      expect(patched).not.toContain(three);
      expect(patched).toContain(godot);
    }
  });

  it('changes nothing but the weights', () => {
    const patched = godotDiffuseChunk();

    const removed = patched.length - threeChunk.length;
    const expected = FRESNEL_WEIGHTED_DIFFUSE.reduce(
      (sum, { three, godot }) => sum + godot.length - three.length,
      0
    );
    expect(removed).toBe(expected);
    expect(patched).toContain('irradiance * specularBRDF * material.multiScatteringCompensation');
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
