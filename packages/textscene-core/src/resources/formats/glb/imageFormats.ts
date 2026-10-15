/**
 * Records on each texture of a loaded glTF the format Godot's importer gives its image, so a
 * colour slot reads it through its sRGB view only when that format has one.
 */

import * as THREE from 'three';
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { gltfTextureImage } from '../../../godot/import/gltf';
import { recordGodotFormat } from '../../textures/sourceColorSpace';
import { forEachSurfaceMaterial } from './surfaceMaterials';

/**
 * The `Image::format_names` entry Godot imports glTF image `index` in, from its `bytes` and the
 * `mimeType` the glTF names. Null when no loader header names one.
 */
export type GltfImageFormat = (
  index: number,
  bytes: Uint8Array,
  mimeType: string | undefined
) => Promise<string | null>;

/**
 * Records the format of each image on every surface texture under `root` that samples it. A
 * texture is matched by its `Source`, which the loader's per-slot clones share.
 */
export async function recordGltfImageFormats(
  parser: GLTFParser,
  root: THREE.Object3D,
  imageFormat: GltfImageFormat
): Promise<void> {
  const formatBySource = await imageFormatsBySource(parser, imageFormat);
  if (formatBySource.size === 0) return;
  forEachSurfaceMaterial(root, (material) => {
    for (const value of Object.values(material)) {
      if (!(value instanceof THREE.Texture)) continue;
      const format = formatBySource.get(value.source);
      if (format !== undefined) recordGodotFormat(value, format);
    }
  });
}

/** The format of each loaded texture's image, by the texture's `Source`. */
async function imageFormatsBySource(
  parser: GLTFParser,
  imageFormat: GltfImageFormat
): Promise<Map<THREE.Texture['source'], string>> {
  const { textures = [], images = [] } = parser.json as {
    textures?: Record<string, unknown>[];
    images?: { bufferView?: number; mimeType?: string }[];
  };
  const formatBySource = new Map<THREE.Texture['source'], string>();
  for (const [textureIndex, definition] of textures.entries()) {
    const imageIndex = gltfTextureImage(definition);
    const image = imageIndex === undefined ? undefined : images[imageIndex];
    // The processor packs every image into a buffer view, so none is named by URI here.
    if (image?.bufferView === undefined) continue;
    const texture = (await parser.getDependency('texture', textureIndex)) as THREE.Texture | null;
    if (!texture) continue;
    const bytes = new Uint8Array((await parser.getDependency('bufferView', image.bufferView)) as ArrayBuffer);
    const format = await imageFormat(imageIndex!, bytes, image.mimeType);
    if (format !== null) formatBySource.set(texture.source, format);
  }
  return formatBySource;
}
