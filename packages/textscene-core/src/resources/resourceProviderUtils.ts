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
 * The file extension of a path, dot-prefixed and lowercased, or null when the
 * path has none. A dot inside a directory name is not an extension.
 */
function fileExtension(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1 || dot < path.lastIndexOf('/')) return null;
  return path.slice(dot).toLowerCase();
}

/**
 * Whether a resource loads as an ArrayBuffer (images, GLB/GLTF, audio, fonts)
 * rather than a string (scenes, scripts). Type and path are independent: a
 * `PackedScene` at a `.glb` is binary, so a text type never skips the extension check.
 *
 * @param type - Godot resource type (for example "Texture2D", "PackedScene")
 * @param path - Optional resource path to check file extension
 */
export function isBinaryResourceType(type: string, path?: string): boolean {
  if (resourceSliceRegistry.byTypeName(type)?.binaryBytes) return true;
  if (UNOWNED_BINARY_TYPES.includes(type)) return true;

  const extension = path ? fileExtension(path) : null;
  if (!extension) return false;

  return (
    resourceSliceRegistry.byExtension(extension)?.binaryBytes === true ||
    UNOWNED_BINARY_EXTENSIONS.includes(extension)
  );
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
