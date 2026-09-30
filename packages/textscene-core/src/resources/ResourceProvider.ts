/** How a host loads an external resource: filesystem, HTTP or upload. */

export interface ResourceProvider {
  /**
   * @param path - Godot resource path, such as "res://scenes/player.tscn"
   * @param type - Optional resource type hint, such as "PackedScene" or "Texture2D"
   * @returns Resource content as string (text files) or ArrayBuffer (binary files), or null if not found
   */
  loadResource(path: string, type?: string): Promise<string | ArrayBuffer | null>;
  /**
   * A cheap version stamp of the file at `path`, such as its modification time and size, that changes whenever its
   * content does. The linter keeps what it read from a file under it and reads the file again only when it changes.
   * Null for a file the host cannot stamp, which the linter then reads. A provider without it is read every time.
   */
  stamp?(path: string): Promise<string | null>;
}
