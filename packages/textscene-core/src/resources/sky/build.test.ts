import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildSkyEnvironment } from './build';
import { decodeSky, decodeSkyMaterial } from './decode';
import type { Sky } from './types';
import { testRenderer } from '../../testing/recordingWebGL';
import { debandingDrawnBy } from './skyLayers.testkit';

/** A sky of `materialType` with every property at Godot's default. */
function defaultSky(materialType: string): Sky {
  return decodeSky({}, decodeSkyMaterial(materialType, {})!);
}

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
      energy: 1,
    });

    expect(env).not.toBeNull();
    expect(readBack).not.toHaveBeenCalled();
  });

  it('bakes the layers of a radiance above 256 at 256, 640 texels wide (edge case)', async () => {
    const { renderer } = await testRenderer();
    const sky: Sky = {
      material: decodeSkyMaterial('ProceduralSkyMaterial', {})!,
      radianceFilter: 'importance-sample',
      radianceSize: 1024,
    };

    const env = buildSkyEnvironment(renderer, { sky, lights: [], asBackground: false, energy: 1 });

    expect(env!.layers.target.width).toBe(640);
  });
});

describe('buildSkyEnvironment debanding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The debanding scale of the radiance octmap the build of `sky` at `energy` draws. */
  async function radianceDebanding(sky: Sky, energy: number): Promise<number | undefined> {
    const { renderer } = await testRenderer();
    const drawn = debandingDrawnBy(renderer, () =>
      buildSkyEnvironment(renderer, { sky, lights: [], asBackground: false, energy })
    );
    return drawn[0];
  }

  it("adds the noise to a debanded sky's radiance at the inverse of the energy a surface reads it at", async () => {
    expect(await radianceDebanding(defaultSky('ProceduralSkyMaterial'), 2)).toBe(0.5);
  });

  it.each([
    [
      'a sky that turns use_debanding off',
      decodeSky({}, decodeSkyMaterial('ProceduralSkyMaterial', { use_debanding: 'false' })!),
    ],
    ['a PanoramaSkyMaterial', defaultSky('PanoramaSkyMaterial')],
  ])('adds no noise to the radiance of %s', async (_label, sky) => {
    expect(await radianceDebanding(sky, 1)).toBe(0);
  });

  it('adds no noise to the radiance of a sky no surface reads (edge case)', async () => {
    expect(await radianceDebanding(defaultSky('ProceduralSkyMaterial'), 0)).toBe(0);
  });
});

describe('buildSkyEnvironment radiance size', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The face size of each cube the build renders, and whether it filters a PMREM besides the layers. */
  async function cubeSizes(radianceSize: number, asBackground = true) {
    const { renderer } = await testRenderer();
    const rendered: number[] = [];
    vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(function (this: THREE.CubeCamera) {
      rendered.push(this.renderTarget.width);
    });
    const pmrem = vi.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap');
    const sky: Sky = {
      material: decodeSkyMaterial('ProceduralSkyMaterial', {})!,
      radianceFilter: 'importance-sample',
      radianceSize,
    };
    const env = buildSkyEnvironment(renderer, { sky, lights: [], asBackground, energy: 1 });
    return { rendered, hasPmrem: pmrem.mock.calls.length > 0, hasBackground: env!.background !== null };
  }

  it('renders one cube for the background and the radiance at the default size', async () => {
    expect(await cubeSizes(256)).toEqual({ rendered: [256], hasPmrem: false, hasBackground: true });
  });

  it('renders the radiance at a smaller size on a cube of its own, so a mirror reads it as coarse as Godot', async () => {
    expect(await cubeSizes(32)).toEqual({ rendered: [256, 32], hasPmrem: false, hasBackground: true });
  });

  it('bakes a size above 256 at 256 (edge case)', async () => {
    expect(await cubeSizes(1024)).toEqual({ rendered: [256], hasPmrem: false, hasBackground: true });
  });

  it('renders only the radiance cube for a sky that is not the background', async () => {
    expect(await cubeSizes(32, false)).toEqual({ rendered: [32], hasPmrem: false, hasBackground: false });
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
  async function build(panorama: THREE.Texture | null, renders = true) {
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
    const env = buildSkyEnvironment(renderer, { sky, lights: [], panorama, asBackground: true, energy: 1 });
    return { env, sampled: sampled as THREE.Texture | null };
  }

  it('samples a clamped panorama through a tiled clone of its source', async () => {
    // The panorama shader samples with `fract(atan(...))`, so u wraps 0..1 and
    // needs Repeat. The loader's shared entry is clamp, so the sky clones it
    // rather than mutating the entry a 2D consumer shares.
    const shared = new THREE.Texture();
    const { env, sampled } = await build(shared);
    expect(env).not.toBeNull();
    expect(sampled).not.toBe(shared);
    expect(sampled!.wrapS).toBe(THREE.RepeatWrapping);
    expect(sampled!.wrapT).toBe(THREE.RepeatWrapping);
    expect(sampled!.source).toBe(shared.source);
    expect(shared.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('samples no panorama when the sky has none (edge case)', async () => {
    const { env, sampled } = await build(null);
    expect(env).not.toBeNull();
    expect(sampled).toBeNull();
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
