import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildSkyEnvironment, skyPanoramaTexture } from './build';
import { decodeSkyMaterial } from './decode';

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
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(
      (_renderer, scene) => {
        const mesh = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
        sampled = mesh.material.uniforms.source_panorama!.value as THREE.Texture;
        if (!renders) throw new Error('no WebGL context');
      }
    );
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap').mockReturnValue(
      new THREE.WebGLRenderTarget(1, 1)
    );
    const sky = decodeSkyMaterial('PanoramaSkyMaterial', {})!;
    const env = buildSkyEnvironment({} as THREE.WebGLRenderer, { sky, lights: [], panorama });
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
