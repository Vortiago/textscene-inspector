/**
 * The Fresnel weight comes off three's diffuse term and nothing else changes. The first test
 * reads the installed three, so a release that rewrites the lines fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FRESNEL_WEIGHTED_DIFFUSE, godotDiffuseChunk, installGodotDiffuse } from './godotDiffuse';

const CHUNK = 'lights_physical_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

const occurrences = (text: string, part: string) => text.split(part).length - 1;

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
});

describe('godotDiffuseChunk', () => {
  it('finds each weighted line exactly once in the installed three', () => {
    for (const [weighted] of FRESNEL_WEIGHTED_DIFFUSE) {
      expect(occurrences(threeChunk, weighted)).toBe(1);
    }
  });

  it('writes each line in Godot’s unweighted form', () => {
    const patched = godotDiffuseChunk(threeChunk)!;

    for (const [weighted, godot] of FRESNEL_WEIGHTED_DIFFUSE) {
      expect(patched).not.toContain(weighted);
      expect(patched).toContain(godot);
    }
  });

  it('changes nothing but the weights', () => {
    const patched = godotDiffuseChunk(threeChunk)!;

    const removed = patched.length - threeChunk.length;
    const expected = FRESNEL_WEIGHTED_DIFFUSE.reduce(
      (sum, [weighted, godot]) => sum + godot.length - weighted.length,
      0
    );
    expect(removed).toBe(expected);
    expect(patched).toContain('irradiance * specularBRDF * material.multiScatteringCompensation');
  });

  it('is null for a chunk without the lines', () => {
    expect(godotDiffuseChunk('void main() {}')).toBeNull();
  });
});

describe('installGodotDiffuse', () => {
  it('replaces three’s chunk with the unweighted one', () => {
    installGodotDiffuse();

    expect(THREE.ShaderChunk[CHUNK]).toBe(godotDiffuseChunk(threeChunk));
  });

  it('leaves a chunk it cannot patch alone', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';

    installGodotDiffuse();

    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
  });
});
