/**
 * The project file Godot's glTF importer loads each image of a glTF from, under the default
 * `gltf/embedded_image_handling`, Extract Textures (`editor_scene_importer_gltf.cpp:88`).
 */

import { fileBaseName, validateFilename } from '../string/string.js';
import { dataUriMimeType } from './gltf.js';
import { imageSourceFormat, type ImageSourceFormat } from './imageSourceFormat.js';

/** The members of a glTF `images` entry that name its file. */
export interface GltfImageDefinition {
  uri?: string;
  name?: string;
  mimeType?: string;
}

/** Where an image's texture comes from. */
export interface GltfImageFile {
  /** The URI of an external image, which imports as its own file. Null for an embedded image. */
  uri: string | null;
  /**
   * The file an embedded image is extracted to, beside the glTF (`gltf_document.cpp:2209-2210`).
   * An external image whose URI names no project file is extracted here too.
   */
  extracted: string;
}

/**
 * The extension of an extracted image by its MIME type (`gltf_document.cpp:2153-2158`,
 * `gltf_document_extension_texture_webp.cpp:54-56`), else PNG (`gltf_document.cpp:2210`).
 */
function extractedExtension(mimeType: string | undefined): string {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

/**
 * Each image's file, in `images` order. A name is the image's base name made a valid file name,
 * or its index, with `_<index>` added while it repeats (`gltf_document.cpp:2321-2333`).
 */
export function gltfImageFiles(gltfPath: string, images: readonly GltfImageDefinition[]): GltfImageFile[] {
  const directory = gltfPath.slice(0, gltfPath.lastIndexOf('/') + 1);
  // `append_from_file` sets the file name to the base name, and `set_filename` takes the base name
  // of that for the prefix (`gltf_document.cpp:7161`, `gltf_state.cpp:440-444`).
  const prefix = fileBaseName(fileBaseName(gltfPath));
  const usedNames = new Set<string>();
  return images.map((image, index) => {
    let name = image.name === undefined ? '' : validateFilename(fileBaseName(image.name));
    if (name === '') name = String(index);
    while (usedNames.has(name)) name += `_${index}`;
    usedNames.add(name);

    const isExternal = image.uri !== undefined && !image.uri.startsWith('data:');
    const mimeType = image.mimeType ?? dataUriMimeType(image.uri);
    return {
      uri: isExternal ? image.uri! : null,
      extracted: `${directory}${prefix}_${name}${extractedExtension(mimeType)}`,
    };
  });
}

/**
 * The format Godot's loader gives a glTF image's bytes (`gltf_document.cpp:2138-2177`): by its
 * MIME type, then as a PNG and as a JPEG, for an image whose MIME type is missing or wrong.
 */
export function gltfImageSourceFormat(
  bytes: Uint8Array,
  mimeType: string | undefined
): ImageSourceFormat | null {
  return (
    (mimeType === undefined ? null : imageSourceFormat(bytes, mimeType)) ??
    imageSourceFormat(bytes, 'image/png') ??
    imageSourceFormat(bytes, 'image/jpeg')
  );
}
