/** How a host loads an external resource: filesystem, HTTP or upload. */

export interface ResourceProvider {
  /**
   * @param path - Godot resource path, such as "res://scenes/player.tscn"
   * @param type - Optional resource type hint, such as "PackedScene" or "Texture2D"
   * @returns Resource content as string (text files) or ArrayBuffer (binary files), or null if not found
   */
  loadResource(path: string, type?: string): Promise<string | ArrayBuffer | null>;
}
