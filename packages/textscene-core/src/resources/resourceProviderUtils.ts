/**
 * Shared utilities for ResourceProvider implementations.
 *
 * The binary question is answered from the resource-slice claim table
 * (ADR-0031), not from a hand-kept list: a slice that declares
 * `binaryBytes: true` says its files must be fetched as bytes, and importing
 * the slice indexes below is what puts those claims in the registry. The
 * indexes are deliberately THREE-free, so a host's provider (the VS Code
 * extension imports this module directly) pulls no renderer.
 */

// The full aggregation barrel rather than the three format slices alone: the
// derivation must see every claim, and a partial import would give this module
// a second, narrower view of the registry than the loader's.
import './sliceRegistrations.js';
import { resourceSliceRegistry } from './sliceRegistration';

/**
 * Binary types no slice owns yet — audio and fonts, which this previewer
 * neither decodes nor renders. Kept verbatim from the list this
 * function used before the registry existed so a provider keeps fetching them
 * as bytes; each moves out of here when its slice lands.
 */
const UNOWNED_BINARY_TYPES: readonly string[] = [
  'AudioStream',
  'AudioStreamWAV',
  'AudioStreamOggVorbis',
  'AudioStreamMP3',
  'FontFile',
];

/** Extensions of the same unowned binary formats. */
const UNOWNED_BINARY_EXTENSIONS: readonly string[] = ['.wav', '.ogg', '.mp3'];

/**
 * The file extension of a path, dot-prefixed and lowercased, or null when the
 * path has none. A dot inside a DIRECTORY name is not an extension.
 */
function fileExtension(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1 || dot < path.lastIndexOf('/')) return null;
  return path.slice(dot).toLowerCase();
}

/**
 * Determine if a resource should be loaded as binary data.
 * Text resources (scenes, scripts) are loaded as strings; binary ones
 * (images, GLB/GLTF, audio, fonts) as ArrayBuffers.
 *
 * Type and path are INDEPENDENT signals: a `PackedScene` pointing at a `.glb`
 * is binary even though the type itself is text, so a claimed-but-text type
 * never short-circuits the extension check.
 *
 * @param type - Godot resource type (e.g., "Texture2D", "PackedScene")
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
