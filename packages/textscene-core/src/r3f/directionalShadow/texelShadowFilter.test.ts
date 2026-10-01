/**
 * The patch is checked against the installed three's chunk, so a release that rewrites the PCF
 * lookup fails here and not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installTexelShadowFilter, texelShadowFilterChunk } from './texelShadowFilter';
import { godotSplitShadowChunk } from './splitShadowChunk';
import { shadowFadeChunks } from './shadowFade';

const CHUNK = 'shadowmap_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
});

describe('texelShadowFilterChunk', () => {
  it('scales the kernel by one texel on each axis of the map', () => {
    const patched = texelShadowFilterChunk(threeChunk)!;
    expect(patched).toContain('vec2 radius = shadowRadius * texelSize;');
    expect(patched).not.toContain('float radius = shadowRadius * texelSize.x;');
  });

  it('keeps the point light lookup, whose cube faces are square (edge case)', () => {
    const patched = texelShadowFilterChunk(threeChunk)!;
    expect(patched).toContain('float texelSize = shadowRadius / shadowMapSize.x;');
  });

  it('composes with the split lookup in either order (edge case)', () => {
    const filterFirst = godotSplitShadowChunk(texelShadowFilterChunk(threeChunk)!);
    const splitFirst = texelShadowFilterChunk(godotSplitShadowChunk(threeChunk)!);
    expect(filterFirst).toBe(splitFirst);
  });

  it('composes with the fade in either order (edge case)', () => {
    const lights = THREE.ShaderChunk.lights_fragment_begin;
    const filterFirst = shadowFadeChunks(texelShadowFilterChunk(threeChunk)!, lights)!.pars;
    const fadeFirst = texelShadowFilterChunk(shadowFadeChunks(threeChunk, lights)!.pars);
    expect(filterFirst).toBe(fadeFirst);
  });

  it('answers null for a chunk without three’s kernel radius (error case)', () => {
    expect(texelShadowFilterChunk('void main() {}')).toBeNull();
  });
});

describe('installTexelShadowFilter', () => {
  it('patches three’s chunk', () => {
    installTexelShadowFilter();
    expect(THREE.ShaderChunk[CHUNK]).toBe(texelShadowFilterChunk(threeChunk));
  });

  it('changes nothing on a second call (edge case)', () => {
    installTexelShadowFilter();
    const once = THREE.ShaderChunk[CHUNK];
    installTexelShadowFilter();
    expect(THREE.ShaderChunk[CHUNK]).toBe(once);
  });

  it('keeps a chunk it cannot patch (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';
    installTexelShadowFilter();
    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
  });
});
