/**
 * The read of the normal map a roughness map's **Import sidecar** names for Godot's roughness
 * limiter, which every image processor shares. Like the sidecar, it is optional: a normal map that
 * is absent or does not decode leaves the chain unlimited, as Godot leaves it.
 */

import type * as THREE from 'three';
import type { DependentRead } from './dependentRead';
import { decodeImagePixels, getMimeType } from '../formats/image/textureProcessing';
import type { ImagePixels } from '../formats/image/imagePixels';
import type { TextureImportOptions } from '../../godot/import/textureImport';
import { RES_SCHEME, resRelativePath } from '../resPath';

/** The read of a roughness map's normal map, under the import `options` its sidecar gives. */
interface RoughnessNormalRead extends DependentRead {
  options: TextureImportOptions;
  /** The loading manager the decode reports to, where the host has one. */
  manager?: THREE.LoadingManager;
}

/**
 * The pixels of the normal map `options` names for the asset's roughness limiter, as Godot's
 * `ImageLoader` decodes the file. Null when the import builds no chain, names no normal map, or the
 * file does not load (`resource_importer_texture.cpp:777-786`).
 */
export async function readRoughnessNormal({
  options,
  assetPath,
  dependent,
  fileEventBus,
  dependencies,
  manager,
}: RoughnessNormalRead): Promise<ImagePixels | null> {
  if (!options.mipmaps || !options.roughnessLimit || !fileEventBus) return null;
  const normalPath = inSchemeOf(assetPath, options.roughnessLimit.normalPath);
  dependencies.record(dependent, normalPath);
  const bytes = await fileEventBus.readOnce(normalPath, 'RoughnessNormal');
  if (!(bytes instanceof ArrayBuffer)) return null;
  try {
    return await decodeImagePixels(bytes, getMimeType(normalPath), manager);
  } catch {
    // `ImageLoader::load_image` failing turns the limiter off, not the import.
    return null;
  }
}

/** `path`, a sidecar's `res://` path, spelled as the host spells `assetPath`. */
function inSchemeOf(assetPath: string, path: string): string {
  if (assetPath.startsWith(RES_SCHEME)) return path;
  return resRelativePath(path) ?? path;
}
