/**
 * Interface for loading external resources from various sources.
 * Apps implement this based on their environment (filesystem, HTTP, upload).
 */

export interface ResourceProvider {
  /**
   * Load a resource by path.
   * @param path - Godot resource path (e.g., "res://scenes/player.tscn")
   * @param type - Optional resource type hint (e.g., "PackedScene", "Texture2D")
   * @returns Resource content as string (text files) or ArrayBuffer (binary files), or null if not found
   */
  loadResource(path: string, type?: string): Promise<string | ArrayBuffer | null>;
}
