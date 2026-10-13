import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildSkyEnvironment, skyPanoramaTexture } from './build';
import { decodeSkyMaterial } from './decode';
import type { Sky } from './types';

describe('skyPanoramaTexture', () => {
  it('tiles a clamped panorama on a source-shared clone', () => {
    // The panorama shader samples with `fract(atan(...))`, so u wraps 0..1 and
    // needs Repeat. The loader's shared entry is clamp, so the sky clones it
    // rather than mutating the entry a 2D consumer shares.
    const shared = new THREE.Texture();
    const tiled = skyPanoramaTexture(shared);
    expect(tiled).not.toBe(shared);
    expect(tiled!.wrapS).toBe(THREE.RepeatWrapping);
    expect(tiled!.wrapT).toBe(THREE.RepeatWrapping);
    expect(tiled!.source).toBe(shared.source);
    expect(shared.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('shares a panorama that already repeats', () => {
    const shared = new THREE.Texture();
    shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
    expect(skyPanoramaTexture(shared)).toBe(shared);
  });

  it('returns null when the sky has no panorama', () => {
    expect(skyPanoramaTexture(null)).toBeNull();
    expect(skyPanoramaTexture(undefined)).toBeNull();
  });
});

/** A renderer whose cube reads back the same radiance on every texel. */
function uniformSkyRenderer(radiance: number): THREE.WebGLRenderer {
  return {
    readRenderTargetPixels: (...args: unknown[]) => {
      (args[5] as Uint16Array).fill(THREE.DataUtils.toHalfFloat(radiance));
    },
  } as unknown as THREE.WebGLRenderer;
}

describe('buildSkyEnvironment layers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("carries Godot's layers 1 to 7 of the sky's radiance", () => {
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(() => {});
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap').mockReturnValue(
      new THREE.WebGLRenderTarget(1, 1)
    );
    const sky: Sky = {
      material: decodeSkyMaterial('ProceduralSkyMaterial', {})!,
      radianceFilter: 'importance-sample',
    };

    const env = buildSkyEnvironment(uniformSkyRenderer(0.25), { sky, lights: [] });

    expect([env!.layers.sharp, env!.layers.rough, env!.layers.last].map((g) => g.length)).toEqual([3, 3, 1]);
    expect(THREE.DataUtils.fromHalfFloat(env!.layers.last[0]![2]![1]!)).toBeCloseTo(0.25, 3);
  });
});

describe('buildSkyEnvironment panorama wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Builds a panorama sky with the cube render stubbed. `sampled` is the
   * panorama the sky shader read, taken during the render because the builder
   * frees it straight after. With `renders` false the render throws.
   */
  function build(panorama: THREE.Texture, renders = true) {
    let sampled: THREE.Texture | null = null;
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation((_renderer, scene) => {
      const mesh = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      sampled = mesh.material.uniforms.source_panorama!.value as THREE.Texture;
      if (!renders) throw new Error('no WebGL context');
    });
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap').mockReturnValue(
      new THREE.WebGLRenderTarget(1, 1)
    );
    const sky: Sky = {
      material: decodeSkyMaterial('PanoramaSkyMaterial', {})!,
      radianceFilter: 'importance-sample',
    };
    const env = buildSkyEnvironment(uniformSkyRenderer(0), { sky, lights: [], panorama });
    return { env, sampled: sampled as THREE.Texture | null };
  }

  it('samples the tiled panorama, not the shared entry', () => {
    // The clone's wrap and source are `skyPanoramaTexture`'s contract, tested above.
    const shared = new THREE.Texture();
    const { env, sampled } = build(shared);
    expect(env).not.toBeNull();
    expect(sampled).not.toBe(shared);
    expect(sampled!.wrapS).toBe(THREE.RepeatWrapping);
  });

  it.each([
    ['renders', true],
    ['fails to render', false],
  ])('frees its clone once the cube is done, when the sky %s', (_label, renders) => {
    const shared = new THREE.Texture();
    // The clone is made and freed inside the build, so a prototype spy is the
    // only place a test can see its disposal.
    const disposedTextures: THREE.Texture[] = [];
    const realDispose = THREE.Texture.prototype.dispose;
    vi.spyOn(THREE.Texture.prototype, 'dispose').mockImplementation(function (this: THREE.Texture) {
      disposedTextures.push(this);
      realDispose.call(this);
    });
    const { env, sampled } = build(shared, renders);
    expect(env === null).toBe(!renders);
    expect(sampled).not.toBe(shared);
    expect(disposedTextures).toContain(sampled);
    expect(disposedTextures).not.toContain(shared);
  });

  it('never disposes a shared panorama that already repeats', () => {
    const shared = new THREE.Texture();
    shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
    const disposed = vi.fn();
    shared.addEventListener('dispose', disposed);
    const { env, sampled } = build(shared);
    expect(sampled).toBe(shared);
    env!.dispose();
    expect(disposed).not.toHaveBeenCalled();
  });
});
