/** How a host loads an external resource: filesystem, HTTP or upload. */

import type { DirectoryEntry } from './projectListing.js';

export interface ResourceProvider {
  /**
   * @param path - Godot resource path, such as "res://scenes/player.tscn"
   * @param type - Optional resource type hint, such as "PackedScene" or "Texture2D"
   * @param maxBytes - Optional cap for a binary file: the caller needs only its first `maxBytes` bytes, so a
   *   host may stop reading there. A host that cannot stop early returns the whole file.
   * @returns Resource content as string (text files) or ArrayBuffer (binary files), or null if not found
   */
  loadResource(path: string, type?: string, maxBytes?: number): Promise<string | ArrayBuffer | null>;
  /**
   * A cheap version stamp of the file at `path`, such as its modification time and size, that changes whenever its
   * content does. The linter keeps what it read from a file under it and reads the file again only when it changes.
   * Null for a file the host cannot stamp, which the linter then reads. A provider without it is read every time.
   */
  stamp?(path: string): Promise<string | null>;
  /**
   * The `res://` path of every project file whose extension is `extension`, in any case, in the directories Godot's
   * editor scan enters (`godot/project/editorScan.ts`). The caller leaves out the data directory, which the project's settings
   * name. Null, like a provider without it, for a host that cannot list the whole project.
   *
   * @param extension - The extension without its dot, such as "gdextension"
   */
  listFiles?(extension: string): Promise<readonly string[] | null>;
  /**
   * The entries of the `res://` folder `folder`, which has no trailing slash (`res://` is the root), or null when the host has
   * no such folder. A provider without it cannot list, and a FileDialog then draws an empty file list.
   */
  listDirectory?(folder: string): Promise<readonly DirectoryEntry[] | null>;
}
