/**
 * In-memory projects for the cross-file rule's tests: a provider that reads a map of `res://` paths, with or without
 * the listing the plugin probe needs to rule out a GDExtension.
 */

import type { ResourceProvider } from '../../resources/ResourceProvider.js';

/** A `project.godot` that enables no editor plugin and declares no autoload. */
export const PLAIN_PROJECT_FILE = 'config_version=5\n';

/** A provider that reads `files`, a path it does not hold being missing, and cannot list. */
export function unlistableProject(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

/** {@link unlistableProject}, which also lists `files` by extension in any case, as a host that can list does. */
export function memoryProject(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return {
    ...unlistableProject(files),
    listFiles: async (extension) =>
      Object.keys(files).filter((path) => path.toLowerCase().endsWith(`.${extension.toLowerCase()}`)),
  };
}
