/**
 * Each test imports a fresh copy of the module, so the holders one test leaves never reach the
 * next.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DIRECTIONAL_SHADOW_SIZE_DEFAULT } from '../../godot/directionalShadow';

type ShadowAtlas = typeof import('./shadowAtlas');

let atlasModule: ShadowAtlas;

beforeEach(async () => {
  vi.resetModules();
  atlasModule = await import('./shadowAtlas');
});

afterEach(() => {
  for (const shader of Object.values(THREE.ShaderLib)) {
    delete shader.uniforms[atlasModule.DIRECTIONAL_SHADOW_ATLAS_UNIFORM];
  }
});

/** A shadow that could hold the atlas. */
function aShadow(): THREE.LightShadow {
  return new THREE.DirectionalLight().shadow;
}

/** Counts the times the atlas frees its GPU memory. */
function freesOf(atlas: THREE.WebGLRenderTarget): () => number {
  const freed = vi.fn();
  atlas.addEventListener('dispose', freed);
  return () => freed.mock.calls.length;
}

describe('the directional shadow atlas', () => {
  it('is Godot’s default directional shadow size on both sides', () => {
    const atlas = atlasModule.holdDirectionalShadowAtlas(aShadow());
    expect([atlas.width, atlas.height]).toEqual([
      DIRECTIONAL_SHADOW_SIZE_DEFAULT,
      DIRECTIONAL_SHADOW_SIZE_DEFAULT,
    ]);
  });

  it('holds depth as three holds a PCF shadow map', () => {
    const depth = atlasModule.directionalShadowAtlasDepth();
    expect(depth.format).toBe(THREE.DepthFormat);
    expect(depth.type).toBe(THREE.UnsignedIntType);
    expect(depth.compareFunction).toBe(THREE.LessEqualCompare);
    expect([depth.minFilter, depth.magFilter]).toEqual([THREE.LinearFilter, THREE.LinearFilter]);
  });

  it('keeps one depth texture through a material’s uniform clone', () => {
    const uniforms = { atlas: { value: atlasModule.directionalShadowAtlasDepth() } };
    expect(THREE.UniformsUtils.clone(uniforms).atlas!.value).toBe(atlasModule.directionalShadowAtlasDepth());
  });

  it('gives every holder the same target', () => {
    const first = atlasModule.holdDirectionalShadowAtlas(aShadow());
    const second = atlasModule.holdDirectionalShadowAtlas(aShadow());
    expect(second).toBe(first);
    expect(first.depthTexture).toBe(atlasModule.directionalShadowAtlasDepth());
  });

  it('draws into the atlas an earlier evaluation gave the lit materials (edge case)', async () => {
    const installed = atlasModule.directionalShadowAtlasDepth();
    THREE.ShaderLib.standard.uniforms[atlasModule.DIRECTIONAL_SHADOW_ATLAS_UNIFORM] = { value: installed };
    vi.resetModules();
    const reloaded: ShadowAtlas = await import('./shadowAtlas');
    expect(reloaded.directionalShadowAtlasDepth()).toBe(installed);
  });
});

describe('releaseDirectionalShadowAtlas', () => {
  it('frees the atlas when its last holder lets go', () => {
    const shadow = aShadow();
    const frees = freesOf(atlasModule.holdDirectionalShadowAtlas(shadow));
    atlasModule.releaseDirectionalShadowAtlas(shadow);
    expect(frees()).toBe(1);
  });

  it('keeps the atlas while another holder draws into it', () => {
    const [kept, released] = [aShadow(), aShadow()];
    const frees = freesOf(atlasModule.holdDirectionalShadowAtlas(kept));
    atlasModule.holdDirectionalShadowAtlas(released);
    atlasModule.releaseDirectionalShadowAtlas(released);
    expect(frees()).toBe(0);
  });

  it('frees nothing for a shadow that holds nothing (error case)', () => {
    const frees = freesOf(atlasModule.holdDirectionalShadowAtlas(aShadow()));
    atlasModule.releaseDirectionalShadowAtlas(aShadow());
    expect(frees()).toBe(0);
  });

  it('frees the atlas once when its last holder lets go twice (edge case)', () => {
    const shadow = aShadow();
    const frees = freesOf(atlasModule.holdDirectionalShadowAtlas(shadow));
    atlasModule.releaseDirectionalShadowAtlas(shadow);
    atlasModule.releaseDirectionalShadowAtlas(shadow);
    expect(frees()).toBe(1);
  });
});
