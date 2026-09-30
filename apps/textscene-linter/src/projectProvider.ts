/**
 * The CLI's view of a scene's Godot project: the files under the nearest directory holding `project.godot`, read from
 * disk. A scene with none has no `res://` root, so it gets no provider and the cross-file rules stay silent.
 */

import { access, readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { ResourceProvider } from '@textscene/core/linter';
import { findProjectRoot, parentDir, projectFileIn, resolveResPath } from '@textscene/core/resources/resPath';
import { isBinaryResourceType } from '@textscene/core/resources/resourceProviderUtils';

async function hasProjectFile(dir: string): Promise<boolean> {
  try {
    await access(projectFileIn(dir));
    return true;
  } catch {
    // Absent or unreadable: either way this directory is not a project root Godot could open.
    return false;
  }
}

/** A provider over the project at `root`. It returns null for a path outside it or a file it does not hold. */
function fileProvider(root: string): ResourceProvider {
  return {
    async loadResource(resPath: string, type = '') {
      const file = resolveResPath(root, resPath);
      if (file === null) return null;
      let bytes: Buffer;
      try {
        bytes = await readFile(file);
      } catch {
        // A missing dependency is the missing-resource path, which the provider contract spells as null.
        return null;
      }
      if (!isBinaryResourceType(type, resPath)) return bytes.toString('utf-8');
      // A copy, not `bytes.buffer`: Node pools small reads, so that buffer holds other files too.
      return new Uint8Array(bytes).buffer;
    },
  };
}

/** The provider for the project `scenePath` belongs to, or null when no ancestor directory holds `project.godot`. */
export async function projectProviderFor(scenePath: string): Promise<ResourceProvider | null> {
  // No stop directory: the CLI has no workspace to bound the walk, so it climbs to the filesystem root.
  const root = await findProjectRoot(dirname(resolve(scenePath)), parentDir, () => false, hasProjectFile);
  return root === null ? null : fileProvider(root);
}
