/**
 * The CLI's view of a scene's Godot project: the files under the nearest directory holding `project.godot`, read from
 * disk. A scene with none has no `res://` root, so it gets no provider and the cross-file rules stay silent.
 */

import type { Dirent } from 'fs';
import { access, readFile, readdir, realpath, stat } from 'fs/promises';
import { resolve } from 'path';
import type { ResourceProvider } from '@textscene/core/linter';
import { listScannedFiles, type DirectoryEntry } from '@textscene/core/resources/projectListing';
import { findProjectRoot, parentDir, projectFileIn, resolveResPath } from '@textscene/core/resources/resPath';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';

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

/** Whether `entry`, a directory entry of `directory`, is a directory or a link to one, which the scan follows too. */
async function isDirectoryEntry(directory: string, entry: Dirent): Promise<boolean> {
  if (!entry.isSymbolicLink()) return entry.isDirectory();
  try {
    return (await stat(resolve(directory, entry.name))).isDirectory();
  } catch {
    // A dangling link is no directory, as the scan's own `stat` finds (`dir_access_unix.cpp:167-175`).
    return false;
  }
}

/**
 * A reader of the directories under `root`, for {@link listScannedFiles}. A directory whose real path it has read
 * before, reached again through a link, reads as empty, so a link up the tree ends the walk.
 */
function directoryReader(root: string): (resDirectory: string) => Promise<DirectoryEntry[]> {
  const readRealPaths = new Set<string>();
  return async (resDirectory) => {
    const directory = resolveResPath(root, resDirectory);
    if (directory === null) return [];
    try {
      const real = await realpath(directory);
      if (readRealPaths.has(real)) return [];
      readRealPaths.add(real);
      const entries = await readdir(directory, { withFileTypes: true });
      return Promise.all(
        entries.map(async (entry) => ({
          name: entry.name,
          isDirectory: await isDirectoryEntry(directory, entry),
        }))
      );
    } catch {
      // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
      return [];
    }
  };
}

/**
 * A provider over the project at `root`. It returns null for a path outside it or a file it does not hold. Its stamp is
 * the file's modification time and size, one `stat`, so the linter reads an unchanged file once per run.
 */
function fileProvider(root: string): ResourceProvider {
  /** Each extension's listing, written by `listFiles` and never cleared: one CLI run sees one state of the project. */
  const listings = new Map<string, Promise<string[]>>();
  return {
    listFiles(extension: string) {
      return memo(listings, extension.toLowerCase(), (key) => listScannedFiles(directoryReader(root), key));
    },
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
      return resourceContent(bytes, type, resPath);
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
  // `parentDir`, not `dirname`, for the first step too: every directory of the walk is then spelled with forward
  // slashes, so a Windows root found at the first step and at a later one is one key, and one provider.
  const sceneDir = parentDir(resolve(scenePath));
  if (sceneDir === null) return null;
  // No stop directory: the CLI has no workspace to bound the walk, so it climbs to the filesystem root.
  const root = await findProjectRoot(sceneDir, parentDir, () => false, hasProjectFile);
  return root === null ? null : memo(providerByRoot, root, fileProvider);
}
