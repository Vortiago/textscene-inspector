/**
 * A glTF image reaches a colour slot through its sRGB view only when the format Godot imports it
 * in has one. An embedded image imports as the file Godot extracts it to, so that file's sidecar
 * decides. happy-dom decodes no image, so the texture decode is faked.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';
import { initGlbModules } from '../formats/glb/glbProcessing';
import { forEachSurfaceMaterial } from '../formats/glb/surfaceMaterials';
import { png } from '../formats/image/testing/imageBytes';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  /** Decodes every image to an empty texture at once. */
  class FakeTextureLoader {
    load(_url: string, onLoad: (texture: InstanceType<typeof actual.Texture>) => void): void {
      onLoad(new actual.Texture());
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

const textureSidecar = (mode: number): string =>
  `[remap]\n\nimporter="texture"\n\n[params]\n\ncompress/mode=${mode}\n`;

function harness(files: Record<string, ArrayBuffer | string>) {
  const fileEventBus = new FileEventBus({ loadResource: vi.fn(async (path: string) => files[path] ?? null) });
  const eventBus = new ResourceEventBus();
  const dependencies = new DependencyGraph();
  const processor = createGLBProcessor(fileEventBus, eventBus, dependencies);
  const load = (): Promise<THREE.Object3D> => {
    const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
    processor.request(GLTF_PATH);
    return loaded;
  };
  return { load, dependencies };
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
  beforeAll(async () => {
    await initGlbModules();
  });

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

  it("records the extracted file's sidecar, so an edit to it reloads the asset", async () => {
    const gltf = texturedGltf({ name: 'albedo', uri: pngDataUri(png(0)) });
    const { load, dependencies } = harness({ [GLTF_PATH]: gltf });
    await load();
    expect(dependencies.release(`${EXTRACTED_PATH}.import`)).toEqual([{ busType: 'glb', key: GLTF_PATH }]);
  });
});
