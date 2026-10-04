/**
 * The Godot project a document belongs to: the files under the nearest `project.godot`,
 * read from disk. A scene with none has no `res://` root, so it gets no provider and the
 * cross-file rules stay silent. Ported from the linter CLI's provider, so both hosts
 * resolve `res://` the same way.
 */

import type { Dirent } from 'node:fs';
import { access, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ResourceProvider } from '@textscene/core/linter';
import { SCAN_STOP_FILES, isScannedDirectoryName } from '@textscene/core/godot';
import { listScannedFiles, type DirectoryEntry } from '@textscene/core/resources/projectListing';
import { findProjectRoot, parentDir, projectFileIn, resolveResPath } from '@textscene/core/resources/resPath';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';

const ROOT = 'res://';

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
 * Each directory's answer, written by `hasProjectFile` and never cleared: the open documents
 * of a project share their ancestors, so each directory is probed once per server run.
 */
const projectFileByDir = new Map<string, Promise<boolean>>();

function hasProjectFile(dir: string): Promise<boolean> {
  return memo(projectFileByDir, dir, probeProjectFile);
}

/** Whether `entry`, a directory entry of `directory`, is a directory or a link to one. */
async function isDirectoryEntry(directory: string, entry: Dirent): Promise<boolean> {
  if (!entry.isSymbolicLink()) return entry.isDirectory();
  try {
    return (await stat(resolve(directory, entry.name))).isDirectory();
  } catch {
    // A dangling link is no directory.
    return false;
  }
}

/**
 * A reader of the directories under `root`, for {@link listScannedFiles}. A directory whose real
 * path it has read before, reached again through a link, reads as empty, so a link up the tree
 * ends the walk.
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
      // The scan skips a directory it cannot enter.
      return [];
    }
  };
}

/**
 * A provider over the project at `root`. It returns null for a path outside it or a file it
 * does not hold. Its stamp is the file's modification time and size, one `stat`, so the linter
 * reads an unchanged file once.
 */
function fileProvider(root: string): ResourceProvider {
  /** Each extension's listing, written by `listFiles` and never cleared. */
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

/** Each project root's provider, written by `providerForRoot` and never cleared. */
const providerByRoot = new Map<string, ResourceProvider>();

/** The provider for the project rooted at `root`, one per root so its verdicts serve every document. */
export function providerForRoot(root: string): ResourceProvider {
  return memo(providerByRoot, root, fileProvider);
}

/** The nearest directory at or above `dir` that holds `project.godot`, or null. */
export function projectRootForDir(dir: string): Promise<string | null> {
  // No stop directory: the server has no workspace to bound the walk, so it climbs to the filesystem root.
  return findProjectRoot(dir, parentDir, () => false, hasProjectFile);
}

/** The project root of the file at `file`, or null when no ancestor directory holds `project.godot`. */
export function projectRootForFile(file: string): Promise<string | null> {
  // `parentDir`, not `dirname`, so every directory of the walk is spelled with forward slashes.
  const dir = parentDir(resolve(file));
  return dir === null ? Promise.resolve(null) : projectRootForDir(dir);
}

/** The provider for the project `scenePath` belongs to, or null when no ancestor holds `project.godot`. */
export async function projectProviderFor(scenePath: string): Promise<ResourceProvider | null> {
  const root = await projectRootForFile(scenePath);
  return root === null ? null : providerForRoot(root);
}

/** The `res://` path of `file`, which lies under `root`. */
function resPathOf(root: string, file: string): string {
  const relative = normalizeSlashes(file).slice(normalizeSlashes(root).length);
  return `${ROOT}${relative.replace(/^\/+/, '')}`;
}

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, '/');
}

async function isFileEntry(fullPath: string, entry: Dirent): Promise<boolean> {
  if (entry.isFile()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return (await stat(fullPath)).isFile();
  } catch {
    return false;
  }
}

/** Whether `dir` holds a file the scan stops at: another project, or a `.gdignore`. */
async function holdsScanStopFile(dir: string): Promise<boolean> {
  for (const name of SCAN_STOP_FILES) {
    try {
      await access(resolve(dir, name));
      return true;
    } catch {
      // Absent, so it does not stop the scan.
    }
  }
  return false;
}

/**
 * Every file under `root` as a `res://` path, sorted, for path completion. It follows the
 * editor's own scan rules (`godot/editorScan.ts`): a dot-named directory and a directory
 * holding `project.godot` or `.gdignore` are not entered, so no `.godot` cache or nested
 * project is offered. A symlinked directory is not followed, so a link up the tree ends
 * the walk.
 */
async function collectResPaths(root: string): Promise<readonly string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isScannedDirectoryName(entry.name)) continue;
        if (await holdsScanStopFile(fullPath)) continue;
        await walk(fullPath);
      } else if (await isFileEntry(fullPath, entry)) {
        found.push(resPathOf(root, fullPath));
      }
    }
  };
  await walk(root);
  return found.sort();
}

/** Each root's listing, written by `listResPaths` and never cleared: one server run sees one state. */
const listingByRoot = new Map<string, Promise<readonly string[]>>();

/** The `res://` paths of every file under `root`, listed once per root. */
export function listResPaths(root: string): Promise<readonly string[]> {
  return memo(listingByRoot, root, collectResPaths);
}

/** The file `resPath` names under `root`, or null for a path that is not `res://` or escapes the root. */
export function projectFileOf(root: string, resPath: string): string | null {
  return resolveResPath(root, resPath);
}

/** Whether a file exists at `path`. */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
