import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildSkyEnvironment, skyPanoramaTexture } from './build';
import { decodeSky, decodeSkyMaterial } from './decode';
import type { Sky } from './types';
import { testRenderer } from '../../testing/recordingWebGL';

/** A sky of `materialType` with every property at Godot's default. */
function defaultSky(materialType: string): Sky {
  return decodeSky({}, decodeSkyMaterial(materialType, {})!);
}

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

describe('buildSkyEnvironment layers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bakes the sky's layers without reading a pixel back", async () => {
    const { renderer } = await testRenderer();
    const readBack = vi.spyOn(renderer.getContext(), 'readPixels');

    const env = buildSkyEnvironment(renderer, {
      sky: defaultSky('ProceduralSkyMaterial'),
      lights: [],
      asBackground: true,
    });

    expect(env).not.toBeNull();
    expect(readBack).not.toHaveBeenCalled();
  });

  it("draws each of Godot's layers 1 to 7 into a mip of its group's cube, on all six faces", async () => {
    const { renderer } = await testRenderer();
    const context = renderer.getContext();
    // Each draw writes to the texture level attached last.
    let attached: unknown[] = [];
    const draws: unknown[][] = [];
    vi.spyOn(context, 'framebufferTexture2D').mockImplementation((...args) => void (attached = args));
    vi.spyOn(context, 'drawArrays').mockImplementation(() => void draws.push(attached));
    vi.spyOn(context, 'drawElements').mockImplementation(() => void draws.push(attached));

    const env = buildSkyEnvironment(renderer, {
      sky: defaultSky('ProceduralSkyMaterial'),
      lights: [],
      asBackground: true,
    });

    const drawnFacesAndMips = (cube: THREE.WebGLCubeRenderTarget) => {
      const handle = (renderer.properties.get(cube.texture) as { __webglTexture: unknown }).__webglTexture;
      const drawn = draws
        .filter(([, , , texture]) => texture === handle)
        .map(([, , face, , level]) => `${(face as number) - context.TEXTURE_CUBE_MAP_POSITIVE_X}@${level}`);
      return new Set(drawn).size;
    };
    expect([env!.layers.sharp, env!.layers.rough, env!.layers.last].map(drawnFacesAndMips)).toEqual([
      18, 18, 6,
    ]);
  });
});

describe('buildSkyEnvironment radiance size', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The face size of each cube the build renders, and of the cube the PMREM prefilters. */
  async function cubeSizes(radianceSize: number, asBackground = true) {
    const { renderer } = await testRenderer();
    const rendered: number[] = [];
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(function (this: THREE.CubeCamera) {
      rendered.push(this.renderTarget.width);
    });
    let prefiltered = 0;
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap').mockImplementation((cubemap) => {
      prefiltered = (cubemap.image as { width: number }[])[0]!.width;
      return new THREE.WebGLRenderTarget(1, 1);
    });
    const sky: Sky = {
      material: decodeSkyMaterial('ProceduralSkyMaterial', {})!,
      radianceFilter: 'importance-sample',
      radianceSize,
    };
    const env = buildSkyEnvironment(renderer, { sky, lights: [], asBackground });
    return { rendered, prefiltered, hasBackground: env!.background !== null };
  }

  it('renders one cube for the background and the radiance at the default size', async () => {
    expect(await cubeSizes(256)).toEqual({ rendered: [256], prefiltered: 256, hasBackground: true });
  });

  it('renders the radiance at a smaller size on a cube of its own, so a mirror reads it as coarse as Godot', async () => {
    expect(await cubeSizes(32)).toEqual({ rendered: [256, 32], prefiltered: 32, hasBackground: true });
  });

  it('bakes a size above 256 at 256 (edge case)', async () => {
    expect(await cubeSizes(1024)).toEqual({ rendered: [256], prefiltered: 256, hasBackground: true });
  });

  it('renders only the radiance cube for a sky that is not the background', async () => {
    expect(await cubeSizes(32, false)).toEqual({ rendered: [32], prefiltered: 32, hasBackground: false });
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
  async function build(panorama: THREE.Texture, renders = true) {
    const { renderer } = await testRenderer();
    let sampled: THREE.Texture | null = null;
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation((_renderer, scene) => {
      const mesh = scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      sampled = mesh.material.uniforms.source_panorama!.value as THREE.Texture;
      if (!renders) throw new Error('no WebGL context');
    });
    vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap').mockReturnValue(
      new THREE.WebGLRenderTarget(1, 1)
    );
    const sky = defaultSky('PanoramaSkyMaterial');
    const env = buildSkyEnvironment(renderer, { sky, lights: [], panorama, asBackground: true });
    return { env, sampled: sampled as THREE.Texture | null };
  }

  it('samples the tiled panorama, not the shared entry', async () => {
    // The clone's wrap and source are `skyPanoramaTexture`'s contract, tested above.
    const shared = new THREE.Texture();
    const { env, sampled } = await build(shared);
    expect(env).not.toBeNull();
    expect(sampled).not.toBe(shared);
    expect(sampled!.wrapS).toBe(THREE.RepeatWrapping);
  });

  it.each([
    ['renders', true],
    ['fails to render', false],
  ])('frees its clone once the cube is done, when the sky %s', async (_label, renders) => {
    const shared = new THREE.Texture();
    // The clone is made and freed inside the build, so a prototype spy is the
    // only place a test can see its disposal.
    const disposedTextures: THREE.Texture[] = [];
    const realDispose = THREE.Texture.prototype.dispose;
    vi.spyOn(THREE.Texture.prototype, 'dispose').mockImplementation(function (this: THREE.Texture) {
      disposedTextures.push(this);
      realDispose.call(this);
    });
    const { env, sampled } = await build(shared, renders);
    expect(env === null).toBe(!renders);
    expect(sampled).not.toBe(shared);
    expect(disposedTextures).toContain(sampled);
    expect(disposedTextures).not.toContain(shared);
  });

  it('never disposes a shared panorama that already repeats', async () => {
    const shared = new THREE.Texture();
    shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
    const disposed = vi.fn();
    shared.addEventListener('dispose', disposed);
    const { env, sampled } = await build(shared);
    expect(sampled).toBe(shared);
    env!.dispose();
    expect(disposed).not.toHaveBeenCalled();
  });
});
