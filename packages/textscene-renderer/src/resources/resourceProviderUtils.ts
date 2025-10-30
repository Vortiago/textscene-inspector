/**
 * Shared utilities for ResourceProvider implementations.
 */

/**
 * Determine if a resource type should be loaded as binary data.
 * Text resources (scenes, scripts) should be loaded as strings.
 * Binary resources (textures, audio) should be loaded as ArrayBuffers.
 */
export function isBinaryResourceType(type: string): boolean {
  const binaryTypes = [
    'Texture2D',
    'CompressedTexture2D',
    'ImageTexture',
    'AudioStream',
    'AudioStreamWAV',
    'AudioStreamOggVorbis',
    'AudioStreamMP3',
    'FontFile',
  ];

  return binaryTypes.includes(type);
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
