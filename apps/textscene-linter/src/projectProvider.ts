/**
 * The CLI's view of a scene's Godot project: the files under the nearest directory holding `project.godot`, read from
 * disk. A scene with none has no `res://` root, so it gets no provider and the cross-file rules stay silent.
 */

import { access, readFile, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { ResourceProvider } from '@textscene/core/linter';
import { findProjectRoot, parentDir, projectFileIn, resolveResPath } from '@textscene/core/resources/resPath';
import { isBinaryResourceType } from '@textscene/core/resources/resourceProviderUtils';

async function probeProjectFile(dir: string): Promise<boolean> {
  try {
    await access(projectFileIn(dir));
    return true;
  } catch {
    // Absent or unreadable: either way this directory is not a project root Godot could open.
    return false;
  }
}

/** `map`'s value for `key`, made by `make` and kept the first time `key` is asked for. */
function memo<V>(map: Map<string, V>, key: string, make: (key: string) => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = make(key);
    map.set(key, value);
  }
  return value;
}

/**
 * Each directory's answer, written by `hasProjectFile` and never cleared: one CLI run lints a tree whose
 * scenes share their ancestors, so each directory is probed once per run, not once per scene.
 */
const projectFileByDir = new Map<string, Promise<boolean>>();

function hasProjectFile(dir: string): Promise<boolean> {
  return memo(projectFileByDir, dir, probeProjectFile);
}

/**
 * A provider over the project at `root`. It returns null for a path outside it or a file it does not hold. Its stamp is
 * the file's modification time and size, one `stat`, so the linter reads an unchanged file once per run.
 */
function fileProvider(root: string): ResourceProvider {
  return {
    async stamp(resPath: string) {
      const file = resolveResPath(root, resPath);
      if (file === null) return null;
      try {
        const { mtimeMs, size } = await stat(file);
        return `${mtimeMs}:${size}`;
      } catch {
        // A file with no stamp is read, and the read answers a missing one with null.
        return null;
      }
    },
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

/**
 * Each project root's provider, written by `projectProviderFor` and never cleared: the linter keeps its glTF verdicts
 * per provider, so one provider per root lets every scene of a run share them.
 */
const providerByRoot = new Map<string, ResourceProvider>();

/** The provider for the project `scenePath` belongs to, or null when no ancestor directory holds `project.godot`. */
export async function projectProviderFor(scenePath: string): Promise<ResourceProvider | null> {
  // No stop directory: the CLI has no workspace to bound the walk, so it climbs to the filesystem root.
  const root = await findProjectRoot(dirname(resolve(scenePath)), parentDir, () => false, hasProjectFile);
  return root === null ? null : memo(providerByRoot, root, fileProvider);
}
