/**
 * The GLB processor gives a mesh the UV2 Godot's importer unwrapped for it, read from the
 * **Unwrap cache** beside the asset. The witness is `global_illumination/cube.glb`, imported at
 * Static Lightmaps with its cache vendored.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';
import { initGlbModules } from '../formats/glb/glbProcessing';
import { demoBytes } from '../formats/glb/lightmapUv/testing/globalIllumination';
import { orderedCornerDigest } from '../formats/glb/lightmapUv/testing/godotCorners';
import { isMesh } from '../../r3f/testing/threeNarrow';
import { triangleGlb } from '../formats/glb/testing/triangleGlb';
import { LIT_UV2, litAndBareCache, litAndBareGlb } from '../formats/glb/lightmapUv/testing/litAndBareGlb';
import * as logger from '../../logger';

const CUBE_PATH = 'res://cube.glb';
const CUBE_MESH_ID = 'cube_Cube_001';

const sidecar = (params: string): string => `[remap]\n\nimporter="scene"\n\n[params]\n\n${params}\n`;
const STATIC_LIGHTMAPS = sidecar('meshes/light_baking=2\nmeshes/lightmap_texel_size=0.2');

/** Every surface of the loaded asset at `path`, in scene order. */
async function loadSurfaces(
  path: string,
  files: Record<string, string | ArrayBuffer>
): Promise<THREE.Mesh[]> {
  const fileEventBus = new FileEventBus({
    loadResource: async (requested: string) => files[requested] ?? null,
  });
  const eventBus = new ResourceEventBus();
  const processor = createGLBProcessor(fileEventBus, eventBus, new DependencyGraph());

  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', path, 5000);
  processor.request(path);
  const surfaces: THREE.Mesh[] = [];
  (await loaded).traverse((node) => {
    if (isMesh(node)) surfaces.push(node);
  });
  return surfaces;
}

async function load(
  path: string,
  files: Record<string, string | ArrayBuffer>
): Promise<THREE.BufferGeometry> {
  return (await loadSurfaces(path, files)).at(-1)!.geometry;
}

function loadCube(files: Record<string, string | ArrayBuffer>): Promise<THREE.BufferGeometry> {
  return load(CUBE_PATH, { [CUBE_PATH]: demoBytes('cube.glb'), ...files });
}

describe('createGLBProcessor: lightmap UV2 from the unwrap cache', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives the cube Godot's unwrapped UV2 at Static Lightmaps", async () => {
    const geometry = await loadCube({
      [`${CUBE_PATH}.import`]: STATIC_LIGHTMAPS,
      [`${CUBE_PATH}.unwrap_cache`]: demoBytes('cube.glb.unwrap_cache'),
    });

    expect(orderedCornerDigest([geometry])).toBe('a60e081e9297b5f4d7c5ca5cf6f8b321');
  });

  it('ignores a cache beside an asset imported at another bake mode, as godot_ball is', async () => {
    const geometry = await loadCube({
      [`${CUBE_PATH}.import`]: sidecar('meshes/light_baking=1'),
      [`${CUBE_PATH}.unwrap_cache`]: demoBytes('cube.glb.unwrap_cache'),
    });

    expect(geometry.getAttribute('uv1')).toBeUndefined();
  });

  it('skips a mesh whose generate/lightmap_uv is Disable', async () => {
    const meshes = `_subresources={\n"meshes": {\n"${CUBE_MESH_ID}": {\n"generate/lightmap_uv": 2\n}\n}\n}`;
    const geometry = await loadCube({
      [`${CUBE_PATH}.import`]: sidecar(`meshes/light_baking=2\n${meshes}`),
      [`${CUBE_PATH}.unwrap_cache`]: demoBytes('cube.glb.unwrap_cache'),
    });

    expect(geometry.getAttribute('uv1')).toBeUndefined();
  });

  it('keeps the GLB attributes without a cache, and says so once, naming the mesh', async () => {
    const info = vi.spyOn(logger, 'info');

    const geometry = await loadCube({ [`${CUBE_PATH}.import`]: STATIC_LIGHTMAPS });

    expect(geometry.getAttribute('uv1')).toBeUndefined();
    expect(info.mock.calls.filter(([line]) => String(line).includes(`'${CUBE_MESH_ID}'`))).toHaveLength(1);
  });

  it('keeps the GLB attributes when no entry matches the hash, as at another texel size', async () => {
    const info = vi.spyOn(logger, 'info');

    const geometry = await loadCube({
      [`${CUBE_PATH}.import`]: sidecar('meshes/light_baking=2\nmeshes/lightmap_texel_size=0.5'),
      [`${CUBE_PATH}.unwrap_cache`]: demoBytes('cube.glb.unwrap_cache'),
    });

    expect(geometry.getAttribute('uv1')).toBeUndefined();
    expect(info.mock.calls.filter(([line]) => String(line).includes(`'${CUBE_MESH_ID}'`))).toHaveLength(1);
  });

  it('keeps the GLB attributes for a cache it cannot read, and warns (edge case)', async () => {
    const warn = vi.spyOn(logger, 'warn');

    const geometry = await loadCube({
      [`${CUBE_PATH}.import`]: STATIC_LIGHTMAPS,
      [`${CUBE_PATH}.unwrap_cache`]: demoBytes('cube.glb.unwrap_cache').slice(0, 100),
    });

    expect(geometry.getAttribute('uv1')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('entry 0 needs 324 bytes'));
  });

  it("leaves a single-root file's root mesh alone, as Godot 4.6.3 unwraps none there", async () => {
    const info = vi.spyOn(logger, 'info');
    const path = 'res://slab.glb';

    await load(path, {
      [path]: triangleGlb({ extensionsUsed: ['GODOT_single_root'] }),
      [`${path}.import`]: STATIC_LIGHTMAPS,
    });

    expect(info.mock.calls.filter(([line]) => String(line).includes("mesh 'slab_mesh'"))).toEqual([]);
  });

  it("drops a last surface without normals, which Godot's unwrapped mesh lacks", async () => {
    const path = 'res://mix.glb';

    const surfaces = await loadSurfaces(path, {
      [path]: litAndBareGlb(),
      [`${path}.import`]: STATIC_LIGHTMAPS,
      [`${path}.unwrap_cache`]: litAndBareCache(Math.fround(0.2)),
    });

    expect(surfaces.map((surface) => Array.from(surface.geometry.getAttribute('uv1').array))).toEqual([
      LIT_UV2,
    ]);
  });
});
