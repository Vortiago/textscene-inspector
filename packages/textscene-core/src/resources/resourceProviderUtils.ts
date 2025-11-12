/**
 * Shared utilities for ResourceProvider implementations.
 */

/**
 * Determine if a resource type should be loaded as binary data.
 * Text resources (scenes, scripts) should be loaded as strings.
 * Binary resources (textures, audio, GLB/GLTF) should be loaded as ArrayBuffers.
 * @param type - Godot resource type (e.g., "Texture2D", "PackedScene")
 * @param path - Optional resource path to check file extension
 */
export function isBinaryResourceType(type: string, path?: string): boolean {
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

  if (binaryTypes.includes(type)) {
    return true;
  }

  // Check for binary file extensions (GLB/GLTF PackedScenes)
  if (path) {
    const ext = path.split('.').pop()?.toLowerCase();
    const binaryExtensions = ['glb', 'gltf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'wav', 'ogg', 'mp3'];
    if (ext && binaryExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
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
