/// <reference types="node" />

/**
 * A scene's `res://` root read from disk, for the Node hosts: the `tscn-lint` CLI and the `tscn-lsp` server. The root
 * is the nearest directory holding `project.godot`, or the scene's own directory when none does and the scene lies
 * inside the host's workspace (`resRootForFile`). Only a Node bundle imports this module, since it reads `node:fs`.
 * An eslint rule keeps every browser bundle away from it.
 */

import type { Dirent } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ResourceProvider } from './ResourceProvider.js';
import { listScannedFiles, type DirectoryEntry } from './projectListing.js';
import {
  findProjectRoot,
  isWithinRoot,
  parentDir,
  pathCaseOf,
  projectFileIn,
  resolveResPath,
} from './resPath.js';
import { resourceContent } from './resourceProviderUtils.js';

/** `map`'s value for `key`, made by `make` and kept the first time `key` is asked for. */
function memo<V>(map: Map<string, V>, key: string, make: (key: string) => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = make(key);
    map.set(key, value);
  }
  return value;
}

/** Whether `path` names a file, not a directory. A file that cannot be read counts as absent. */
export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    // Absent or unreadable: either way there is no file to open.
    return false;
  }
}

/**
 * Each directory's answer, written by `hasProjectFile` and cleared by `forgetDiskState`: the
 * scenes of one run share their ancestors, so each directory is probed once.
 */
const projectFileByDir = new Map<string, Promise<boolean>>();

/** Whether `dir` holds a `project.godot`. An unreadable one is no root Godot could open. */
function hasProjectFile(dir: string): Promise<boolean> {
  return memo(projectFileByDir, dir, (key) => isFile(projectFileIn(key)));
}

/** Whether `entry` of `directory` is a directory or a link to one, since the scan follows a link too. */
async function isDirectoryEntry(directory: string, entry: Dirent): Promise<boolean> {
  if (!entry.isSymbolicLink()) return entry.isDirectory();
  try {
    return (await stat(resolve(directory, entry.name))).isDirectory();
  } catch {
    // A dangling link is no directory, as the scan's own `stat` finds (`dir_access_unix.cpp:167-175`).
    return false;
  }
}

/** The entries of `directory`, each link resolved to what it names. */
async function readEntries(directory: string): Promise<DirectoryEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries.map(async (entry) => ({
      name: entry.name,
      isDirectory: await isDirectoryEntry(directory, entry),
    }))
  );
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
      return await readEntries(directory);
    } catch {
      // The scan skips a directory it cannot enter (`editor_file_system.cpp:1201-1202`).
      return [];
    }
  };
}

/**
 * A provider over the project at `root`. It returns null for a path outside it or a file it does not hold. Its stamp is
 * the file's modification time and size, one `stat`, so the linter reads an unchanged file once.
 */
function fileProvider(root: string): ResourceProvider {
  /** Each extension's listing, written by `listFiles`. It goes with its provider, which `forgetDiskState` drops. */
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
 * Each project root's provider, written by `providerForRoot` and cleared by `forgetDiskState`: the linter keeps its
 * glTF verdicts per provider, so one provider per root lets every scene share them.
 */
const providerByRoot = new Map<string, ResourceProvider>();

/** The provider for the project rooted at `root`. */
export function providerForRoot(root: string): ResourceProvider {
  return memo(providerByRoot, root, fileProvider);
}

/** The nearest directory at or above `dir` that holds `project.godot`, or null. */
export function projectRootForDir(dir: string): Promise<string | null> {
  // No stop directory: a Node host has no workspace to bound the walk, so it climbs to the filesystem root.
  return findProjectRoot(dir, parentDir, () => false, hasProjectFile);
}

/**
 * The directory that holds the file at `file`, or null for a filesystem root. `parentDir`, not `dirname`: every
 * directory of a walk is then spelled with forward slashes, so a Windows root found at the first step and at a later
 * one is one key, and one provider.
 */
function directoryOf(file: string): string | null {
  return parentDir(resolve(file));
}

/**
 * The directory the `res://` paths of the scene at `file` resolve under: its project root, or the scene's own
 * directory when no project holds it and it lies inside `workspace`. Null outside both, since a listing from a loose
 * scene in `/tmp` or the home directory would read every file under it.
 */
export async function resRootForFile(file: string, workspace: string | null): Promise<string | null> {
  const dir = directoryOf(file);
  if (dir === null) return null;
  const project = await projectRootForDir(dir);
  if (project !== null) return project;
  return workspace !== null && isWithinRoot(resolve(workspace), dir, pathCaseOf(process.platform))
    ? dir
    : null;
}

/** The provider for the `res://` root of the scene at `file`, as `resRootForFile` finds it, or null for no root. */
export async function resProviderForFile(
  file: string,
  workspace: string | null
): Promise<ResourceProvider | null> {
  const root = await resRootForFile(file, workspace);
  return root === null ? null : providerForRoot(root);
}

/** Each root's listing, written by `listProjectPaths` and cleared by `forgetDiskState`. */
const pathsByRoot = new Map<string, Promise<readonly string[]>>();

/**
 * The `res://` path of every file the editor's scan reaches under `root`, sorted and listed
 * once per root, for path completion.
 */
export function listProjectPaths(root: string): Promise<readonly string[]> {
  return memo(pathsByRoot, root, async (key) => (await listScannedFiles(directoryReader(key))).sort());
}

/**
 * Drops every answer read from the disk, so the next request reads the project again. A
 * long-running host calls it when a file changes. A single run never needs it.
 */
export function forgetDiskState(): void {
  projectFileByDir.clear();
  providerByRoot.clear();
  pathsByRoot.clear();
}
