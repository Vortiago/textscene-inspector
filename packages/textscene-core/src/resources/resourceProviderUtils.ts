/**
 * Shared utilities for ResourceProvider implementations. A slice claiming
 * `binaryBytes: true` (ADR-0031) is fetched as bytes once its index, imported
 * below, registers. The indexes are THREE-free, so a host's provider (the VS
 * Code extension imports this module) pulls no renderer.
 */

// The full aggregation barrel rather than the three format slices alone: the
// derivation must see every claim, and a partial import would give this module
// a second, narrower view of the registry than the loader's.
import './sliceRegistrations.js';
import { resourceSliceRegistry } from './sliceRegistration';
import { fileExtension } from './fileExtension';
import { GODOT_TEXT_RESOURCE_EXTENSIONS, IMPORT_SIDECAR_SUFFIX, PROJECT_FILE_PATH } from '../godot/index.js';

/**
 * Every file extension a scene's resources can have, dotted: the slices' claims, Godot's
 * text resources, and the **Import sidecar** read beside an asset. A host's resource watcher
 * watches these. `project.godot` is not a resource: a host watches it on its own.
 */
export const LOADED_FILE_EXTENSIONS: readonly string[] = [
  ...new Set([
    ...resourceSliceRegistry.all().flatMap((registration) => registration.extensions ?? []),
    ...GODOT_TEXT_RESOURCE_EXTENSIONS,
    IMPORT_SIDECAR_SUFFIX,
  ]),
];

/**
 * Binary types no slice owns: audio, which this previewer neither decodes nor
 * renders, so a provider still fetches them as bytes. Each moves out when its
 * slice lands.
 */
const UNOWNED_BINARY_TYPES: readonly string[] = [
  'AudioStream',
  'AudioStreamWAV',
  'AudioStreamOggVorbis',
  'AudioStreamMP3',
];

/** Extensions of the same unowned binary formats. */
const UNOWNED_BINARY_EXTENSIONS: readonly string[] = ['.wav', '.ogg', '.mp3'];

/**
 * Every file extension a host provider may be asked for: a scene's resources, the
 * project file, and the unowned binary formats it still fetches as bytes. A host's file
 * picker accepts these.
 */
export const PROVIDED_FILE_EXTENSIONS: readonly string[] = [
  ...new Set([...LOADED_FILE_EXTENSIONS, fileExtension(PROJECT_FILE_PATH)!, ...UNOWNED_BINARY_EXTENSIONS]),
];

/**
 * Whether a resource loads as an ArrayBuffer (images, GLB/GLTF, audio, fonts)
 * rather than a string (scenes, scripts). Type and path are independent: a
 * `PackedScene` at a `.glb` is binary, so a text type never skips the extension check.
 *
 * @param type - Godot resource type (for example "Texture2D", "PackedScene"), or
 *   undefined for a load the byte layer makes, which knows only the path
 * @param path - Optional resource path to check file extension
 */
export function isBinaryResourceType(type: string | undefined, path?: string): boolean {
  if (type !== undefined && resourceSliceRegistry.byTypeName(type)?.binaryBytes) return true;
  if (type !== undefined && UNOWNED_BINARY_TYPES.includes(type)) return true;

  const extension = path ? fileExtension(path) : null;
  if (!extension) return false;

  return (
    resourceSliceRegistry.byExtension(extension)?.binaryBytes === true ||
    UNOWNED_BINARY_EXTENSIONS.includes(extension)
  );
}

/**
 * A file's bytes in the shape `loadResource` returns for `type` at `path`: an ArrayBuffer for a binary resource, else
 * UTF-8 text. A view over a whole ArrayBuffer hands that buffer over, so a large `.glb` is not held twice. Any other
 * view is copied, since it can sit inside a larger buffer, such as the pool `readFileSync` reads a small file into.
 */
export function resourceContent(
  bytes: Uint8Array,
  type: string | undefined,
  path: string
): string | ArrayBuffer {
  if (!isBinaryResourceType(type, path)) return new TextDecoder('utf-8').decode(bytes);
  const { buffer } = bytes;
  const spansBuffer =
    buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength;
  return spansBuffer ? buffer : new Uint8Array(bytes).buffer;
}

/**
 * Strip the "res://" prefix from a Godot resource path.
 * @param godotPath - Path with format "res://scenes/Door.tscn"
 * @returns Relative path without "res://" prefix
 */
export function stripResPrefix(godotPath: string): string {
  if (godotPath.startsWith('res://')) {
    return godotPath.substring(6);
  }
  return godotPath;
}
