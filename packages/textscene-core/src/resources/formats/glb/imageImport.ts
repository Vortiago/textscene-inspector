/**
 * Imports each image of a glTF as Godot's texture importer imports the file it extracts the image
 * to: the texel passes, the mip chain and the format its sidecar asks for.
 */

import type * as THREE from 'three';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { importDecodedImage, type ImageImport } from '../image/textureProcessing';
import { gltfObjects } from '../../../godot/import/gltf';

/**
 * How Godot imports glTF image `index`, from its `bytes` and the `mimeType` the glTF names. Null
 * when Godot loads it as it is.
 */
export type GltfImageImport = (
  index: number,
  bytes: Uint8Array,
  mimeType: string | undefined
) => Promise<ImageImport | null>;

/**
 * A plugin that imports each image source once, as the loader decodes it, so every texture that
 * samples it, through `EXT_texture_webp` too, clones the imported texture. A plugin has no hook per
 * image source, so it wraps the parser's `loadImageSource`, which clones a repeat request too.
 */
export function importingImages(imageImport: GltfImageImport): (parser: GLTFParser) => GLTFLoaderPlugin {
  return (parser) => {
    const loadImageSource = parser.loadImageSource.bind(parser);
    const imported = new Map<number, Promise<THREE.Texture>>();
    parser.loadImageSource = (sourceIndex, loader) => {
      const first = imported.get(sourceIndex);
      if (first) return first.then((texture) => texture.clone());
      const texture = importedImage(parser, sourceIndex, loadImageSource(sourceIndex, loader), imageImport);
      imported.set(sourceIndex, texture);
      return texture;
    };
    return { name: 'textscene_godot_image_import' };
  };
}

async function importedImage(
  parser: GLTFParser,
  sourceIndex: number,
  decoded: Promise<THREE.Texture>,
  imageImport: GltfImageImport
): Promise<THREE.Texture> {
  const texture = await decoded;
  const image = gltfObjects(parser.json.images)[sourceIndex];
  // The processor packs every image into a buffer view, so none is named by URI here.
  if (typeof image?.bufferView !== 'number') return texture;
  const bytes = new Uint8Array((await parser.getDependency('bufferView', image.bufferView)) as ArrayBuffer);
  const mimeType = typeof image.mimeType === 'string' ? image.mimeType : undefined;
  const imageImported = await imageImport(sourceIndex, bytes, mimeType);
  return imageImported ? importDecodedImage(texture, imageImported) : texture;
}
