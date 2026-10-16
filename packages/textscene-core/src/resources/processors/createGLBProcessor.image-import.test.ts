/**
 * A glTF image imports as the file Godot loads it from, so that file's sidecar decides its texels
 * and its format: a colour slot reads it through its sRGB view only when that format has one. An
 * embedded image imports as the file Godot extracts it to. happy-dom decodes no image, so the
 * texture decode is faked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';
import { forEachSurfaceMaterial } from '../formats/glb/surfaceMaterials';
import { png } from '../formats/image/testing/imageBytes';

/** The RGBA8 texels every image decodes to, top row first. Null decodes to an empty texture. */
const decoded = vi.hoisted(() => ({
  image: null as { data: Uint8Array; width: number; height: number } | null,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  /** Decodes every image at once, to `decoded.image`. */
  class FakeTextureLoader {
    load(_url: string, onLoad: (texture: InstanceType<typeof actual.Texture>) => void): void {
      const texture = new actual.Texture();
      if (decoded.image) texture.image = { ...decoded.image, data: decoded.image.data.slice() };
      onLoad(texture);
    }
  }

  return { ...actual, TextureLoader: FakeTextureLoader };
});

const GLTF_PATH = 'res://props/quad.gltf';
/** Where Godot extracts the embedded image named `albedo` (`gltf_document.cpp:2209-2210`). */
const EXTRACTED_PATH = 'res://props/quad_albedo.png';
const EXTERNAL_PATH = 'res://props/textures/grey.png';

const base64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const pngDataUri = (image: Uint8Array): string => `data:image/png;base64,${base64(image)}`;

/** One triangle whose material samples image 0 as its base colour and emission. */
function texturedGltf(image: { uri: string; name?: string }): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'quad', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
        emissiveTexture: { index: 0 },
        emissiveFactor: [1, 1, 1],
      },
    ],
    textures: [{ source: 0 }],
    images: [image],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    buffers: [
      {
        byteLength: positions.byteLength,
        uri: `data:application/octet-stream;base64,${base64(new Uint8Array(positions.buffer))}`,
      },
    ],
  };
  return new TextEncoder().encode(JSON.stringify(gltf)).buffer as ArrayBuffer;
}

const textureSidecar = (mode: number, params = ''): string =>
  `[remap]\n\nimporter="texture"\n\n[params]\n\ncompress/mode=${mode}\n${params}`;

function harness(files: Record<string, ArrayBuffer | string>) {
  const loadResource = vi.fn(async (path: string) => files[path] ?? null);
  const fileEventBus = new FileEventBus({ loadResource });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createGLBProcessor(fileEventBus, eventBus, dependencies);
  const load = (): Promise<THREE.Object3D> => {
    const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
    processor.request(GLTF_PATH);
    return loaded;
  };
  return { load, dependencies, loadResource };
}

/** The colour spaces of the base colour and emissive maps of the asset's one material. */
function colourMapSpaces(root: THREE.Object3D): THREE.ColorSpace[] {
  const spaces: THREE.ColorSpace[] = [];
  forEachSurfaceMaterial(root, (material) => {
    const { map, emissiveMap } = material as THREE.MeshStandardMaterial;
    spaces.push(map!.colorSpace as THREE.ColorSpace, emissiveMap!.colorSpace as THREE.ColorSpace);
  });
  return spaces;
}

describe('createGLBProcessor: the import format of a glTF image', () => {
  it('reads an embedded greyscale image raw when its extracted file has no sidecar', async () => {
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(0)) });
    const root = await harness({ [GLTF_PATH]: gltf }).load();
    expect(colourMapSpaces(root)).toEqual([THREE.NoColorSpace, THREE.NoColorSpace]);
  });

  it('reads an embedded greyscale image as sRGB when its extracted file is VRAM compressed', async () => {
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(0)) });
    const root = await harness({ [GLTF_PATH]: gltf, [`${EXTRACTED_PATH}.import`]: textureSidecar(2) }).load();
    expect(colourMapSpaces(root)).toEqual([THREE.SRGBColorSpace, THREE.SRGBColorSpace]);
  });

  it('reads an embedded colour image as sRGB', async () => {
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(2)) });
    const root = await harness({ [GLTF_PATH]: gltf }).load();
    expect(colourMapSpaces(root)).toEqual([THREE.SRGBColorSpace, THREE.SRGBColorSpace]);
  });

  it("reads an external greyscale image by its own file's sidecar", async () => {
    const gltf = texturedGltf({ uri: 'textures/grey.png' });
    const image = png(0).slice().buffer;
    const lossless = await harness({ [GLTF_PATH]: gltf, [EXTERNAL_PATH]: image }).load();
    const vram = await harness({
      [GLTF_PATH]: gltf,
      [EXTERNAL_PATH]: image,
      [`${EXTERNAL_PATH}.import`]: textureSidecar(2),
    }).load();
    expect([colourMapSpaces(lossless)[0], colourMapSpaces(vram)[0]]).toEqual([
      THREE.NoColorSpace,
      THREE.SRGBColorSpace,
    ]);
  });

  it('reads a greyscale image raw through a second texture, which clones it (edge case)', async () => {
    const json = JSON.parse(
      new TextDecoder().decode(texturedGltf({ name: 'albedo', uri: pngDataUri(png(0)) }))
    ) as Record<string, unknown>;
    Object.assign(json, {
      samplers: [{ magFilter: 9728 }],
      textures: [{ source: 0 }, { source: 0, sampler: 0 }],
    });
    (json['materials'] as { emissiveTexture: { index: number } }[])[0]!.emissiveTexture.index = 1;
    const gltf = new TextEncoder().encode(JSON.stringify(json)).buffer as ArrayBuffer;
    const root = await harness({ [GLTF_PATH]: gltf }).load();
    expect(colourMapSpaces(root)).toEqual([THREE.NoColorSpace, THREE.NoColorSpace]);
  });

  it("records the extracted file's sidecar, so an edit to it reloads the asset", async () => {
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(0)) });
    const { load, dependencies } = harness({ [GLTF_PATH]: gltf });
    await load();
    expect(dependencies.release(`${EXTRACTED_PATH}.import`)).toEqual([{ busType: 'glb', key: GLTF_PATH }]);
  });
});

describe('createGLBProcessor: the texels of a glTF image', () => {
  afterEach(() => {
    decoded.image = null;
  });

  /** An embedded RGBA PNG whose two texels decode to `texels`. */
  async function loadTexels(
    texels: number[][],
    files: Record<string, ArrayBuffer | string> = {}
  ): Promise<THREE.Texture> {
    decoded.image = { data: new Uint8Array(texels.flat()), width: texels.length, height: 1 };
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(6)) });
    const root = await harness({ [GLTF_PATH]: gltf, ...files }).load();
    let map: THREE.Texture | null = null;
    forEachSurfaceMaterial(root, (material) => (map ??= (material as THREE.MeshStandardMaterial).map));
    return map!;
  }

  const bytesOf = (texture: THREE.Texture) => Array.from((texture.image as { data: Uint8Array }).data);

  it('gives a transparent texel its opaque neighbour colour, as the default alpha-border pass does', async () => {
    const map = await loadTexels([
      [200, 100, 50, 255],
      [0, 0, 0, 0],
    ]);
    expect(bytesOf(map)).toEqual([200, 100, 50, 255, 200, 100, 50, 0]);
  });

  it("runs the passes the extracted file's sidecar asks for", async () => {
    const map = await loadTexels([[10, 0, 30, 255]], {
      [`${EXTRACTED_PATH}.import`]: textureSidecar(0, 'process/normal_map_invert_y=true\n'),
    });
    expect(bytesOf(map)).toEqual([10, 255, 30, 255]);
  });

  it("limits the roughness of the chain by the normal map the extracted file's sidecar names", async () => {
    const leaning = [
      [255, 128, 0, 255],
      [0, 128, 0, 255],
    ];
    const map = await loadTexels(leaning, {
      'res://props/bumps.png': png(6).slice().buffer,
      [`${EXTRACTED_PATH}.import`]: textureSidecar(
        0,
        'roughness/mode=2\nroughness/src_normal="res://props/bumps.png"\n'
      ),
    });
    expect(Array.from((map.mipmaps[1] as { data: Uint8Array }).data)).toEqual([163, 128, 0, 255]);
  });

  /** The base colour map of a glTF that names the external RGBA PNG at `EXTERNAL_PATH`. */
  async function loadExternalMap(files: Record<string, string> = {}): Promise<THREE.Texture> {
    decoded.image = { data: new Uint8Array([10, 20, 30, 255]), width: 1, height: 1 };
    const gltf = texturedGltf({ uri: 'textures/grey.png' });
    const root = await harness({
      [GLTF_PATH]: gltf,
      [EXTERNAL_PATH]: png(6).slice().buffer,
      ...files,
    }).load();
    let map: THREE.Texture | null = null;
    forEachSurfaceMaterial(root, (material) => (map ??= (material as THREE.MeshStandardMaterial).map));
    return map!;
  }

  it("samples an external image with no sidecar at its base level, as the file's own import has no mipmaps", async () => {
    const map = await loadExternalMap();
    expect([map.minFilter, map.generateMipmaps]).toEqual([THREE.LinearFilter, false]);
  });

  it('keeps the mip chain of an external image whose own sidecar generates mipmaps', async () => {
    const map = await loadExternalMap({
      [`${EXTERNAL_PATH}.import`]: textureSidecar(0, 'mipmaps/generate=true\n'),
    });
    expect(map.generateMipmaps).toBe(true);
  });

  it('keeps the mip chain Godot gives an extracted image, whatever its sidecar says', async () => {
    const map = await loadTexels([[10, 0, 30, 0]], {
      [`${EXTRACTED_PATH}.import`]: textureSidecar(0, 'mipmaps/generate=false\n'),
    });
    expect(map.generateMipmaps).toBe(true);
  });

  it('imports an image once, however many textures sample it (edge case)', async () => {
    decoded.image = { data: new Uint8Array([0, 0, 0, 0]), width: 1, height: 1 };
    const json = JSON.parse(
      new TextDecoder().decode(texturedGltf({ name: 'albedo', uri: pngDataUri(png(6)) }))
    ) as Record<string, unknown>;
    // A second texture of the same image under its own sampler, which the loader caches apart.
    Object.assign(json, {
      samplers: [{ magFilter: 9728 }],
      textures: [{ source: 0 }, { source: 0, sampler: 0 }],
    });
    (json['materials'] as { emissiveTexture: { index: number } }[])[0]!.emissiveTexture.index = 1;
    const gltf = new TextEncoder().encode(JSON.stringify(json)).buffer as ArrayBuffer;
    const { load, loadResource } = harness({ [GLTF_PATH]: gltf });
    await load();
    const sidecarReads = loadResource.mock.calls.filter(([path]) => path === `${EXTRACTED_PATH}.import`);
    expect(sidecarReads).toHaveLength(1);
  });
});
