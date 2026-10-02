/**
 * Each test imports a fresh copy of the module, so the holders one test leaves never reach the next.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

type AtlasTarget = typeof import('./shadowAtlasTarget');

let target: AtlasTarget;

beforeEach(async () => {
  vi.resetModules();
  target = await import('./shadowAtlasTarget');
});

afterEach(() => {
  delete THREE.ShaderLib.standard.uniforms[target.POSITIONAL_SHADOW_ATLAS_UNIFORM];
});

/** Counts the times the atlas frees its GPU memory. */
function freesOf(atlas: THREE.WebGLRenderTarget): () => number {
  const freed = vi.fn();
  atlas.addEventListener('dispose', freed);
  return () => freed.mock.calls.length;
}

describe('the positional shadow atlas texture', () => {
  it('holds 16-bit depth that a linear filter compares, strictly nearer reading as lit', () => {
    const depth = target.positionalShadowAtlasDepth();
    expect(depth.format).toBe(THREE.DepthFormat);
    expect(depth.type).toBe(THREE.UnsignedShortType);
    expect(depth.compareFunction).toBe(THREE.LessCompare);
    expect([depth.minFilter, depth.magFilter]).toEqual([THREE.LinearFilter, THREE.LinearFilter]);
  });

  it('keeps one depth texture through a material’s uniform clone', () => {
    const uniforms = { atlas: { value: target.positionalShadowAtlasDepth() } };
    expect(THREE.UniformsUtils.clone(uniforms).atlas!.value).toBe(target.positionalShadowAtlasDepth());
  });

  it('draws into the atlas an earlier evaluation gave the lit materials (edge case)', async () => {
    const installed = target.positionalShadowAtlasDepth();
    THREE.ShaderLib.standard.uniforms[target.POSITIONAL_SHADOW_ATLAS_UNIFORM] = { value: installed };
    vi.resetModules();
    const reloaded: AtlasTarget = await import('./shadowAtlasTarget');
    expect(reloaded.positionalShadowAtlas()).toBe(target.positionalShadowAtlas());
  });
});

describe('holdPositionalShadowAtlas', () => {
  it('sizes the atlas to the largest atlas any holder asks for', () => {
    target.holdPositionalShadowAtlas({}, 2048);
    target.holdPositionalShadowAtlas({}, 4096);
    expect([target.positionalShadowAtlas().width, target.positionalShadowAtlas().height]).toEqual([
      4096, 4096,
    ]);
  });

  it('keeps the atlas when a holder asks for a smaller one (edge case)', () => {
    target.holdPositionalShadowAtlas({}, 4096);
    const frees = freesOf(target.positionalShadowAtlas());
    target.holdPositionalShadowAtlas({}, 2048);
    expect(target.positionalShadowAtlas().width).toBe(4096);
    expect(frees()).toBe(0);
  });

  it('keeps a side of one texel for a viewport whose atlas has none (error case)', () => {
    target.holdPositionalShadowAtlas({}, 0);
    expect(target.positionalShadowAtlas().width).toBe(1);
  });
});

describe('releasePositionalShadowAtlas', () => {
  it('frees the atlas when its last holder lets go', () => {
    const holder = {};
    target.holdPositionalShadowAtlas(holder, 4096);
    const frees = freesOf(target.positionalShadowAtlas());
    target.releasePositionalShadowAtlas(holder);
    expect(frees()).toBe(1);
  });

  it('shrinks the atlas to the holders that remain', () => {
    const [small, large] = [{}, {}];
    target.holdPositionalShadowAtlas(small, 2048);
    target.holdPositionalShadowAtlas(large, 4096);
    target.releasePositionalShadowAtlas(large);
    expect(target.positionalShadowAtlas().width).toBe(2048);
  });

  it('changes nothing for a holder that holds nothing (error case)', () => {
    target.holdPositionalShadowAtlas({}, 4096);
    const frees = freesOf(target.positionalShadowAtlas());
    target.releasePositionalShadowAtlas({});
    expect(frees()).toBe(0);
    expect(target.positionalShadowAtlas().width).toBe(4096);
  });
});
