/** The glTF image importer: each image imported once, and the sampling the loader overwrites restored. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { importingImages, restoreImportedSampling, type GltfImageImport } from './imageImport';
import { DEFAULT_TEXTURE_IMPORT } from '../../../godot/import/textureImport';

/** A parser whose one image lives in a buffer view and decodes to a fresh texture. */
function fakeParser(): GLTFParser {
  return {
    json: { images: [{ bufferView: 0, mimeType: 'image/png' }] },
    loadImageSource: async () => new THREE.Texture(),
    getDependency: async () => new ArrayBuffer(4),
  } as unknown as GLTFParser;
}

/** A root whose one mesh samples `map`, as the loader leaves it: mipmapped again. */
function rootSampling(map: THREE.Texture): THREE.Object3D {
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map }));
}

/** Imports image 0 of a fake glTF under `imageImport`, and returns its texture. */
async function importFirstImage(imageImport: GltfImageImport): Promise<THREE.Texture> {
  const parser = fakeParser();
  importingImages(imageImport)(parser);
  return parser.loadImageSource(0, new THREE.TextureLoader());
}

describe('importingImages', () => {
  it('imports a repeat request for an image source once, as a clone', async () => {
    let imports = 0;
    const parser = fakeParser();
    importingImages(async () => {
      imports++;
      return { source: 'RGBA8', options: DEFAULT_TEXTURE_IMPORT, roughnessNormal: null };
    })(parser);
    const first = await parser.loadImageSource(0, new THREE.TextureLoader());
    const repeat = await parser.loadImageSource(0, new THREE.TextureLoader());
    expect([imports, repeat === first, repeat.source === first.source]).toEqual([1, false, true]);
  });
});

describe('restoreImportedSampling', () => {
  it('drops again the mip chain the loader turns back on for an import without one', async () => {
    const texture = await importFirstImage(async () => ({
      source: 'RGBA8',
      options: DEFAULT_TEXTURE_IMPORT,
      roughnessNormal: null,
    }));
    const map = texture.clone();
    restoreImportedSampling(rootSampling(map));
    expect([map.generateMipmaps, map.minFilter]).toEqual([false, THREE.LinearFilter]);
  });
});
