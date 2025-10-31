/**
 * Interface for loading external resources from various sources.
 * Apps implement this based on their environment (filesystem, HTTP, upload).
 */

export interface ResourceProvider {
  /**
   * Load a resource by path.
   * @param path - Godot resource path (e.g., "res://scenes/player.tscn")
   * @param type - Resource type (e.g., "PackedScene", "Texture2D")
   * @returns Resource content as string (text files) or ArrayBuffer (binary files)
   */
  loadResource(path: string, type: string): Promise<string | ArrayBuffer>;

  /**
   * Check if a resource is available without loading it.
   * Useful for UI hints about missing resources.
   * @param path - Godot resource path
   * @returns true if resource can be loaded
   */
  hasResource?(path: string): boolean;
}
